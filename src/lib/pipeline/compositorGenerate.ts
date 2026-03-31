import Anthropic from "@anthropic-ai/sdk";
import { fal } from "@fal-ai/client";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { createClient } from "pexels";
import { ART_DIRECTOR_SYSTEM_PROMPT, CompositionSchema } from "./compositorSchema";
import type { Composition } from "./compositorSchema";
import type { BrandProfile } from "./classifyBrand";
import { generateFullCreativeBrief } from "./compositorAgents";

// ─── fal.ai client config ────────────────────────────────────────────────────
// FAL_KEY env var is read automatically by the fal client

// ─── JSON repair utility ─────────────────────────────────────────────────────
// Claude sometimes outputs unescaped double-quotes inside JSON string values.
// This scanner walks the JSON character-by-character and escapes bare quotes
// that appear inside string values (not as string delimiters).
function repairJsonQuotes(raw: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        // Opening quote — enter string mode
        inString = true;
        result += ch;
      } else {
        // We're inside a string. Check if this is a legitimate closing quote
        // by looking ahead for the next non-whitespace character.
        // A closing quote should be followed by: , } ] whitespace
        let j = i + 1;
        while (j < raw.length && (raw[j] === ' ' || raw[j] === '\t' || raw[j] === '\n' || raw[j] === '\r')) j++;
        const nextMeaningful = raw[j];
        if (nextMeaningful === ',' || nextMeaningful === '}' || nextMeaningful === ']' || nextMeaningful === ':' || j >= raw.length) {
          // Legitimate closing quote
          inString = false;
          result += ch;
        } else {
          // Unescaped quote inside a string value — replace with a curly quote
          result += '\u201c';
        }
      }
      continue;
    }

    result += ch;
  }

  return result;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreativeBrief {
  audience: string;           // Who this post is speaking to
  emotionalGoal: string;      // The one thing it needs to make them feel
  headline: string;           // The actual headline to use
  subheadline: string;        // Supporting line (can be empty)
  callToAction: string;       // CTA text
  visualDirection: string;    // What the photography/imagery needs to show
  pexelsQuery: string;        // Exact Pexels search query derived from visual direction
  colorTheme: "light" | "dark"; // Social-first theme decision
  layoutStyle: string;        // e.g. "bold typographic split", "full-bleed portrait", "editorial grid"
  keyStats: string[];         // Any statistics to feature (from brand profile)
  keyQuote: string;           // A testimonial or brand quote to feature (can be empty)
}

// ─── Step 0: Generate Creative Brief (delegates to 4-agent pipeline) ─────────
// Kept for backward compatibility with runCompositor.ts.
// The actual work is done by Creative Strategist + Social Copywriter agents.

export async function generateCreativeBrief(
  brandProfile: BrandProfile,
  postTopic: string
): Promise<CreativeBrief> {
  // Delegate to the new 4-agent pipeline
  const fullBrief = await generateFullCreativeBrief(brandProfile, postTopic);

  // Map FullCreativeBrief back to the legacy CreativeBrief shape
  return {
    audience: fullBrief.strategy.targetAudience,
    emotionalGoal: fullBrief.strategy.emotionalRegister,
    headline: fullBrief.copy.headline,
    subheadline: fullBrief.copy.subheadline,
    callToAction: fullBrief.copy.callToAction,
    visualDirection: fullBrief.strategy.visualConcept,
    pexelsQuery: fullBrief.copy.pexelsQuery,
    colorTheme: fullBrief.strategy.colorTheme,
    layoutStyle: fullBrief.copy.layoutStyle,
    keyStats: fullBrief.copy.statHighlight ? [fullBrief.copy.statHighlight] : [],
    keyQuote: fullBrief.copy.testimonialQuote || "",
  };
}

// ─── Step 1: Source hero image (Pexels-first, Flux fallback) ─────────────────

export async function sourceHeroImage(
  brief: CreativeBrief,
  brandProfile: BrandProfile,
  canvasWidth: number,
  canvasHeight: number,
  workDir: string
): Promise<string> {
  const isPortrait = canvasHeight > canvasWidth;
  const heroPath = path.join(workDir, "hero.jpg");

  // ── 1a. Try Pexels first ──────────────────────────────────────────────────
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (pexelsKey) {
    try {
      const pexelsClient = createClient(pexelsKey);
      const orientation = isPortrait ? "portrait" : "square";
      const result = await pexelsClient.photos.search({
        query: brief.pexelsQuery,
        per_page: 10,
        orientation,
      });

      if ("photos" in result && result.photos.length > 0) {
        // Pick the best match — prefer photos with people if the brief calls for them
        const photo = result.photos[0];
        const imageUrl = isPortrait
          ? (photo.src.portrait || photo.src.large2x)
          : (photo.src.large2x || photo.src.large);

        await downloadFile(imageUrl, heroPath);
        console.log(`[compositor] Pexels image sourced: "${brief.pexelsQuery}" → ${photo.photographer} (${photo.url})`);
        return heroPath;
      } else {
        console.log(`[compositor] Pexels returned no results for "${brief.pexelsQuery}" — falling back to Flux`);
      }
    } catch (err) {
      console.log(`[compositor] Pexels failed (${(err as Error).message}) — falling back to Flux`);
    }
  } else {
    console.log("[compositor] No PEXELS_API_KEY — using Flux");
  }

  // ── 1b. Flux fallback — brief-driven prompt ───────────────────────────────
  const fluxPrompt = buildFluxPrompt(brief, brandProfile, isPortrait);
  console.log(`[compositor] Flux prompt: ${fluxPrompt.slice(0, 120)}...`);

  const result = await fal.subscribe("fal-ai/flux-pro/v1.1-ultra", {
    input: {
      prompt: fluxPrompt,
      aspect_ratio: isPortrait ? "4:5" : "1:1",
      output_format: "jpeg",
      safety_tolerance: "2",
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as unknown as { data: { images: Array<{ url: string }> } };

  const imageUrl = result.data.images[0].url;
  await downloadFile(imageUrl, heroPath);
  return heroPath;
}

function buildFluxPrompt(brief: CreativeBrief, brandProfile: BrandProfile, isPortrait: boolean): string {
  const primaryColor = brandProfile.primaryColor ?? "#333333";
  const theme = brief.colorTheme;
  const bgDesc = theme === "dark"
    ? "dark moody background, deep shadows, cinematic lighting"
    : "bright clean background, natural light, airy atmosphere";

  return `${brief.visualDirection}, professional commercial photography,
    ${bgDesc},
    subject positioned in right third of frame with generous negative space on left for text overlay,
    full body or three-quarter shot, ${isPortrait ? "portrait orientation" : "square composition"},
    studio lighting, sharp focus,
    brand color accent: ${primaryColor},
    photorealistic, high quality, social media post photography,
    NOT stock photo generic, NOT corporate clipart`;
}

// ─── Step 2: Segment image into background + subject ────────────────────────

export interface SegmentedImages {
  backgroundPath: string;
  subjectPath: string;
  originalPath: string;
}

export async function segmentHeroImage(
  heroPath: string,
  workDir: string
): Promise<SegmentedImages> {
  // Upload the local file to fal storage first
  const fileBuffer = fs.readFileSync(heroPath);
  const blob = new Blob([fileBuffer], { type: "image/jpeg" });
  const uploadedUrl = await fal.storage.upload(blob);

  // Run birefnet segmentation
  const result = await fal.subscribe("fal-ai/birefnet", {
    input: {
      image_url: uploadedUrl,
      model: "General Use (Light)",
      operating_resolution: "1024x1024",
      output_format: "png",
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as unknown as { data: { image: { url: string } } };

  const subjectUrl = result.data.image.url;
  const subjectPath = path.join(workDir, "subject.png");
  await downloadFile(subjectUrl, subjectPath);

  // The background is the original hero (subject will be composited on top)
  return {
    backgroundPath: heroPath,
    subjectPath,
    originalPath: heroPath,
  };
}

// ─── Step 3: Art Director — generate Composition JSON ───────────────────────

export async function generateComposition(
  brandProfile: BrandProfile,
  segmented: SegmentedImages,
  logoDataUri: string | null,
  canvasWidth: number,
  canvasHeight: number,
  brief: CreativeBrief,
  critiqueIssues?: string[]   // Passed on retry — what the previous attempt got wrong
): Promise<Composition> {
  const client = new Anthropic();

  const retryContext = critiqueIssues && critiqueIssues.length > 0
    ? `\n\nPREVIOUS ATTEMPT FAILED QUALITY REVIEW. Fix ALL of these issues:\n${critiqueIssues.map((i) => `- ${i}`).join("\n")}\n`
    : "";

  // Build design signal context if available
  const ds = brandProfile.designSignal;
  const designSignalContext = ds ? `
## BRAND DESIGN SIGNAL (extracted from their actual website)
Layout pattern: ${ds.layoutPattern}
Visual weight: ${ds.visualWeight}
Card style: ${ds.cardStyle}
CTA style: ${ds.ctaStyle}
Dominant visual type: ${ds.dominantVisualType}
Photography treatment: ${ds.photographyTreatment}
Text overlay style: ${ds.textOverlayStyle}
Density: ${ds.density}
Art Director notes: ${ds.artDirectorNotes}

IMPORTANT: The design signal above describes how this brand actually composes content.
Match this visual system. Do not impose your own design preferences.` : "";

  const userPrompt = `Design a social media post using this creative brief. Keep it simple — maximum 8 layers.

## CREATIVE BRIEF
Audience: ${brief.audience}
Emotional goal: ${brief.emotionalGoal}
Headline: ${brief.headline}
Subheadline: ${brief.subheadline}
Call to action: ${brief.callToAction}
Layout style: ${brief.layoutStyle}
Color theme: ${brief.colorTheme}
${brief.keyStats.length > 0 ? `Key stat to feature: ${brief.keyStats[0]}` : ""}
${brief.keyQuote ? `Quote to feature: ${brief.keyQuote.replace(/"/g, "'")}` : ""}

## BRAND TOKENS
Brand name: ${brandProfile.meta?.brandName ?? "Unknown"}
Primary color: ${brandProfile.primaryColor ?? "#333333"}
Accent color: ${brandProfile.accentColor ?? "#666666"}
Headline font: ${(brandProfile.typography?.headline as Record<string, string | undefined>)?.fontFamily ?? "Inter"} weight ${(brandProfile.typography?.headline as Record<string, string | undefined>)?.fontWeight ?? "700"}
Shape language: ${brandProfile.shapeLanguage?.classification ?? "rounded"}
Color palette (with semantic roles):
${(brandProfile.colorPalette ?? []).slice(0, 4).map((c) => `  ${c.hex}: ${c.contexts.slice(0, 2).join(", ")}`).join("\n")}
${designSignalContext}

## CANVAS
${canvasWidth}x${canvasHeight}px

## AVAILABLE IMAGE SOURCES
- "background": The hero photo (use as full-canvas background layer)
- "subject": The segmented subject with transparent background (use as foreground to create depth)
- "logo": The brand logo${logoDataUri ? " (available)" : " (not available — use brand name as text)"}

## COMPOSITION RULES
1. background image: zIndex 1, full canvas (${canvasWidth}x${canvasHeight}), objectFit cover
2. Text and shape layers: zIndex 2–9
3. subject image: zIndex 10, positioned to overlap text and create depth
4. Logo: zIndex 11, always visible
5. Use the EXACT headline from the creative brief — do not invent new copy
6. Make the headline LARGE — at least ${Math.round(canvasHeight * 0.12)}px
7. Every text layer MUST have maxWidth = (canvasWidth - x - 60) minimum
8. For headlines > 80px, split into multiple layers (one phrase per layer) to control line breaks
9. Logo dimensions: max 160x50px for horizontal logos, 50x50px for icons
10. MAXIMUM 8 layers total${retryContext}

Output ONLY valid JSON. No markdown, no explanation.`;

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 8000,
    system: ART_DIRECTOR_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Art Director");

  let rawJson: unknown;
  try {
    // Strip markdown code fences — Claude sometimes wraps JSON in ```json...``` even when told not to
    let cleaned = content.text
      .replace(/^```(?:json)?\s*/i, "")  // strip opening fence
      .replace(/\s*```\s*$/i, "")        // strip closing fence
      .trim();

    // Attempt 1: parse as-is
    try {
      rawJson = JSON.parse(cleaned);
    } catch {
      // Attempt 2: repair common patterns where Claude puts unescaped double-quotes inside JSON string values.
      // We use a character-by-character scanner to properly handle all cases.
      const repaired = repairJsonQuotes(cleaned);
      rawJson = JSON.parse(repaired);
    }
  } catch (e) {
    // Dump full raw response to disk for debugging
    const debugPath = `/tmp/art-director-raw-${Date.now()}.txt`;
    require("fs").writeFileSync(debugPath, content.text);
    throw new Error(`Art Director returned invalid JSON: ${(e as Error).message}\n\nRaw (first 500): ${content.text.slice(0, 500)}\n\nFull response dumped to: ${debugPath}`);
  }

  const parsed = CompositionSchema.safeParse(rawJson);
  if (!parsed.success) {
    throw new Error(`Composition JSON failed validation: ${JSON.stringify(parsed.error.issues, null, 2)}`);
  }

  return parsed.data;
}

// ─── Step 4: Vision Critique ─────────────────────────────────────────────────

export interface CritiqueResult {
  passed: boolean;
  score: number; // 1-10
  issues: string[];
  corrections: Partial<Composition> | null;
}

export async function critiqueComposition(
  renderedImagePath: string,
  composition: Composition,
  brandProfile: BrandProfile,
  brief: CreativeBrief
): Promise<CritiqueResult> {
  const client = new Anthropic();

  const rawBuffer = fs.readFileSync(renderedImagePath);
  let imageBuffer: Buffer = rawBuffer;
  let mediaType: "image/png" | "image/jpeg" = "image/png";

  // Claude vision API has a 5MB base64 limit. Compress large images to JPEG.
  const MAX_BYTES = 4 * 1024 * 1024;
  if (rawBuffer.length > MAX_BYTES) {
    try {
      const sharp = (await import("sharp")).default;
      const compressed = await sharp(rawBuffer)
        .resize(1080, undefined, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      imageBuffer = Buffer.from(compressed);
      mediaType = "image/jpeg";
    } catch {
      // sharp not available — proceed and let it fail gracefully
    }
  }

  const base64Image = imageBuffer.toString("base64");

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64Image },
        },
        {
          type: "text",
          text: `You are a senior creative director reviewing a social media post for a real brand.
The bar is: would a social media manager at this specific company post this today without any edits?

BRAND: ${brandProfile.meta?.brandName ?? "Unknown"}
INTENDED AUDIENCE: ${brief.audience}
EMOTIONAL GOAL: ${brief.emotionalGoal}
INTENDED HEADLINE: "${brief.headline}"
INTENDED VISUAL: ${brief.visualDirection}

Score this post on ALL of the following:
1. Text legibility — is every word readable at a glance, no clipping, no overflow?
2. Visual hierarchy — does the eye know exactly where to go first, second, third?
3. Brand alignment — does it feel unmistakably like this specific brand made it?
4. Copy accuracy — does the headline match the intended copy? Is the copy on-brand?
5. Photography fit — does the image match the brand's visual language and the intended visual direction?
6. Composition quality — is the layout balanced, intentional, and not cluttered?
7. Overall "would post" quality — would this pass a real social media manager's approval?

A score of 8 or above means: post it today, no changes needed.
A score below 8 means: specific problems exist that must be fixed before posting.
Be honest and specific. Do not give high scores to mediocre work.

Respond with JSON only:
{
  "passed": boolean (true ONLY if score >= 8),
  "score": number (1-10, be rigorous),
  "issues": string[] (specific, actionable problems — be precise about what is wrong and where)
}`,
        },
      ],
    }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected critique response type");

  try {
    // Strip markdown code fences — Claude sometimes wraps JSON in ```json...``` even when told not to
    const cleaned = content.text
      .replace(/^```(?:json)?\s*/i, "")  // strip opening fence
      .replace(/\s*```\s*$/i, "")        // strip closing fence
      .trim();
    const result = JSON.parse(cleaned) as CritiqueResult;
    // Enforce: passed must be false if score < 8
    result.passed = result.score >= 8;
    result.corrections = null;
    return result;
  } catch {
    return { passed: false, score: 1, issues: ["Failed to parse critique response"], corrections: null };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    protocol.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        return downloadFile(response.headers.location!, dest).then(resolve).catch(reject);
      }
      response.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}
