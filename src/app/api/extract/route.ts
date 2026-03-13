/**
 * POST /api/extract
 *
 * Accepts { url: string } in the request body.
 * Runs the brand extractor pipeline (extract_dom.js → classify_brand.py)
 * and streams results back as Server-Sent Events (SSE).
 *
 * Event types:
 *   { type: "status",   message: string }
 *   { type: "color",    hex: string, contexts: string[], count: number }
 *   { type: "font",     family: string, weight: string, role: string }
 *   { type: "tone",     directness: string, formality: string, emotionality: string, summary: string }
 *   { type: "photo",    style: string, subject: string }
 *   { type: "complete", generationId: string, brandProfile: object }
 *   { type: "error",    message: string }
 *
 * On completion, a new row is inserted into the generations table with
 * status "pending" and the full brand_profile stored.
 */

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { generations } from "@/db/schema";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export const runtime = "nodejs";
export const maxDuration = 120;

const EXTRACTOR_DIR = "/home/ubuntu/orb_brand_extractor";
const PIPELINE_DIR = "/home/ubuntu/orb_pipeline";

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function runExtraction(
  url: string,
  workDir: string,
  emit: (data: object) => void
): Promise<object> {
  // Step 1: DOM extraction
  emit({ type: "status", message: "Extracting brand signals from website..." });

  const extractScript = path.join(EXTRACTOR_DIR, "extract_dom.js");
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("node", [extractScript, url], {
      cwd: EXTRACTOR_DIR,
      env: { ...process.env },
    });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code: number) => {
      if (code !== 0) reject(new Error(`DOM extraction failed: ${stderr.slice(0, 400)}`));
      else resolve();
    });
    proc.on("error", reject);
  });

  emit({ type: "status", message: "Analyzing brand identity with AI..." });

  // Step 2: LLM classification
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("python3.11", ["classify_brand.py"], {
      cwd: EXTRACTOR_DIR,
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
      },
    });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code: number) => {
      if (code !== 0) reject(new Error(`Classification failed: ${stderr.slice(0, 400)}`));
      else resolve();
    });
    proc.on("error", reject);
  });

  // Read the brand profile
  const profilePath = path.join(EXTRACTOR_DIR, "brand_profile.json");
  const profile = JSON.parse(fs.readFileSync(profilePath, "utf-8"));

  // Copy outputs to workDir
  for (const fname of ["raw_dom_data.json", "brand_profile.json", "screenshot.png"]) {
    const src = path.join(EXTRACTOR_DIR, fname);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(workDir, fname));
    }
  }

  // Stream individual brand tokens as events
  const palette: Array<{ hex: string; contexts: string[]; count: number }> =
    profile.colorPalette || [];
  for (const color of palette.slice(0, 6)) {
    emit({
      type: "color",
      hex: color.hex,
      contexts: color.contexts || [],
      count: color.count || 1,
    });
  }

  const typo = profile.typography || {};
  if (typo.headline?.fontFamily) {
    emit({
      type: "font",
      family: typo.headline.fontFamily,
      weight: typo.headline.fontWeight || "700",
      role: "headline",
    });
  }
  if (typo.body?.fontFamily && typo.body.fontFamily !== typo.headline?.fontFamily) {
    emit({
      type: "font",
      family: typo.body.fontFamily,
      weight: typo.body.fontWeight || "400",
      role: "body",
    });
  }

  const tone = profile.tone || {};
  emit({
    type: "tone",
    directness: tone.directness || "",
    formality: tone.formality || "",
    emotionality: tone.emotionality || "",
    summary: tone.summary || "",
  });

  const photo = profile.photography || {};
  emit({
    type: "photo",
    style: photo.style || "",
    subject: photo.subject || "",
  });

  return profile;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
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
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { url } = body;
  if (!url || typeof url !== "string") {
    return new Response(JSON.stringify({ error: "url is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate URL
  try {
    new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
  const workDir = path.join(os.tmpdir(), `orb-extract-${randomUUID()}`);
  fs.mkdirSync(workDir, { recursive: true });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => {
        controller.enqueue(encoder.encode(sse(data)));
      };

      try {
        const profile = await runExtraction(normalizedUrl, workDir, emit);

        // Insert a new generation row with status "pending"
        const [generation] = await db
          .insert(generations)
          .values({
            userId: userId,
            brandUrl: normalizedUrl,
            brandProfile: profile as Record<string, unknown>,
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
        // Clean up temp dir
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
