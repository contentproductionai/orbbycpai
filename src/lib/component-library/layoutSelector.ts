/**
 * layoutSelector.ts
 *
 * Maps a BrandProfile + CreativeBrief to one of the four approved layout classes,
 * then builds the full set of CSS custom properties needed to render that layout.
 *
 * Layout classes:
 *   orb-layout--dark-field-hero    (BRUNT pattern)   — dark bg, product right, bold condensed type
 *   orb-layout--split-stat         (Magic Mind)       — light split, oversized stat, testimonial
 *   orb-layout--split-steps        (Cometeer)         — light split, numbered steps, monospace UI
 *   orb-layout--gradient-mascot    (Grüns)            — gradient field, mascot/product cutout, ticker
 *
 * Selection logic:
 *   1. colorTheme === "dark"  → dark-field-hero
 *   2. postAngle === "social_proof" && stat available → split-stat
 *   3. postAngle === "educational" → split-steps
 *   4. gradient/mascot brand signal OR default → gradient-mascot
 */

import type { BrandProfile } from "../pipeline/classifyBrand";
import type { CreativeBrief } from "../pipeline/compositorGenerate";
import type { FullCreativeBrief } from "../pipeline/compositorAgents";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LayoutClass =
  | "orb-layout--dark-field-hero"
  | "orb-layout--split-stat"
  | "orb-layout--split-steps"
  | "orb-layout--gradient-mascot";

export interface LayoutSelection {
  layoutClass: LayoutClass;
  /** CSS custom properties to inject into :root */
  cssVars: Record<string, string>;
  /** Reason for the selection (for logging) */
  reason: string;
}

// ─── Font mapping ─────────────────────────────────────────────────────────────

function resolveFont(fontFamily: string | undefined, fallback: string): string {
  if (!fontFamily) return fallback;
  const f = fontFamily.toLowerCase().replace(/['"]/g, "").trim();
  if (f.includes("barlow condensed") || f.includes("barlow-condensed")) return "Barlow Condensed";
  if (f.includes("barlow")) return "Barlow";
  if (f.includes("dm serif") || f.includes("dm-serif")) return "DM Serif Display";
  if (f.includes("dm sans") || f.includes("dm-sans")) return "DM Sans";
  if (f.includes("space grotesk") || f.includes("space-grotesk")) return "Space Grotesk";
  if (f.includes("space mono") || f.includes("space-mono")) return "Space Mono";
  if (f.includes("work sans") || f.includes("work-sans")) return "Work Sans";
  if (f.includes("condensed") || f.includes("narrow")) return "Barlow Condensed";
  if (f.includes("mono") || f.includes("code")) return "Space Mono";
  if (f.includes("serif")) return "DM Serif Display";
  if (f.includes("grotesk") || f.includes("grotesque")) return "Space Grotesk";
  return fallback;
}

// ─── Color utilities ──────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6 && clean.length !== 3) return null;
  const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

function darken(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb[0] * factor, rgb[1] * factor, rgb[2] * factor);
}

function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    rgb[0] + (255 - rgb[0]) * amount,
    rgb[1] + (255 - rgb[1]) * amount,
    rgb[2] + (255 - rgb[2]) * amount
  );
}

// ─── CSS variable builders ────────────────────────────────────────────────────

function buildDarkFieldHeroVars(brand: BrandProfile): Record<string, string> {
  const headingFont = resolveFont((brand.typography?.headline as Record<string, string>)?.fontFamily, "Barlow Condensed");
  const bodyFont    = resolveFont((brand.typography?.body as Record<string, string>)?.fontFamily, "Barlow");
  const bg          = brand.primaryColor ? darken(brand.primaryColor, 0.15) : "#0f0f0f";
  return {
    "--brand-bg":           bg,
    "--brand-primary":      brand.accentColor ?? brand.primaryColor ?? "#C74F1F",
    "--brand-font-heading": headingFont,
    "--brand-font-body":    bodyFont,
  };
}

function buildSplitStatVars(
  brand: BrandProfile,
  brief: CreativeBrief & { _fullBrief?: FullCreativeBrief }
): Record<string, string> {
  const headingFont = resolveFont((brand.typography?.headline as Record<string, string>)?.fontFamily, "DM Serif Display");
  const bodyFont    = resolveFont((brand.typography?.body as Record<string, string>)?.fontFamily, "DM Sans");
  const statRaw     = (brief.keyStats ?? [])[0] ?? "";
  const statMatch   = statRaw.match(/^([0-9]+(?:\.[0-9]+)?[xX%+]?)\s*(.*)$/);
  const statValue   = statMatch ? statMatch[1] : statRaw.split(" ")[0] ?? "5x";
  const statLabel   = statMatch ? statMatch[2] : statRaw.split(" ").slice(1).join(" ") ?? "more effective";
  const bgColor     = brand.colorPalette?.find(c => c.contexts.includes("background"))?.hex ?? "#f5f0e8";
  return {
    "--brand-bg":           bgColor,
    "--brand-primary":      brand.primaryColor ?? "#1a5c4a",
    "--brand-accent":       brand.accentColor ?? "#1a5c4a",
    "--brand-font-heading": headingFont,
    "--brand-font-body":    bodyFont,
    "--brand-stat-value":   statValue,
    "--brand-stat-label":   statLabel,
  };
}

function buildSplitStepsVars(brand: BrandProfile): Record<string, string> {
  const headingFont = resolveFont((brand.typography?.headline as Record<string, string>)?.fontFamily, "Space Grotesk");
  const bodyFont    = resolveFont((brand.typography?.body as Record<string, string>)?.fontFamily, "Space Grotesk");
  return {
    "--brand-bg":           "#f7f4ee",
    "--brand-primary":      brand.primaryColor ?? "#1a1a1a",
    "--brand-accent":       brand.accentColor ?? "#c8a84b",
    "--brand-font-heading": headingFont,
    "--brand-font-body":    bodyFont,
    "--brand-font-mono":    "Space Mono",
  };
}

function buildGradientMascotVars(brand: BrandProfile): Record<string, string> {
  const headingFont   = resolveFont((brand.typography?.headline as Record<string, string>)?.fontFamily, "Work Sans");
  const bodyFont      = resolveFont((brand.typography?.body as Record<string, string>)?.fontFamily, "Work Sans");
  const primary       = brand.primaryColor ?? "#2e8b4a";
  const accent        = brand.accentColor  ?? "#FFCC2F";
  const gradientEnd   = lighten(primary, 0.3);
  return {
    "--brand-gradient-start": primary,
    "--brand-gradient-end":   gradientEnd,
    "--brand-accent":         accent,
    "--brand-font-heading":   headingFont,
    "--brand-font-body":      bodyFont,
  };
}

// ─── Main selector ────────────────────────────────────────────────────────────

export function selectLayout(
  brand: BrandProfile,
  brief: CreativeBrief & { _fullBrief?: FullCreativeBrief },
  heroImagePath: string,
  logoDataUri: string | null
): LayoutSelection {
  // Override colorTheme with ground truth from backgroundLuminance.
  // The Creative Strategist may classify a brand as "dark" based on photography mood,
  // but the actual page background luminance is the authoritative signal for layout choice.
  // backgroundLuminance > 0.5 means the brand's website has a light background → use light layouts.
  const bgLuminance = brand.backgroundLuminance ?? 0.5;
  const colorTheme = bgLuminance > 0.5 ? "light" : (brief.colorTheme ?? "dark");
  const postAngle  = brief._fullBrief?.strategy?.postAngle ?? "brand_awareness";
  const hasStat    = (brief.keyStats ?? []).length > 0 && (brief.keyStats ?? [])[0] !== "";

  // Rule 1: Dark brand → dark-field-hero (only when page background is actually dark)
  if (colorTheme === "dark") {
    return {
      layoutClass: "orb-layout--dark-field-hero",
      cssVars: buildDarkFieldHeroVars(brand),
      reason: `colorTheme=dark → dark-field-hero`,
    };
  }

  // Rule 2: Social proof with a real stat → split-stat
  if (postAngle === "social_proof" && hasStat) {
    return {
      layoutClass: "orb-layout--split-stat",
      cssVars: buildSplitStatVars(brand, brief),
      reason: `postAngle=social_proof + hasStat → split-stat`,
    };
  }

  // Rule 3: Educational / how-it-works → split-steps
  if (postAngle === "educational") {
    return {
      layoutClass: "orb-layout--split-steps",
      cssVars: buildSplitStepsVars(brand),
      reason: `postAngle=educational → split-steps`,
    };
  }

  // Rule 4: Brand awareness or product feature → gradient-mascot
  if (heroImagePath && (postAngle === "brand_awareness" || postAngle === "product_feature")) {
    return {
      layoutClass: "orb-layout--gradient-mascot",
      cssVars: buildGradientMascotVars(brand),
      reason: `postAngle=${postAngle} + heroImage → gradient-mascot`,
    };
  }

  // Fallback → split-steps (clean, versatile)
  return {
    layoutClass: "orb-layout--split-steps",
    cssVars: buildSplitStepsVars(brand),
    reason: `fallback → split-steps`,
  };
}
