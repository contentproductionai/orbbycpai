/**
 * test-layout-zones.ts
 * Tests the layout zone renderer for portrait (4:5), square (1:1), and Story (9:16).
 * Uses the existing Allbirds brand profile from a previous run.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import puppeteer from "puppeteer";
import { extractLayoutTokens, renderLayout } from "../src/lib/pipeline/layoutRenderer.js";
import { classifyBrand } from "../src/lib/pipeline/classifyBrand.js";
import { inlineLocalImages } from "../src/lib/pipeline/compositorRenderer.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const ALLBIRDS_DOM_DATA = "/tmp/orb-test-1eWjao/raw_dom_data.json";
const HERO_IMAGE = "/tmp/orb-imagen-test-pXjFXR/hero.jpg";
const LOGO_ASSET = "/tmp/orb-test-1eWjao/brand_assets/asset_7_a4f8_logo_with_padding__1__png.png";

const OUT_DIR = "/tmp/orb-layout-zone-test";
fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── Sizes ────────────────────────────────────────────────────────────────────

const SIZES = [
  { name: "portrait",  width: 1080, height: 1350, layoutStyle: "editorial split" },
  { name: "square",    width: 1080, height: 1080, layoutStyle: "editorial split" },
  { name: "story",     width: 1080, height: 1920, layoutStyle: "editorial split" },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[test-layout-zones] Starting...");

  // 1. Build brand profile from existing DOM data
  console.log("[test-layout-zones] Classifying brand...");
  const rawDomData = JSON.parse(fs.readFileSync(ALLBIRDS_DOM_DATA, "utf-8"));
  const brandProfile = await classifyBrand(rawDomData, "allbirds.com");
  console.log(`[test-layout-zones] Brand: ${brandProfile.meta?.brandName}, primary: ${brandProfile.primaryColor}`);

  // 2. Build a creative brief
  const brief = {
    layoutStyle: "editorial split",
    colorTheme: "warm natural",
    headline: "Sheep spent 10,000 years perfecting this fabric",
    subheadline: "Merino wool wicks moisture, regulates temperature, and resists odor. We just shaped it into shoes.",
    callToAction: "See how we use it",
    visualDirection: "Close-up of a merino sheep's face in soft natural light, green New Zealand hills in background",
    keyStats: [],
    keyQuote: "",
  };

  // 3. Extract tokens once (shared across all sizes)
  console.log("[test-layout-zones] Extracting layout tokens...");
  const tokens = await extractLayoutTokens(brief, brandProfile);
  console.log(`[test-layout-zones] Layout variant selected: ${tokens.layoutVariant}`);
  console.log(`[test-layout-zones] CTA color: ${tokens.ctaBgColor}, Headline color: ${tokens.headlineColor}`);
  console.log(`[test-layout-zones] BG color: ${tokens.bgColor}`);
  console.log("[test-layout-zones] Tokens:", JSON.stringify(tokens, null, 2));

  // 4. Load logo as data URI
  let logoDataUri: string | null = null;
  if (fs.existsSync(LOGO_ASSET)) {
    const logoBuffer = fs.readFileSync(LOGO_ASSET);
    const ext = path.extname(LOGO_ASSET).slice(1).toLowerCase();
    const mime = ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`;
    logoDataUri = `data:${mime};base64,${logoBuffer.toString("base64")}`;
    console.log(`[test-layout-zones] Logo loaded (${Math.round(logoBuffer.length / 1024)}KB)`);
  }

  // 5. Launch Puppeteer
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    headless: true,
  });

  try {
    for (const size of SIZES) {
      console.log(`[test-layout-zones] Rendering ${size.name} (${size.width}x${size.height})...`);

      // Generate HTML with layout zone renderer
      const sizedBrief = { ...brief, layoutStyle: size.layoutStyle };
      const html = renderLayout(tokens, size.width, size.height, HERO_IMAGE, logoDataUri);

      // Inline local images (hero path → data URI) — synchronous
      const inlinedHtml = inlineLocalImages(html);

      // Save HTML for inspection
      const htmlPath = path.join(OUT_DIR, `${size.name}.html`);
      fs.writeFileSync(htmlPath, inlinedHtml);

      // Render to PNG
      const page = await browser.newPage();
      await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
      await page.setContent(inlinedHtml, { waitUntil: "domcontentloaded", timeout: 30000 });
      await new Promise(r => setTimeout(r, 1500)); // wait for fonts

      const pngPath = path.join(OUT_DIR, `${size.name}.png`);
      await page.screenshot({ path: pngPath as `${string}.png`, type: "png" });
      await page.close();

      const stat = fs.statSync(pngPath);
      console.log(`[test-layout-zones] ✓ ${size.name}.png (${Math.round(stat.size / 1024)}KB)`);
    }
  } finally {
    await browser.close();
  }

  console.log(`[test-layout-zones] Done. Output: ${OUT_DIR}`);
}

main().catch(err => {
  console.error("[test-layout-zones] FAILED:", err);
  process.exit(1);
});
