/**
 * POST /api/extract
 *
 * Accepts { url: string } in the request body.
 * Runs the brand extraction pipeline (Puppeteer DOM scrape + Claude classification)
 * and streams progress events via SSE.
 *
 * Event types:
 *   { type: "status",   step: number, total: number, message: string }
 *   { type: "token",    field: string, value: string }
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
        // Step 1: DOM extraction
        emit({ type: "status", step: 1, total: 2, message: "Extracting brand signals from website..." });
        const raw = await extractDom(normalizedUrl, workDir, emit);

        // Emit discovered tokens
        const rawTyped = raw as Record<string, unknown>;
        if (rawTyped.brandName) emit({ type: "token", field: "brandName", value: String(rawTyped.brandName) });
        const colors = (rawTyped.colorSamples as Array<{ hex: string }>) ?? [];
        if (colors.length > 0) {
          emit({ type: "token", field: "colors", value: colors.slice(0, 5).map((c) => c.hex).join(", ") });
        }

        // Step 2: Brand classification
        emit({ type: "status", step: 2, total: 2, message: "Classifying brand identity with Claude..." });
        const profile = await classifyBrand(raw);

        // Emit key brand tokens
        emit({ type: "token", field: "brandPersonality", value: profile.brandPersonality });
        emit({ type: "token", field: "tone", value: profile.tone.summary });
        emit({ type: "token", field: "primaryColor", value: profile.primaryColor });
        emit({ type: "token", field: "accentColor", value: profile.accentColor });
        const hlFont = (profile.typography?.headline as Record<string, string | undefined>)?.fontFamily;
        if (hlFont) emit({ type: "token", field: "headlineFont", value: hlFont });
        if (profile.statistics?.length > 0) emit({ type: "token", field: "statistics", value: `${profile.statistics.length} found` });
        if (profile.testimonials?.length > 0) emit({ type: "token", field: "testimonials", value: `${profile.testimonials.length} found` });

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
