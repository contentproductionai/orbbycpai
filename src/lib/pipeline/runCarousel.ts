/**
 * runCarousel.ts — Carousel generation pipeline
 *
 * For each topic, generates a 5-slide carousel in 2 sizes:
 *   square   1080×1080  (Instagram, LinkedIn)
 *   portrait 1080×1350  (Instagram feed, Facebook)
 *
 * Output: 10 images per topic (5 slides × 2 sizes)
 * Total per full run: 50 carousel images (5 topics × 10)
 *
 * Architecture:
 *   1. generateCarouselCopy() — one Haiku call writes all 5 slides as a unified arc
 *   2. For each slide: sourceSlideImage() — Imagen 4 Fast → Pexels
 *   3. For each slide × 2 sizes: generateCarouselSlide() → renderHtml() → PNG
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { createClient } from "pexels";
import type { Browser } from "puppeteer";
import type { BrandProfile } from "./classifyBrand";
import type { PostTopic, CreativeStrategy } from "./compositorAgents";
import type { CreativeBrief } from "./compositorGenerate";
import { generateCarouselCopy, generateCarouselSlide, type CarouselSlide, type CarouselScript } from "./carouselAgents";
import { renderHtml } from "./compositorRenderer";
import type { EmitFn } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CarouselSlideResult {
  /** Absolute path to the rendered PNG */
  imagePath: string;
  /** The HTML/CSS string that was rendered */
  composition: string;
  /** Slide number (1–5) */
  slideNumber: number;
  /** Slide role */
  role: CarouselSlide["role"];
  /** Platform size */
  size: "square" | "portrait";
  /** Schema ID for the API route */
  schemaId: string;
  /** The topic this carousel belongs to */
  topic: PostTopic;
}

export interface CarouselResult {
  /** The narrative arc description */
  narrativeArc: string;
  /** All rendered slides */
  slides: CarouselSlideResult[];
  /** The topic this carousel belongs to */
  topic: PostTopic;
  /** Topic index (0-based) */
  topicIndex: number;
}

// ─── Carousel sizes ───────────────────────────────────────────────────────────

const CAROUSEL_SIZES = {
  square:   { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
} as const;

type CarouselSize = keyof typeof CAROUSEL_SIZES;

// ─── Image sourcing for carousel slides ──────────────────────────────────────

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        downloadFile(response.headers.location!, dest).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function sourceSlideImage(
  slide: CarouselSlide,
  slideDir: string,
  isPortrait: boolean
): Promise<string> {
  const imagePath = path.join(slideDir, `slide_${slide.slideNumber}_hero.jpg`);

  // Hook slides (bold typographic) don't need an image
  if (slide.layoutStyle === "bold typographic") {
    return "";
  }

  // ── 1. Imagen 4 Fast ──────────────────────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && slide.imagenPrompt) {
    try {
      const aspectRatio = isPortrait ? "3:4" : "1:1";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${geminiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: slide.imagenPrompt }],
          parameters: { sampleCount: 1, aspectRatio, outputMimeType: "image/jpeg" },
        }),
      });

      if (response.ok) {
        const data = await response.json() as { predictions?: Array<{ bytesBase64Encoded?: string }> };
        const bytes = data.predictions?.[0]?.bytesBase64Encoded;
        if (bytes) {
          fs.writeFileSync(imagePath, Buffer.from(bytes, "base64"));
          console.log(`[carousel] Slide ${slide.slideNumber}: Imagen 4 Fast generated`);
          return imagePath;
        }
      }
    } catch (err) {
      console.log(`[carousel] Slide ${slide.slideNumber}: Imagen failed — ${(err as Error).message}`);
    }
  }

  // ── 2. Pexels fallback ────────────────────────────────────────────────────
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (pexelsKey && slide.pexelsQuery) {
    try {
      const pexelsClient = createClient(pexelsKey);
      const orientation = isPortrait ? "portrait" : "square";
      const result = await pexelsClient.photos.search({
        query: slide.pexelsQuery,
        per_page: 5,
        orientation,
      });

      if ("photos" in result && result.photos.length > 0) {
        const photo = result.photos[0];
        const imageUrl = isPortrait
          ? (photo.src.portrait || photo.src.large2x)
          : (photo.src.large2x || photo.src.large);
        await downloadFile(imageUrl, imagePath);
        console.log(`[carousel] Slide ${slide.slideNumber}: Pexels "${slide.pexelsQuery}"`);
        return imagePath;
      }
    } catch (err) {
      console.log(`[carousel] Slide ${slide.slideNumber}: Pexels failed — ${(err as Error).message}`);
    }
  }

  // No image — Art Director will use brand color background
  return "";
}

// ─── Main carousel runner ─────────────────────────────────────────────────────

/**
 * Generate a full 5-slide carousel for a single topic.
 * Returns up to 10 CarouselSlideResult objects (5 slides × 2 sizes).
 */
export async function runCarouselForTopic(
  topic: PostTopic,
  topicIndex: number,
  strategy: CreativeStrategy,
  brandProfile: BrandProfile,
  logoDataUri: string | null,
  carouselDir: string,
  browser: Browser,
  emit: EmitFn
): Promise<CarouselResult> {
  fs.mkdirSync(carouselDir, { recursive: true });

  const allSlides: CarouselSlideResult[] = [];

  // ── Step 1: Generate all 5 slides' copy in one call ──────────────────────
  console.log(`[carousel] Generating carousel copy for: ${topic.label}`);
  emit({ type: "status", step: 6, total: 7, message: `Carousel: writing ${topic.label}...` });

  let script: CarouselScript;
  try {
    script = await generateCarouselCopy(strategy, brandProfile, topic.direction);
    console.log(`[carousel] Narrative arc: "${script.narrativeArc}"`);
    fs.writeFileSync(path.join(carouselDir, "carousel_script.json"), JSON.stringify(script, null, 2));
  } catch (e) {
    console.error(`[carousel] Copy generation failed: ${(e as Error).message}`);
    throw e;
  }

  // ── Step 2: Source images for each slide ─────────────────────────────────
  const slideImages: Record<number, string> = {};
  for (const slide of script.slides) {
    try {
      const heroPath = await sourceSlideImage(slide, carouselDir, true);
      slideImages[slide.slideNumber] = heroPath;
    } catch (e) {
      console.warn(`[carousel] Image source failed for slide ${slide.slideNumber}: ${(e as Error).message}`);
      slideImages[slide.slideNumber] = "";
    }
  }

  // ── Step 3: Generate HTML + render PNG for each slide × 2 sizes ──────────
  for (const slide of script.slides) {
    const heroPath = slideImages[slide.slideNumber] ?? "";

    for (const [sizeName, dims] of Object.entries(CAROUSEL_SIZES) as Array<[CarouselSize, { width: number; height: number }]>) {
      const schemaId = `post${topicIndex + 1}_carousel_s${slide.slideNumber}_${sizeName}`;
      const outputPath = path.join(carouselDir, `slide_${slide.slideNumber}_${slide.role}_${sizeName}.png`);
      const htmlPath = path.join(carouselDir, `slide_${slide.slideNumber}_${slide.role}_${sizeName}.html`);

      emit({ type: "status", step: 6, total: 7, message: `Carousel: slide ${slide.slideNumber}/5 ${sizeName}...` });
      console.log(`[carousel] ${schemaId}...`);

      try {
        const html = await generateCarouselSlide(
          slide,
          script.slides.length,
          brandProfile,
          heroPath,
          logoDataUri,
          dims.width,
          dims.height
        );

        fs.writeFileSync(htmlPath, html);

        await renderHtml(html, outputPath, dims.width, dims.height, browser);

        emit({
          type: "image",
          schemaId,
          schemaName: `${topic.label} · carousel slide ${slide.slideNumber} (${slide.role})`,
          size: sizeName,
          filePath: outputPath,
          critiqueScore: 7,
          critiqueIssues: [],
          isCarousel: true,
          carouselSlide: slide.slideNumber,
          carouselRole: slide.role,
        });

        allSlides.push({
          imagePath: outputPath,
          composition: html,
          slideNumber: slide.slideNumber,
          role: slide.role,
          size: sizeName,
          schemaId,
          topic,
        });

        console.log(`[carousel] ${schemaId}: done`);
      } catch (e) {
        console.error(`[carousel] Failed ${schemaId}: ${(e as Error).message}`);
      }
    }
  }

  return {
    narrativeArc: script.narrativeArc,
    slides: allSlides,
    topic,
    topicIndex,
  };
}
