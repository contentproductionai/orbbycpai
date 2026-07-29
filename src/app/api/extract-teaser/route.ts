/**
 * POST /api/extract-teaser
 *
 * No-auth lightweight brand intelligence endpoint for the homepage demo.
 * Runs DOM extraction + brand classification only (no AI perception fan-out).
 * Returns a teaser subset of the full BrandProfile.
 *
 * Rate limited to 3 requests per IP per hour to prevent abuse.
 *
 * Response: { teaserProfile: TeaserProfile }
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { extractDom } from "@/lib/pipeline/runPipeline";
import { classifyBrand } from "@/lib/pipeline/classifyBrand";

export const runtime = "nodejs";
export const maxDuration = 120;

// Simple in-memory rate limiter (resets on server restart, good enough for Railway)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Convert a local image file to a base64 data URI
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

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please sign up for unlimited access." },
      { status: 429 }
    );
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawUrl = (body.url ?? "").trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  try {
    new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const normalizedUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  const workDir = path.join(os.tmpdir(), `orb-teaser-${randomUUID()}`);
  fs.mkdirSync(workDir, { recursive: true });

  try {
    // Emit function (no-op for teaser — we don't stream)
    const noopEmit = (_data: object) => {};

    // DOM extraction
    const raw = await extractDom(normalizedUrl, workDir, noopEmit);
    const rawTyped = raw as Record<string, unknown>;

    // Resolve downloaded assets
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

    // Brand classification
    const profile = await classifyBrand(rawTyped);

    // Return teaser subset only
    const teaserProfile = {
      meta: profile.meta,
      primaryColor: profile.primaryColor,
      accentColor: profile.accentColor,
      colorPalette: profile.colorPalette.slice(0, 5),
      typography: {
        headline: { fontFamily: profile.typography.headline.fontFamily },
        body: { fontFamily: profile.typography.body.fontFamily },
      },
      tone: profile.tone,
      brandArchetype: profile.brandArchetype,
      brandPersonality: profile.brandPersonality,
      industryContext: profile.industryContext,
      shapeLanguage: { classification: profile.shapeLanguage.classification },
      brandAssets: {
        favicon: profile.brandAssets.favicon,
        ogImage: profile.brandAssets.ogImage,
        logoImgs: profile.brandAssets.logoImgs.slice(0, 1),
      },
      productIntelligence: {
        productName: profile.productIntelligence.productName,
        oneLiner: profile.productIntelligence.oneLiner,
        productCategory: profile.productIntelligence.productCategory,
        productType: profile.productIntelligence.productType,
      },
    };

    return NextResponse.json({ teaserProfile });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[extract-teaser] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}
