/**
 * Orb Guardrail Validator
 * Validates generated HTML against quality and brand constraints.
 * Ported from guardrails.py
 */

export interface GuardrailResult {
  passed: boolean;
  failures: string[];
  warnings: string[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function hasWatermark(html: string): boolean {
  const upper = html.toUpperCase();
  return upper.includes("CONTENTPRODUCTION.AI") && upper.includes("MADE WITH ORB");
}

function hasNonPxFontSizes(html: string): string[] {
  // Match font-size with non-px units (rem, em, vh, vw, %)
  const matches = html.matchAll(/font-size\s*:\s*[\d.]+\s*(rem|em|vh|vw|%)/gi);
  return Array.from(matches).map((m) => m[0]);
}

function extractInlineFontSizes(html: string): number[] {
  const sizes: number[] = [];
  const matches = html.matchAll(/font-size\s*:\s*([\d.]+)\s*px/gi);
  for (const m of matches) {
    sizes.push(parseFloat(m[1]));
  }
  return sizes;
}

function extractTextContent(html: string): string {
  // Remove tags and collapse whitespace
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function checkCanvasDimensions(
  html: string,
  canvasWidth: number,
  canvasHeight: number
): string[] {
  const failures: string[] = [];
  const widthStr = String(canvasWidth);
  const heightStr = String(canvasHeight);
  const htmlCompact = html.replace(/\s/g, "");
  if (
    !html.includes(`${widthStr}px`) &&
    !htmlCompact.includes(`width:${widthStr}`)
  ) {
    failures.push(`Canvas width ${canvasWidth}px not found in HTML`);
  }
  if (
    !html.includes(`${heightStr}px`) &&
    !htmlCompact.includes(`height:${heightStr}`)
  ) {
    failures.push(`Canvas height ${canvasHeight}px not found in HTML`);
  }
  return failures;
}

function checkMinimumFontSizes(html: string): string[] {
  const failures: string[] = [];
  const nonPx = hasNonPxFontSizes(html);
  if (nonPx.length > 0) {
    failures.push(`Non-px font sizes detected: ${nonPx.slice(0, 5).join(", ")}`);
  }
  const pxSizes = extractInlineFontSizes(html);
  if (pxSizes.length > 0) {
    const minSize = Math.min(...pxSizes);
    if (minSize < 12) {
      failures.push(`Font size too small: ${minSize}px (minimum 12px for any text)`);
    }
  }
  return failures;
}

function checkWordCount(html: string, maxWords: number): string[] {
  const failures: string[] = [];
  // Remove watermark text before counting
  const htmlNoWatermark = html
    .replace(/CONTENTPRODUCTION\.AI/gi, "")
    .replace(/MADE WITH ORB/gi, "");
  const text = extractTextContent(htmlNoWatermark);
  const wordCount = countWords(text);
  if (wordCount > maxWords) {
    failures.push(
      `Word count too high: ${wordCount} words (maximum ${maxWords})`
    );
  }
  return failures;
}

// ─── Main Validator ───────────────────────────────────────────────────────────

export function validateHtml(
  html: string,
  canvasWidth = 1080,
  canvasHeight = 1350,
  maxWords = 25
): GuardrailResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  // 1. Canvas dimensions
  failures.push(...checkCanvasDimensions(html, canvasWidth, canvasHeight));

  // 2 & 3. Font sizes
  failures.push(...checkMinimumFontSizes(html));

  // 4. Word count
  failures.push(...checkWordCount(html, maxWords));

  // 5. Watermark
  if (!hasWatermark(html)) {
    failures.push(
      "Watermark missing: must include 'CONTENTPRODUCTION.AI' and 'MADE WITH ORB'"
    );
  }

  // 6. Unreplaced LOGO_PLACEHOLDER
  if (html.includes("LOGO_PLACEHOLDER")) {
    failures.push("LOGO_PLACEHOLDER not replaced — logo injection failed");
  }

  // 7. No JavaScript
  if (/<script/i.test(html)) {
    failures.push("JavaScript found in output — HTML must be static");
  }

  // 8. Google Fonts (warning only)
  if (
    !html.includes("fonts.googleapis.com") &&
    !html.includes("fonts.gstatic.com")
  ) {
    warnings.push(
      "No Google Fonts link detected — brand typography may not render correctly"
    );
  }

  return {
    passed: failures.length === 0,
    failures,
    warnings,
  };
}
