/**
 * assembleHtml.ts
 *
 * Builds a complete, self-contained HTML document from a layout selection.
 * Replaces the free-generation generateComposition() call with deterministic
 * template assembly.
 *
 * The output HTML:
 *   - Embeds fonts.css with absolute file:// paths to local woff2 files
 *   - Embeds layouts.css inline
 *   - Injects CSS custom properties from the layout selection
 *   - Fills copy slots from the creative brief
 *   - Injects hero image and logo as base64 data URIs
 *   - Scales to any of the four platform sizes via CSS transform
 *
 * Platform sizes (all layouts are authored at 1080×1080, then scaled):
 *   portrait   1080×1350  → scale(1.0) + clip top/bottom
 *   square     1080×1080  → scale(1.0) (native)
 *   story      1080×1920  → scale(1.0) + extend vertically
 *   landscape  1200×628   → scale(0.582) + letterbox
 */

import * as fs from "fs";
import * as path from "path";
import type { BrandProfile } from "../pipeline/classifyBrand";
import type { CreativeBrief } from "../pipeline/compositorGenerate";
import type { FullCreativeBrief } from "../pipeline/compositorAgents";
import { selectLayout, type LayoutSelection } from "./layoutSelector";

// ─── Paths ────────────────────────────────────────────────────────────────────

const COMPONENT_LIB_DIR = path.join(__dirname);
const FONTS_CSS_PATH     = path.join(COMPONENT_LIB_DIR, "fonts.css");
const LAYOUTS_CSS_PATH   = path.join(COMPONENT_LIB_DIR, "layouts.css");
const FONTS_DIR          = path.join(COMPONENT_LIB_DIR, "fonts");

// ─── CSS loader ───────────────────────────────────────────────────────────────

let _fontsCSS: string | null = null;
let _layoutsCSS: string | null = null;

function loadFontsCSS(): string {
  if (_fontsCSS) return _fontsCSS;
  let css = fs.readFileSync(FONTS_CSS_PATH, "utf8");
  // Replace relative ../fonts/ paths with absolute file:// URIs
  css = css.replace(/url\(['"]?\.\.\/fonts\/([^'")\s]+)['"]?\)/g, (_, filename) => {
    const absPath = path.join(FONTS_DIR, filename);
    return `url('${absPath}')`;
  });
  _fontsCSS = css;
  return css;
}

function loadLayoutsCSS(): string {
  if (_layoutsCSS) return _layoutsCSS;
  _layoutsCSS = fs.readFileSync(LAYOUTS_CSS_PATH, "utf8");
  return _layoutsCSS;
}

// ─── Image encoder ────────────────────────────────────────────────────────────

function encodeImageAsDataUri(imagePath: string): string {
  if (!imagePath || !fs.existsSync(imagePath)) return "";
  const data = fs.readFileSync(imagePath);
  const ext  = path.extname(imagePath).toLowerCase().replace(".", "");
  const mime = (ext === "jpg" || ext === "jpeg") ? "image/jpeg"
             : ext === "png" ? "image/png"
             : ext === "webp" ? "image/webp"
             : "image/jpeg";
  return `data:${mime};base64,${data.toString("base64")}`;
}

// ─── CSS variable serializer ──────────────────────────────────────────────────

function serializeCssVars(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
}

// ─── HTML templates per layout ────────────────────────────────────────────────

function buildDarkFieldHeroHtml(
  brief: CreativeBrief & { _fullBrief?: FullCreativeBrief },
  brand: BrandProfile,
  heroDataUri: string,
  logoDataUri: string | null,
  width: number,
  height: number
): string {
  const eyebrow  = brief._fullBrief?.strategy?.coreValueProp?.split(".")[0]?.toUpperCase() ?? "MADE IN THE USA";
  const headline = brief.headline ?? "BUILT DIFFERENT.";
  const body     = brief.subheadline ?? "";
  const cta      = brief.callToAction ?? "LEARN MORE";
  const logoHtml = logoDataUri
    ? `<img class="l1-logo" src="${logoDataUri}" alt="logo">`
    : `<div class="l1-logo l1-logo--text">${brand.meta?.brandName ?? ""}</div>`;
  const heroHtml = heroDataUri
    ? `<img class="l1-product-image" src="${heroDataUri}" alt="product">`
    : "";

  return `
<div class="orb-layout--dark-field-hero">
  ${heroHtml}
  <div class="l1-gradient-overlay"></div>
  ${logoHtml}
  <div class="l1-content">
    <div class="l1-eyebrow">${eyebrow}</div>
    <h1 class="l1-headline">${headline}</h1>
    ${body ? `<p class="l1-body">${body}</p>` : ""}
    <div class="l1-cta-row">
      <span class="l1-cta-line"></span>
      <span class="l1-cta-text">${cta}</span>
    </div>
  </div>
</div>`;
}

function buildSplitStatHtml(
  brief: CreativeBrief & { _fullBrief?: FullCreativeBrief },
  brand: BrandProfile,
  heroDataUri: string,
  logoDataUri: string | null,
  cssVars: Record<string, string>
): string {
  const badge    = brief._fullBrief?.strategy?.postAngle === "social_proof" ? "CLINICALLY BACKED" : "PROVEN RESULTS";
  // Parse stat value into number and unit: "5x" → num="5", unit="x"
  const statRaw  = cssVars["--brand-stat-value"] ?? "5";
  const statNum  = statRaw.replace(/[^0-9.]/g, "") || "5";
  const statUnit = statRaw.replace(/[0-9.]+/, "") || "x";
  const statLbl  = cssVars["--brand-stat-label"] ?? "more effective";
  const quote    = brief.keyQuote ?? "";
  const logoHtml = logoDataUri
    ? `<img class="l2-logo" src="${logoDataUri}" alt="logo">`
    : `<div class="l2-logo l2-logo--text">${brand.meta?.brandName ?? ""}</div>`;
  const heroHtml = heroDataUri
    ? `<img class="l2-lifestyle-image" src="${heroDataUri}" alt="lifestyle">`
    : "";

  return `
<div class="orb-layout--split-stat">
  ${heroHtml}
  <div class="l2-image-fade"></div>
  ${logoHtml}
  <div class="l2-content">
    <div class="l2-badge">
      <span class="l2-badge-dot"></span>
      <span class="l2-badge-text">${badge}</span>
    </div>
    <div class="l2-stat-number">${statNum}<span class="l2-stat-unit">${statUnit}</span></div>
    <div class="l2-stat-label">${statLbl}</div>
    <div class="l2-divider"></div>
    ${quote ? `<p class="l2-supporting">${quote}</p>` : ""}
  </div>
</div>`;
}

function buildSplitStepsHtml(
  brief: CreativeBrief & { _fullBrief?: FullCreativeBrief },
  brand: BrandProfile,
  heroDataUri: string,
  logoDataUri: string | null
): string {
  const eyebrow  = "HOW IT WORKS";
  const headline = brief.headline ?? "Three steps.";
  const body     = brief.subheadline ?? "";
  const cta      = brief.callToAction ?? "TRY YOUR FIRST BOX →";

  // Extract up to 3 steps from the brief — use keyStats or split subheadline
  const rawSteps = brief._fullBrief?.copy?.subheadline ?? "";
  const stepLines = rawSteps
    .split(/\.\s+/)
    .filter(s => s.trim().length > 0)
    .slice(0, 3);

  const defaultSteps = [
    "Start with your brand",
    "Generate content in seconds",
    "Publish on-brand, every time",
  ];
  const steps = stepLines.length >= 2 ? stepLines : defaultSteps;

  const logoHtml = logoDataUri
    ? `<div class="l3-logo"><img src="${logoDataUri}" alt="logo"></div>`
    : `<div class="l3-logo l3-logo--text">${brand.meta?.brandName ?? ""}</div>`;
  const heroHtml = heroDataUri
    ? `<img class="l3-pour-image" src="${heroDataUri}" alt="product">`
    : "";

  const stepsHtml = steps.map((step, i) => `
    <div class="l3-step">
      <div class="l3-step-num">${i + 1}</div>
      <div class="l3-step-text">${step.trim().replace(/\.$/, "")}</div>
    </div>`).join("");

  return `
<div class="orb-layout--split-steps">
  ${heroHtml}
  <div class="l3-image-fade"></div>
  ${logoHtml}
  <div class="l3-content">
    <div class="l3-eyebrow">${eyebrow}</div>
    <h1 class="l3-headline">${headline}</h1>
    <div class="l3-rule"></div>
    ${body ? `<p class="l3-body">${body}</p>` : ""}
    <div class="l3-steps">${stepsHtml}</div>
    <div class="l3-cta">${cta}</div>
  </div>
</div>`;
}

function buildGradientMascotHtml(
  brief: CreativeBrief & { _fullBrief?: FullCreativeBrief },
  brand: BrandProfile,
  heroDataUri: string,
  logoDataUri: string | null
): string {
  const headline  = brief.headline ?? "YOUR GREENS FINALLY TASTE GOOD.";
  const body      = brief.subheadline ?? "";
  const badge     = brief._fullBrief?.strategy?.coreValueProp?.split(".")[0] ?? "60+ Ingredients";

  // Pills from keyStats or defaults
  const rawStats  = brief.keyStats ?? [];
  const pills     = rawStats.length >= 3
    ? rawStats.slice(0, 3)
    : ["No Compromise", "Science-Backed", "Real Results"];

  // Ticker text
  const tickerItems = [
    brand.meta?.brandName?.toUpperCase() ?? "ORB",
    "•",
    brief._fullBrief?.strategy?.coreValueProp?.split(".")[0]?.toUpperCase() ?? "ON-BRAND CONTENT",
    "•",
    brand.meta?.brandName?.toUpperCase() ?? "ORB",
    "•",
    brief._fullBrief?.strategy?.coreValueProp?.split(".")[0]?.toUpperCase() ?? "ON-BRAND CONTENT",
    "•",
  ];

  const logoHtml = logoDataUri
    ? `<img src="${logoDataUri}" alt="logo">`
    : `<span class="l4-logo-text">${brand.meta?.brandName ?? ""}</span>`;

  const mascotHtml = heroDataUri
    ? `<img class="l4-mascot" src="${heroDataUri}" alt="product">`
    : "";

  const pillsHtml = pills.map(p => {
    const parts = p.match(/^([0-9]+[a-zA-Z%+x]*)\s+(.+)$/) ?? [p, "", p];
    return parts[1]
      ? `<div class="l4-pill"><strong>${parts[1]}</strong> ${parts[2]}</div>`
      : `<div class="l4-pill">${p}</div>`;
  }).join("");

  return `
<div class="orb-layout--gradient-mascot">
  <div class="l4-top">
    <div class="l4-logo">${logoHtml}</div>
    <div class="l4-badge">${badge}</div>
  </div>
  ${mascotHtml}
  <div class="l4-headline-zone">
    <h1 class="l4-headline">${headline}</h1>
    ${body ? `<p class="l4-subhead">${body}</p>` : ""}
    <div class="l4-pills">${pillsHtml}</div>
  </div>
  <div class="l4-bottom-strip">
    <div class="l4-bottom-text">${tickerItems.join("&nbsp;&nbsp;")}</div>
  </div>
</div>`;
}

// ─── Main assembler ───────────────────────────────────────────────────────────

export interface AssembleHtmlOptions {
  width: number;
  height: number;
}

export function assembleHtml(
  brand: BrandProfile,
  brief: CreativeBrief & { _fullBrief?: FullCreativeBrief },
  heroImagePath: string,
  logoDataUri: string | null,
  options: AssembleHtmlOptions = { width: 1080, height: 1080 }
): string {
  const { width, height } = options;

  // 1. Select layout and build CSS vars
  const selection: LayoutSelection = selectLayout(brand, brief, heroImagePath, logoDataUri);
  console.log(`[assembleHtml] Layout: ${selection.layoutClass} — ${selection.reason}`);

  // 2. Encode hero image as data URI (avoids file:// path issues in Puppeteer)
  const heroDataUri = encodeImageAsDataUri(heroImagePath);

  // 3. Load CSS
  const fontsCSS   = loadFontsCSS();
  const layoutsCSS = loadLayoutsCSS();

  // 4. Build inner HTML for the selected layout
  let innerHtml: string;
  switch (selection.layoutClass) {
    case "orb-layout--dark-field-hero":
      innerHtml = buildDarkFieldHeroHtml(brief, brand, heroDataUri, logoDataUri, width, height);
      break;
    case "orb-layout--split-stat":
      innerHtml = buildSplitStatHtml(brief, brand, heroDataUri, logoDataUri, selection.cssVars);
      break;
    case "orb-layout--split-steps":
      innerHtml = buildSplitStepsHtml(brief, brand, heroDataUri, logoDataUri);
      break;
    case "orb-layout--gradient-mascot":
      innerHtml = buildGradientMascotHtml(brief, brand, heroDataUri, logoDataUri);
      break;
    default:
      innerHtml = buildSplitStepsHtml(brief, brand, heroDataUri, logoDataUri);
  }

  // 5. Build scale transform for non-square sizes
  // All layouts are authored at 1080×1080. We scale + clip to fit other sizes.
  const scaleX = width  / 1080;
  const scaleY = height / 1080;
  const scale  = Math.min(scaleX, scaleY);
  const offsetX = (width  - 1080 * scale) / 2;
  const offsetY = (height - 1080 * scale) / 2;

  const containerTransform = scale !== 1
    ? `transform: scale(${scale.toFixed(4)}) translate(${(offsetX / scale).toFixed(1)}px, ${(offsetY / scale).toFixed(1)}px); transform-origin: top left;`
    : "";

  // 6. Assemble the full HTML document
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Canvas ── */
html, body {
  width: ${width}px;
  height: ${height}px;
  overflow: hidden;
  background: #000;
}

/* ── Layout container ── */
#orb-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 1080px;
  height: 1080px;
  ${containerTransform}
}

/* ── CSS custom properties (brand tokens) ── */
:root {
${serializeCssVars(selection.cssVars)}
}

/* ── Fonts ── */
${fontsCSS}

/* ── Layouts ── */
${layoutsCSS}

/* ── Logo fallback text ── */
.l1-logo--text, .l2-logo--text, .l3-logo--text {
  font-family: var(--brand-font-heading, sans-serif);
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.05em;
}
</style>
</head>
<body>
<div id="orb-canvas">
${innerHtml}
</div>
</body>
</html>`;
}

// ─── Drop-in replacement for generateComposition ─────────────────────────────

/**
 * generateCompositionFromLibrary
 *
 * Drop-in replacement for generateComposition() in compositorGenerate.ts.
 * Uses the component library instead of free-generating HTML from Claude.
 */
export async function generateCompositionFromLibrary(
  brand: BrandProfile,
  heroImagePath: string,
  logoDataUri: string | null,
  canvasWidth: number,
  canvasHeight: number,
  brief: CreativeBrief & { _fullBrief?: FullCreativeBrief }
): Promise<string> {
  return assembleHtml(brand, brief, heroImagePath, logoDataUri, {
    width: canvasWidth,
    height: canvasHeight,
  });
}
