/**
 * carouselAgents.ts
 *
 * Carousel-specific agents for the Orb pipeline.
 *
 * Architecture:
 *   generateCarouselCopy() — one Haiku call that writes all 5 slides as a unified narrative arc
 *   generateCarouselSlide() — Art Director generates HTML for each individual slide
 *
 * Carousel structure:
 *   Slide 1: Hook — stops the scroll, poses the question or tension
 *   Slide 2: Story beat 1 — opens the narrative
 *   Slide 3: Story beat 2 — deepens the story, adds proof or detail
 *   Slide 4: Story beat 3 — resolution or transformation
 *   Slide 5: CTA — clear action, brand-forward close
 */

import Anthropic from "@anthropic-ai/sdk";
import type { BrandProfile } from "./classifyBrand";
import type { CreativeStrategy } from "./compositorAgents";
import type { CreativeBrief, SegmentedImages } from "./compositorGenerate";
import type { FullCreativeBrief } from "./compositorAgents";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CarouselSlideRole = "hook" | "story" | "cta";

export interface CarouselSlide {
  /** Slide number (1–5) */
  slideNumber: number;
  /** The narrative role of this slide */
  role: CarouselSlideRole;
  /** The primary headline for this slide (max 8 words) */
  headline: string;
  /** Supporting body copy (max 20 words — this is social, not a blog post) */
  body: string;
  /** CTA text — only used on the final slide */
  callToAction: string;
  /** Suggested layout for this slide */
  layoutStyle: "bold typographic" | "full-bleed portrait" | "editorial split" | "quote card";
  /** Pexels query for this slide's image (can differ per slide) */
  pexelsQuery: string;
  /** Imagen prompt for this slide's image */
  imagenPrompt: string;
}

export interface CarouselScript {
  /** The overarching narrative theme of this carousel */
  narrativeArc: string;
  /** All 5 slides in order */
  slides: CarouselSlide[];
}

// ─── Carousel Copywriter System Prompt ───────────────────────────────────────

const CAROUSEL_COPYWRITER_SYSTEM = `You are a Social Media Carousel Copywriter. Your job is to write a 5-slide carousel that tells a complete story — one that earns the swipe.

A carousel is NOT 5 separate posts. It is one narrative arc broken into 5 beats:
- Slide 1 (Hook): Creates a tension, question, or bold claim that makes the viewer NEED to swipe. This is the most important slide. If it doesn't hook, nothing else matters.
- Slides 2-4 (Story): Each slide advances the narrative. Each one must earn the swipe to the next. No filler. No repetition.
- Slide 5 (CTA): The payoff. Clear action. Brand-forward. Feels earned, not forced.

COPY RULES:
1. Headline: max 8 words. Short. Punchy. Social-first.
2. Body: max 20 words. Adds context without repeating the headline. Can be empty on hook slides.
3. CTA: only on slide 5. Action-oriented. Brand-appropriate.
4. Write in the brand's actual social voice — match their vocabulary, sentence structure, and tone.
5. Each slide must stand alone visually but only make full sense as part of the sequence.
6. Never fabricate statistics or testimonials. If no real data exists, use conceptual copy.

LAYOUT RULES:
- Hook slides: "bold typographic" (text-dominant, no image needed — the words are the visual)
- Story slides: "editorial split" or "full-bleed portrait" (image + copy working together)
- CTA slide: "editorial split" or "bold typographic" (brand color dominant, clear action)

IMAGE RULES:
- Each story slide should have its own distinct image concept
- Images should advance the visual narrative, not repeat the same shot
- Pexels queries: 3-5 words, specific to the slide's content
- Imagen prompts: 2-3 sentences, photorealistic, commercial quality, leave space for text

Output ONLY valid JSON. No markdown. Start with { and end with }.`;

// ─── generateCarouselCopy ─────────────────────────────────────────────────────

export async function generateCarouselCopy(
  strategy: CreativeStrategy,
  brandProfile: BrandProfile,
  postTopic: string
): Promise<CarouselScript> {
  const client = new Anthropic();

  const stats = (brandProfile.statistics ?? [])
    .map((s) => `${s.value} ${s.label}`)
    .join(", ");
  const testimonials = (brandProfile.testimonials ?? [])
    .slice(0, 2)
    .map((t) => `"${t.quote}" — ${t.author}`)
    .join("\n");

  const payload = `BRAND: ${brandProfile.meta?.brandName ?? "Unknown"}
INDUSTRY: ${brandProfile.industryContext ?? ""}
SOCIAL VOICE: ${strategy.socialVoice}
CORE VALUE PROP: ${strategy.coreValueProp}
BIG IDEA: ${strategy.bigIdea}
POST TOPIC: ${postTopic}
POST ANGLE: ${strategy.postAngle}
EMOTIONAL REGISTER: ${strategy.emotionalRegister}
COLOR THEME: ${strategy.colorTheme}

REAL STATISTICS (only use these, do not invent):
${stats || "none"}

REAL TESTIMONIALS (only use these, do not invent):
${testimonials || "none"}

BRAND PHOTOGRAPHY:
  Style: ${brandProfile.photography?.style ?? ""}
  Subjects: ${brandProfile.photography?.subject ?? ""}
  Primary color: ${brandProfile.primaryColor ?? ""}

---
Write a 5-slide carousel script. Output JSON:
{
  "narrativeArc": "string (one sentence describing the overall story arc)",
  "slides": [
    {
      "slideNumber": 1,
      "role": "hook",
      "headline": "string (max 8 words)",
      "body": "string (max 20 words, can be empty)",
      "callToAction": "",
      "layoutStyle": "bold typographic",
      "pexelsQuery": "string (3-5 words)",
      "imagenPrompt": "string (2-3 sentences, photorealistic)"
    },
    {
      "slideNumber": 2,
      "role": "story",
      "headline": "string",
      "body": "string",
      "callToAction": "",
      "layoutStyle": "editorial split" | "full-bleed portrait",
      "pexelsQuery": "string",
      "imagenPrompt": "string"
    },
    {
      "slideNumber": 3,
      "role": "story",
      "headline": "string",
      "body": "string",
      "callToAction": "",
      "layoutStyle": "editorial split" | "full-bleed portrait",
      "pexelsQuery": "string",
      "imagenPrompt": "string"
    },
    {
      "slideNumber": 4,
      "role": "story",
      "headline": "string",
      "body": "string",
      "callToAction": "",
      "layoutStyle": "editorial split" | "full-bleed portrait",
      "pexelsQuery": "string",
      "imagenPrompt": "string"
    },
    {
      "slideNumber": 5,
      "role": "cta",
      "headline": "string",
      "body": "string (optional)",
      "callToAction": "string (required — action-oriented CTA)",
      "layoutStyle": "editorial split" | "bold typographic",
      "pexelsQuery": "string",
      "imagenPrompt": "string"
    }
  ]
}`;

  async function callWithRetry(attempt = 1): Promise<Anthropic.Message> {
    try {
      return await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: CAROUSEL_COPYWRITER_SYSTEM,
        messages: [{ role: "user", content: payload }],
      }) as Anthropic.Message;
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? "";
      const isConnErr = msg.includes("Connection error") || msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT") || msg.includes("fetch failed");
      if (isConnErr && attempt < 3) {
        const delay = attempt * 3000;
        console.warn(`[CarouselCopywriter] Connection error on attempt ${attempt}, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        return callWithRetry(attempt + 1);
      }
      throw err;
    }
  }

  const response = await callWithRetry();
  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Carousel Copywriter");

  const cleaned = content.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as CarouselScript;
  } catch (e) {
    throw new Error(`Carousel Copywriter returned invalid JSON: ${(e as Error).message}\n\nRaw: ${content.text.slice(0, 500)}`);
  }
}

// ─── Carousel Slide Art Director System Prompt ───────────────────────────────

const CAROUSEL_SLIDE_SYSTEM = `You are a world-class Art Director specializing in social media carousel content. You produce complete, self-contained HTML/CSS documents that render as individual carousel slides.

CAROUSEL CONTEXT: This is ONE slide in a 5-slide carousel. Each slide must:
1. Be visually consistent with the other slides (same brand colors, typography, logo position)
2. Have a clear visual hierarchy that works at a glance
3. Feel like part of a series — not a standalone post

CANVAS: The document body is always exactly the canvas size specified. No scrollbars. No overflow.

SLIDE-SPECIFIC RULES:
- HOOK slide (slide 1): Bold, text-dominant. The visual tension is in the words. Use brand color background or minimal image. Large headline (72-96px). Slide number indicator top-right (small, subtle: "1 / 5").
- STORY slide (slides 2-4): Image + copy working together. Headline (44-56px). Body copy (16-18px, max 2 lines). Slide number indicator top-right.
- CTA slide (slide 5): Brand-forward. Clear action. CTA button prominent. Slide number indicator top-right.

CONSISTENCY RULES (apply to ALL slides):
- Logo: always top-left, same size and position across all slides
- Slide number: always top-right, same style — small text "X / 5" in brand color or white
- Margins: minimum 48px on all sides
- Typography: same font family across all slides
- Color palette: same brand colors across all slides

COPY RULES:
- Use ONLY the copy provided in the brief — do not add, modify, or embellish
- Headline is the dominant text element
- Body copy is secondary — smaller, lighter weight
- CTA button only on slide 5

TECHNICAL REQUIREMENTS:
- Use Google Fonts via @import
- Images referenced as local file paths
- Logo: <img src="__LOGO_DATA_URI__" alt="logo" style="max-height:40px;max-width:140px;object-fit:contain;">
- Canvas dimensions are fixed — use position:absolute or CSS grid
- No external dependencies except Google Fonts

OUTPUT: Return ONLY the complete HTML document. No explanation. No markdown. Start with <!DOCTYPE html> and end with </html>.`;

// ─── generateCarouselSlide ────────────────────────────────────────────────────

export async function generateCarouselSlide(
  slide: CarouselSlide,
  totalSlides: number,
  brandProfile: BrandProfile,
  heroPath: string,
  logoDataUri: string | null,
  canvasWidth: number,
  canvasHeight: number
): Promise<string> {
  const client = new Anthropic();

  const ds = brandProfile.designSignal;
  const headlineFontFamily = (brandProfile.typography?.headline as Record<string, string | undefined>)?.fontFamily ?? "Inter";
  const headlineFontWeight = (brandProfile.typography?.headline as Record<string, string | undefined>)?.fontWeight ?? "700";
  const bodyFontFamily = (brandProfile.typography?.body as Record<string, string | undefined>)?.fontFamily ?? "Inter";

  const logoSection = logoDataUri
    ? `Logo: available — use <img src="__LOGO_DATA_URI__" alt="logo" style="max-height:40px;max-width:140px;object-fit:contain;"> exactly as written`
    : "No logo available — render the brand name as styled text instead";

  const userPrompt = `Create carousel slide ${slide.slideNumber} of ${totalSlides} as a complete HTML/CSS document.

## CANVAS
${canvasWidth}x${canvasHeight}px

## SLIDE BRIEF
Slide: ${slide.slideNumber} / ${totalSlides}
Role: ${slide.role.toUpperCase()}
Layout style: ${slide.layoutStyle}
Headline: "${slide.headline}"
Body: "${slide.body}"
${slide.callToAction ? `CTA button text: "${slide.callToAction}"` : "No CTA button on this slide"}

## BRAND IDENTITY
Brand name: ${brandProfile.meta?.brandName ?? "Unknown"}
Primary color: ${brandProfile.primaryColor ?? "#333333"}
Accent color: ${brandProfile.accentColor ?? "#666666"}
Headline font: ${headlineFontFamily} (weight ${headlineFontWeight})
Body font: ${bodyFontFamily}
Shape language: ${brandProfile.shapeLanguage?.classification ?? "rounded"}
Color theme: ${(brandProfile.backgroundLuminance ?? 0.5) > 0.5 ? "light" : "dark"}
Color palette:
${(brandProfile.colorPalette ?? []).slice(0, 5).map((c) => `  ${c.hex}: ${c.contexts.slice(0, 2).join(", ")}`).join("\n")}
${ds ? `
BRAND DESIGN SIGNAL:
- Layout pattern: ${ds.layoutPattern}
- Visual weight: ${ds.visualWeight}
- CTA style: ${ds.ctaStyle}
- Photography treatment: ${ds.photographyTreatment}` : ""}

## AVAILABLE IMAGE
${heroPath ? `Hero image: ${heroPath}` : "No image — use brand color background"}

## LOGO
${logoSection}

## SLIDE NUMBER INDICATOR
Add a subtle slide number indicator top-right: "${slide.slideNumber} / ${totalSlides}" — small (12-14px), brand color or white, 48px from edges.

Write the complete HTML document now. Make it stunning and consistent with the carousel series.`;

  async function callWithRetry(attempt = 1): Promise<Anthropic.Message> {
    try {
      return await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 3000,
        system: CAROUSEL_SLIDE_SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      }) as Anthropic.Message;
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? "";
      const isConnErr = msg.includes("Connection error") || msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT") || msg.includes("fetch failed");
      if (isConnErr && attempt < 3) {
        const delay = attempt * 3000;
        console.warn(`[CarouselArtDirector] Connection error on attempt ${attempt}, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        return callWithRetry(attempt + 1);
      }
      throw err;
    }
  }

  const response = await callWithRetry();
  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Carousel Art Director");

  let html = content.text.trim()
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  if (!html.startsWith("<!DOCTYPE") && !html.startsWith("<html")) {
    throw new Error(`Carousel Art Director returned invalid HTML: ${html.slice(0, 200)}`);
  }

  // Inject the actual logo data URI
  if (logoDataUri && html.includes("__LOGO_DATA_URI__")) {
    html = html.replaceAll("__LOGO_DATA_URI__", logoDataUri);
  }

  return html;
}
