/**
 * test-carousel.ts — Focused carousel test
 * Uses existing raw_dom_data from a previous pipeline run to avoid re-scraping
 * Tests: generateCarouselCopy() + generateCarouselSlide() + renderHtml()
 */
import { config } from "dotenv";
import { resolve } from "path";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
config({ path: resolve(process.cwd(), ".env.local") });

import { classifyBrand } from "../src/lib/pipeline/classifyBrand";
import { generateCarouselCopy, generateCarouselSlide } from "../src/lib/pipeline/carouselAgents";
import { renderHtml } from "../src/lib/pipeline/compositorRenderer";
import { resolveLogo } from "../src/lib/pipeline/runPipeline";
import puppeteer from "puppeteer";
import { execSync } from "child_process";

function getChromiumPath(): string | undefined {
  for (const bin of ["chromium", "chromium-browser", "google-chrome"]) {
    try { return execSync(`which ${bin}`, { encoding: "utf8" }).trim(); } catch {}
  }
  return undefined;
}

async function main() {
  const existingWorkDir = "/tmp/orb-test-1eWjao";
  const rawDomPath = path.join(existingWorkDir, "raw_dom_data.json");

  if (!fs.existsSync(rawDomPath)) {
    console.error("No raw_dom_data.json found at", rawDomPath);
    process.exit(1);
  }

  // Create output dir
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "orb-carousel-test-"));
  console.log(`[carousel-test] Output dir: ${outDir}`);

  // ── Step 1: Classify brand from existing DOM data ─────────────────────────
  console.log("\n[1/4] Classifying brand from existing DOM data...");
  const domData = JSON.parse(fs.readFileSync(rawDomPath, "utf8"));
  const brandProfile = await classifyBrand(domData, existingWorkDir, (e: object) => {
    if ((e as { type?: string }).type === "status") console.log(`  ${(e as { message?: string }).message}`);
  });
  console.log(`[1/4] Brand: ${brandProfile.meta?.brandName}`);
  fs.writeFileSync(path.join(outDir, "brand_profile.json"), JSON.stringify(brandProfile, null, 2));

  // ── Step 2: Resolve logo ──────────────────────────────────────────────────
  const logoDataUri = await resolveLogo(brandProfile);
  console.log(`[2/4] Logo: ${logoDataUri ? `${logoDataUri.length} chars` : "none"}`);

  // ── Step 3: Generate carousel copy ───────────────────────────────────────
  console.log("\n[3/4] Generating carousel copy...");
  const strategy = {
    coreValueProp: "Natural materials that feel better than synthetic alternatives",
    targetAudience: "Environmentally conscious consumers who want comfort without compromise",
    painPoint: "Synthetic shoes are uncomfortable and environmentally damaging",
    bigIdea: "Nature made the best materials — we just turned them into shoes",
    postAngle: "brand_awareness" as const,
    emotionalRegister: "Warm, grounded, quietly confident",
    socialVoice: "Short declarative sentences, conversational, no jargon",
    visualConcept: "Natural materials in natural settings — wool, trees, earth",
    colorTheme: "light" as const,
  };

  const postTopic = "Tell the Allbirds origin story — why natural materials, why now";
  const t0 = Date.now();
  const script = await generateCarouselCopy(strategy, brandProfile, postTopic);
  console.log(`[3/4] Copy generated in ${Date.now() - t0}ms`);
  console.log(`  Narrative arc: "${script.narrativeArc}"`);
  script.slides.forEach(s => {
    console.log(`  Slide ${s.slideNumber} [${s.role}] "${s.headline}" | layout: ${s.layoutStyle}`);
  });
  fs.writeFileSync(path.join(outDir, "carousel_script.json"), JSON.stringify(script, null, 2));

  // ── Step 4: Generate HTML for all 5 slides ────────────────────────────────
  console.log("\n[4/4] Generating HTML for all 5 slides...");

  // Find a hero image from the existing run
  const heroPath = path.join(existingWorkDir, "topic_1_merino_wool_comfort_story", "hero.jpg");
  const hasHero = fs.existsSync(heroPath);
  console.log(`  Hero image: ${hasHero ? heroPath : "not found"}`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: getChromiumPath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    for (const slide of script.slides) {
      const slideHeroPath = (slide.layoutStyle === "bold typographic") ? "" : (hasHero ? heroPath : "");
      const t1 = Date.now();

      const html = await generateCarouselSlide(
        slide,
        script.slides.length,
        brandProfile,
        slideHeroPath,
        logoDataUri,
        1080,
        1080
      );

      const htmlPath = path.join(outDir, `slide_${slide.slideNumber}_${slide.role}.html`);
      const pngPath = path.join(outDir, `slide_${slide.slideNumber}_${slide.role}.png`);
      fs.writeFileSync(htmlPath, html);

      await renderHtml(html, pngPath, 1080, 1080, browser);
      console.log(`  Slide ${slide.slideNumber} [${slide.role}]: done in ${Date.now() - t1}ms → ${pngPath}`);
    }
  } finally {
    await browser.close();
  }

  console.log(`\n[carousel-test] Complete! Output: ${outDir}`);
  console.log("Generated files:");
  fs.readdirSync(outDir).filter(f => f.endsWith(".png")).forEach(f => {
    console.log(`  ${path.join(outDir, f)}`);
  });
}

main().catch(e => { console.error("[carousel-test] FAILED:", e.message); process.exit(1); });
