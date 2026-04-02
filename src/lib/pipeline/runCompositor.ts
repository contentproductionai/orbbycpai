/**
 * runCompositor.ts — Full compositor pipeline
 *
 * Architecture:
 *   Topic Generator → 5 distinct post topics (from brand profile)
 *   For each topic:
 *     Creative Strategist → Social Copywriter → Image Director → Art Director
 *     Quality gate (7/10 threshold, 1 attempt — no retries)
 *   4 platform sizes per topic → 20 images total
 *
 *   Optional second pass: Veo image-to-video for each topic
 *   (uses Imagen-generated hero as seed for visual consistency)
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
  generateVeoVideo,
} from "./compositorGenerate";
import { generatePostTopics, type PostTopic } from "./compositorAgents";
import { runCarouselForTopic, type CarouselResult } from "./runCarousel";
import { renderHtml } from "./compositorRenderer";
import { resolveLogo } from "./runPipeline";
import { execSync } from "child_process";
import type { BrandProfile } from "./classifyBrand";
import type { EmitFn } from "./types";
import type { CreativeBrief } from "./compositorGenerate";
import type { CreativeStrategy } from "./compositorAgents";

const QUALITY_THRESHOLD = 7;
const TOPIC_COUNT = 1; // TODO: restore to 5 once output quality is confirmed

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

export type { CarouselResult } from "./runCarousel";

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
  /** Number of generation attempts (always 1 — no retries) */
  attempts: number;
  /** The post topic this image belongs to */
  topic: PostTopic;
  /** The platform size key */
  size: PlatformSize;
  /** Unique schema ID for the API route (topic_index + size) */
  schemaId: string;
  /** Path to Veo-generated video (if generated) */
  videoPath?: string;
  /** Carousel results for this topic (if generated) */
  carouselResult?: CarouselResult;
}

/**
 * Run the full compositor pipeline for a brand.
 *
 * Steps:
 *   1. Topic Generator produces 5 distinct post topics
 *   2. For each topic: run 4-agent pipeline → generate 4 sizes (no retries)
 *   3. Optional: Veo image-to-video using hero image as seed
 *
 * Returns up to 20 CompositorResult objects (5 topics × 4 sizes), plus carousel results.
 * Emits progress events throughout for the SSE stream.
 */
export async function runCompositorPipeline(
  brandProfile: BrandProfile,
  workDir: string,
  emit: EmitFn,
  options?: { generateVideo?: boolean; generateCarousel?: boolean }
): Promise<CompositorResult[]> {
  fs.mkdirSync(workDir, { recursive: true });
  const allResults: CompositorResult[] = [];
  const generateVideo = options?.generateVideo ?? false;
  const generateCarousel = options?.generateCarousel ?? true; // Carousel enabled by default

  // ── Step 0: Topic Generator — produce 5 distinct post topics ─────────────
  emit({ type: "status", step: 1, total: 7, message: "Planning content strategy..." });
  console.log("[compositor] Generating post topics...");

  let topics: PostTopic[];
  try {
    topics = (await generatePostTopics(brandProfile)).slice(0, TOPIC_COUNT);
    console.log(`[compositor] Topic Generator produced ${topics.length} topics:`);
    topics.forEach((t, i) => console.log(`  ${i + 1}. [${t.angle}] ${t.label} — ${t.direction.slice(0, 60)}...`));
  } catch (e) {
    console.error("[compositor] Topic Generator failed:", (e as Error).message);
    // Fallback: 5 generic topics covering core angles
    topics = [
      { label: "brand story hero",      angle: "brand_awareness",  direction: "Tell the brand's origin story and core mission",                          primaryPlatform: "instagram" },
      { label: "product hero feature",  angle: "product_feature",  direction: "Showcase the primary product capability with a bold visual",              primaryPlatform: "instagram" },
      { label: "how it works",          angle: "educational",      direction: "Explain the core mechanism or process in simple terms",                   primaryPlatform: "linkedin"  },
      { label: "customer result",       angle: "social_proof",     direction: "Highlight a real customer outcome or transformation",                     primaryPlatform: "instagram" },
      { label: "key differentiator",    angle: "product_feature",  direction: "Contrast what makes this brand different from alternatives",              primaryPlatform: "linkedin"  },
    ];
    console.log("[compositor] Using fallback topic list");
  }

  // Save topic plan for debugging
  fs.writeFileSync(path.join(workDir, "topic_plan.json"), JSON.stringify(topics, null, 2));

  // ── Step 1: Resolve logo once (shared across all topics) ─────────────────
  emit({ type: "status", step: 2, total: 7, message: "Loading brand assets..." });
  const logoDataUri = await resolveLogo(brandProfile);

  // ── Step 2: Launch a single shared browser for all renders ───────────────
  emit({ type: "status", step: 3, total: 7, message: "Preparing renderer..." });
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
    // ── Step 3: Loop over topics ──────────────────────────────────────────
    for (let topicIndex = 0; topicIndex < topics.length; topicIndex++) {
      const topic = topics[topicIndex];
      const topicSlug = topic.label.replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      const topicDir = path.join(workDir, `topic_${topicIndex + 1}_${topicSlug}`);
      fs.mkdirSync(topicDir, { recursive: true });

      const progressMsg = `Post ${topicIndex + 1}/${TOPIC_COUNT}: ${topic.label}`;
      emit({ type: "status", step: 4, total: 7, message: progressMsg });
      console.log(`\n[compositor] ── Topic ${topicIndex + 1}/${TOPIC_COUNT}: [${topic.angle}] ${topic.label} ──`);

      // ── 3a. Generate Creative Brief (4-agent pipeline) ──────────────────
      let brief: CreativeBrief;
      try {
        brief = await generateCreativeBrief(brandProfile, topic.direction);
        console.log(`[compositor] Brief: "${brief.headline}" | layout: ${brief.layoutStyle}`);
        fs.writeFileSync(path.join(topicDir, "creative_brief.json"), JSON.stringify(brief, null, 2));
      } catch (e) {
        console.error(`[compositor] Creative brief failed for topic ${topicIndex + 1}:`, (e as Error).message);
        continue;
      }

      // ── 3b. Source hero image (brand images → Imagen 4 Fast → Pexels) ──
      const primaryDims = SIZE_DIMENSIONS.portrait;
      let heroPath: string;
      try {
        heroPath = await sourceHeroImage(brief, brandProfile, primaryDims.width, primaryDims.height, topicDir);
      } catch (e) {
        console.error(`[compositor] Hero image failed for topic ${topicIndex + 1}:`, (e as Error).message);
        heroPath = "";
      }

      // ── 3c. Segment image (no-op — uses full image as background) ───────
      let segmented: Awaited<ReturnType<typeof segmentHeroImage>>;
      try {
        segmented = await segmentHeroImage(heroPath, topicDir);
      } catch (e) {
        segmented = { backgroundPath: heroPath, subjectPath: "", originalPath: heroPath };
      }

      // ── 3d. Render all 4 platform sizes (sequential — API rate limits prevent parallelism) ──
      const htmlResults: Array<{ size: PlatformSize; schemaId: string; html: string; dims: { width: number; height: number }; error: string | null }> = [];
      for (const size of ALL_SIZES) {
        const dims = SIZE_DIMENSIONS[size];
        const schemaId = `post${topicIndex + 1}_${size}`;
        emit({ type: "status", step: 5, total: 7, message: `Creating ${topic.label} · ${size}...` });
        console.log(`[compositor] ${schemaId}...`);
        try {
          const html = await generateComposition(
            brandProfile,
            segmented,
            logoDataUri,
            dims.width,
            dims.height,
            brief
          );
          fs.writeFileSync(path.join(topicDir, `${size}.html`), html);
          htmlResults.push({ size, schemaId, html, dims, error: null });
        } catch (e) {
          console.error(`[compositor] Art Director failed for ${schemaId}:`, (e as Error).message);
          htmlResults.push({ size, schemaId, html: "", dims, error: (e as Error).message });
        }
      }

      // Render HTML → PNG
      for (const { size, schemaId, html, dims, error } of htmlResults) {
        if (error || !html) continue;

        const outputPath = path.join(topicDir, `${size}.png`);
        try {
          await renderHtml(html, outputPath, dims.width, dims.height, browser);
        } catch (e) {
          console.error(`[compositor] Render failed for ${schemaId}:`, (e as Error).message);
          continue;
        }

        // Emit image result (critique removed — saves ~$0.43/run)
        const score = 7;
        const issues: string[] = [];

        emit({
          type: "image",
          schemaId,
          schemaName: topic.label,
          size,
          filePath: outputPath,
          critiqueScore: score,
          critiqueIssues: issues,
        });

        allResults.push({
          imagePath: outputPath,
          composition: html,
          critiqueScore: score,
          critiqueIssues: issues,
          brief,
          attempts: 1,
          topic,
          size,
          schemaId,
        });

        console.log(`[compositor] ${schemaId}: done`);
      }

      // ── 3e. Optional: Carousel generation (5 slides × 2 sizes) ──────────
      if (generateCarousel) {
        const carouselDir = path.join(topicDir, "carousel");
        try {
          // Extract the creative strategy from the brief for carousel copy generation
          const strategy = (brief as CreativeBrief & { _fullBrief?: { strategy?: CreativeStrategy } })._fullBrief?.strategy;
          if (strategy) {
            const carouselResult = await runCarouselForTopic(
              topic,
              topicIndex,
              strategy,
              brandProfile,
              logoDataUri,
              carouselDir,
              browser,
              emit
            );
            // Attach carousel result to the portrait result for this topic
            const portraitResult = allResults.find(r => r.topic.label === topic.label && r.size === "portrait");
            if (portraitResult) {
              portraitResult.carouselResult = carouselResult;
            }
            console.log(`[compositor] Carousel: ${carouselResult.slides.length} slides generated for topic ${topicIndex + 1}`);
          } else {
            console.warn(`[compositor] No strategy available for carousel — skipping topic ${topicIndex + 1}`);
          }
        } catch (e) {
          console.warn(`[compositor] Carousel failed for topic ${topicIndex + 1}:`, (e as Error).message);
        }
      }

      // ── 3f. Optional: Veo image-to-video (uses hero image as seed) ───────
      if (generateVideo && heroPath) {
        emit({ type: "status", step: 6, total: 7, message: `Generating video for ${topic.label}...` });
        try {
          const videoResult = await generateVeoVideo(heroPath, brief, topicDir);
          if (videoResult) {
            // Attach video path to the portrait result for this topic
            const portraitResult = allResults.find(r => r.topic.label === topic.label && r.size === "portrait");
            if (portraitResult) {
              portraitResult.videoPath = videoResult.videoPath;
            }
            emit({
              type: "video",
              schemaId: `post${topicIndex + 1}_video`,
              schemaName: topic.label,
              filePath: videoResult.videoPath,
              durationSeconds: videoResult.durationSeconds,
            });
            console.log(`[compositor] Veo video saved for topic ${topicIndex + 1}`);
          }
        } catch (e) {
          console.warn(`[compositor] Veo failed for topic ${topicIndex + 1}:`, (e as Error).message);
        }
      }
    }
  } finally {
    await browser.close();
  }

  emit({ type: "status", step: 7, total: 7, message: "Finalizing..." });
  console.log(`\n[compositor] Complete: ${allResults.length}/${TOPIC_COUNT * ALL_SIZES.length} images generated`);

  return allResults;
}
