/**
 * POST /api/extract
 *
 * Accepts { url: string } in the request body.
 * Runs the brand extraction pipeline (Puppeteer DOM scrape + Claude classification)
 * and streams progress events via SSE.
 *
 * Event types:
 *   { type: "status",   step: number, total: number, message: string }
 *   { type: "complete", generationId: string, brandProfile: BrandProfile }
 *   { type: "error",    message: string }
 */
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { generations } from "@/db/schema";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { extractDom } from "@/lib/pipeline/runPipeline";
import { classifyBrand } from "@/lib/pipeline/classifyBrand";

export const runtime = "nodejs";
export const maxDuration = 120;

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
        // DOM extraction — extractDom.ts emits its own step-numbered status events
        const raw = await extractDom(normalizedUrl, workDir, emit);

        // Resolve downloaded brand assets to base64 data URIs before workDir is deleted
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

        // Convert each downloaded file to a data URI (capped at 500KB)
        const resolvedAssets = downloadedAssets.map((asset) => {
          const dataUri = fileToDataUri(asset.localPath);
          return {
            ...asset,
            localUrl: dataUri || asset.src, // fall back to original src if too large
          };
        }).filter((a) => a.localUrl); // drop any that failed completely

        // Inject resolved assets back into raw before classification
        rawTyped.downloadedAssets = resolvedAssets;

        // Brand classification
        const profile = await classifyBrand(rawTyped);

        // Insert generation row
        const [generation] = await db
          .insert(generations)
          .values({
            userId,
            brandUrl: normalizedUrl,
            brandProfile: profile as unknown as Record<string, unknown>,
            status: "pending",
          })
          .returning({ id: generations.id });

        emit({
          type: "complete",
          generationId: generation.id,
          brandProfile: profile,
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
