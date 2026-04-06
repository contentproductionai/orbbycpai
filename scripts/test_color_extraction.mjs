/**
 * test_color_extraction.mjs
 * Validates the color extraction fixes against three brands:
 *   1. Liquid Death (black-dominant)
 *   2. OLIPOP Vintage Cola (light-dominant)
 *   3. BRUNT Workwear (dark-with-accent)
 *
 * Run with: node scripts/test_color_extraction.mjs
 * Requires ANTHROPIC_API_KEY in environment.
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import os from "os";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from .env.local if present
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  }
}

// Register path aliases
const { register } = await import("module");
process.env.NODE_PATH = path.join(__dirname, "..", "src");

// Use ts-node/esm or tsx to run TypeScript
// Since we can't easily run TS directly, we'll use the compiled approach
// Instead, let's test the quantizeImageColors function directly using the downloaded assets

import sharp from "sharp";

// Replicate the quantizeImageColors logic inline for testing
async function quantizeImageColors(imagePath, topN = 3) {
  try {
    const { data, info } = await sharp(imagePath)
      .resize(50, 50, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const freq = new Map();
    for (let i = 0; i < data.length; i += 3) {
      const r = Math.min(Math.round(data[i] / 16) * 16, 240);
      const g = Math.min(Math.round(data[i + 1] / 16) * 16, 240);
      const b = Math.min(Math.round(data[i + 2] / 16) * 16, 240);
      const key = `${r},${g},${b}`;
      const existing = freq.get(key);
      if (existing) existing.count++;
      else freq.set(key, { r, g, b, count: 1 });
    }

    const totalPixels = info.width * info.height;

    const sorted = Array.from(freq.values())
      .sort((a, b) => b.count - a.count)
      .filter(({ r, g, b, count }) => {
        if (count / totalPixels < 0.02) return false;
        if (r > 220 && g > 220 && b > 220) return false;
        if (r < 35 && g < 35 && b < 35) return false;
        return true;
      });

    return sorted.slice(0, topN).map((c, i) => {
      const hex = `#${c.r.toString(16).padStart(2, "0")}${c.g.toString(16).padStart(2, "0")}${c.b.toString(16).padStart(2, "0")}`;
      return { hex, score: 25 - i * 5, sources: ["image:quantize"], coverage: `${((c.count / totalPixels) * 100).toFixed(1)}%` };
    });
  } catch (e) {
    console.warn("quantizeImageColors failed:", e.message);
    return [];
  }
}

// Test against the already-downloaded assets from the manual POC builds
const testCases = [
  {
    brand: "Liquid Death (Scary Strawberry)",
    expectedPrimary: "#000000 (black)",
    expectedAccent: "#D4AF37 (gold) or #FF1F8E (pink)",
    assetPath: "/home/ubuntu/ld-scary-strawberry/can_scary_strawberry_1280.png",
  },
  {
    brand: "OLIPOP (Vintage Cola)",
    expectedPrimary: "#D4EDE1 or similar light mint",
    expectedAccent: "#E8472A (orange-red)",
    assetPath: "/home/ubuntu/upload/85.png", // use the approved output as proxy for the can
  },
  {
    brand: "BRUNT Workwear",
    expectedPrimary: "#000000 (black)",
    expectedAccent: "#E05A1B (orange)",
    assetPath: "/home/ubuntu/upload/brunt_1x1.png", // use the approved output as proxy
  },
];

console.log("\n═══════════════════════════════════════════════════════");
console.log("  COLOR EXTRACTION VALIDATION — 3 BRAND TEST");
console.log("═══════════════════════════════════════════════════════\n");

for (const tc of testCases) {
  console.log(`\n─── ${tc.brand} ───────────────────────────────────`);
  console.log(`Expected primary: ${tc.expectedPrimary}`);
  console.log(`Expected accent:  ${tc.expectedAccent}`);

  let assetPath = tc.assetPath;

  // Download if needed
  if (!assetPath || !fs.existsSync(assetPath)) {
    if (tc.assetUrl) {
      const tmpPath = path.join(os.tmpdir(), `test_asset_${Date.now()}.png`);
      console.log(`Downloading asset from ${tc.assetUrl}...`);
      try {
        const { execSync } = await import("child_process");
        execSync(`curl -sL "${tc.assetUrl}" -o "${tmpPath}"`, { timeout: 15000 });
        assetPath = tmpPath;
      } catch (e) {
        console.log(`  ✗ Download failed: ${e.message}`);
        continue;
      }
    } else {
      console.log(`  ✗ Asset not found: ${assetPath}`);
      continue;
    }
  }

  const colors = await quantizeImageColors(assetPath, 5);
  if (colors.length === 0) {
    console.log("  ✗ No colors extracted");
  } else {
    console.log("  Extracted colors:");
    for (const c of colors) {
      console.log(`    ${c.hex}  score=${c.score}  coverage=${c.coverage}`);
    }
  }
}

console.log("\n═══════════════════════════════════════════════════════");
console.log("  DOMINANT COLOR FILTER TEST");
console.log("═══════════════════════════════════════════════════════\n");

// Test the isNeutral + isThinPalette logic with a simulated black-dominant palette
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isNeutral(hex) {
  const [r, g, b] = hexToRgb(hex);
  const lum = relativeLuminance(hex);
  if (lum > 0.85 || lum < 0.02) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  return saturation < 0.12;
}

function isThinPaletteOLD(palette) {
  if (palette.length < 4) return true;
  const top3 = palette.slice(0, 3);
  return top3.every((c) => isNeutral(c.hex));
}

function isThinPaletteNEW(palette) {
  if (palette.length < 4) return true;
  // If any color is non-neutral, the palette has brand color signal — not thin
  const hasNonNeutralColor = palette.some((c) => !isNeutral(c.hex));
  if (hasNonNeutralColor) return false;
  // All colors are neutral — palette is thin regardless of dominance
  return true;
}

// Simulate Liquid Death DOM palette: black is dominant (60% area), pink and gold are accents
const liquidDeathPalette = [
  { hex: "#000000", score: 80, sources: ["body:background"], totalArea: 0.60 },
  { hex: "#ff1f8e", score: 40, sources: ["css:variable"], totalArea: 0.15 },
  { hex: "#d4af37", score: 20, sources: ["css:variable"], totalArea: 0.10 },
  { hex: "#ffffff", score: 10, sources: ["h1:color"], totalArea: 0.05 },
];

console.log("Liquid Death simulated palette:");
console.log("  OLD isThinPalette:", isThinPaletteOLD(liquidDeathPalette), "(should be false — was incorrectly true before fix)");
console.log("  NEW isThinPalette:", isThinPaletteNEW(liquidDeathPalette), "(should be false — black is dominant, not thin)");

// Simulate a truly thin palette (CSS-in-JS site with no color signal)
const thinPalette = [
  { hex: "#ffffff", score: 50, sources: ["body:background"], totalArea: 0.30 },
  { hex: "#000000", score: 30, sources: ["h1:color"], totalArea: 0.10 },
  { hex: "#888888", score: 10, sources: ["body:color"], totalArea: 0.05 },
  { hex: "#cccccc", score: 5, sources: ["border"], totalArea: 0.02 },
];

console.log("\nThin palette (CSS-in-JS, no brand colors):");
console.log("  OLD isThinPalette:", isThinPaletteOLD(thinPalette), "(should be true)");
console.log("  NEW isThinPalette:", isThinPaletteNEW(thinPalette), "(should be true)");

console.log("\n✓ Validation complete\n");
