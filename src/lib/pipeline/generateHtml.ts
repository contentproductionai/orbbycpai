/**
 * Orb HTML Generator
 * Generates social media post HTML/CSS using Claude Opus.
 * Ported from generate_html.py
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import type { BrandProfile } from "./classifyBrand";

const GENERATION_MODEL = "claude-opus-4-5";

const SYSTEM_PROMPT = `You are an elite social media creative director and front-end engineer. Your output is a single, self-contained HTML file that renders a pixel-perfect social media post.

## Technical requirements
- Output ONLY a complete HTML document: <!DOCTYPE html> ... </html>
- Dimensions: set EXACTLY on the <body> element: width, height, overflow:hidden, margin:0, padding:0, position:relative
- All layout: absolute positioning only. No flexbox, no grid, no float.
- No JavaScript.
- Fonts: load from Google Fonts via <link> tag only. Match the brand typography. All font sizes must be in px only.
- Photo: use PHOTO_PLACEHOLDER as the src of a full-bleed background img (object-fit: cover, width: 100%, height: 100%, position: absolute, top: 0, left: 0). Only include if the schema requires photography.
- Logo: use LOGO_PLACEHOLDER as the src of the logo img, positioned as specified in the schema, max-height: 48px, max-width: 160px, object-fit: contain. If no logo is available, render the brand name as styled text instead.
- Watermark: bottom bar must include "CONTENTPRODUCTION.AI" left and "• MADE WITH ORB" right, small muted text (12px, opacity 0.6).
- WCAG AA: every text element must achieve minimum 4.5:1 contrast ratio against its background. Use text-shadow or semi-transparent overlay panels to ensure this.
- Word count: follow the maximum word counts specified in the schema for each content slot.
- No gradients on text. Text must be solid color.
- All font sizes in px exclusively. No rem, vh, vw, or em anywhere.
- Every element must be at least 60px from any canvas edge.
## Design principles
- Typography: weights/sizes matching brand personality. All-caps headline if brand is bold/athletic. Sentence case if brand is warm/conversational.
- Color: 60-30-10 rule. Primary color dominates. Accent color for one focal point only.
- Shape language: pill/rounded borders if brand is rounded. Zero border-radius if sharp. Never mix.
- Space: generous padding (60px+) if spacious brand. Tighter if dense.
- Copy: write all copy in the brand's voice. Sound like their marketing team wrote it.
Return ONLY the complete HTML document. Start with <!DOCTYPE html>, end with </html>. No markdown, no commentary.`;

// ─── Brand summary builder ────────────────────────────────────────────────────

function buildCompactBrandSummary(profile: BrandProfile): string {
  const name = profile.meta?.brandName ?? "Unknown Brand";
  const industry = profile.industryContext ?? "";
  const personality = profile.brandPersonality ?? "";
  const toneD = profile.tone?.directness ?? "";
  const toneF = profile.tone?.formality ?? "";
  const toneE = profile.tone?.emotionality ?? "";
  const toneS = profile.tone?.summary ?? "";
  const shape =
    (typeof profile.shapeLanguage === "object"
      ? (profile.shapeLanguage as { classification?: string }).classification
      : String(profile.shapeLanguage)) ?? "rounded";
  const spatial =
    (typeof profile.spatialPhilosophy === "object"
      ? (profile.spatialPhilosophy as { classification?: string }).classification
      : String(profile.spatialPhilosophy)) ?? "moderate";
  const photoStyle =
    (typeof profile.photography === "object"
      ? (profile.photography as { style?: string }).style
      : "") ?? "people-focused";
  const photoSubject =
    (typeof profile.photography === "object"
      ? (profile.photography as { subject?: string }).subject
      : "") ?? "";
  const primary = profile.primaryColor ?? "#333333";
  const accent = profile.accentColor ?? "#666666";
  const bgLum = profile.backgroundLuminance ?? "unknown";
  const logoRender = profile.logoRendering ?? "white";
  const hlFont =
    (profile.typography?.headline as Record<string, string | undefined>)
      ?.fontFamily ?? "Inter";
  const hlWeight =
    (profile.typography?.headline as Record<string, string | undefined>)
      ?.fontWeight ?? "700";
  const hlTransform =
    (profile.typography?.headline as Record<string, string | undefined>)
      ?.textTransform ?? "none";

  const palette = profile.colorPalette ?? [];
  const paletteStr = palette
    .slice(0, 3)
    .map((c) => `${c.hex} (${c.contexts[0] ?? "?"})`)
    .join(", ");

  const stats = profile.statistics ?? [];
  const statsStr =
    stats.length > 0
      ? "\nStatistics: " +
        stats
          .slice(0, 3)
          .map((s) => `${s.value} (${s.label})`)
          .join(" | ")
      : "";

  const testimonials = profile.testimonials ?? [];
  const testStr =
    testimonials.length > 0
      ? `\nTestimonial: "${testimonials[0].quote}" — ${testimonials[0].author}`
      : "";

  return `Brand: ${name}
Industry: ${industry}
Personality: ${personality}
Tone: ${toneD} / ${toneF} / ${toneE} — ${toneS}
Shape language: ${shape}
Spatial philosophy: ${spatial}
Photography style: ${photoStyle} — ${photoSubject}
Primary color: ${primary}
Accent color: ${accent}
Background luminance: ${bgLum} (logo renders ${logoRender} on brand backgrounds)
Headline font: ${hlFont} weight ${hlWeight} text-transform: ${hlTransform}
Color palette: ${paletteStr}${statsStr}${testStr}`;
}

// ─── Photo encoder ────────────────────────────────────────────────────────────

function encodePhoto(photoPath: string): string {
  const data = fs.readFileSync(photoPath);
  const ext = path.extname(photoPath).toLowerCase().replace(".", "");
  const mime =
    ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
  const b64 = data.toString("base64");
  return `data:${mime};base64,${b64}`;
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateHtml(
  brandProfile: BrandProfile,
  photoPath: string | null,
  logoDataUri: string | null = null,
  canvasWidth = 1080,
  canvasHeight = 1350,
  schemaDefinition = ""
): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const brandSummary = buildCompactBrandSummary(brandProfile);
  const hasLogo = logoDataUri !== null;

  const userMessage = `Canvas: ${canvasWidth}px wide x ${canvasHeight}px tall
Brand profile:
${brandSummary}
Logo available: ${hasLogo ? "YES — use LOGO_PLACEHOLDER as the img src" : "NO — use brand name as styled text instead of LOGO_PLACEHOLDER"}
${photoPath ? "Photo: use PHOTO_PLACEHOLDER as the img src for the full-bleed background." : "No photo required for this schema."}
Schema definition:
${schemaDefinition}
Generate the complete ${canvasWidth}x${canvasHeight}px HTML/CSS social media post. Reason about this brand's psychology — make it feel like their own design team created it. Return only the HTML document.`;

  console.log(
    `  Calling Claude API (${GENERATION_MODEL}) — ${canvasWidth}x${canvasHeight}...`
  );

  const message = await client.messages.create({
    model: GENERATION_MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  let html = (message.content[0] as { text: string }).text.trim();

  // Strip markdown fences if present
  if (html.startsWith("```html")) html = html.slice(7);
  else if (html.startsWith("```")) html = html.slice(3);
  if (html.endsWith("```")) html = html.slice(0, -3);
  html = html.trim();

  // Inject photo
  if (photoPath) {
    const photoDataUri = encodePhoto(photoPath);
    html = html.replace(/PHOTO_PLACEHOLDER/g, photoDataUri);
  }

  // Inject logo or remove placeholder
  if (logoDataUri) {
    html = html.replace(/LOGO_PLACEHOLDER/g, logoDataUri);
  } else {
    html = html.replace(/<img[^>]*LOGO_PLACEHOLDER[^>]*\/?>/gi, "");
  }

  return html;
}
