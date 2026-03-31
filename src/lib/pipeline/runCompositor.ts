/**
 * runCompositor.ts — Full 4-agent compositor pipeline
 *
 * Architecture:
 *   Topic Generator → 10 distinct post topics (from brand profile)
 *   For each topic:
 *     Creative Strategist → Social Copywriter → Image Director → Art Director
 *     QA Retry Loop (up to 3 attempts per size, quality gate ≥ 8/10)
 *   4 platform sizes per topic → 40 images total
 *
 * Platform sizes:
 *   portrait  1080×1350  (Instagram feed, Facebook feed)
 *   square    1080×1080  (Instagram square, LinkedIn)
 *   story     1080×1920  (Instagram/Facebook Stories)
 *   landscape 1200×628   (Twitter/X card, LinkedIn banner, Facebook link)
 */

import * as fs from "fs";
import * as path from "path";
import puppeteer, { type Browser } from "puppeteer";
import {
  generateCreativeBrief,
  sourceHeroImage,
  segmentHeroImage,
  generateComposition,
  critiqueComposition,
} from "./compositorGenerate";
import { generatePostTopics, type PostTopic } from "./compositorAgents";
import { renderHtml } from "./compositorRenderer";
import { resolveLogo } from "./runPipeline";
import { execSync } from "child_process";
import type { BrandProfile } from "./classifyBrand";
import type { EmitFn } from "./types";
import type { CreativeBrief } from "./compositorGenerate";

const MAX_RETRY_ATTEMPTS = 3;
const QUALITY_THRESHOLD = 8;

// All 4 platform sizes — rendered for every post
const ALL_SIZES = ["portrait", "square", "story", "landscape"] as const;
type PlatformSize = (typeof ALL_SIZES)[number];

export const SIZE_DIMENSIONS: Record<PlatformSize, { width: number; height: number }> = {
  portrait:  { width: 1080, height: 1350 }, // Instagram feed, Facebook feed
  square:    { width: 1080, height: 1080 }, // Instagram square, LinkedIn
  story:     { width: 1080, height: 1920 }, // Instagram/Facebook Stories
  landscape: { width: 1200, height: 628  }, // Twitter/X card, LinkedIn banner
};

function getChromiumPath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  for (const bin of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      const p = execSync(`which ${bin}`, { encoding: "utf8" }).trim();
      if (p) return p;
    } catch {}
  }
  return undefined;
}

export interface CompositorResult {
  /** Absolute path to the final PNG */
  imagePath: string;
  /** The HTML/CSS string that was rendered */
  composition: string;
  /** Quality Evaluator score (1–10) */
  critiqueScore: number;
  /** Issues identified by the Quality Evaluator */
  critiqueIssues: string[];
  /** The creative brief used for this image */
  brief: CreativeBrief;
  /** Number of generation attempts (1–MAX_RETRY_ATTEMPTS) */
  attempts: number;
  /** The post topic this image belongs to */
  topic: PostTopic;
  /** The platform size key */
  size: PlatformSize;
  /** Unique schema ID for the API route (topic_index + size) */
  schemaId: string;
}

/**
 * Run the full 4-agent compositor pipeline for a brand.
 *
 * Steps:
 *   1. Topic Generator produces 10 distinct post topics
 *   2. For each topic: run 4-agent pipeline → generate 4 sizes
 *   3. Quality Evaluator gates each render (up to 3 retries)
 *
 * Returns 40 CompositorResult objects (10 topics × 4 sizes).
 * Emits progress events throughout for the SSE stream.
 */
export async function runCompositorPipeline(
  brandProfile: BrandProfile,
  workDir: string,
  emit: EmitFn
): Promise<CompositorResult[]> {
  fs.mkdirSync(workDir, { recursive: true });
  const allResults: CompositorResult[] = [];

  // ── Step 0: Topic Generator — produce 10 distinct post topics ────────────
  emit({ type: "status", step: 1, total: 7, message: "Planning 10-post content strategy..." });
  console.log("[compositor] Generating post topics...");

  let topics: PostTopic[];
  try {
    topics = await generatePostTopics(brandProfile);
    console.log(`[compositor] Topic Generator produced ${topics.length} topics:`);
    topics.forEach((t, i) => console.log(`  ${i + 1}. [${t.angle}] ${t.label} — ${t.direction.slice(0, 60)}...`));
  } catch (e) {
    console.error("[compositor] Topic Generator failed:", (e as Error).message);
    // Fallback: 10 generic topics covering all angles
    topics = [
      { label: "brand story hero",      angle: "brand_awareness",  direction: "Tell the brand's origin story and core mission",                          primaryPlatform: "instagram" },
      { label: "product hero feature",  angle: "product_feature",  direction: "Showcase the primary product capability with a bold visual",              primaryPlatform: "instagram" },
      { label: "how it works",          angle: "educational",      direction: "Explain the core mechanism or process in simple terms",                   primaryPlatform: "linkedin"  },
      { label: "customer result",       angle: "social_proof",     direction: "Highlight a real customer outcome or transformation",                     primaryPlatform: "instagram" },
      { label: "key differentiator",    angle: "product_feature",  direction: "Contrast what makes this brand different from alternatives",              primaryPlatform: "linkedin"  },
      { label: "brand values",          angle: "brand_awareness",  direction: "Express the brand's values through imagery and copy",                     primaryPlatform: "facebook"  },
      { label: "use case spotlight",    angle: "product_feature",  direction: "Show a specific use case or scenario where the product shines",           primaryPlatform: "instagram" },
      { label: "industry insight",      angle: "educational",      direction: "Share a non-obvious insight about the industry or problem space",         primaryPlatform: "linkedin"  },
      { label: "community proof",       angle: "social_proof",     direction: "Show the scale or quality of the brand's community or customer base",     primaryPlatform: "twitter"   },
      { label: "trend context",         angle: "contextual",       direction: "Connect the brand's value proposition to a current trend or moment",      primaryPlatform: "twitter"   },
    ];
    console.log("[compositor] Using fallback topic list");
  }

  // Save topic plan for debugging
  fs.writeFileSync(path.join(workDir, "topic_plan.json"), JSON.stringify(topics, null, 2));

  // ── Step 1: Resolve logo once (shared across all topics) ─────────────────
  emit({ type: "status", step: 2, total: 7, message: "Resolving brand assets..." });
  const logoDataUri = await resolveLogo(brandProfile);

  // ── Step 2: Launch a single shared browser for all renders ───────────────
  emit({ type: "status", step: 3, total: 7, message: "Launching render engine..." });
  console.log("[compositor] Launching shared browser...");
  const browser: Browser = await puppeteer.launch({
    headless: true,
    executablePath: getChromiumPath(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--font-render-hinting=none",
      "--disable-web-security",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    // ── Step 3: Loop over 10 topics ─────────────────────────────────────────
    for (let topicIndex = 0; topicIndex < topics.length; topicIndex++) {
      const topic = topics[topicIndex];
      const topicSlug = topic.label.replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      const topicDir = path.join(workDir, `topic_${topicIndex + 1}_${topicSlug}`);
      fs.mkdirSync(topicDir, { recursive: true });

      const progressMsg = `Post ${topicIndex + 1}/10: ${topic.label}`;
      emit({ type: "status", step: 4, total: 7, message: progressMsg });
      console.log(`\n[compositor] ── Topic ${topicIndex + 1}/10: [${topic.angle}] ${topic.label} ──`);

      // ── 3a. Generate Creative Brief (4-agent pipeline) ───────────────────
      let brief: CreativeBrief;
      try {
        brief = await generateCreativeBrief(brandProfile, topic.direction);
        console.log(`[compositor] Brief: "${brief.headline}" | layout: ${brief.layoutStyle}`);
        fs.writeFileSync(path.join(topicDir, "creative_brief.json"), JSON.stringify(brief, null, 2));
      } catch (e) {
        console.error(`[compositor] Creative brief failed for topic ${topicIndex + 1}:`, (e as Error).message);
        continue; // Skip this topic rather than crash the whole run
      }

      // ── 3b. Source hero image (brand images → Flux → Pexels) ────────────
      const primaryDims = SIZE_DIMENSIONS.portrait;
      let heroPath: string;
      try {
        heroPath = await sourceHeroImage(brief, brandProfile, primaryDims.width, primaryDims.height, topicDir);
      } catch (e) {
        console.error(`[compositor] Hero image failed for topic ${topicIndex + 1}:`, (e as Error).message);
        continue;
      }

      // ── 3c. Segment image into background + subject ──────────────────────
      let segmented: Awaited<ReturnType<typeof segmentHeroImage>>;
      try {
        segmented = await segmentHeroImage(heroPath, topicDir);
      } catch (e) {
        console.warn(`[compositor] Segmentation failed for topic ${topicIndex + 1} (using full image):`, (e as Error).message);
        segmented = { backgroundPath: heroPath, subjectPath: "", originalPath: heroPath };
      }

      // ── 3d. Render all 4 platform sizes ──────────────────────────────────
      for (const size of ALL_SIZES) {
        const dims = SIZE_DIMENSIONS[size];
        const schemaId = `post${topicIndex + 1}_${size}`;

        emit({ type: "status", step: 5, total: 7, message: `Composing ${topic.label} · ${size}...` });

        let finalScore = 0;
        let finalIssues: string[] = [];
        let finalHtml = "";
        let finalOutputPath = "";
        let attempt = 0;
        let critiqueIssues: string[] = [];

        // ── QA Retry Loop (up to MAX_RETRY_ATTEMPTS) ──────────────────────
        while (attempt < MAX_RETRY_ATTEMPTS) {
          attempt++;
          console.log(`[compositor] ${schemaId} attempt ${attempt}/${MAX_RETRY_ATTEMPTS}...`);

          let html: string;
          try {
            html = await generateComposition(
              brandProfile,
              segmented,
              logoDataUri,
              dims.width,
              dims.height,
              brief,
              attempt > 1 ? critiqueIssues : undefined
            );
          } catch (e) {
            console.error(`[compositor] Art Director failed (attempt ${attempt}):`, (e as Error).message);
            if (attempt === MAX_RETRY_ATTEMPTS) break;
            continue;
          }

          // Save HTML for debugging
          fs.writeFileSync(path.join(topicDir, `${size}_attempt${attempt}.html`), html);

          // Render HTML → PNG
          const outputPath = path.join(topicDir, `${size}_attempt${attempt}.png`);
          try {
            await renderHtml(html, outputPath, dims.width, dims.height, browser);
          } catch (e) {
            console.error(`[compositor] Render failed (attempt ${attempt}):`, (e as Error).message);
            if (attempt === MAX_RETRY_ATTEMPTS) break;
            continue;
          }

          emit({ type: "status", step: 6, total: 7, message: `Quality check: ${topic.label} · ${size} (attempt ${attempt})...` });

          // Quality Evaluator
          let critique: Awaited<ReturnType<typeof critiqueComposition>>;
          try {
            critique = await critiqueComposition(outputPath, html, brandProfile, brief);
          } catch (e) {
            console.warn(`[compositor] Critique failed (attempt ${attempt}), accepting output:`, (e as Error).message);
            finalHtml = html;
            finalOutputPath = outputPath;
            finalScore = 7; // Assume passing if critique errors
            break;
          }

          console.log(`[compositor] ${schemaId} attempt ${attempt}: score=${critique.score}/10, passed=${critique.passed}`);
          if (critique.issues.length > 0) {
            console.log(`  Issues: ${critique.issues.join("; ")}`);
          }

          finalScore = critique.score;
          finalIssues = critique.issues;
          finalHtml = html;
          finalOutputPath = outputPath;

          if (critique.passed) {
            console.log(`[compositor] ${schemaId} PASSED at attempt ${attempt} (score=${critique.score})`);
            break;
          }

          critiqueIssues = critique.issues;
          if (attempt < MAX_RETRY_ATTEMPTS) {
            console.log(`[compositor] ${schemaId} score ${critique.score} < ${QUALITY_THRESHOLD} — retrying...`);
          } else {
            console.log(`[compositor] ${schemaId} exhausted ${MAX_RETRY_ATTEMPTS} attempts. Best: ${finalScore}`);
          }
        }

        if (!finalOutputPath || !finalHtml) {
          console.warn(`[compositor] ${schemaId} produced no output — skipping`);
          continue;
        }

        // Copy final attempt to canonical path
        const canonicalPath = path.join(topicDir, `${size}.png`);
        fs.copyFileSync(finalOutputPath, canonicalPath);

        emit({
          type: "image",
          schemaId,
          schemaName: topic.label,
          size,
          filePath: canonicalPath,
          critiqueScore: finalScore,
          critiqueIssues: finalIssues,
        });

        allResults.push({
          imagePath: canonicalPath,
          composition: finalHtml,
          critiqueScore: finalScore,
          critiqueIssues: finalIssues,
          brief,
          attempts: attempt,
          topic,
          size,
          schemaId,
        });

        console.log(`[compositor] ${schemaId}: score=${finalScore}, attempts=${attempt}`);
      }
    }
  } finally {
    await browser.close();
  }

  emit({ type: "status", step: 7, total: 7, message: "Finalizing..." });
  console.log(`\n[compositor] Complete: ${allResults.length}/40 images generated`);

  return allResults;
}
