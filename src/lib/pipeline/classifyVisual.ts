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

  const paletteJson = JSON.stringify(
    scoredPalette.map((c) => ({ hex: c.hex, score: c.score, sources: c.sources.slice(0, 5) })),
    null,
    2
  );

  // Build a readable per-element font table for Claude
  // Separate high-signal content elements from low-signal structural ones
  const highSignalElements = ["h1", "h2", "h3", "h4", "p", "li", "blockquote"];
  const lowSignalElements = ["body", "footer"];

  const highSignalRows = highSignalElements
    .filter((el) => fontElementMap[el] !== undefined)
    .map((el) => `  ${el}: ${fontElementMap[el] ?? "(only system fonts)"}`)
    .join("\n");

  const lowSignalRows = lowSignalElements
    .filter((el) => fontElementMap[el] !== undefined)
    .map((el) => `  ${el}: ${fontElementMap[el] ?? "(only system fonts)"}`)
    .join("\n");

  const otherRows = Object.entries(fontElementMap)
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

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages,
    });

    responseText = (response.content[0] as { text: string }).text.trim();
  } catch (e) {
    console.error("[classifyVisual] Claude API error:", (e as Error).message);
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

    // Merge Claude's color classifications back into the scored palette
    const classifiedColors: ClassifiedColor[] = scoredPalette.map((c) => {
      const classification = parsed.colors.find(
        (pc) => pc.hex.toLowerCase() === c.hex.toLowerCase()
      );
      return {
        ...c,
        role: (classification?.role ?? "structural") as ClassifiedColor["role"],
      };
    });

    // Merge Claude's font classifications back into the discovered fonts list
    const classifiedFonts: ClassifiedFont[] = discoveredFonts.map((f) => {
      const classification = parsed.fonts.find(
        (pf) => pf.family.toLowerCase() === f.family.toLowerCase()
      );
      return {
        ...f,
        role: (classification?.role ?? "unknown") as ClassifiedFont["role"],
      };
    });

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
    return buildFallback(scoredPalette, discoveredFonts);
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
