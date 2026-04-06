/**
 * Orb Pipeline — Main Orchestrator
 * URL → BrandProfile → 4-Agent Compositor → 20 PNGs (5 topics × 4 sizes)
 */

import puppeteer, { type Browser } from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { execSync } from "child_process";
import Anthropic from "@anthropic-ai/sdk";
import { withAnthropicRetry } from "@/lib/utils/anthropicRetry";
import { classifyBrand, extractDesignSignal, type BrandProfile } from "./classifyBrand";
import { classifyVisual, quantizeImageColors } from "./classifyVisual";
import type { EmitFn } from "./types";
import { runCompositorPipeline, SIZE_DIMENSIONS } from "./runCompositor";

// ─── Chromium path resolution ────────────────────────────────────────────────

function getChromiumPath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  // Try to find system Chromium in PATH (e.g. Nix-installed on Railway)
  for (const bin of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      const p = execSync(`which ${bin}`, { encoding: "utf8" }).trim();
      if (p) {
        console.log(`[Puppeteer] Found browser at: ${p}`);
        return p;
      }
    } catch {}
  }
  // Fall back to Puppeteer's bundled Chrome
  console.log("[Puppeteer] Using bundled Chrome");
  return undefined;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageResult {
  schemaId: string;
  schemaName: string;
  size: string;
  filePath: string;
  url: string;
}

export type { EmitFn } from "./types";

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib
      .get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return fetchBuffer(res.headers.location).then(resolve).catch(reject);
          }
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks)));
          res.on("error", reject);
        }
      )
      .on("error", reject);
  });
}

function bufferToDataUri(buf: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buf.toString("base64")}`;
}

function mimeFromUrl(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    svg: "image/svg+xml",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] ?? "image/png";
}

// ─── Step 1: DOM Extraction via Puppeteer ─────────────────────────────────────
// Extracted to extractDom.ts — scoring-model approach with cross-validation
import { extractDom } from './extractDom';
export { extractDom };

// ─── Step 2: Pexels photo fetch ───────────────────────────────────────────────

async function derivePexelsQuery(brandProfile: BrandProfile): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const name = brandProfile.meta?.brandName ?? "Unknown";
  const industry = brandProfile.industryContext ?? "";
  const personality = brandProfile.brandPersonality ?? "";
  const photoStyle = (brandProfile.photography as { style?: string })?.style ?? "";
  const photoSubject = (brandProfile.photography as { subject?: string })?.subject ?? "";
  const tone = brandProfile.tone ?? {};
  const toneSummary = tone.summary ?? "";
  const toneE = tone.emotionality ?? "";

  const prompt = `You are selecting a stock photo for a social media post for this brand.
Brand: ${name}
Industry: ${industry}
Personality: ${personality}
Photography style: ${photoStyle}
Photography subject: ${photoSubject}
Tone: ${toneSummary}
Emotional register: ${toneE}
Write a single Pexels search query (4-7 words) that would return a high-quality, on-brand photograph.
Rules:
- The query must describe a SPECIFIC scene or subject, not a mood or concept
- Match the brand's actual visual world (what appears in their real photography)
- Use concrete nouns and adjectives (e.g. "runner sprinting track motion blur" not "motivation energy")
- No brand names, no abstract concepts like "success" or "inspiration"
- Portrait orientation preferred (taller than wide)
Return ONLY the query string, nothing else.`;

  const response = await withAnthropicRetry(
    () => client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 30,
      messages: [{ role: "user", content: prompt }],
    }),
    "derivePexelsQuery"
  );

  let query = (response.content[0] as { text: string }).text
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim();

  return query;
}

export async function fetchPexelsPhoto(
  brandProfile: BrandProfile,
  workDir: string,
  emit?: EmitFn
): Promise<string> {
  emit?.({ type: "status", step: 2, total: 5, message: "Fetching brand-matched photography..." });

  const query = await derivePexelsQuery(brandProfile);
  console.log(`  Pexels query: "${query}"`);

  const pexelsKey = process.env.PEXELS_API_KEY ?? "";
  const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=portrait`;

  const searchBuf = await fetchBuffer(
    searchUrl.replace("https://", "https://") // force https
  ).catch(() => Buffer.from("{}"));

  // Use node-fetch style via https module
  const searchResult = await new Promise<{ photos: Array<{ id: number; avg_color: string; src: { large2x: string } }> }>(
    (resolve, reject) => {
      const req = https.get(
        searchUrl,
        { headers: { Authorization: pexelsKey } },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString()));
            } catch {
              resolve({ photos: [] });
            }
          });
          res.on("error", reject);
        }
      );
      req.on("error", reject);
    }
  );

  let photos = searchResult.photos ?? [];

  // Fallback query
  if (photos.length === 0) {
    const fallbackQuery = `${brandProfile.industryContext ?? "professional"} people`;
    console.log(`  Pexels fallback query: "${fallbackQuery}"`);
    const fallbackUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(fallbackQuery)}&per_page=10&orientation=portrait`;
    const fallbackResult = await new Promise<{ photos: typeof photos }>(
      (resolve, reject) => {
        const req = https.get(
          fallbackUrl,
          { headers: { Authorization: pexelsKey } },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c: Buffer) => chunks.push(c));
            res.on("end", () => {
              try {
                resolve(JSON.parse(Buffer.concat(chunks).toString()));
              } catch {
                resolve({ photos: [] });
              }
            });
            res.on("error", reject);
          }
        );
        req.on("error", reject);
      }
    );
    photos = fallbackResult.photos ?? [];
  }

  if (photos.length === 0) {
    throw new Error(`No Pexels photos found for query: ${query}`);
  }

  // Select photo with good contrast potential (mid-dark luminance)
  function lum(hex: string): number {
    const h = hex.replace("#", "");
    if (h.length !== 6) return 0.5;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  function photoScore(p: { avg_color: string }): number {
    const l = lum(p.avg_color ?? "#888888");
    if (l >= 0.25 && l <= 0.55) return 1.0;
    if (l < 0.25) return 0.6;
    return 0.3;
  }
  const best = photos.reduce((a, b) => (photoScore(a) >= photoScore(b) ? a : b));

  const photoPath = path.join(workDir, "photo.jpg");
  const photoBuf = await fetchBuffer(best.src.large2x);
  fs.writeFileSync(photoPath, photoBuf);
  console.log(`  Photo ID ${best.id} (avg ${best.avg_color}) saved`);

  return photoPath;
}

// ─── Step 3: Logo resolution ──────────────────────────────────────────────────

export async function resolveLogo(brandProfile: BrandProfile): Promise<string | null> {
  const assets = brandProfile.brandAssets ?? { logoImgs: [], logoSvgs: [], favicon: "", ogImage: "" };

  // 1. Try logoImgs
  for (const logo of assets.logoImgs) {
    const src = typeof logo === "object" ? (logo as { src: string }).src : String(logo);
    const storedW = typeof logo === "object" ? (logo as { width?: number }).width ?? 0 : 0;
    const storedH = typeof logo === "object" ? (logo as { height?: number }).height ?? 0 : 0;
    if (!src) continue;
    // Reject near-square large images — these are illustrations, not logos
    // A real logo is either wide (wordmark) or small-square (icon mark)
    // Reject if: both dimensions > 200px AND aspect ratio is close to 1:1 (0.6–1.6)
    if (storedW > 200 && storedH > 200) {
      const ar = storedW / storedH;
      if (ar > 0.6 && ar < 1.6) {
        console.log(`[resolveLogo] Skipping near-square image (${storedW}x${storedH}) — likely illustration, not logo`);
        continue;
      }
    }
    // Reject URLs that look like illustrations/hero images
    if (/group|illustration|hero|banner|background|avatar/i.test(src)) continue;
    // Already a data URI — use directly
    if (src.startsWith("data:")) {
      return src;
    }
    // HTTP/HTTPS URL — fetch and convert
    if (src.startsWith("http")) {
      try {
        const buf = await fetchBuffer(src);
        if (buf.length > 500) {
          const mime = mimeFromUrl(src);
          return bufferToDataUri(buf, mime);
        }
      } catch {}
    }
  }

  // 2. Try logoSvgs (inline SVG elements captured from the nav/header)
  // Convert outerHTML to a base64 SVG data URI — works for Stripe, Linear, etc.
  for (const svgEntry of assets.logoSvgs) {
    const outerHTML =
      typeof svgEntry === "object"
        ? (svgEntry as { outerHTML?: string }).outerHTML ?? ""
        : String(svgEntry);
    if (!outerHTML || !outerHTML.trim().startsWith("<svg")) continue;
    // Ensure xmlns is present so the SVG renders correctly as a data URI
    const svgWithNs = outerHTML.includes("xmlns=")
      ? outerHTML
      : outerHTML.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    return bufferToDataUri(Buffer.from(svgWithNs, "utf8"), "image/svg+xml");
  }

  // No logo found — return null so the template renders without a logo.
  // Never fall back to the favicon: favicons are 16–32px browser icons,
  // not brand logos, and using them destroys brand recognition.
  return null;
}

// ─── Step 4: Multi-size PNG rendering ────────────────────────────────────────

export async function renderSizes(
  html: string,
  workDir: string,
  basename: string,
  sizes: string[] = ["portrait", "story", "square"],
  sharedBrowser?: Browser
): Promise<Record<string, string>> {
  const ownBrowser = !sharedBrowser;
  const browser: Browser = sharedBrowser ?? await puppeteer.launch({
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

  const results: Record<string, string> = {};

  try {
    for (const size of sizes) {
      const dims = SIZE_DIMENSIONS[size as keyof typeof SIZE_DIMENSIONS];
      if (!dims) continue;

      const page = await browser.newPage();
      try {
        await page.setViewport({
          width: dims.width,
          height: dims.height,
          deviceScaleFactor: 1,
        });
        await page.setContent(html, { waitUntil: "load", timeout: 30000 });
        // Wait for Google Fonts
        await new Promise((r) => setTimeout(r, 2500));

        const outputPath = path.join(workDir, `${basename}_${size}.png`);
        await page.screenshot({
          path: outputPath,
          type: "png",
          clip: { x: 0, y: 0, width: dims.width, height: dims.height },
        });
        results[size] = outputPath;
        console.log(`  Rendered ${size}: ${outputPath}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    // Only close if we own this browser instance
    if (ownBrowser) await browser.close();
  }

  return results;
}

// ─── Full pipeline orchestrator ───────────────────────────────────────────────

export async function runFullPipeline(
  url: string,
  workDir: string,
  emit: EmitFn
): Promise<{ brandProfile: BrandProfile; images: ImageResult[] }> {
  fs.mkdirSync(workDir, { recursive: true });

  // Step 1: DOM extraction (discovery only — no classification)
  const raw = await extractDom(url, workDir, emit);

  // Step 1b: Product image color quantization — extract dominant colors from the
  // hero asset (if downloaded) and merge into the DOM palette before classification.
  // This captures accent colors that live on product packaging but not in site CSS
  // (e.g. Liquid Death gold band, OLIPOP orange, BRUNT orange).
  const domPalette = (raw.scoredPalette as Array<{ hex: string; score: number; sources: string[]; totalArea?: number }>) ?? [];
  let enrichedPalette = domPalette;
  try {
    const downloadedAssets = (raw.downloadedAssets as Array<{ localPath: string; inHero: boolean; width: number; height: number }>) ?? [];
    // Prefer hero assets; fall back to the largest downloaded asset
    const heroAsset = downloadedAssets.find((a) => a.inHero) ?? downloadedAssets[0];
    if (heroAsset?.localPath && fs.existsSync(heroAsset.localPath)) {
      console.log(`[pipeline] Running color quantization on hero asset: ${heroAsset.localPath}`);
      const quantizedColors = await quantizeImageColors(heroAsset.localPath, 3);
      if (quantizedColors.length > 0) {
        console.log(`[pipeline] Quantized ${quantizedColors.length} colors from hero asset:`, quantizedColors.map((c) => c.hex));
        // Merge: add quantized colors that aren't already close to a DOM palette entry
        // "Close" = within 30 units of Euclidean RGB distance
        const isAlreadyInPalette = (hex: string): boolean => {
          const toRgb = (h: string): [number, number, number] => {
            const n = parseInt(h.replace("#", ""), 16);
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
          };
          const [r1, g1, b1] = toRgb(hex);
          return domPalette.some((c) => {
            const [r2, g2, b2] = toRgb(c.hex);
            return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) < 30;
          });
        };
        const newColors = quantizedColors.filter((c) => !isAlreadyInPalette(c.hex));
        enrichedPalette = [...domPalette, ...newColors];
        console.log(`[pipeline] Added ${newColors.length} new colors from quantization to palette`);
      }
    }
  } catch (e) {
    console.warn("[pipeline] Color quantization pass failed (non-fatal):", (e as Error).message);
  }

  // Step 1c: Visual classification — Claude Vision classifies scoredPalette colors
  // and discoveredFonts by semantic role (primary/secondary/accent/structural, heading/body/ui)
  emit({ type: "status", step: 2, total: 5, message: "Classifying brand colors and fonts..." });
  console.log("[pipeline] Starting classifyVisual...");
  const visualClassification = await classifyVisual(
    (raw.viewportScreenshotPath as string) ?? "",
    enrichedPalette,
    (raw.discoveredFonts as Array<{ family: string; seenOn: string[]; score?: number }>) ?? [],
    (raw.fontElementMap as Record<string, string | null>) ?? {}
  );
  console.log("[pipeline] classifyVisual complete:", {
    brandPrimary: visualClassification.brandPrimary,
    brandSecondary: visualClassification.brandSecondary,
    accentColor: visualClassification.accentColor,
    headingFont: visualClassification.headingFont,
    bodyFont: visualClassification.bodyFont,
  });
  fs.writeFileSync(
    path.join(workDir, "visual_classification.json"),
    JSON.stringify(visualClassification, null, 2)
  );

  // Merge visual classification into raw DOM data so classifyBrand receives
  // pre-classified colors and fonts — it no longer needs to infer them
  const rawWithClassification = {
    ...raw,
    brandPrimary: visualClassification.brandPrimary,
    brandSecondary: visualClassification.brandSecondary,
    accentColor: visualClassification.accentColor,
    headingFont: visualClassification.headingFont,
    bodyFont: visualClassification.bodyFont,
    uiFont: visualClassification.uiFont,
    classifiedColors: visualClassification.colors,
    classifiedFonts: visualClassification.fonts,
  };

  // Step 2: Brand classification (tone, personality, industry, photography — NOT colors/fonts)
  console.log("[pipeline] Starting classifyBrand...");
  const brandProfile = await classifyBrand(rawWithClassification);
  console.log("[pipeline] classifyBrand complete");

  // Step 2b: Design signal extraction — analyzes screenshot to extract visual design patterns
  // This enriches the BrandProfile with layout, card style, photography treatment, etc.
  // The Art Director uses this to compose content that matches the brand's actual visual system.
  try {
    console.log("[pipeline] Starting extractDesignSignal...");
    const screenshotPath = (raw.viewportScreenshotPath as string) ?? "";
    const downloadedAssets = (brandProfile.brandAssets?.downloadedAssets ?? []) as Array<{
      localPath: string;
      inHero: boolean;
      alt: string;
      width: number;
      height: number;
    }>;
    const designSignal = await extractDesignSignal(screenshotPath, downloadedAssets, brandProfile);
    brandProfile.designSignal = designSignal;
    console.log("[pipeline] extractDesignSignal complete:", {
      layoutPattern: designSignal.layoutPattern,
      dominantVisualType: designSignal.dominantVisualType,
      density: designSignal.density,
    });
  } catch (e) {
    console.warn("[pipeline] extractDesignSignal failed (non-fatal):", (e as Error).message);
  }

  fs.writeFileSync(
    path.join(workDir, "brand_profile.json"),
    JSON.stringify(brandProfile, null, 2)
  );

  // Emit brand profile immediately so the UI can populate Brand Intel
  // while image generation is still running
  emit({ type: "brand", brandProfile });

  // Step 3: Run the 4-agent compositor pipeline
  // Topic Generator → 5 topics → Creative Strategist → Social Copywriter → Image Director → Art Director
  // Quality check is informational — no retries
  // Output: 5 topics × 4 sizes = 20 images
  emit({ type: "status", step: 4, total: 5, message: "Generating content..." });
  console.log("[pipeline] Starting compositor pipeline...");

  const compositorResults = await runCompositorPipeline(brandProfile, workDir, emit, { generateVideo: process.env.TEST_GENERATE_VIDEO === "true" });

  const images: ImageResult[] = compositorResults.map((r) => ({
    schemaId: r.schemaId,
    schemaName: r.topic.label,
    size: r.size,
    filePath: r.imagePath,
    url: "", // will be set by the API route after copying to public dir
  }));

  console.log(`[pipeline] Compositor complete: ${images.length} images`);
  emit({ type: "status", step: 5, total: 5, message: "Finalizing..." });

  return { brandProfile, images };
}

/**
 * Render-only pipeline — skips DOM extraction and brand classification.
 * Used when a fresh brand profile already exists in the brands cache.
 */
export async function runRenderOnly(
  brandProfile: BrandProfile,
  workDir: string,
  emit: EmitFn
): Promise<{ images: ImageResult[] }> {
  fs.mkdirSync(workDir, { recursive: true });

  emit({ type: "status", step: 1, total: 3, message: "Using cached brand profile..." });

  // Run the 4-agent compositor pipeline (same as full pipeline, skips extraction)
  emit({ type: "status", step: 2, total: 3, message: "Generating content..." });
  const compositorResults = await runCompositorPipeline(brandProfile, workDir, emit, { generateVideo: process.env.TEST_GENERATE_VIDEO === "true" });

  const images: ImageResult[] = compositorResults.map((r) => ({
    schemaId: r.schemaId,
    schemaName: r.topic.label,
    size: r.size,
    filePath: r.imagePath,
    url: "",
  }));

  emit({ type: "status", step: 3, total: 3, message: "Finalizing..." });
  return { images };
}
