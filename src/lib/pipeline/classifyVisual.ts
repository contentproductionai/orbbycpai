/**
 * classifyVisual.ts — Claude Vision Classification
 *
 * Responsibility: CLASSIFICATION ONLY. No discovery.
 *
 * Receives:
 *   - A viewport screenshot of the website (JPEG, ~100-200kb)
 *   - scoredPalette: colors discovered by DOM scan, with sources
 *   - discoveredFonts: font families discovered by DOM scan, with elements seen on
 *
 * Returns:
 *   - colors: each palette entry tagged with a semantic role (primary | secondary | accent | structural)
 *   - fonts: each font tagged with a semantic role (heading | body | ui | unknown)
 *   - brandPrimary, brandSecondary, accentColor: top-scored color per role
 *   - headingFont, bodyFont, uiFont: font per role
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";

export interface ScoredColor {
  hex: string;
  score: number;
  sources: string[];
  totalArea?: number;
}

export interface DiscoveredFont {
  family: string;
  seenOn: string[];
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

export async function classifyVisual(
  viewportScreenshotPath: string,
  scoredPalette: ScoredColor[],
  discoveredFonts: DiscoveredFont[]
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

  const paletteJson = JSON.stringify(
    scoredPalette.map((c) => ({ hex: c.hex, score: c.score, sources: c.sources.slice(0, 5) })),
    null,
    2
  );

  const fontsJson = JSON.stringify(
    discoveredFonts.map((f) => ({ family: f.family, seenOn: f.seenOn })),
    null,
    2
  );

  const prompt = `You are a brand designer analyzing a website screenshot.

You will be given:
1. A screenshot of the website's above-the-fold viewport
2. A scoredPalette: colors discovered from the website's DOM, with the elements they came from and a score
3. discoveredFonts: font families found in the DOM, with the elements they appeared on

Your job is CLASSIFICATION ONLY. Do not invent new colors or fonts. Only classify what is in the lists.

For each color in scoredPalette, assign exactly one semantic role:
- "primary": The dominant brand color that defines the visual identity. Usually the most visually prominent non-white, non-black color. For a dark-themed site this may be a dark color. For a light-themed site this is typically a saturated color used in key brand moments.
- "secondary": A supporting brand color used alongside the primary. Often a lighter or darker variant, or a complementary color.
- "accent": A high-contrast color used for CTAs, highlights, or interactive elements. Often the most saturated or vibrant color on the page.
- "structural": White, black, near-white, near-black, or gray used purely for layout/text — not a brand color.

For each font in discoveredFonts, assign exactly one semantic role:
- "heading": Used for H1, H2, H3 — the display/title font
- "body": Used for paragraphs, body text
- "ui": Used for buttons, nav links, labels, form elements
- "unknown": Cannot determine

Rules:
- Every color must get exactly one role. Do not skip any.
- Every font must get exactly one role. Do not skip any.
- If two colors could both be "primary", pick the one that is most visually dominant in the screenshot.
- If unsure between "primary" and "secondary", prefer "secondary" — only one color should be "primary".
- White (#ffffff or near-white) and black (#000000 or near-black) are almost always "structural" unless the entire site is monochromatic.

scoredPalette:
${paletteJson}

discoveredFonts:
${fontsJson}

Respond with ONLY valid JSON in this exact format, no explanation:
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
        content: prompt + "\n\n(No screenshot available — classify based on source labels only.)",
      });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages,
    });

    responseText = (response.content[0] as { text: string }).text.trim();
  } catch (e) {
    console.error("[classifyVisual] Claude API error:", (e as Error).message);
    // Fall back to score-based ordering with no classification
    return buildFallback(scoredPalette, discoveredFonts);
  }

  // Parse Claude's response
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    const parsed = JSON.parse(jsonMatch[0]) as {
      colors: Array<{ hex: string; role: string }>;
      fonts: Array<{ family: string; role: string }>;
    };

    // Merge Claude's classifications back into the scored palette
    const classifiedColors: ClassifiedColor[] = scoredPalette.map((c) => {
      const classification = parsed.colors.find(
        (pc) => pc.hex.toLowerCase() === c.hex.toLowerCase()
      );
      return {
        ...c,
        role: (classification?.role ?? "structural") as ClassifiedColor["role"],
      };
    });

    const classifiedFonts: ClassifiedFont[] = discoveredFonts.map((f) => {
      const classification = parsed.fonts.find(
        (pf) => pf.family.toLowerCase() === f.family.toLowerCase()
      );
      return {
        ...f,
        role: (classification?.role ?? "unknown") as ClassifiedFont["role"],
      };
    });

    // Pick winners per role (highest score wins within each role)
    const topByRole = (role: ClassifiedColor["role"]) =>
      classifiedColors
        .filter((c) => c.role === role)
        .sort((a, b) => b.score - a.score)[0]?.hex ?? null;

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
    return buildFallback(scoredPalette, discoveredFonts);
  }
}

// Fallback: no Claude classification — use score order, skip obvious white/black
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
