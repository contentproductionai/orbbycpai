/**
 * classifyVisual.ts — Claude Vision Classification
 *
 * Responsibility: CLASSIFICATION ONLY. No discovery.
 *
 * Receives:
 *   - A viewport screenshot of the website (JPEG, ~100-200kb)
 *   - scoredPalette: colors discovered by DOM scan, with sources and scores
 *   - discoveredFonts: font families discovered by DOM scan, ranked by score
 *   - fontElementMap: per-element font assignments from the DOM
 *     e.g. { h1: "Poppins", h2: "Poppins", body: "Open Sans", footer: "Open Sans" }
 *
 * Claude's job for fonts:
 *   - Receive the per-element map showing what the DOM says each element uses
 *   - Look at the screenshot and confirm or correct each assignment
 *   - Body/footer are low-signal (theme defaults) — if the screenshot shows
 *     something different, Claude's visual read wins
 *   - Assign semantic roles: heading | body | ui | unknown
 *
 * Returns:
 *   - colors: each palette entry tagged with a semantic role
 *   - fonts: each font tagged with a semantic role
 *   - brandPrimary, brandSecondary, accentColor: top-scored color per role
 *   - headingFont, bodyFont, uiFont: font per role
 *
 * THIN PALETTE FALLBACK:
 *   When the DOM palette has fewer than 4 colors OR all top colors are neutral
 *   (white, black, near-white, near-black), the DOM scanner failed to capture
 *   the brand's actual colors (common with CSS-in-JS frameworks like Shopify
 *   Hydrogen, Next.js with Tailwind, etc.). In this case, we run a separate
 *   screenshot-only pass asking Claude Vision to directly identify brand colors
 *   from the visual, bypassing the DOM palette entirely.
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import { withAnthropicRetry } from "@/lib/utils/anthropicRetry";

export interface ScoredColor {
  hex: string;
  score: number;
  sources: string[];
  totalArea?: number;
}

export interface DiscoveredFont {
  family: string;
  seenOn: string[];
  score?: number;
}

export interface ClassifiedColor extends ScoredColor {
  role: "primary" | "secondary" | "accent" | "structural";
}

export interface ClassifiedFont extends DiscoveredFont {
  role: "heading" | "body" | "ui" | "unknown";
}

export interface VisualClassification {
  colors: ClassifiedColor[];
  fonts: ClassifiedFont[];
  brandPrimary: string | null;
  brandSecondary: string | null;
  accentColor: string | null;
  headingFont: string | null;
  bodyFont: string | null;
  uiFont: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Returns true if a color is effectively white, black, or near-neutral gray */
function isNeutral(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const [r, g, b] = rgb;
  const lum = relativeLuminance(hex);
  // Near-white or near-black
  if (lum > 0.85 || lum < 0.02) return true;
  // Low saturation (gray)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  return saturation < 0.12;
}

/**
 * Returns true when the DOM palette is too thin to be reliable:
 * - Fewer than 4 colors, OR
 * - All top-3 colors are neutral (white/black/gray)
 */
function isThinPalette(palette: ScoredColor[]): boolean {
  if (palette.length < 4) return true;
  const top3 = palette.slice(0, 3);
  return top3.every((c) => isNeutral(c.hex));
}

// ─── Screenshot-only color sampling (thin palette escape hatch) ───────────────

async function sampleColorsFromScreenshot(
  client: Anthropic,
  imageBase64: string,
  imageMediaType: "image/jpeg" | "image/png"
): Promise<Array<{ hex: string; role: "primary" | "secondary" | "accent" | "structural" }>> {
  const prompt = `You are a brand designer. Look at this website screenshot and identify the brand's key colors.

The DOM color scanner failed to capture this brand's palette (likely due to CSS-in-JS or dynamic styling).
You must identify the colors directly from the visual.

Look for:
1. The dominant background color of the hero/main section (not white/black unless the entire site is monochromatic)
2. The primary brand color — the most visually prominent non-neutral color (used in logos, key UI elements, backgrounds)
3. Any accent/highlight color used for CTAs, badges, or emphasis

Return ONLY valid JSON:
{
  "colors": [
    { "hex": "#xxxxxx", "role": "primary", "description": "what you see" },
    { "hex": "#xxxxxx", "role": "secondary", "description": "what you see" },
    { "hex": "#xxxxxx", "role": "accent", "description": "what you see" }
  ]
}

Rules:
- All hex values must be 6-digit lowercase hex (e.g. #1a5c4a)
- Only include colors you can actually see in the screenshot
- Do NOT include pure white (#ffffff) or pure black (#000000) as primary/secondary/accent
- If you can only identify 1-2 brand colors, only include those
- If the site is genuinely monochromatic (only white and black), return an empty colors array`;

  try {
    const response = await withAnthropicRetry(
      () => client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: imageMediaType, data: imageBase64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
      "classifyVisual:screenshotColorSample"
    );
    const text = (response.content[0] as { text: string }).text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as {
      colors: Array<{ hex: string; role: string }>;
    };
    return (parsed.colors ?? [])
      .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c.hex))
      .map((c) => ({
        hex: c.hex.toLowerCase(),
        role: (["primary", "secondary", "accent", "structural"].includes(c.role)
          ? c.role
          : "structural") as ClassifiedColor["role"],
      }));
  } catch (e) {
    console.warn("[classifyVisual] Screenshot color sampling failed:", (e as Error).message);
    return [];
  }
}

// ─── Main classifier ──────────────────────────────────────────────────────────

export async function classifyVisual(
  viewportScreenshotPath: string,
  scoredPalette: ScoredColor[],
  discoveredFonts: DiscoveredFont[],
  fontElementMap: Record<string, string | null> = {}
): Promise<VisualClassification> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Read screenshot as base64
  let imageBase64 = "";
  let imageMediaType: "image/jpeg" | "image/png" = "image/jpeg";
  try {
    const buf = fs.readFileSync(viewportScreenshotPath);
    imageBase64 = buf.toString("base64");
    imageMediaType = viewportScreenshotPath.endsWith(".png") ? "image/png" : "image/jpeg";
  } catch (e) {
    console.warn("[classifyVisual] Could not read screenshot:", (e as Error).message);
  }

  // ── Thin palette escape hatch ─────────────────────────────────────────────
  // When the DOM scanner returns fewer than 4 colors or all top colors are neutral,
  // run a screenshot-only color sampling pass to recover brand colors that the
  // DOM scanner missed (CSS-in-JS, dynamic theming, Shopify Hydrogen, etc.)
  let effectivePalette = scoredPalette;
  if (isThinPalette(scoredPalette) && imageBase64) {
    console.log(`[classifyVisual] Thin palette detected (${scoredPalette.length} colors, top 3 are neutral) — running screenshot color sampling`);
    const screenshotColors = await sampleColorsFromScreenshot(client, imageBase64, imageMediaType);
    if (screenshotColors.length > 0) {
      console.log(`[classifyVisual] Screenshot sampling recovered ${screenshotColors.length} brand colors`);
      // Merge screenshot colors into the palette as synthetic entries with high scores
      // so they win the classification step. Score them above DOM entries.
      const syntheticEntries: ScoredColor[] = screenshotColors.map((c, i) => ({
        hex: c.hex,
        score: 100 - i * 10, // 100, 90, 80 — higher than typical DOM scores
        sources: ["screenshot:visual-sampling"],
      }));
      // Keep DOM palette entries that aren't already covered by screenshot colors
      const screenshotHexes = new Set(screenshotColors.map((c) => c.hex.toLowerCase()));
      const domOnly = scoredPalette.filter((c) => !screenshotHexes.has(c.hex.toLowerCase()));
      effectivePalette = [...syntheticEntries, ...domOnly];
    }
  }

  const paletteJson = JSON.stringify(
    effectivePalette.map((c) => ({ hex: c.hex, score: c.score, sources: c.sources.slice(0, 5) })),
    null,
    2
  );

  // ── Font contamination detection ─────────────────────────────────────────
  // When a third-party widget (Klaviyo, Intercom, chat, etc.) injects a font
  // via CSS inheritance, every element reports the same font family in
  // computed styles. This is a false signal — the widget's font is not the
  // brand's font. Detect this by checking if all high-signal elements report
  // the same font AND that font is not in the discoveredFonts list (meaning
  // it was loaded by a third party, not the brand's own stylesheet).
  const allElementFonts = Object.values(fontElementMap).filter(Boolean) as string[];
  const uniqueElementFonts = new Set(allElementFonts.map((f) => f.toLowerCase().trim()));
  const discoveredFontNames = new Set(discoveredFonts.map((f) => f.family.toLowerCase().trim()));
  const isContaminated =
    uniqueElementFonts.size === 1 &&
    allElementFonts.length >= 5 &&
    !discoveredFontNames.has([...uniqueElementFonts][0]);
  const effectiveFontElementMap = isContaminated ? {} : fontElementMap;
  if (isContaminated) {
    console.log(`[classifyVisual] Font contamination detected — all elements report '${[...uniqueElementFonts][0]}' which is not in discoveredFonts. Clearing element map, using discoveredFonts list only.`);
  }

  // Build a readable per-element font table for Claude
  // Separate high-signal content elements from low-signal structural ones
  const highSignalElements = ["h1", "h2", "h3", "h4", "p", "li", "blockquote"];
  const lowSignalElements = ["body", "footer"];

  const highSignalRows = highSignalElements
    .filter((el) => effectiveFontElementMap[el] !== undefined)
    .map((el) => `  ${el}: ${effectiveFontElementMap[el] ?? "(only system fonts)"}`)
    .join("\n");

  const lowSignalRows = lowSignalElements
    .filter((el) => effectiveFontElementMap[el] !== undefined)
    .map((el) => `  ${el}: ${effectiveFontElementMap[el] ?? "(only system fonts)"}`)
    .join("\n");

  const otherRows = Object.entries(effectiveFontElementMap)
    .filter(([el]) => !highSignalElements.includes(el) && !lowSignalElements.includes(el))
    .map(([el, fam]) => `  ${el}: ${fam ?? "(only system fonts)"}`)
    .join("\n");

  const fontElementSection = [
    "HIGH-SIGNAL content elements (h1-h4, p, li, blockquote — what users actually read):",
    highSignalRows || "  (none found)",
    "",
    "MEDIUM-SIGNAL interactive elements (nav, button, form):",
    otherRows || "  (none found)",
    "",
    "LOW-SIGNAL structural elements (body, footer — often theme defaults, frequently overridden):",
    lowSignalRows || "  (none found)",
  ].join("\n");

  const rankedFontsJson = JSON.stringify(
    discoveredFonts.map((f) => ({ family: f.family, score: f.score ?? 0, seenOn: f.seenOn })),
    null,
    2
  );

  const prompt = `You are a brand designer analyzing a website screenshot.

You will be given:
1. A screenshot of the website's above-the-fold viewport
2. scoredPalette: colors discovered from the DOM, with scores and source elements
3. fontElementMap: what the DOM's computed styles say each element type uses
4. rankedFonts: all discovered font families ranked by how often they appear on content elements

Your job is CLASSIFICATION ONLY. Do not invent new colors or fonts.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COLOR CLASSIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For each color in scoredPalette, assign exactly one role:
- "primary": The dominant brand color defining the visual identity. Most visually prominent non-white, non-black color.
- "secondary": A supporting brand color used alongside the primary.
- "accent": High-contrast color for CTAs, highlights, interactive elements.
- "structural": White, black, near-white, near-black, or gray used for layout/text only.

Rules:
- Every color must get exactly one role.
- Only one color should be "primary".
- White and black are almost always "structural" unless the site is monochromatic.
- Use the screenshot to break ties — the most visually dominant non-neutral color is "primary".
- Colors with source "screenshot:visual-sampling" were recovered directly
  from the screenshot — treat them as high-confidence brand colors.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FONT CLASSIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The fontElementMap shows what the DOM says each element uses.
HIGH-SIGNAL elements (h1-h4, p, li) are reliable — they reflect what users actually read.
LOW-SIGNAL elements (body, footer) are often WordPress/theme defaults that get overridden everywhere.

Your task:
1. Look at the screenshot. What font do the visible headings (H1, H2, H3) actually use?
2. What font does the body/paragraph text actually use?
3. If the screenshot shows a font that contradicts a LOW-SIGNAL DOM entry, trust the screenshot.
4. If the screenshot confirms a HIGH-SIGNAL DOM entry, use that.
5. Assign each font in rankedFonts exactly one role: "heading" | "body" | "ui" | "unknown".

CRITICAL RULES — null is never acceptable for headingFont or bodyFont:
- heading and body are ALWAYS distinct roles, even if the same font family appears on both elements.
- If the same font is used for both headings and body text (e.g. Poppins on h1, h2, h3, AND p), include it TWICE in the fonts array — once with role "heading" and once with role "body".
- If only one font exists on the entire site, still include it twice with both roles.
- If no heading font can be identified, use "Arial" as the heading font.
- If no body font can be identified, use "Arial" as the body font.
- The downstream template renderer will crash if either is null. Your response MUST always include at least one entry with role "heading" and one with role "body".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INPUT DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

scoredPalette:
${paletteJson}

fontElementMap (DOM computed styles per element type):
${fontElementSection}

rankedFonts (all discovered fonts, ranked by content-element frequency):
${rankedFontsJson}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Respond with ONLY valid JSON, no explanation:
{
  "colors": [
    { "hex": "#xxxxxx", "role": "primary|secondary|accent|structural" }
  ],
  "fonts": [
    { "family": "Font Name", "role": "heading|body|ui|unknown" }
  ]
}`;

  let responseText = "";
  try {
    const messages: Anthropic.MessageParam[] = [];

    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: imageMediaType,
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      });
    } else {
      // No screenshot — text-only fallback
      messages.push({
        role: "user",
        content: prompt + "\n\n(No screenshot available — classify based on DOM data only.)",
      });
    }

    const response = await withAnthropicRetry(
      () => client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages,
      }),
      "classifyVisual"
    );

    responseText = (response.content[0] as { text: string }).text.trim();
  } catch (e) {
    console.error("[classifyVisual] Claude API error:", (e as Error).message);
    return buildFallback(effectivePalette, discoveredFonts);
  }

  // Parse Claude's response
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    const parsed = JSON.parse(jsonMatch[0]) as {
      colors: Array<{ hex: string; role: string }>;
      fonts: Array<{ family: string; role: string }>;
    };

    // Merge Claude's color classifications back into the effective palette
    const classifiedColors: ClassifiedColor[] = effectivePalette.map((c) => {
      const classification = parsed.colors.find(
        (pc) => pc.hex.toLowerCase() === c.hex.toLowerCase()
      );
      return {
        ...c,
        role: (classification?.role ?? "structural") as ClassifiedColor["role"],
      };
    });

    // Merge Claude's font classifications back into the discovered fonts list.
    // Claude may return the same font twice with different roles (e.g. Poppins as both
    // heading and body). We expand those into separate entries so topFontByRole works.
    const classifiedFonts: ClassifiedFont[] = [];
    for (const f of discoveredFonts) {
      const matches = parsed.fonts.filter(
        (pf) => pf.family.toLowerCase() === f.family.toLowerCase()
      );
      if (matches.length === 0) {
        classifiedFonts.push({ ...f, role: "unknown" });
      } else {
        for (const m of matches) {
          classifiedFonts.push({ ...f, role: m.role as ClassifiedFont["role"] });
        }
      }
    }

    // Hard guarantees: headingFont and bodyFont are never null.
    // These are always distinct roles. If Claude missed either, default to Arial.
    const hasHeadingFont = classifiedFonts.some((f) => f.role === "heading");
    if (!hasHeadingFont) {
      classifiedFonts.push({ family: "Arial", seenOn: [], score: 0, role: "heading" });
    }
    const hasBodyFont = classifiedFonts.some((f) => f.role === "body");
    if (!hasBodyFont) {
      classifiedFonts.push({ family: "Arial", seenOn: [], score: 0, role: "body" });
    }

    // Pick winners per role (highest score wins within each role for colors)
    const topByRole = (role: ClassifiedColor["role"]) =>
      classifiedColors
        .filter((c) => c.role === role)
        .sort((a, b) => b.score - a.score)[0]?.hex ?? null;

    // For fonts: first match in the ranked list (already sorted by content-element frequency)
    const topFontByRole = (role: ClassifiedFont["role"]) =>
      classifiedFonts.find((f) => f.role === role)?.family ?? null;

    return {
      colors: classifiedColors,
      fonts: classifiedFonts,
      brandPrimary: topByRole("primary"),
      brandSecondary: topByRole("secondary"),
      accentColor: topByRole("accent"),
      headingFont: topFontByRole("heading"),
      bodyFont: topFontByRole("body"),
      uiFont: topFontByRole("ui"),
    };
  } catch (e) {
    console.error("[classifyVisual] Failed to parse Claude response:", (e as Error).message);
    console.error("[classifyVisual] Raw response:", responseText);
    return buildFallback(effectivePalette, discoveredFonts);
  }
}

// Fallback: no Claude classification — use score order
function buildFallback(
  scoredPalette: ScoredColor[],
  discoveredFonts: DiscoveredFont[]
): VisualClassification {
  const colors: ClassifiedColor[] = scoredPalette.map((c, i) => ({
    ...c,
    role: (i === 0 ? "primary" : i === 1 ? "secondary" : i === 2 ? "accent" : "structural") as ClassifiedColor["role"],
  }));
  const fonts: ClassifiedFont[] = discoveredFonts.map((f, i) => ({
    ...f,
    role: (i === 0 ? "heading" : i === 1 ? "body" : "ui") as ClassifiedFont["role"],
  }));
  return {
    colors,
    fonts,
    brandPrimary: colors[0]?.hex ?? null,
    brandSecondary: colors[1]?.hex ?? null,
    accentColor: colors[2]?.hex ?? null,
    headingFont: fonts[0]?.family ?? null,
    bodyFont: fonts[1]?.family ?? null,
    uiFont: fonts[2]?.family ?? null,
  };
}
