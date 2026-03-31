import Anthropic from "@anthropic-ai/sdk";
import { fal } from "@fal-ai/client";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { createClient } from "pexels";
import type { BrandProfile } from "./classifyBrand";
import { generateFullCreativeBrief } from "./compositorAgents";
import type { FullCreativeBrief } from "./compositorAgents";

// ─── fal.ai client config ────────────────────────────────────────────────────
// FAL_KEY env var is read automatically by the fal client

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
//   2. Flux AI generation (using Image Director's prompt)
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
      // Copy to hero.jpg
      fs.copyFileSync(selected.localPath, heroPath);
      console.log(`[compositor] Using brand image [${imageDirection.brandImageIndex}]: ${selected.alt || selected.src}`);
      return heroPath;
    } else {
      console.log(`[compositor] Brand image [${imageDirection.brandImageIndex}] not found locally — falling back to Flux`);
    }
  }

  // ── 1b. Flux AI generation (Image Director's prompt) ─────────────────────
  const fluxPrompt = imageDirection?.fluxPrompt ?? buildDefaultFluxPrompt(brief, brandProfile, isPortrait);
  const falKey = process.env.FAL_KEY;

  if (falKey) {
    try {
      console.log(`[compositor] Flux prompt: ${fluxPrompt.slice(0, 120)}...`);
      const result = await fal.subscribe("fal-ai/flux-pro/v1.1-ultra", {
        input: {
          prompt: fluxPrompt,
          aspect_ratio: isPortrait ? "4:5" : "1:1",
          output_format: "jpeg",
          safety_tolerance: "2",
        },
      }) as unknown as { data: { images: Array<{ url: string }> } };

      const imageUrl = result.data.images[0].url;
      await downloadFile(imageUrl, heroPath);
      console.log(`[compositor] Flux image generated successfully`);
      return heroPath;
    } catch (err) {
      console.log(`[compositor] Flux failed (${(err as Error).message}) — falling back to Pexels`);
    }
  } else {
    console.log("[compositor] No FAL_KEY — skipping Flux, trying Pexels");
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

  // ── 1d. Hard fallback: solid brand color background ──────────────────────
  // If everything fails, the Art Director will render a text-only composition
  console.log("[compositor] All image sources failed — Art Director will use text-only layout");
  return "";
}

function buildDefaultFluxPrompt(brief: CreativeBrief, brandProfile: BrandProfile, isPortrait: boolean): string {
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
  if (!heroPath) {
    // No hero image — return empty paths for text-only layout
    return { backgroundPath: "", subjectPath: "", originalPath: "" };
  }

  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    console.log("[compositor] No FAL_KEY — skipping segmentation, using original as background");
    return { backgroundPath: heroPath, subjectPath: "", originalPath: heroPath };
  }

  try {
    const fileBuffer = fs.readFileSync(heroPath);
    const blob = new Blob([fileBuffer], { type: "image/jpeg" });
    const uploadedUrl = await fal.storage.upload(blob);

    const result = await fal.subscribe("fal-ai/birefnet", {
      input: {
        image_url: uploadedUrl,
        model: "General Use (Light)",
        operating_resolution: "1024x1024",
        output_format: "png",
      },
    }) as unknown as { data: { image: { url: string } } };

    const subjectUrl = result.data.image.url;
    const subjectPath = path.join(workDir, "subject.png");
    await downloadFile(subjectUrl, subjectPath);

    return {
      backgroundPath: heroPath,
      subjectPath,
      originalPath: heroPath,
    };
  } catch (err) {
    console.log(`[compositor] Segmentation failed (${(err as Error).message}) — using original as background`);
    return { backgroundPath: heroPath, subjectPath: "", originalPath: heroPath };
  }
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
- The subject image (segmented, transparent background) should be positioned as an overlay on the background
- Logo is a data URI or local path — render as <img> tag
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

  // Get the headline font family for Google Fonts import
  const headlineFontFamily = (brandProfile.typography?.headline as Record<string, string | undefined>)?.fontFamily ?? "Inter";
  const headlineFontWeight = (brandProfile.typography?.headline as Record<string, string | undefined>)?.fontWeight ?? "700";
  const bodyFontFamily = (brandProfile.typography?.body as Record<string, string | undefined>)?.fontFamily ?? "Inter";

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
${segmented.subjectPath ? `Subject (transparent background, use as foreground overlay): ${segmented.subjectPath}` : "No segmented subject"}
${logoDataUri ? `Logo: ${logoDataUri.startsWith("data:") ? "[data URI available — use as <img src='LOGO_DATA_URI'>]" : logoDataUri}` : "No logo — use brand name as text"}

## FOOTER (always include)
Bottom-left: "CONTENTPRODUCTION.AI" in small caps, muted color
Bottom-right: "• MADE WITH ORB" in small caps, muted color
${retryContext}

Write the complete HTML document now. Use the exact copy from the creative brief. Make it stunning.`;

  // Replace LOGO_DATA_URI placeholder with actual data URI
  const finalPrompt = logoDataUri
    ? userPrompt.replace("LOGO_DATA_URI", logoDataUri)
    : userPrompt;

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 8000,
    system: ART_DIRECTOR_SYSTEM,
    messages: [{ role: "user", content: finalPrompt }],
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

  // Inject actual logo data URI if the placeholder is present
  if (logoDataUri && html.includes("LOGO_DATA_URI")) {
    html = html.replaceAll("LOGO_DATA_URI", logoDataUri);
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
  composition: string,  // now HTML string
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
      // sharp not available — proceed
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
    const cleaned = content.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    const result = JSON.parse(cleaned) as CritiqueResult;
    result.passed = result.score >= 8;
    result.corrections = null;
    return result;
  } catch {
    return { passed: false, score: 0, issues: ["Failed to parse critique response"], corrections: null };
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
