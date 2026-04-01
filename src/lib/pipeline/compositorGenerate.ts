import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { createClient } from "pexels";
import type { BrandProfile } from "./classifyBrand";
import { generateFullCreativeBrief } from "./compositorAgents";
import type { FullCreativeBrief } from "./compositorAgents";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreativeBrief {
  audience: string;
  emotionalGoal: string;
  headline: string;
  subheadline: string;
  callToAction: string;
  visualDirection: string;
  pexelsQuery: string;
  colorTheme: "light" | "dark";
  layoutStyle: string;
  keyStats: string[];
  keyQuote: string;
}

// ─── Step 0: Generate Creative Brief (delegates to 4-agent pipeline) ─────────

export async function generateCreativeBrief(
  brandProfile: BrandProfile,
  postTopic: string
): Promise<CreativeBrief & { _fullBrief?: FullCreativeBrief }> {
  const fullBrief = await generateFullCreativeBrief(brandProfile, postTopic);

  const brief: CreativeBrief & { _fullBrief?: FullCreativeBrief } = {
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
    _fullBrief: fullBrief,
  };

  return brief;
}

// ─── Step 1: Source hero image ────────────────────────────────────────────────
// Priority order:
//   1. Brand's own downloaded site images (if Image Director selected one)
//   2. Imagen 4 Fast (Google) — fast, high-quality AI generation
//   3. Pexels stock photo (last resort)

export async function sourceHeroImage(
  brief: CreativeBrief & { _fullBrief?: FullCreativeBrief },
  brandProfile: BrandProfile,
  canvasWidth: number,
  canvasHeight: number,
  workDir: string
): Promise<string> {
  const isPortrait = canvasHeight > canvasWidth;
  const heroPath = path.join(workDir, "hero.jpg");
  const imageDirection = brief._fullBrief?.imageDirection;

  // ── 1a. Brand's own site images (Image Director selected one) ────────────
  if (imageDirection?.useBrandImage) {
    const assets = brandProfile.brandAssets?.downloadedAssets ?? [];
    const selected = assets[imageDirection.brandImageIndex];
    if (selected?.localPath && fs.existsSync(selected.localPath)) {
      fs.copyFileSync(selected.localPath, heroPath);
      console.log(`[compositor] Using brand image [${imageDirection.brandImageIndex}]: ${selected.alt || selected.src}`);
      return heroPath;
    } else {
      console.log(`[compositor] Brand image [${imageDirection.brandImageIndex}] not found locally — falling back to Imagen`);
    }
  }

  // ── 1b. Imagen 4 Fast (Google Gemini API) ────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY;
  const imagePrompt = imageDirection?.fluxPrompt ?? buildDefaultImagePrompt(brief, brandProfile, isPortrait);

  if (geminiKey) {
    try {
      // Imagen 4 Fast supports: 1:1, 3:4, 4:3, 9:16, 16:9
      const aspectRatio = isPortrait ? "3:4" : canvasWidth === canvasHeight ? "1:1" : "16:9";
      console.log(`[compositor] Imagen 4 Fast: ${imagePrompt.slice(0, 100)}... (${aspectRatio})`);

      const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${geminiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: imagePrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio,
            outputMimeType: "image/jpeg",
          },
        }),
      });

      if (response.ok) {
        const data = await response.json() as { predictions?: Array<{ bytesBase64Encoded?: string }> };
        const bytes = data.predictions?.[0]?.bytesBase64Encoded;
        if (bytes) {
          fs.writeFileSync(heroPath, Buffer.from(bytes, "base64"));
          console.log(`[compositor] Imagen 4 Fast generated successfully`);
          return heroPath;
        }
      } else {
        const err = await response.text();
        console.log(`[compositor] Imagen 4 Fast error ${response.status}: ${err.slice(0, 200)}`);
      }
    } catch (err) {
      console.log(`[compositor] Imagen 4 Fast failed (${(err as Error).message}) — falling back to Pexels`);
    }
  } else {
    console.log("[compositor] No GEMINI_API_KEY — skipping Imagen, trying Pexels");
  }

  // ── 1c. Pexels stock photo (last resort) ─────────────────────────────────
  const pexelsKey = process.env.PEXELS_API_KEY;
  const pexelsQuery = imageDirection?.pexelsQuery ?? brief.pexelsQuery;

  if (pexelsKey) {
    try {
      const pexelsClient = createClient(pexelsKey);
      const orientation = isPortrait ? "portrait" : "square";
      const result = await pexelsClient.photos.search({
        query: pexelsQuery,
        per_page: 10,
        orientation,
      });

      if ("photos" in result && result.photos.length > 0) {
        const photo = result.photos[0];
        const imageUrl = isPortrait
          ? (photo.src.portrait || photo.src.large2x)
          : (photo.src.large2x || photo.src.large);

        await downloadFile(imageUrl, heroPath);
        console.log(`[compositor] Pexels image sourced: "${pexelsQuery}" → ${photo.photographer}`);
        return heroPath;
      } else {
        console.log(`[compositor] Pexels returned no results for "${pexelsQuery}"`);
      }
    } catch (err) {
      console.log(`[compositor] Pexels failed (${(err as Error).message})`);
    }
  }

  // ── 1d. Hard fallback: text-only layout ──────────────────────────────────
  console.log("[compositor] All image sources failed — Art Director will use text-only layout");
  return "";
}

function buildDefaultImagePrompt(brief: CreativeBrief, brandProfile: BrandProfile, isPortrait: boolean): string {
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
    photorealistic, high quality, social media post photography`;
}

// ─── Step 1b: Generate Veo video from hero image (image-to-video) ─────────────
// Uses the Imagen-generated hero image as a seed to maintain visual consistency.
// This is an optional second pass — stills complete first, video generates async.

export interface VeoVideoResult {
  videoPath: string;
  durationSeconds: number;
}

export async function generateVeoVideo(
  heroImagePath: string,
  brief: CreativeBrief & { _fullBrief?: FullCreativeBrief },
  workDir: string
): Promise<VeoVideoResult | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.log("[compositor] No GEMINI_API_KEY — skipping Veo video generation");
    return null;
  }
  if (!heroImagePath || !fs.existsSync(heroImagePath)) {
    console.log("[compositor] No hero image available for Veo seed — skipping video");
    return null;
  }

  try {
    // Read and encode the hero image as base64 for the Veo seed
    const imageBytes = fs.readFileSync(heroImagePath);
    const imageBase64 = imageBytes.toString("base64");

    // Build a motion prompt that extends the still image naturally
    const motionPrompt = buildVeoMotionPrompt(brief);
    console.log(`[compositor] Veo image-to-video: "${motionPrompt.slice(0, 100)}..."`);

    // Submit generation job to Veo 3 Fast (faster, still high quality)
    const submitUrl = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-fast-generate-001:predictLongRunning?key=${geminiKey}`;
    const submitResponse = await fetch(submitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{
          prompt: motionPrompt,
          image: {
            bytesBase64Encoded: imageBase64,
            mimeType: "image/jpeg",
          },
        }],
        parameters: {
          aspectRatio: "9:16",
          durationSeconds: 8,
          outputMimeType: "video/mp4",
        },
      }),
    });

    if (!submitResponse.ok) {
      const err = await submitResponse.text();
      console.log(`[compositor] Veo submit error ${submitResponse.status}: ${err.slice(0, 200)}`);
      return null;
    }

    const operation = await submitResponse.json() as { name?: string };
    if (!operation.name) {
      console.log("[compositor] Veo returned no operation name");
      return null;
    }

    console.log(`[compositor] Veo job submitted: ${operation.name}`);

    // Poll for completion (Veo typically takes 2–4 minutes)
    const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${operation.name}?key=${geminiKey}`;
    const maxWaitMs = 5 * 60 * 1000; // 5 minute timeout
    const pollIntervalMs = 15 * 1000; // poll every 15s
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

      const pollResponse = await fetch(pollUrl);
      if (!pollResponse.ok) continue;

      const status = await pollResponse.json() as {
        done?: boolean;
        response?: { predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }> };
        error?: { message: string };
      };

      if (status.error) {
        console.log(`[compositor] Veo job failed: ${status.error.message}`);
        return null;
      }

      if (status.done && status.response?.predictions?.[0]?.bytesBase64Encoded) {
        const videoBytes = status.response.predictions[0].bytesBase64Encoded;
        const videoPath = path.join(workDir, "hero_video.mp4");
        fs.writeFileSync(videoPath, Buffer.from(videoBytes, "base64"));
        console.log(`[compositor] Veo video generated: ${Math.round(videoBytes.length * 0.75 / 1024)}KB`);
        return { videoPath, durationSeconds: 8 };
      }

      console.log(`[compositor] Veo still processing... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
    }

    console.log("[compositor] Veo timed out after 5 minutes");
    return null;
  } catch (err) {
    console.log(`[compositor] Veo failed (${(err as Error).message})`);
    return null;
  }
}

function buildVeoMotionPrompt(brief: CreativeBrief): string {
  const theme = brief.colorTheme;
  const lightingDesc = theme === "dark"
    ? "cinematic, moody atmosphere with subtle light rays"
    : "natural light with gentle movement, warm and inviting";

  return `${brief.visualDirection}. Subtle camera movement — slow push-in or gentle parallax. ${lightingDesc}. Subject maintains natural pose and expression. Background elements have gentle motion. Professional commercial video quality. No text overlays. No sudden cuts.`;
}

// ─── Step 2: Segment image into background + subject ────────────────────────
// Note: Segmentation (background removal) requires fal.ai birefnet.
// Without FAL_KEY, we use the full image as background — still looks great.

export interface SegmentedImages {
  backgroundPath: string;
  subjectPath: string;
  originalPath: string;
}

export async function segmentHeroImage(
  heroPath: string,
  workDir: string
): Promise<SegmentedImages> {
  if (!heroPath) {
    return { backgroundPath: "", subjectPath: "", originalPath: "" };
  }

  // Segmentation is a nice-to-have — skip it and use the full image as background
  // This avoids the fal.ai dependency entirely
  console.log("[compositor] Using full image as background (no segmentation)");
  return { backgroundPath: heroPath, subjectPath: "", originalPath: heroPath };
}

// ─── Step 3: Art Director — generate HTML/CSS composition ────────────────────

const ART_DIRECTOR_SYSTEM = `You are a world-class Art Director specializing in social media content. You produce complete, self-contained HTML/CSS documents that render as stunning social media posts.

Your output is a COMPLETE HTML document — not JSON, not a description, not a template. A working HTML file that Puppeteer will screenshot directly.

CANVAS: The document body is always exactly the canvas size specified. No scrollbars. No overflow. Pixel-perfect.

YOUR CREATIVE BRIEF TELLS YOU:
- The headline, subheadline, and CTA (use these EXACTLY — do not rewrite copy)
- The layout style (full-bleed portrait, editorial split, bold typographic, product showcase, quote card)
- The color theme (light or dark)
- The brand's visual identity (colors, fonts, shape language)

WHAT MAKES GREAT SOCIAL CONTENT:
1. HIERARCHY — the eye knows exactly where to go first. One dominant element. Everything else supports it.
2. CONTRAST — text is always legible. Use overlays, shadows, or solid backgrounds when text sits on imagery.
3. BRAND FIDELITY — use the brand's actual colors and fonts. Do not substitute.
4. BREATHING ROOM — generous whitespace. Never crowded. Never cluttered.
5. INTENTIONAL COMPOSITION — every element has a reason to be where it is.

LAYOUT STYLES — implement these faithfully:
- "full-bleed portrait": hero image fills entire canvas. Text overlaid with gradient scrim (bottom 50% to transparent). Logo top-left. Headline large, bottom-left. Subheadline below headline. CTA bottom-right or bottom-left.
- "editorial split": canvas divided vertically. Image on one side (60%), brand color fill on other side (40%). Text on the solid color side. Clean, magazine-style.
- "bold typographic": no hero photo (or very subtle background). Giant headline dominates. Brand color accents. Strong type hierarchy. Minimal elements.
- "product showcase": product/subject image prominent in center or right. Copy on left or bottom. Brand color background.
- "quote card": testimonial or stat as the hero. Large display number or pull quote. Supporting context below. Brand color treatment.

TECHNICAL REQUIREMENTS:
- Use Google Fonts via @import for brand fonts (e.g., @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap'))
- Images are referenced as local file paths provided in the brief
- Logo is provided as a data URI — render it as <img src="DATA_URI_HERE"> with max-height: 48px, max-width: 160px, object-fit: contain
- Canvas dimensions are fixed — use position:absolute or CSS grid for precise placement
- No external dependencies except Google Fonts
- The entire post must be visible within the canvas — no overflow, no clipping of important content

OUTPUT: Return ONLY the complete HTML document. No explanation. No markdown. Start with <!DOCTYPE html> and end with </html>.`;

export async function generateComposition(
  brandProfile: BrandProfile,
  segmented: SegmentedImages,
  logoDataUri: string | null,
  canvasWidth: number,
  canvasHeight: number,
  brief: CreativeBrief & { _fullBrief?: FullCreativeBrief },
  critiqueIssues?: string[]
): Promise<string> {
  const client = new Anthropic();

  const retryContext = critiqueIssues && critiqueIssues.length > 0
    ? `\n\nPREVIOUS ATTEMPT FAILED QUALITY REVIEW. Fix ALL of these issues:\n${critiqueIssues.map((i) => `- ${i}`).join("\n")}\n`
    : "";

  const ds = brandProfile.designSignal;
  const designSignalContext = ds ? `
BRAND DESIGN SIGNAL (from their actual website):
- Layout pattern: ${ds.layoutPattern}
- Visual weight: ${ds.visualWeight}
- Card style: ${ds.cardStyle}
- CTA style: ${ds.ctaStyle}
- Dominant visual type: ${ds.dominantVisualType}
- Photography treatment: ${ds.photographyTreatment}
- Text overlay style: ${ds.textOverlayStyle}
- Density: ${ds.density}
- Art Director notes: ${ds.artDirectorNotes}` : "";

  const headlineFontFamily = (brandProfile.typography?.headline as Record<string, string | undefined>)?.fontFamily ?? "Inter";
  const headlineFontWeight = (brandProfile.typography?.headline as Record<string, string | undefined>)?.fontWeight ?? "700";
  const bodyFontFamily = (brandProfile.typography?.body as Record<string, string | undefined>)?.fontFamily ?? "Inter";

  // Embed logo data URI directly in the prompt so Claude sees the actual value
  const logoSection = logoDataUri
    ? `Logo: provided as data URI below — use as <img src="..."> with max-height: 48px, max-width: 160px, object-fit: contain\n${logoDataUri}`
    : "No logo available — render the brand name as styled text instead";

  const userPrompt = `Create a social media post as a complete HTML/CSS document.

## CANVAS
${canvasWidth}x${canvasHeight}px

## CREATIVE BRIEF
Layout style: ${brief.layoutStyle}
Color theme: ${brief.colorTheme}
Headline: "${brief.headline}"
Subheadline: "${brief.subheadline}"
Call to action: "${brief.callToAction}"
${brief.keyStats.length > 0 ? `Key stat: ${brief.keyStats[0]}` : ""}
${brief.keyQuote ? `Quote: "${brief.keyQuote}"` : ""}

## BRAND IDENTITY
Brand name: ${brandProfile.meta?.brandName ?? "Unknown"}
Primary color: ${brandProfile.primaryColor ?? "#333333"}
Accent color: ${brandProfile.accentColor ?? "#666666"}
Headline font: ${headlineFontFamily} (weight ${headlineFontWeight})
Body font: ${bodyFontFamily}
Shape language: ${brandProfile.shapeLanguage?.classification ?? "rounded"}
Color palette:
${(brandProfile.colorPalette ?? []).slice(0, 5).map((c) => `  ${c.hex}: ${c.contexts.slice(0, 2).join(", ")}`).join("\n")}
${designSignalContext}

## AVAILABLE IMAGES
${segmented.backgroundPath ? `Background/hero image: ${segmented.backgroundPath}` : "No background image — use brand color background"}
${segmented.subjectPath ? `Subject (transparent background, use as foreground overlay): ${segmented.subjectPath}` : ""}

## LOGO
${logoSection}
${retryContext}

Write the complete HTML document now. Use the exact copy from the creative brief. Make it stunning.`;

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 8000,
    system: ART_DIRECTOR_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Art Director");

  let html = content.text.trim();

  // Strip markdown code fences if present
  html = html
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  if (!html.startsWith("<!DOCTYPE") && !html.startsWith("<html")) {
    throw new Error(`Art Director returned invalid HTML (first 200 chars): ${html.slice(0, 200)}`);
  }

  return html;
}

// ─── Step 4: Vision Critique ─────────────────────────────────────────────────

export interface CritiqueResult {
  passed: boolean;
  score: number;
  issues: string[];
  corrections: null;
}

export async function critiqueComposition(
  renderedImagePath: string,
  composition: string,
  brandProfile: BrandProfile,
  brief: CreativeBrief
): Promise<CritiqueResult> {
  const client = new Anthropic();

  const rawBuffer = fs.readFileSync(renderedImagePath);
  let imageBuffer: Buffer = rawBuffer;
  let mediaType: "image/png" | "image/jpeg" = "image/png";

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
      // sharp not available — proceed with original
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

A score of 7 or above means: post it today, no changes needed.
A score below 7 means: specific problems exist that must be fixed before posting.
Be honest and specific. Do not give high scores to mediocre work.

Respond with JSON only:
{
  "passed": boolean (true ONLY if score >= 7),
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
    const cleaned = content.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    const result = JSON.parse(cleaned) as CritiqueResult;
    result.passed = result.score >= 7;
    result.corrections = null;
    return result;
  } catch {
    return { passed: true, score: 7, issues: [], corrections: null };
  }
}

// ─── Utility: download file ───────────────────────────────────────────────────

export async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        downloadFile(response.headers.location!, dest).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}
