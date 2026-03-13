/**
 * POST /api/generate
 *
 * Accepts { generationId: string } in the request body.
 * Runs the full generation pipeline (TypeScript-native, no Python subprocesses).
 * Uploads rendered images to Cloudflare R2 and stores public URLs in the database.
 *
 * Brand profile caching:
 *   - Checks the global `brands` table for an existing profile keyed by domain.
 *   - Skips DOM extraction + classification if a fresh profile exists (< 30 days old).
 *   - Auto-re-scrapes if the cached profile is stale (>= 30 days old).
 *   - Upserts the brand record after every scrape.
 *
 * Event types (SSE):
 *   { type: "status",   step: number, total: number, message: string }
 *   { type: "schema",   schemaId: string, schemaName: string }
 *   { type: "image",    schemaId: string, size: string, url: string }
 *   { type: "complete", generationId: string, images: ImageResult[] }
 *   { type: "error",    message: string }
 */
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { generations, subscriptions, brands } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { runFullPipeline, runRenderOnly, type ImageResult } from "@/lib/pipeline/runPipeline";
import { uploadToR2 } from "@/lib/storage/r2";
import { normalizeDomain } from "@/lib/utils/normalizeDomain";
import type { BrandProfile } from "@/lib/pipeline/classifyBrand";

export const runtime = "nodejs";
export const maxDuration = 300;

const BRAND_CACHE_TTL_DAYS = 30;

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
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

  let body: { generationId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { generationId } = body;
  if (!generationId) {
    return new Response(JSON.stringify({ error: "generationId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const workDir = path.join(os.tmpdir(), `orb-generate-${randomUUID()}`);
  fs.mkdirSync(workDir, { recursive: true });

  const encoder = new TextEncoder();
  let streamClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Safe emit — never throws even if stream is closed
      const emit = (data: object) => {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(sse(data)));
        } catch {
          streamClosed = true;
        }
      };

      // Safe close
      const closeStream = () => {
        if (streamClosed) return;
        streamClosed = true;
        try { controller.close(); } catch {}
      };

      // Keepalive ping every 25 seconds to prevent Railway's proxy from
      // closing the SSE connection during long-running pipeline steps
      const keepaliveInterval = setInterval(() => {
        if (streamClosed) {
          clearInterval(keepaliveInterval);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          streamClosed = true;
          clearInterval(keepaliveInterval);
        }
      }, 25000);

      try {
        // Fetch generation row
        const [generation] = await db
          .select()
          .from(generations)
          .where(eq(generations.id, generationId))
          .limit(1);

        if (!generation) {
          emit({ type: "error", message: "Generation not found" });
          closeStream();
          return;
        }

        if (generation.userId !== userId) {
          emit({ type: "error", message: "Unauthorized" });
          closeStream();
          return;
        }

        // Check subscription limit
        const [subscription] = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId))
          .limit(1);

        if (
          subscription &&
          subscription.generationsUsed >= subscription.generationsLimit
        ) {
          emit({
            type: "error",
            message: `Generation limit reached (${subscription.generationsLimit} per period). Please upgrade your plan.`,
          });
          closeStream();
          return;
        }

        // Mark as processing
        await db
          .update(generations)
          .set({ status: "processing", updatedAt: new Date() })
          .where(eq(generations.id, generationId));

        // ── Brand cache lookup ──────────────────────────────────────────────────
        const domain = normalizeDomain(generation.brandUrl);
        const staleCutoff = new Date(Date.now() - BRAND_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

        const [existingBrand] = await db
          .select()
          .from(brands)
          .where(eq(brands.domain, domain))
          .limit(1);

        let brandProfile: BrandProfile;
        let brandId: string;

        const isFresh = existingBrand && existingBrand.scrapedAt > staleCutoff;

        if (isFresh) {
          // Cache hit — use existing brand profile, skip scraping
          console.log(`[generate] Brand cache hit for ${domain} (scraped ${existingBrand.scrapedAt.toISOString()})`);
          emit({ type: "status", step: 1, total: 5, message: "Using cached brand profile..." });
          brandProfile = existingBrand.brandProfile as unknown as BrandProfile;
          brandId = existingBrand.id;

          // Run render-only pipeline (skips extraction + classification)
          const { images: rawImages } = await runRenderOnly(
            brandProfile,
            workDir,
            emit
          );

          await _uploadAndFinalize(rawImages, generationId, brandId, subscription, emit);
        } else {
          // Cache miss or stale — run full pipeline
          if (existingBrand) {
            console.log(`[generate] Brand cache stale for ${domain}, re-scraping...`);
          } else {
            console.log(`[generate] No brand cache for ${domain}, scraping...`);
          }

          const { brandProfile: freshProfile, images: rawImages } = await runFullPipeline(
            generation.brandUrl,
            workDir,
            emit
          );
          brandProfile = freshProfile;

          // Upsert brand record
          const now = new Date();
          const [upsertedBrand] = await db
            .insert(brands)
            .values({
              domain,
              brandUrl: generation.brandUrl,
              brandProfile: brandProfile as unknown as Record<string, unknown>,
              scrapedAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: brands.domain,
              set: {
                brandUrl: generation.brandUrl,
                brandProfile: brandProfile as unknown as Record<string, unknown>,
                scrapedAt: now,
                updatedAt: now,
              },
            })
            .returning({ id: brands.id });

          brandId = upsertedBrand.id;

          await _uploadAndFinalize(rawImages, generationId, brandId, subscription, emit);
        }

        emit({ type: "complete", generationId });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[generate] Pipeline error:", message);
        try {
          await db
            .update(generations)
            .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
            .where(eq(generations.id, generationId));
        } catch {}
        emit({ type: "error", message });
      } finally {
        clearInterval(keepaliveInterval);
        try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
        closeStream();
      }

      // ── Helper: upload images to R2 and finalize generation record ───────────
      async function _uploadAndFinalize(
        rawImages: ImageResult[],
        genId: string,
        brandId: string,
        subscription: { id: string; generationsUsed: number } | undefined,
        emitFn: (data: object) => void
      ) {
        const finalImages: ImageResult[] = [];
        for (const img of rawImages) {
          const key = `generated/${genId}/${img.schemaId}_${img.size}.png`;
          const publicUrl = await uploadToR2(img.filePath, key);
          const finalImg: ImageResult = { ...img, url: publicUrl };
          finalImages.push(finalImg);
          emitFn({ type: "image", schemaId: img.schemaId, size: img.size, url: publicUrl });
        }

        await db
          .update(generations)
          .set({
            status: "complete",
            brandId,
            images: finalImages as unknown as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(eq(generations.id, genId));

        if (subscription) {
          await db
            .update(subscriptions)
            .set({
              generationsUsed: subscription.generationsUsed + 1,
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.id, subscription.id));
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
