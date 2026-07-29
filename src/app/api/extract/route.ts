/**
 * POST /api/extract
 *
 * Accepts { url: string } in the request body.
 * Runs the full brand intelligence pipeline with freemium enforcement:
 *
 *   Free tier (no paid plan):
 *     Run 1:    Full report — Brand Report + AI Perception (all 3 models)
 *     Runs 2-5: Partial report — Brand Report only (AI Perception skipped)
 *     Run 6+:   Blocked — returns 402 with upgrade prompt
 *
 *   Paid tiers: Unlimited full reports
 *
 * Streams progress events via SSE.
 *
 * Event types:
 *   { type: "status",   step: number, total: number, message: string }
 *   { type: "complete", generationId: string, brandProfile: BrandProfile, accessTier: "full" | "partial" }
 *   { type: "error",    message: string }
 */
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { generations, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { extractDom } from "@/lib/pipeline/runPipeline";
import { classifyBrand } from "@/lib/pipeline/classifyBrand";
import { fetchAiPerception } from "@/lib/pipeline/fetchAiPerception";

export const runtime = "nodejs";
export const maxDuration = 180;

// ─── Free tier limits ─────────────────────────────────────────────────────────
const FREE_FULL_RUNS = 1;   // First run: full report including AI Perception
const FREE_TOTAL_RUNS = 5;  // Runs 2-5: partial (Brand Report only). Run 6+: blocked.

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// Convert a local image file to a base64 data URI so it survives workDir cleanup
function fileToDataUri(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    if (buf.length < 1000) return null; // skip empty/corrupt files
    const ext = path.extname(filePath).toLowerCase().replace(".", "");
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    };
    const mime = mimeMap[ext] || "image/jpeg";
    // Cap at 500KB per image to keep the DB row manageable
    if (buf.length > 512 * 1024) return null;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Get or create a subscription row for the user. Returns the current usage state. */
async function getUserSubscription(userId: string) {
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  // First time — create a free subscription row
  const [created] = await db
    .insert(subscriptions)
    .values({
      userId,
      tier: "free",
      status: "active",
      generationsUsed: 0,
      generationsLimit: FREE_TOTAL_RUNS,
    })
    .returning();
  return created;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawUrl = (body.url ?? "").trim();
  if (!rawUrl) {
    return new Response(JSON.stringify({ error: "url is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ─── Freemium check ───────────────────────────────────────────────────────
  const sub = await getUserSubscription(userId);
  const isPaid = sub.tier !== "free";
  const runsUsed = sub.generationsUsed ?? 0;

  // Paid users: unlimited. Free users: block at run 6+
  if (!isPaid && runsUsed >= FREE_TOTAL_RUNS) {
    return new Response(
      JSON.stringify({
        error: "upgrade_required",
        message: `You've used all ${FREE_TOTAL_RUNS} free analyses. Upgrade to Starter for unlimited full reports.`,
        runsUsed,
        limit: FREE_TOTAL_RUNS,
      }),
      { status: 402, headers: { "Content-Type": "application/json" } }
    );
  }

  // Determine access tier for this run
  // Run 1 (index 0) = full. Runs 2-5 (index 1-4) = partial.
  const accessTier: "full" | "partial" =
    isPaid || runsUsed < FREE_FULL_RUNS ? "full" : "partial";

  const normalizedUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  const workDir = path.join(os.tmpdir(), `orb-extract-${randomUUID()}`);
  fs.mkdirSync(workDir, { recursive: true });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => {
        controller.enqueue(encoder.encode(sse(data)));
      };

      try {
        // Steps 1-5: DOM extraction
        const raw = await extractDom(normalizedUrl, workDir, emit);

        const rawTyped = raw as Record<string, unknown>;
        const downloadedAssets = (rawTyped.downloadedAssets as Array<{
          src: string;
          localPath: string;
          localUrl: string;
          alt: string;
          width: number;
          height: number;
          ext: string;
          isGif: boolean;
          inHero: boolean;
        }>) ?? [];

        const resolvedAssets = downloadedAssets.map((asset) => {
          const dataUri = fileToDataUri(asset.localPath);
          return { ...asset, localUrl: dataUri || asset.src };
        }).filter((a) => a.localUrl);

        rawTyped.downloadedAssets = resolvedAssets;

        // Step 6: Brand classification
        const totalSteps = accessTier === "full" ? 8 : 7;
        emit({ type: "status", step: 6, total: totalSteps, message: "Classifying brand identity and archetype..." });
        const profile = await classifyBrand(rawTyped);

        // Step 7: AI Perception (full tier only)
        if (accessTier === "full") {
          emit({ type: "status", step: 7, total: 8, message: "Querying AI models for brand perception..." });
          const brandName = profile.meta?.brandName || new URL(normalizedUrl).hostname;
          const copyText = rawTyped.copyText as { h1?: string[]; h2?: string[]; bodyParagraphs?: string[] } | undefined;
          const bodySnippet = (rawTyped.bodySnippet as string | undefined) ?? "";
          const scrapedContext = [
            copyText?.h1?.join(" | "),
            copyText?.h2?.slice(0, 4).join(" | "),
            copyText?.bodyParagraphs?.slice(0, 3).join(" "),
            bodySnippet.slice(0, 800),
          ].filter(Boolean).join("\n").slice(0, 2000);
          const aiPerception = await fetchAiPerception(brandName, normalizedUrl, scrapedContext || undefined);
          profile.aiPerception = aiPerception;
        } else {
          // Partial tier: mark AI perception as locked so the UI can show the gate
          profile.aiPerception = undefined;
        }

        // Step 7 (partial) / Step 8 (full): Save to database
        emit({ type: "status", step: totalSteps, total: totalSteps, message: "Saving intelligence report..." });

        const [generation] = await db
          .insert(generations)
          .values({
            userId,
            brandUrl: normalizedUrl,
            brandProfile: profile as unknown as Record<string, unknown>,
            status: "complete",
          })
          .returning({ id: generations.id });

        // Increment usage counter
        await db
          .update(subscriptions)
          .set({ generationsUsed: runsUsed + 1, updatedAt: new Date() })
          .where(eq(subscriptions.userId, userId));

        emit({
          type: "complete",
          generationId: generation.id,
          brandProfile: profile,
          accessTier,
          runsUsed: runsUsed + 1,
          runsRemaining: isPaid ? null : Math.max(0, FREE_TOTAL_RUNS - (runsUsed + 1)),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        emit({ type: "error", message });
      } finally {
        try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
