/**
 * POST /api/compare
 *
 * Auth-required endpoint for competitor brand comparison.
 * Accepts { primaryUrl: string, competitorUrls: string[] } (max 3 competitors).
 *
 * For each URL:
 *   - Checks if a brand profile exists in the DB (brands table)
 *   - If not, runs the full extraction pipeline
 *   - Returns all profiles + AI-generated USP statements
 *
 * Response: {
 *   comparison: ComparisonResult
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import OpenAI from "openai";
import { extractDom } from "@/lib/pipeline/runPipeline";
import { classifyBrand, type BrandProfile } from "@/lib/pipeline/classifyBrand";
import { fetchAiPerception } from "@/lib/pipeline/fetchAiPerception";

export const runtime = "nodejs";
export const maxDuration = 300;

function fileToDataUri(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    if (buf.length < 1000) return null;
    const ext = path.extname(filePath).toLowerCase().replace(".", "");
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    };
    const mime = mimeMap[ext] || "image/jpeg";
    if (buf.length > 512 * 1024) return null;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function normalizeDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function extractBrandProfile(url: string): Promise<BrandProfile> {
  const workDir = path.join(os.tmpdir(), `orb-compare-${randomUUID()}`);
  fs.mkdirSync(workDir, { recursive: true });
  try {
    const noopEmit = (_data: object) => {};
    const raw = await extractDom(url, workDir, noopEmit);
    const rawTyped = raw as Record<string, unknown>;

    const downloadedAssets = (rawTyped.downloadedAssets as Array<{
      src: string; localPath: string; localUrl: string;
      alt: string; width: number; height: number;
      ext: string; isGif: boolean; inHero: boolean;
    }>) ?? [];

    const resolvedAssets = downloadedAssets.map((asset) => {
      const dataUri = fileToDataUri(asset.localPath);
      return { ...asset, localUrl: dataUri || asset.src };
    }).filter((a) => a.localUrl);

    rawTyped.downloadedAssets = resolvedAssets;
    return await classifyBrand(rawTyped);
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}

async function getOrExtractBrand(url: string): Promise<BrandProfile> {
  const domain = normalizeDomain(url);
  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

  // Check cache (30-day freshness)
  const existing = await db.select().from(brands).where(eq(brands.domain, domain)).limit(1);
  if (existing.length > 0) {
    const brand = existing[0];
    const ageMs = Date.now() - brand.scrapedAt.getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (ageMs < thirtyDaysMs) {
      return brand.brandProfile as unknown as BrandProfile;
    }
  }

  // Extract fresh profile
  const profile = await extractBrandProfile(normalizedUrl);
  const brandName = profile.meta?.brandName || domain;
  const aiPerception = await fetchAiPerception(brandName, normalizedUrl);
  profile.aiPerception = aiPerception;

  // Upsert into brands table
  if (existing.length > 0) {
    await db.update(brands)
      .set({
        brandProfile: profile as unknown as Record<string, unknown>,
        scrapedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(brands.domain, domain));
  } else {
    await db.insert(brands).values({
      domain,
      brandUrl: normalizedUrl,
      brandProfile: profile as unknown as Record<string, unknown>,
    });
  }

  return profile;
}

async function generateUspStatements(
  primaryProfile: BrandProfile,
  competitorProfiles: BrandProfile[]
): Promise<Record<string, string>> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE,
  });

  const primaryName = primaryProfile.meta?.brandName || "Primary Brand";
  const uspStatements: Record<string, string> = {};

  await Promise.all(
    competitorProfiles.map(async (competitor) => {
      const competitorName = competitor.meta?.brandName || "Competitor";
      const prompt = `You are a strategic brand consultant. Compare these two brands and write a 2-3 sentence USP statement explaining why ${primaryName} wins against ${competitorName}.

${primaryName}:
- Positioning: ${primaryProfile.positioningSignal || primaryProfile.productIntelligence?.oneLiner || ""}
- Category: ${(primaryProfile.productIntelligence?.productCategory || []).join(", ")}
- Archetype: ${primaryProfile.brandArchetype?.archetype || ""}
- Target: ${primaryProfile.productIntelligence?.targetCustomers || ""}
- Key features: ${(primaryProfile.productIntelligence?.keyFeatures || []).slice(0, 3).join(", ")}

${competitorName}:
- Positioning: ${competitor.positioningSignal || competitor.productIntelligence?.oneLiner || ""}
- Category: ${(competitor.productIntelligence?.productCategory || []).join(", ")}
- Archetype: ${competitor.brandArchetype?.archetype || ""}
- Target: ${competitor.productIntelligence?.targetCustomers || ""}
- Key features: ${(competitor.productIntelligence?.keyFeatures || []).slice(0, 3).join(", ")}

Write a 2-3 sentence "Why ${primaryName} wins" statement that is specific, honest, and compelling. Focus on genuine differentiation, not generic claims. Return only the statement text, no labels or formatting.`;

      try {
        const response = await client.chat.completions.create({
          model: "gpt-5-mini",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.4,
        });
        const competitorDomain = normalizeDomain(competitor.meta?.url || "");
        uspStatements[competitorDomain] = response.choices[0]?.message?.content?.trim() || "No USP data available.";
      } catch {
        const competitorDomain = normalizeDomain(competitor.meta?.url || "");
        uspStatements[competitorDomain] = "USP analysis unavailable.";
      }
    })
  );

  return uspStatements;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { primaryUrl?: string; competitorUrls?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { primaryUrl, competitorUrls = [] } = body;
  if (!primaryUrl) {
    return NextResponse.json({ error: "primaryUrl is required" }, { status: 400 });
  }
  if (competitorUrls.length > 3) {
    return NextResponse.json({ error: "Maximum 3 competitor URLs allowed" }, { status: 400 });
  }

  try {
    // Extract all brand profiles in parallel
    const allUrls = [primaryUrl, ...competitorUrls];
    const profiles = await Promise.all(allUrls.map((url) => getOrExtractBrand(url)));

    const [primaryProfile, ...competitorProfiles] = profiles;

    // Generate USP statements
    const uspStatements = competitorProfiles.length > 0
      ? await generateUspStatements(primaryProfile, competitorProfiles)
      : {};

    return NextResponse.json({
      comparison: {
        primary: primaryProfile,
        competitors: competitorProfiles,
        uspStatements,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[compare] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
