/**
 * POST /api/generate
 *
 * Accepts { generationId: string } in the request body.
 * The generationId must reference an existing row in the generations table
 * with status "pending" and a populated brand_profile.
 *
 * Pipeline steps:
 *   1. Check subscription limit (generationsUsed < generationsLimit)
 *   2. Update generation status to "processing"
 *   3. Fetch Pexels photo (schema-dependent)
 *   4. Resolve logo
 *   5. Generate HTML with Claude (per schema, per size)
 *   6. Run guardrail validation (up to 2 retries per schema)
 *   7. Render PNG with Puppeteer (all sizes for this schema)
 *   8. Upload PNGs to Vercel Blob
 *   9. Update generation row with images JSON and status "complete"
 *  10. Increment subscriptions.generations_used
 *
 * Event types (SSE):
 *   { type: "status",   step: number, total: number, message: string }
 *   { type: "schema",   schemaId: string, schemaName: string }
 *   { type: "image",    schemaId: string, size: string, url: string }
 *   { type: "complete", generationId: string, images: ImageResult[] }
 *   { type: "error",    message: string }
 *
 * ImageResult: { schemaId, schemaName, size, url }
 */

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { generations, subscriptions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { put } from "@vercel/blob";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export const runtime = "nodejs";
export const maxDuration = 300;

const PIPELINE_DIR = "/home/ubuntu/orb_pipeline";
const EXTRACTOR_DIR = "/home/ubuntu/orb_brand_extractor";

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ─── Python subprocess helpers ────────────────────────────────────────────────

function runPython(
  script: string,
  args: string[],
  cwd: string,
  env: Record<string, string> = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3.11", [script, ...args], {
      cwd,
      env: { ...process.env, ...env } as NodeJS.ProcessEnv,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code: number) => {
      if (code !== 0) reject(new Error(stderr.slice(0, 600)));
      else resolve(stdout);
    });
    proc.on("error", reject);
  });
}

function runNode(
  script: string,
  args: string[],
  cwd: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", [script, ...args], { cwd });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
    proc.on("close", (code: number) => {
      if (code !== 0) reject(new Error(stderr.slice(0, 600)));
      else resolve(stdout);
    });
    proc.on("error", reject);
  });
}

// ─── Main generation function ─────────────────────────────────────────────────

interface ImageResult {
  schemaId: string;
  schemaName: string;
  size: string;
  url: string;
}

async function runGeneration(
  generationId: string,
  brandProfile: Record<string, unknown>,
  brandUrl: string,
  workDir: string,
  emit: (data: object) => void
): Promise<ImageResult[]> {
  const env: Record<string, string> = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
    PEXELS_API_KEY: process.env.PEXELS_API_KEY || "",
  };

  // Write brand profile to workDir for pipeline scripts
  const profilePath = path.join(workDir, "brand_profile.json");
  fs.writeFileSync(profilePath, JSON.stringify(brandProfile, null, 2));

  // ── Step 1: Select schemas ────────────────────────────────────────────────
  emit({ type: "status", step: 1, total: 5, message: "Selecting content schemas..." });

  const schemasJson = await runPython(
    "-c",
    [
      `
import sys, json
sys.path.insert(0, '${PIPELINE_DIR}')
from schemas import select_schemas
with open('${profilePath}') as f:
    profile = json.load(f)
schemas = select_schemas(profile)
print(json.dumps([{'id': s.id, 'name': s.name, 'sizes': s.sizes, 'requires_photo': s.requires_photo} for s in schemas]))
      `.trim(),
    ],
    PIPELINE_DIR,
    env
  );

  const schemas: Array<{
    id: string;
    name: string;
    sizes: string[];
    requires_photo: boolean;
  }> = JSON.parse(schemasJson.trim());

  // ── Step 2: Fetch Pexels photo (once, shared across schemas that need it) ──
  emit({ type: "status", step: 2, total: 5, message: "Fetching brand-matched photography..." });

  let photoPath: string | null = null;
  const needsPhoto = schemas.some((s) => s.requires_photo);

  if (needsPhoto) {
    const photoScript = `
import sys, json, os
sys.path.insert(0, '${PIPELINE_DIR}')
from pathlib import Path
from run_pipeline import fetch_pexels_photo
with open('${profilePath}') as f:
    profile = json.load(f)
photo = fetch_pexels_photo(profile, Path('${workDir}'))
print(photo)
    `.trim();

    const photoOut = await runPython("-c", [photoScript], PIPELINE_DIR, env);
    photoPath = photoOut.trim().split("\n").pop() || null;
  }

  // ── Step 3: Resolve logo ──────────────────────────────────────────────────
  emit({ type: "status", step: 3, total: 5, message: "Resolving brand logo..." });

  const logoScript = `
import sys, json
sys.path.insert(0, '${PIPELINE_DIR}')
from pathlib import Path
from run_pipeline import resolve_logo
with open('${profilePath}') as f:
    profile = json.load(f)
logo = resolve_logo(profile, Path('${workDir}'))
print(logo or '')
  `.trim();

  const logoOut = await runPython("-c", [logoScript], PIPELINE_DIR, env);
  const logoDataUri = logoOut.trim().split("\n").pop() || null;

  // ── Step 4: Generate HTML + render PNGs per schema ────────────────────────
  emit({ type: "status", step: 4, total: 5, message: `Generating ${schemas.length} content schemas...` });

  const allImages: ImageResult[] = [];

  for (const schema of schemas) {
    emit({ type: "schema", schemaId: schema.id, schemaName: schema.name });

    const schemaPhotoPath = schema.requires_photo ? photoPath : null;

    // Generate HTML with guardrail retry loop (max 2 retries)
    let html: string | null = null;
    let guardrailPassed = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!guardrailPassed && attempts < maxAttempts) {
      attempts++;

      const genScript = `
import sys, json
sys.path.insert(0, '${PIPELINE_DIR}')
from generate_html import generate_html
from schemas import SCHEMA_BY_ID
with open('${profilePath}') as f:
    profile = json.load(f)
schema = SCHEMA_BY_ID.get('${schema.id}')
html = generate_html(
    profile,
    ${schemaPhotoPath ? `'${schemaPhotoPath}'` : "None"},
    logo_data_uri=${logoDataUri ? `'${(logoDataUri as string).slice(0, 50)}...'` : "None"},
    canvas_width=1080,
    canvas_height=1350,
    schema_definition=schema.definition if schema else '',
)
print(html)
      `.trim();

      // For logo we need to pass the full data URI — write it to a temp file
      const logoTempPath = logoDataUri
        ? path.join(workDir, "logo_data_uri.txt")
        : null;
      if (logoDataUri && logoTempPath) {
        fs.writeFileSync(logoTempPath, logoDataUri as string);
      }

      const genScript2 = `
import sys, json
sys.path.insert(0, '${PIPELINE_DIR}')
from generate_html import generate_html
from schemas import SCHEMA_BY_ID
with open('${profilePath}') as f:
    profile = json.load(f)
schema = SCHEMA_BY_ID.get('${schema.id}')
logo_data_uri = None
${logoTempPath ? `
with open('${logoTempPath}') as f:
    logo_data_uri = f.read().strip()
` : ""}
html = generate_html(
    profile,
    ${schemaPhotoPath ? `'${schemaPhotoPath}'` : "None"},
    logo_data_uri=logo_data_uri,
    canvas_width=1080,
    canvas_height=1350,
    schema_definition=schema.definition if schema else '',
)
print(html)
      `.trim();

      const htmlOut = await runPython("-c", [genScript2], PIPELINE_DIR, env);
      html = htmlOut;

      // Save HTML to file
      const htmlPath = path.join(workDir, `post_${schema.id}_attempt${attempts}.html`);
      fs.writeFileSync(htmlPath, html);

      // Run guardrail validation
      const guardScript = `
import sys
sys.path.insert(0, '${PIPELINE_DIR}')
from guardrails import validate_html
import json
with open('${htmlPath}') as f:
    html = f.read()
result = validate_html(html, canvas_width=1080, canvas_height=1350)
print(json.dumps({'passed': result.passed, 'failures': result.failures, 'warnings': result.warnings}))
      `.trim();

      const guardOut = await runPython("-c", [guardScript], PIPELINE_DIR, env);
      const guardResult = JSON.parse(guardOut.trim().split("\n").pop() || "{}");

      if (guardResult.passed) {
        guardrailPassed = true;
        // Save final HTML
        const finalHtmlPath = path.join(workDir, `post_${schema.id}.html`);
        fs.copyFileSync(htmlPath, finalHtmlPath);
      }
      // If not passed, loop will retry
    }

    if (!guardrailPassed || !html) {
      // Skip this schema after max retries
      continue;
    }

    const finalHtmlPath = path.join(workDir, `post_${schema.id}.html`);

    // Render all sizes for this schema
    const sizesToRender = schema.sizes.join(",");
    const renderOut = await runNode(
      path.join(PIPELINE_DIR, "render_sizes.js"),
      [finalHtmlPath, workDir, sizesToRender],
      PIPELINE_DIR
    );

    // Parse render output
    let renderResult: Record<string, string> = {};
    try {
      renderResult = JSON.parse(renderOut.trim().split("\n").pop() || "{}");
    } catch {
      // ignore parse errors
    }

    // Upload each PNG to Vercel Blob
    for (const [size, pngPath] of Object.entries(renderResult)) {
      if (!pngPath || !fs.existsSync(pngPath)) continue;

      const pngBuffer = fs.readFileSync(pngPath);
      const blobName = `generations/${generationId}/${schema.id}_${size}.png`;

      const blob = await put(blobName, pngBuffer, {
        access: "public",
        contentType: "image/png",
      });

      const imageResult: ImageResult = {
        schemaId: schema.id,
        schemaName: schema.name,
        size,
        url: blob.url,
      };

      allImages.push(imageResult);
      emit({ type: "image", ...imageResult });
    }
  }

  return allImages;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { generationId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
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

  const userId = session.user.id;

  // Fetch the generation row
  const [generation] = await db
    .select()
    .from(generations)
    .where(and(eq(generations.id, generationId), eq(generations.userId, userId)))
    .limit(1);

  if (!generation) {
    return new Response(JSON.stringify({ error: "Generation not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (generation.status !== "pending") {
    return new Response(
      JSON.stringify({ error: `Generation is already ${generation.status}` }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  // Check subscription limit
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (subscription) {
    if (subscription.generationsUsed >= subscription.generationsLimit) {
      return new Response(
        JSON.stringify({
          error: "Generation limit reached",
          used: subscription.generationsUsed,
          limit: subscription.generationsLimit,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const workDir = path.join(os.tmpdir(), `orb-gen-${randomUUID()}`);
  fs.mkdirSync(workDir, { recursive: true });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => {
        controller.enqueue(encoder.encode(sse(data)));
      };

      try {
        // Mark as processing
        await db
          .update(generations)
          .set({ status: "processing", updatedAt: new Date() })
          .where(eq(generations.id, generationId));

        const brandProfile = generation.brandProfile as Record<string, unknown>;
        const images = await runGeneration(
          generationId,
          brandProfile,
          generation.brandUrl,
          workDir,
          emit
        );

        emit({ type: "status", step: 5, total: 5, message: "Saving results..." });

        // Update generation row with images and status complete
        await db
          .update(generations)
          .set({
            status: "complete",
            images: images as unknown as Record<string, unknown>,
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

        emit({ type: "complete", generationId, images });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);

        // Mark as failed
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
