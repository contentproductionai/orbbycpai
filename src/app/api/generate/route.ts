/**
 * POST /api/generate
 *
 * Accepts { generationId: string } in the request body.
 * Runs the full generation pipeline (TypeScript-native, no Python subprocesses).
 * Stores images on the Railway server filesystem under /public/generated/.
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
import { generations, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { runFullPipeline, type ImageResult } from "@/lib/pipeline/runPipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function storeImage(
  filePath: string,
  generationId: string,
  schemaId: string,
  size: string
): string {
  const publicDir = path.join(process.cwd(), "public", "generated", generationId);
  fs.mkdirSync(publicDir, { recursive: true });
  const filename = `${schemaId}_${size}.png`;
  fs.copyFileSync(filePath, path.join(publicDir, filename));
  return `/generated/${generationId}/${filename}`;
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
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => {
        controller.enqueue(encoder.encode(sse(data)));
      };

      try {
        // Fetch generation row
        const [generation] = await db
          .select()
          .from(generations)
          .where(eq(generations.id, generationId))
          .limit(1);

        if (!generation) {
          emit({ type: "error", message: "Generation not found" });
          controller.close();
          return;
        }

        if (generation.userId !== userId) {
          emit({ type: "error", message: "Unauthorized" });
          controller.close();
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
          controller.close();
          return;
        }

        // Mark as processing
        await db
          .update(generations)
          .set({ status: "processing", updatedAt: new Date() })
          .where(eq(generations.id, generationId));

        // Run the full pipeline
        const { images: rawImages } = await runFullPipeline(
          generation.brandUrl,
          workDir,
          emit
        );

        // Copy images to public dir and build final results
        const finalImages: ImageResult[] = [];
        for (const img of rawImages) {
          const publicUrl = storeImage(img.filePath, generationId, img.schemaId, img.size);
          const finalImg: ImageResult = { ...img, url: publicUrl };
          finalImages.push(finalImg);
          emit({ type: "image", schemaId: img.schemaId, size: img.size, url: publicUrl });
        }

        // Update generation row
        await db
          .update(generations)
          .set({
            status: "complete",
            images: finalImages as unknown as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(eq(generations.id, generationId));

        // Increment generations_used
        if (subscription) {
          await db
            .update(subscriptions)
            .set({
              generationsUsed: subscription.generationsUsed + 1,
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.userId, userId));
        }

        emit({ type: "complete", generationId, images: finalImages });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        try {
          await db
            .update(generations)
            .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
            .where(eq(generations.id, generationId));
        } catch {}
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
