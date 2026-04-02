/**
 * layoutRenderer.ts
 *
 * Layout Zone Renderer — TypeScript owns HTML structure, Haiku fills content tokens.
 *
 * Architecture:
 *  1. extractLayoutTokens() — Haiku call that returns typed JSON tokens INCLUDING layoutVariant
 *  2. renderLayout()        — TypeScript dispatches to the correct layout renderer
 *
 * Layout Variants (Haiku selects, TypeScript executes):
 *  - editorial-split        Image left, text panel right. Lifestyle/brand storytelling.
 *  - editorial-split-right  Text panel left, image right. Visual variety.
 *  - full-bleed             Image fills canvas, text overlaid with scrim. Bold lifestyle brands.
 *  - stacked                Image top 55%, text panel bottom 45%. Portrait, product-forward.
 *  - product-spotlight      Product centered on clean brand-color field, minimal text, strong CTA.
 *  - stat-forward           Large typographic number/stat dominates, small image accent. B2B/data.
 *  - text-dominant          Minimal or no image, typography-led. Quotes, announcements.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { BrandProfile } from "./classifyBrand";
import type { CreativeBrief } from "./compositorGenerate";
import type { FullCreativeBrief } from "./compositorAgents";

// ─── Layout Variant Enum ──────────────────────────────────────────────────────

export type LayoutVariant =
  | "editorial-split"
  | "editorial-split-right"
  | "full-bleed"
  | "stacked"
  | "product-spotlight"
  | "stat-forward"
  | "text-dominant";

// ─── Token Schema ─────────────────────────────────────────────────────────────

export interface LayoutTokens {
  // Layout selection (Haiku picks, TypeScript executes)
  layoutVariant: LayoutVariant;

  // Copy
  headline: string;
  subheadline: string;
  cta: string;
  stat?: string;          // For stat-forward: the big number/stat (e.g. "2.4M", "47%")
  statLabel?: string;     // For stat-forward: label under the stat (e.g. "customers served")

  // Colors (hex)
  bgColor: string;        // text panel / page background
  headlineColor: string;  // headline text color
  bodyColor: string;      // subheadline text color
  ctaBgColor: string;     // CTA button background
  ctaTextColor: string;   // CTA button text (usually #fff)

  // Typography
  headlineFontFamily: string;
  headlineFontWeight: string;
  bodyFontFamily: string;
  googleFontsUrl: string; // full @import URL for the fonts used

  // Shape
  ctaBorderRadius: string; // e.g. "6px" or "24px"

  // Image focal point hint (for background-position)
  imageFocalPoint: string; // e.g. "center", "top center", "60% 40%"
}

// ─── Token Extractor (Haiku) ──────────────────────────────────────────────────

const TOKEN_EXTRACTOR_SYSTEM = `You are a brand design token extractor for social media posts. Given a creative brief and brand profile, you return a JSON object of design tokens.

You do NOT generate HTML. You ONLY fill in content and brand tokens that will be injected into a pre-built layout structure.

Return ONLY valid JSON. No explanation, no markdown, no code fences. Start with { and end with }.

## LAYOUT VARIANT SELECTION RULES

You MUST pick exactly one layoutVariant from this list based on brand type and content:

"editorial-split"        — Image left, text panel right. Use for: lifestyle DTC brands, brand storytelling, square format.
"editorial-split-right"  — Text panel left, image right. Use for: visual variety, when brand prefers left-aligned text.
"full-bleed"             — Hero image fills canvas, text overlaid with gradient scrim. Use for: outdoor/heritage brands (LL Bean, Howler Bros, Patagonia), bold lifestyle brands, portrait/story format.
"stacked"                — Image top 55%, text panel bottom 45%. Use for: portrait format when product needs vertical room, food/beverage brands.
"product-spotlight"      — Product centered on clean brand-color field, minimal text, strong CTA. Use for: DTC commerce brands where the product IS the content (shoes, apparel, gear, accessories). Allbirds = product-spotlight.
"stat-forward"           — Large typographic number/stat dominates, small image accent. Use for: B2B SaaS, data-driven content, fintech, HR tech, any brand leading with metrics.
"text-dominant"          — Minimal or no image, typography-led on brand background. Use for: quotes, announcements, editorial brands, luxury brands that avoid photography.

EXPLICIT MAPPING RULES (follow these exactly):
- DTC footwear, apparel, accessories → "product-spotlight" (product is the hero)
- Outdoor/heritage lifestyle (LL Bean, REI, Patagonia, Howler Bros) → "full-bleed"
- B2B SaaS, fintech, HR tech, data platforms → "stat-forward" or "text-dominant"
- Minimalist lifestyle DTC (not product-forward) → "full-bleed" or "editorial-split"
- Food, beverage, CPG → "stacked" or "full-bleed"
- Quote/announcement content → "text-dominant"
- Default fallback → "editorial-split"

## TOKEN RULES

- headline: use the exact headline from the brief, unchanged
- subheadline: max 20 words, trim if longer
- cta: use the exact CTA from the brief
- stat: ONLY for stat-forward layout — extract a key number from the brief or brand data. Leave empty string for other layouts.
- statLabel: ONLY for stat-forward — short label for the stat. Leave empty string for other layouts.
- bgColor: brand's lightest background for light theme, darkest for dark theme
- headlineColor: high contrast against bgColor (≥4.5:1 ratio)
- bodyColor: slightly softer than headlineColor, still readable
- ctaBgColor: brand's primary action color (CTA button color from their website). MUST match the brand's actual button color.
- ctaTextColor: "#ffffff" unless ctaBgColor is very light, then use darkest brand color
- headlineFontFamily: brand's headline font if available, otherwise "Inter"
- headlineFontWeight: "700" or "800"
- bodyFontFamily: brand's body font if available, otherwise "Inter"
- googleFontsUrl: correct Google Fonts @import URL for the fonts chosen
- ctaBorderRadius: "6px" for geometric/minimal, "24px" for rounded/friendly, "0px" for sharp/luxury
- imageFocalPoint: where to focus the hero image crop — "center", "top center", "bottom center", "40% 30%"`;

export async function extractLayoutTokens(
  brief: CreativeBrief & { _fullBrief?: FullCreativeBrief },
  brandProfile: BrandProfile
): Promise<LayoutTokens> {
  const client = new Anthropic();

  const headlineFontFamily = (brandProfile.typography?.headline as Record<string, string | undefined>)?.fontFamily ?? "Inter";
  const headlineFontWeight = (brandProfile.typography?.headline as Record<string, string | undefined>)?.fontWeight ?? "700";
  const bodyFontFamily = (brandProfile.typography?.body as Record<string, string | undefined>)?.fontFamily ?? "Inter";

  // Extract the actual CTA button hex color from the color palette (cta:background context)
  const ctaColorFromPalette = (brandProfile.colorPalette ?? [])
    .find((c) => c.contexts.some((ctx) => /cta:background/.test(ctx)))?.hex ?? null;

  const userPrompt = `Extract design tokens for this social media post.

## CREATIVE BRIEF
Headline: "${brief.headline}"
Subheadline: "${brief.subheadline}"
CTA: "${brief.callToAction}"
Color theme: ${brief.colorTheme}
Layout style hint: ${brief.layoutStyle}

## BRAND PROFILE
Brand: ${brandProfile.meta?.brandName ?? "Unknown"}
Brand type: ${(brandProfile.meta as Record<string, unknown>)?.brandType ?? "unknown"}
Primary color: ${brandProfile.primaryColor ?? "#333333"}
Accent color: ${brandProfile.accentColor ?? "#666666"}
Shape language: ${brandProfile.shapeLanguage?.classification ?? "rounded"}
Headline font: ${headlineFontFamily} (weight ${headlineFontWeight})
Body font: ${bodyFontFamily}
Color palette (from their actual website):
${(brandProfile.colorPalette ?? []).slice(0, 6).map((c) => `  ${c.hex}: ${c.contexts.slice(0, 2).join(", ")}`).join("\n")}
${ctaColorFromPalette ? `CTA button background color (from website DOM): ${ctaColorFromPalette} — use this as ctaBgColor` : ""}
${brandProfile.designSignal ? `CTA button shape style: ${brandProfile.designSignal.ctaStyle}` : ""}

## VISUAL CONCEPT
${brief.visualDirection}

Return the JSON token object now. Remember: pick layoutVariant based on the brand type rules above.`;

  async function callWithRetry(attempt = 1): Promise<Anthropic.Message> {
    try {
      return await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        system: TOKEN_EXTRACTOR_SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      }) as Anthropic.Message;
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? "";
      const isConnErr = msg.includes("Connection error") || msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT") || msg.includes("fetch failed");
      if (isConnErr && attempt < 3) {
        await new Promise(r => setTimeout(r, attempt * 3000));
        return callWithRetry(attempt + 1);
      }
      throw err;
    }
  }

  const response = await callWithRetry();
  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected token extractor response");

  let raw = content.text.trim();
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  let tokens: LayoutTokens;
  try {
    tokens = JSON.parse(raw) as LayoutTokens;
  } catch {
    throw new Error(`Token extractor returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  // Validate layoutVariant
  const validVariants: LayoutVariant[] = [
    "editorial-split", "editorial-split-right", "full-bleed",
    "stacked", "product-spotlight", "stat-forward", "text-dominant"
  ];
  if (!validVariants.includes(tokens.layoutVariant)) {
    tokens.layoutVariant = "editorial-split"; // safe fallback
  }

  // Fallback defaults for any missing tokens
  tokens.headline = tokens.headline || brief.headline;
  tokens.subheadline = tokens.subheadline || brief.subheadline;
  tokens.cta = tokens.cta || brief.callToAction;
  tokens.stat = tokens.stat || "";
  tokens.statLabel = tokens.statLabel || "";
  tokens.bgColor = tokens.bgColor || "#f5f0eb";
  tokens.headlineColor = tokens.headlineColor || "#1a1a1a";
  tokens.bodyColor = tokens.bodyColor || "#4a4a4a";
  tokens.ctaBgColor = tokens.ctaBgColor || brandProfile.primaryColor || "#333333";
  tokens.ctaTextColor = tokens.ctaTextColor || "#ffffff";
  tokens.headlineFontFamily = tokens.headlineFontFamily || headlineFontFamily;
  tokens.headlineFontWeight = tokens.headlineFontWeight || headlineFontWeight;
  tokens.bodyFontFamily = tokens.bodyFontFamily || bodyFontFamily;
  tokens.googleFontsUrl = tokens.googleFontsUrl || `https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap`;
  tokens.ctaBorderRadius = tokens.ctaBorderRadius || "8px";
  tokens.imageFocalPoint = tokens.imageFocalPoint || "center";

  return tokens;
}

// ─── Shared Utilities ─────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return (str ?? "").toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function htmlShell(
  width: number,
  height: number,
  googleFontsUrl: string,
  body: string
): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
@import url('${googleFontsUrl}');
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body {
  width: ${width}px;
  height: ${height}px;
  overflow: hidden;
}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function logoHtmlFor(logoDataUri: string | null, tokens: LayoutTokens, size: "sm" | "md" | "lg" = "md"): string {
  const heights = { sm: 32, md: 48, lg: 64 };
  const maxWidths = { sm: 120, md: 180, lg: 240 };
  const h = heights[size];
  const w = maxWidths[size];
  return logoDataUri
    ? `<img src="${logoDataUri}" alt="logo" style="max-height:${h}px;max-width:${w}px;object-fit:contain;display:block;">`
    : `<span style="font-family:'${tokens.headlineFontFamily}',sans-serif;font-weight:${tokens.headlineFontWeight};font-size:${Math.round(h * 0.5)}px;color:${tokens.headlineColor};">&nbsp;</span>`;
}

// ─── Layout Variant Renderers ─────────────────────────────────────────────────

/**
 * EDITORIAL-SPLIT — Image left, text panel right.
 * Three zones: logo (top) | headline+subheadline (center) | CTA (bottom)
 */
function renderEditorialSplit(
  width: number,
  height: number,
  heroPath: string,
  logoDataUri: string | null,
  tokens: LayoutTokens,
  imageOnRight = false
): string {
  const aspectRatio = width / height;
  const imagePanelRatio = aspectRatio >= 0.9 ? 0.575 : 0.50;
  const imagePanelWidth = Math.round(width * imagePanelRatio);
  const textPanelWidth = width - imagePanelWidth;
  const padding = Math.round(Math.min(width, height) * 0.055);
  const headlineFontSize = Math.round(textPanelWidth * 0.115);
  const bodyFontSize = Math.round(height * 0.016);

  const heroClass = "orb-hero-split";
  const heroStyle = `.${heroClass} {
    width: ${imagePanelWidth}px;
    height: ${height}px;
    flex-shrink: 0;
    background-image: url('HERO_PATH_PLACEHOLDER');
    background-size: cover;
    background-position: ${tokens.imageFocalPoint};
  }`;

  const imagePanel = `<div class="${heroClass}"></div>`;
  const textPanel = `<div style="width:${textPanelWidth}px;height:${height}px;flex-shrink:0;background:${tokens.bgColor};display:flex;flex-direction:column;padding:${padding}px;gap:0;box-sizing:border-box;overflow:hidden;">
    <div style="flex-shrink:0;padding-bottom:${Math.round(padding * 0.6)}px;">
      ${logoHtmlFor(logoDataUri, tokens, "md")}
    </div>
    <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:${Math.round(padding * 0.4)}px;">
      <h1 style="font-family:'${tokens.headlineFontFamily}',sans-serif;font-weight:${tokens.headlineFontWeight};font-size:${headlineFontSize}px;line-height:1.1;color:${tokens.headlineColor};letter-spacing:-0.02em;">${escapeHtml(tokens.headline)}</h1>
      <p style="font-family:'${tokens.bodyFontFamily}',sans-serif;font-size:${bodyFontSize}px;line-height:1.55;color:${tokens.bodyColor};">${escapeHtml(tokens.subheadline)}</p>
    </div>
    <div style="flex-shrink:0;padding-top:${Math.round(padding * 0.5)}px;">
      <button style="width:100%;padding:${Math.round(padding * 0.38)}px ${Math.round(padding * 0.5)}px;background:${tokens.ctaBgColor};color:${tokens.ctaTextColor};border:none;border-radius:${tokens.ctaBorderRadius};font-family:'${tokens.bodyFontFamily}',sans-serif;font-size:${bodyFontSize}px;font-weight:600;cursor:pointer;letter-spacing:0.01em;">${escapeHtml(tokens.cta)}</button>
    </div>
  </div>`;

  const panels = imageOnRight
    ? `${textPanel}${imagePanel}`
    : `${imagePanel}${textPanel}`;

  const body = `<style>${heroStyle}</style>
<div style="width:${width}px;height:${height}px;display:flex;overflow:hidden;">
  ${panels}
</div>`.replace('HERO_PATH_PLACEHOLDER', heroPath);

  return htmlShell(width, height, tokens.googleFontsUrl, body);
}

/**
 * FULL-BLEED — Hero image fills canvas, gradient scrim, text overlaid.
 */
function renderFullBleed(
  width: number,
  height: number,
  heroPath: string,
  logoDataUri: string | null,
  tokens: LayoutTokens
): string {
  const padding = Math.round(Math.min(width, height) * 0.055);
  const headlineFontSize = Math.round(height * 0.052);
  const bodyFontSize = Math.round(height * 0.018);
  const scrimColor = tokens.bgColor;

  const heroClass = "orb-hero-fullbleed";
  const heroStyle = `.${heroClass} {
    position: absolute;
    inset: 0;
    background-image: url('HERO_PATH_PLACEHOLDER');
    background-size: cover;
    background-position: ${tokens.imageFocalPoint};
  }`;

  const body = `<style>${heroStyle}</style>
<div style="width:${width}px;height:${height}px;position:relative;overflow:hidden;">
  <div class="${heroClass}"></div>`.replace('HERO_PATH_PLACEHOLDER', heroPath) + `
  <div style="position:absolute;inset:0;background:linear-gradient(to bottom, transparent 25%, ${scrimColor}99 55%, ${scrimColor}f0 80%, ${scrimColor} 100%);"></div>
  <div style="position:absolute;top:${padding}px;left:${padding}px;">
    ${logoHtmlFor(logoDataUri, tokens, "md")}
  </div>
  <div style="position:absolute;bottom:${padding}px;left:${padding}px;right:${padding}px;display:flex;flex-direction:column;gap:${Math.round(padding * 0.35)}px;">
    <h1 style="font-family:'${tokens.headlineFontFamily}',sans-serif;font-weight:${tokens.headlineFontWeight};font-size:${headlineFontSize}px;line-height:1.1;color:${tokens.headlineColor};letter-spacing:-0.02em;">${escapeHtml(tokens.headline)}</h1>
    <p style="font-family:'${tokens.bodyFontFamily}',sans-serif;font-size:${bodyFontSize}px;line-height:1.5;color:${tokens.bodyColor};">${escapeHtml(tokens.subheadline)}</p>
    <button style="align-self:flex-start;padding:${Math.round(padding * 0.35)}px ${Math.round(padding * 0.7)}px;background:${tokens.ctaBgColor};color:${tokens.ctaTextColor};border:none;border-radius:${tokens.ctaBorderRadius};font-family:'${tokens.bodyFontFamily}',sans-serif;font-size:${Math.round(height * 0.016)}px;font-weight:600;cursor:pointer;">${escapeHtml(tokens.cta)}</button>
  </div>
</div>`;

  return htmlShell(width, height, tokens.googleFontsUrl, body);
}

/**
 * STACKED — Image top 55%, text panel bottom 45%.
 */
function renderStacked(
  width: number,
  height: number,
  heroPath: string,
  logoDataUri: string | null,
  tokens: LayoutTokens
): string {
  const imageHeight = Math.round(height * 0.55);
  const textHeight = height - imageHeight;
  const padding = Math.round(Math.min(width, height) * 0.055);
  const headlineFontSize = Math.round(width * 0.062);
  const bodyFontSize = Math.round(height * 0.016);

  const heroClass = "orb-hero-stacked";
  const heroStyle = `.${heroClass} {
    width: ${width}px;
    height: ${imageHeight}px;
    flex-shrink: 0;
    background-image: url('HERO_PATH_PLACEHOLDER');
    background-size: cover;
    background-position: ${tokens.imageFocalPoint};
    position: relative;
  }`;

  const body = (`<style>${heroStyle}</style>
<div style="width:${width}px;height:${height}px;display:flex;flex-direction:column;overflow:hidden;">
  <!-- Image zone: top 55% -->
  <div class="${heroClass}">`.replace('HERO_PATH_PLACEHOLDER', heroPath)) + `
    <div style="position:absolute;top:${padding}px;left:${padding}px;">
      ${logoHtmlFor(logoDataUri, tokens, "md")}
    </div>
  </div>
  <!-- Text zone: bottom 45% -->
  <div style="width:${width}px;height:${textHeight}px;flex-shrink:0;background:${tokens.bgColor};display:flex;flex-direction:column;padding:${padding}px;box-sizing:border-box;overflow:hidden;">
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:${Math.round(padding * 0.35)}px;">
      <h1 style="font-family:'${tokens.headlineFontFamily}',sans-serif;font-weight:${tokens.headlineFontWeight};font-size:${headlineFontSize}px;line-height:1.1;color:${tokens.headlineColor};letter-spacing:-0.02em;">${escapeHtml(tokens.headline)}</h1>
      <p style="font-family:'${tokens.bodyFontFamily}',sans-serif;font-size:${bodyFontSize}px;line-height:1.5;color:${tokens.bodyColor};">${escapeHtml(tokens.subheadline)}</p>
    </div>
    <div style="flex-shrink:0;">
      <button style="width:100%;padding:${Math.round(padding * 0.38)}px;background:${tokens.ctaBgColor};color:${tokens.ctaTextColor};border:none;border-radius:${tokens.ctaBorderRadius};font-family:'${tokens.bodyFontFamily}',sans-serif;font-size:${bodyFontSize}px;font-weight:600;cursor:pointer;">${escapeHtml(tokens.cta)}</button>
    </div>
  </div>
</div>`;

  return htmlShell(width, height, tokens.googleFontsUrl, body);
}

/**
 * PRODUCT-SPOTLIGHT — Product centered on clean brand-color field.
 * Product image is the subject, not the backdrop.
 * Layout: logo top-left | product image centered | headline below | CTA bottom
 */
function renderProductSpotlight(
  width: number,
  height: number,
  heroPath: string,
  logoDataUri: string | null,
  tokens: LayoutTokens
): string {
  const padding = Math.round(Math.min(width, height) * 0.055);
  const aspectRatio = height / width;
  const isStory = aspectRatio >= 1.6; // 9:16 = 1.78
  const isPortrait = aspectRatio >= 1.1 && !isStory; // 4:5 = 1.25
  // Scale product image to fill the available vertical space appropriately:
  //   Story (9:16): 80% of width — needs to dominate the tall canvas
  //   Portrait (4:5): 65% of width — balanced with copy below
  //   Square (1:1): 55% of shorter dimension — classic product card
  const productSize = isStory
    ? Math.round(width * 0.80)
    : isPortrait
      ? Math.round(width * 0.65)
      : Math.round(Math.min(width, height) * 0.55);
  const headlineFontSize = Math.round(width * 0.058);
  const bodyFontSize = Math.round(height * 0.016);

  const productClass = "orb-product-img";
  const productStyle = `.${productClass} {
    width: ${productSize}px;
    height: ${productSize}px;
    background-image: url('HERO_PATH_PLACEHOLDER');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }`;

  const body = (`<style>${productStyle}</style>
<div style="width:${width}px;height:${height}px;background:${tokens.bgColor};display:flex;flex-direction:column;padding:${padding}px;box-sizing:border-box;overflow:hidden;">
  <!-- Logo top -->
  <div style="flex-shrink:0;padding-bottom:${Math.round(padding * 0.4)}px;">`.replace('HERO_PATH_PLACEHOLDER', heroPath)) + `
    ${logoHtmlFor(logoDataUri, tokens, isStory ? "lg" : "md")}
  </div>
  <!-- Product image: centered, clean field -->
  <!-- For story format, align to flex-end so image sits closer to copy; otherwise center -->
  <div style="flex:1;min-height:0;display:flex;align-items:${isStory ? 'flex-end' : 'center'};justify-content:center;padding-bottom:${isStory ? Math.round(padding * 0.5) : 0}px;">
    <div class="orb-product-img"></div>
  </div>
  <!-- Copy + CTA bottom -->
  <div style="flex-shrink:0;display:flex;flex-direction:column;gap:${Math.round(padding * 0.3)}px;padding-top:${Math.round(padding * 0.4)}px;">
    <h1 style="font-family:'${tokens.headlineFontFamily}',sans-serif;font-weight:${tokens.headlineFontWeight};font-size:${headlineFontSize}px;line-height:1.1;color:${tokens.headlineColor};letter-spacing:-0.02em;text-align:center;">${escapeHtml(tokens.headline)}</h1>
    <p style="font-family:'${tokens.bodyFontFamily}',sans-serif;font-size:${bodyFontSize}px;line-height:1.5;color:${tokens.bodyColor};text-align:center;">${escapeHtml(tokens.subheadline)}</p>
    <button style="width:100%;padding:${Math.round(padding * 0.38)}px;background:${tokens.ctaBgColor};color:${tokens.ctaTextColor};border:none;border-radius:${tokens.ctaBorderRadius};font-family:'${tokens.bodyFontFamily}',sans-serif;font-size:${bodyFontSize}px;font-weight:600;cursor:pointer;margin-top:${Math.round(padding * 0.2)}px;">${escapeHtml(tokens.cta)}</button>
  </div>
</div>`;

  return htmlShell(width, height, tokens.googleFontsUrl, body);
}

/**
 * STAT-FORWARD — Large typographic stat dominates, small image accent, supporting copy.
 * For B2B/data-driven content.
 */
function renderStatForward(
  width: number,
  height: number,
  heroPath: string | null,
  logoDataUri: string | null,
  tokens: LayoutTokens
): string {
  const padding = Math.round(Math.min(width, height) * 0.065);
  const statFontSize = Math.round(Math.min(width, height) * 0.22);
  const statLabelFontSize = Math.round(height * 0.018);
  const headlineFontSize = Math.round(height * 0.038);
  const bodyFontSize = Math.round(height * 0.016);

  // Optional small image accent (top-right corner, 30% width)
  const imageAccentSize = Math.round(width * 0.28);
  const accentClass = "orb-stat-accent";
  const accentStyle = heroPath ? `.${accentClass} {
    position: absolute;
    top: ${padding}px;
    right: ${padding}px;
    width: ${imageAccentSize}px;
    height: ${imageAccentSize}px;
    border-radius: ${tokens.ctaBorderRadius};
    background-image: url('HERO_PATH_PLACEHOLDER');
    background-size: cover;
    background-position: ${tokens.imageFocalPoint};
    opacity: 0.85;
  }` : "";
  const imageAccentHtml = heroPath ? `<div class="${accentClass}"></div>` : "";

  const stat = tokens.stat || "—";
  const statLabel = tokens.statLabel || "";

  const accentStyleBlock = accentStyle ? `<style>${accentStyle.replace('HERO_PATH_PLACEHOLDER', heroPath ?? '')}</style>` : '';

  const body = `${accentStyleBlock}<div style="width:${width}px;height:${height}px;background:${tokens.bgColor};position:relative;display:flex;flex-direction:column;padding:${padding}px;box-sizing:border-box;overflow:hidden;">
  ${imageAccentHtml}
  <!-- Logo top-left -->
  <div style="flex-shrink:0;padding-bottom:${Math.round(padding * 0.5)}px;position:relative;z-index:1;">
    ${logoHtmlFor(logoDataUri, tokens, "md")}
  </div>
  <!-- Stat block: centered -->
  <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:${Math.round(padding * 0.15)}px;position:relative;z-index:1;">
    <div style="font-family:'${tokens.headlineFontFamily}',sans-serif;font-weight:800;font-size:${statFontSize}px;line-height:0.9;color:${tokens.headlineColor};letter-spacing:-0.04em;">${escapeHtml(stat)}</div>
    ${statLabel ? `<div style="font-family:'${tokens.bodyFontFamily}',sans-serif;font-size:${statLabelFontSize}px;font-weight:600;color:${tokens.bodyColor};text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(statLabel)}</div>` : ""}
    <div style="width:${Math.round(width * 0.12)}px;height:3px;background:${tokens.ctaBgColor};margin-top:${Math.round(padding * 0.3)}px;"></div>
    <h2 style="font-family:'${tokens.headlineFontFamily}',sans-serif;font-weight:${tokens.headlineFontWeight};font-size:${headlineFontSize}px;line-height:1.2;color:${tokens.headlineColor};margin-top:${Math.round(padding * 0.2)}px;">${escapeHtml(tokens.headline)}</h2>
    <p style="font-family:'${tokens.bodyFontFamily}',sans-serif;font-size:${bodyFontSize}px;line-height:1.55;color:${tokens.bodyColor};">${escapeHtml(tokens.subheadline)}</p>
  </div>
  <!-- CTA bottom -->
  <div style="flex-shrink:0;padding-top:${Math.round(padding * 0.5)}px;position:relative;z-index:1;">
    <button style="padding:${Math.round(padding * 0.35)}px ${Math.round(padding * 0.7)}px;background:${tokens.ctaBgColor};color:${tokens.ctaTextColor};border:none;border-radius:${tokens.ctaBorderRadius};font-family:'${tokens.bodyFontFamily}',sans-serif;font-size:${bodyFontSize}px;font-weight:600;cursor:pointer;">${escapeHtml(tokens.cta)}</button>
  </div>
</div>`;

  return htmlShell(width, height, tokens.googleFontsUrl, body);
}

/**
 * TEXT-DOMINANT — Minimal or no image, typography-led on brand background.
 * For quotes, announcements, editorial brands.
 */
function renderTextDominant(
  width: number,
  height: number,
  logoDataUri: string | null,
  tokens: LayoutTokens
): string {
  const padding = Math.round(Math.min(width, height) * 0.07);
  const headlineFontSize = Math.round(Math.min(width, height) * 0.085);
  const bodyFontSize = Math.round(height * 0.019);

  const body = `<div style="width:${width}px;height:${height}px;background:${tokens.bgColor};display:flex;flex-direction:column;padding:${padding}px;box-sizing:border-box;overflow:hidden;">
  <div style="flex-shrink:0;padding-bottom:${Math.round(padding * 0.5)}px;">
    ${logoHtmlFor(logoDataUri, tokens, "md")}
  </div>
  <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:${Math.round(padding * 0.4)}px;">
    <h1 style="font-family:'${tokens.headlineFontFamily}',sans-serif;font-weight:${tokens.headlineFontWeight};font-size:${headlineFontSize}px;line-height:1.05;color:${tokens.headlineColor};letter-spacing:-0.03em;">${escapeHtml(tokens.headline)}</h1>
    <p style="font-family:'${tokens.bodyFontFamily}',sans-serif;font-size:${bodyFontSize}px;line-height:1.6;color:${tokens.bodyColor};">${escapeHtml(tokens.subheadline)}</p>
  </div>
  <div style="flex-shrink:0;padding-top:${Math.round(padding * 0.5)}px;">
    <button style="padding:${Math.round(padding * 0.38)}px ${Math.round(padding * 0.7)}px;background:${tokens.ctaBgColor};color:${tokens.ctaTextColor};border:none;border-radius:${tokens.ctaBorderRadius};font-family:'${tokens.bodyFontFamily}',sans-serif;font-size:${Math.round(height * 0.016)}px;font-weight:600;cursor:pointer;">${escapeHtml(tokens.cta)}</button>
  </div>
</div>`;

  return htmlShell(width, height, tokens.googleFontsUrl, body);
}

// ─── Main Render Dispatcher ───────────────────────────────────────────────────

/**
 * renderLayout — dispatches to the correct TypeScript layout renderer based on
 * the layoutVariant token Haiku selected. TypeScript executes, Haiku chose.
 */
export function renderLayout(
  tokens: LayoutTokens,
  width: number,
  height: number,
  heroPath: string,
  logoDataUri: string | null
): string {
  switch (tokens.layoutVariant) {
    case "editorial-split":
      return renderEditorialSplit(width, height, heroPath, logoDataUri, tokens, false);
    case "editorial-split-right":
      return renderEditorialSplit(width, height, heroPath, logoDataUri, tokens, true);
    case "full-bleed":
      return renderFullBleed(width, height, heroPath, logoDataUri, tokens);
    case "stacked":
      return renderStacked(width, height, heroPath, logoDataUri, tokens);
    case "product-spotlight":
      return renderProductSpotlight(width, height, heroPath, logoDataUri, tokens);
    case "stat-forward":
      return renderStatForward(width, height, heroPath, logoDataUri, tokens);
    case "text-dominant":
      return renderTextDominant(width, height, logoDataUri, tokens);
    default:
      return renderEditorialSplit(width, height, heroPath, logoDataUri, tokens, false);
  }
}
