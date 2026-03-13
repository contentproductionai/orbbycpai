/**
 * Orb Pipeline — Main Orchestrator
 * URL → BrandProfile → Pexels photo → Claude HTML/CSS → Puppeteer PNG
 * Ported from run_pipeline.py + extract_dom.js + render_sizes.js
 * No Python. No subprocesses. Pure TypeScript.
 */

import puppeteer, { Browser } from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { execSync } from "child_process";
import Anthropic from "@anthropic-ai/sdk";
import { classifyBrand, type BrandProfile } from "./classifyBrand";
import { generateHtml } from "./generateHtml";
import { validateHtml } from "./guardrails";
import {
  SCHEMA_BY_ID,
  SIZE_DIMENSIONS,
  selectSchemas,
  type Schema,
} from "./schemas";

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

export type EmitFn = (event: object) => void;

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

export async function extractDom(
  url: string,
  workDir: string,
  emit?: EmitFn
): Promise<Record<string, unknown>> {
  emit?.({ type: "status", step: 1, total: 5, message: "Extracting brand signals from website..." });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: getChromiumPath(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    } catch {
      // If networkidle2 times out, continue with what loaded
    }

    await new Promise((r) => setTimeout(r, 2000));

    // Scroll to trigger lazy-loaded images
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 400;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 120);
      });
    });

    await new Promise((r) => setTimeout(r, 1500));

    // Save screenshot
    const screenshotPath = path.join(workDir, "screenshot.png");
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});

    // Extract all brand signals
    const raw = await page.evaluate(() => {
      // ─── Helpers ───────────────────────────────────────────────────────────
      function toHex(color: string): string | null {
        if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return null;
        const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return null;
        return (
          "#" +
          [m[1], m[2], m[3]]
            .map((v) => parseInt(v).toString(16).padStart(2, "0"))
            .join("")
        );
      }
      function isNeutral(hex: string): boolean {
        const h = hex.replace("#", "");
        if (h.length !== 6) return true;
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return max - min < 25 || lum > 0.94 || lum < 0.04;
      }

      // ─── PASS 1: Copy text ─────────────────────────────────────────────────
      const copyText: Record<string, string[]> = {
        h1: Array.from(document.querySelectorAll("h1")).map((el) => el.textContent?.trim() ?? "").filter(Boolean).slice(0, 5),
        h2: Array.from(document.querySelectorAll("h2")).map((el) => el.textContent?.trim() ?? "").filter(Boolean).slice(0, 5),
        nav: Array.from(document.querySelectorAll("nav a")).map((el) => el.textContent?.trim() ?? "").filter(Boolean).slice(0, 10),
        cta: Array.from(document.querySelectorAll("a[class*='btn'], a[class*='button'], button")).map((el) => el.textContent?.trim() ?? "").filter(Boolean).slice(0, 5),
      };
      const bodySnippet = document.body.innerText.slice(0, 2000);

      // ─── PASS 2: Typography ────────────────────────────────────────────────
      function typoFor(selector: string) {
        const el = document.querySelector(selector);
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        return {
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing,
          textTransform: cs.textTransform,
          color: toHex(cs.color),
        };
      }
      const typography = {
        h1: typoFor("h1"),
        body: typoFor("p, body"),
        cta: typoFor("a[class*='btn'], a[class*='button'], button"),
      };

      // ─── PASS 3: CSS variables ─────────────────────────────────────────────
      const cssVars: Record<string, string> = {};
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules ?? [])) {
            if (rule instanceof CSSStyleRule && rule.selectorText === ":root") {
              for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                if (prop.startsWith("--")) {
                  const val = rule.style.getPropertyValue(prop).trim();
                  if (val.startsWith("#") || val.startsWith("rgb")) {
                    cssVars[prop] = val;
                  }
                }
              }
            }
          }
        } catch {}
      }

      // ─── PASS 4: Border radii ──────────────────────────────────────────────
      const borderRadii: string[] = [];
      const radiiTargets = [
        "button", "a[class*='btn']", "[class*='card']", "[class*='badge']",
        "[class*='tag']", "[class*='pill']", "input", "img",
      ];
      for (const sel of radiiTargets) {
        for (const el of Array.from(document.querySelectorAll(sel)).slice(0, 3)) {
          const r = window.getComputedStyle(el).borderRadius;
          if (r && r !== "0px") borderRadii.push(r);
        }
      }

      // ─── PASS 5: Color samples ─────────────────────────────────────────────
      const colorSamples: Array<{ hex: string; contexts: string[]; count: number }> = [];
      const colorTargets: Array<{ sel: string; ctx: string; prop?: string }> = [
        { sel: "body", ctx: "page-background" },
        { sel: "header, nav", ctx: "header-background" },
        { sel: "h1", ctx: "headline" },
        { sel: "h2", ctx: "subheadline" },
        { sel: "p", ctx: "body-text" },
        { sel: "a[class*='btn'], button[class*='primary']", ctx: "cta-background" },
        { sel: "[class*='hero'], [class*='Hero']", ctx: "hero-background" },
        { sel: "footer", ctx: "footer-background" },
      ];
      for (const { sel, ctx, prop } of colorTargets) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const cs = window.getComputedStyle(el);
        const rawColor = cs.getPropertyValue(prop || "background-color");
        const hex = toHex(rawColor);
        if (hex && !isNeutral(hex)) {
          colorSamples.push({ hex, contexts: [ctx], count: 2 });
        }
        if (!prop) {
          const textHex = toHex(cs.color);
          if (textHex && !isNeutral(textHex)) {
            colorSamples.push({ hex: textHex, contexts: [ctx + "-text"], count: 1 });
          }
        }
      }

      // ─── PASS 6: Spatial philosophy ────────────────────────────────────────
      function spatialFor(selector: string) {
        const el = document.querySelector(selector);
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        const parseVal = (v: string) => parseFloat(v) || 0;
        return {
          paddingTop: cs.paddingTop,
          paddingBottom: cs.paddingBottom,
          paddingLeft: cs.paddingLeft,
          paddingRight: cs.paddingRight,
          marginTop: cs.marginTop,
          marginBottom: cs.marginBottom,
          avgPadding: (parseVal(cs.paddingTop) + parseVal(cs.paddingBottom) + parseVal(cs.paddingLeft) + parseVal(cs.paddingRight)) / 4,
          avgMargin: (parseVal(cs.marginTop) + parseVal(cs.marginBottom)) / 2,
        };
      }
      const spatial = spatialFor("body") ?? spatialFor("section") ?? { avgPadding: 16, avgMargin: 8 };

      // ─── PASS 7: Brand assets ──────────────────────────────────────────────
      const logoImgs = Array.from(
        document.querySelectorAll("header img, nav img, [class*='logo'] img, [id*='logo'] img")
      )
        .map((el) => {
          const img = el as HTMLImageElement;
          return { src: img.src, alt: img.alt, width: img.naturalWidth, height: img.naturalHeight };
        })
        .filter((i) => i.src && !i.src.includes("data:"))
        .slice(0, 3);

      const logoSvgs = Array.from(
        document.querySelectorAll("header svg, nav svg, [class*='logo'] svg")
      )
        .map((el) => ({ type: "inline-svg", outerHTML: el.outerHTML.slice(0, 500) }))
        .slice(0, 2);

      const favicon =
        (document.querySelector('link[rel="icon"], link[rel="shortcut icon"]') as HTMLLinkElement)?.href ?? "";
      const ogImage =
        document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "";
      const ogTitle =
        document.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? document.title ?? "";
      const rawSiteName =
        document.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ?? "";
      const genericNames = ["my site", "home", "website", "untitled", "wix site"];
      const brandName = genericNames.includes(rawSiteName.toLowerCase()) ? "" : rawSiteName;

      // ─── PASS 8: Photography ───────────────────────────────────────────────
      const images = Array.from(document.querySelectorAll("img"))
        .filter((img) => img.naturalWidth > 200 && img.naturalHeight > 200)
        .map((img) => ({
          src: img.src,
          alt: img.alt ?? "",
          width: img.naturalWidth,
          height: img.naturalHeight,
          inHero: !!img.closest('[class*="hero"], [class*="Hero"], section:first-of-type'),
        }))
        .filter((i) => !i.src.includes("data:") && !i.src.includes("logo") && !i.src.includes("icon"))
        .slice(0, 15);

      const bgImages = Array.from(
        document.querySelectorAll('[class*="hero"], [class*="Hero"], section, div')
      )
        .map((el) => {
          const bg = window.getComputedStyle(el).backgroundImage;
          if (bg && bg !== "none" && bg.includes("url(")) {
            const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
            return match ? match[1] : null;
          }
          return null;
        })
        .filter(Boolean)
        .slice(0, 5) as string[];

      return {
        url: window.location.href,
        title: document.title,
        brandName,
        ogTitle,
        ogImage,
        favicon,
        copyText,
        bodySnippet,
        borderRadii,
        typography,
        cssVars,
        colorSamples,
        spatial,
        logoImgs,
        logoSvgs,
        images,
        bgImages,
      };
    });

    // Save raw DOM data
    const rawPath = path.join(workDir, "raw_dom_data.json");
    fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2));

    return raw as Record<string, unknown>;
  } finally {
    await browser.close();
  }
}

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

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 30,
    messages: [{ role: "user", content: prompt }],
  });

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
    if (src && src.startsWith("http")) {
      try {
        const buf = await fetchBuffer(src);
        if (buf.length > 500) {
          const mime = mimeFromUrl(src);
          return bufferToDataUri(buf, mime);
        }
      } catch {}
    }
  }

  // 2. Try favicon
  if (assets.favicon && assets.favicon.startsWith("http")) {
    try {
      const buf = await fetchBuffer(assets.favicon);
      if (buf.length > 200) {
        const mime = mimeFromUrl(assets.favicon);
        return bufferToDataUri(buf, mime);
      }
    } catch {}
  }

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
      const dims = SIZE_DIMENSIONS[size];
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

  // Step 1: DOM extraction
  const raw = await extractDom(url, workDir, emit);

  // Step 2: Brand classification
  emit({ type: "status", step: 2, total: 5, message: "Classifying brand identity..." });
  const brandProfile = await classifyBrand(raw);
  fs.writeFileSync(
    path.join(workDir, "brand_profile.json"),
    JSON.stringify(brandProfile, null, 2)
  );

  // Step 3: Fetch Pexels photo
  let photoPath: string | null = null;
  try {
    photoPath = await fetchPexelsPhoto(brandProfile, workDir, emit);
  } catch (e) {
    console.warn("Pexels fetch failed:", (e as Error).message);
  }

  // Step 4: Resolve logo
  const logoDataUri = await resolveLogo(brandProfile);

  // Step 5: Generate HTML + render for each schema
  emit({ type: "status", step: 4, total: 5, message: "Generating posts with Claude..." });
  const schemaIds = selectSchemas(brandProfile as unknown as Record<string, unknown>);
  const images: ImageResult[] = [];

  // Launch a single shared Puppeteer browser for all schemas to save memory and startup time
  const sharedBrowser: Browser = await puppeteer.launch({
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
  for (const schemaId of schemaIds) {
    const schema: Schema = SCHEMA_BY_ID[schemaId];
    if (!schema) continue;

    emit({ type: "schema", schemaId, schemaName: schema.name });
    console.log(`\n  Schema: ${schema.name}`);

    // Generate for portrait first (primary size)
    const primarySize = schema.sizes[0];
    const dims = SIZE_DIMENSIONS[primarySize];

    let html: string | null = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        html = await generateHtml(
          brandProfile,
          schema.requiresPhoto ? photoPath : null,
          logoDataUri,
          dims.width,
          dims.height,
          schema.definition
        );

        const validation = validateHtml(html, dims.width, dims.height);
        if (validation.passed) {
          console.log(`  Guardrails passed (attempt ${attempts})`);
          break;
        } else {
          console.warn(`  Guardrails failed (attempt ${attempts}):`, validation.failures);
          if (attempts === maxAttempts) {
            console.warn(`  Using last attempt despite failures`);
          } else {
            html = null;
          }
        }
      } catch (e) {
        console.error(`  Generation error (attempt ${attempts}):`, (e as Error).message);
        if (attempts === maxAttempts) throw e;
      }
    }

    if (!html) continue;

    // Save HTML
    const htmlPath = path.join(workDir, `${schemaId}.html`);
    fs.writeFileSync(htmlPath, html);

    // Render all sizes using the shared browser
    const renderResults = await renderSizes(html, workDir, schemaId, schema.sizes, sharedBrowser);

    for (const [size, filePath] of Object.entries(renderResults)) {
      images.push({
        schemaId,
        schemaName: schema.name,
        size,
        filePath,
        url: "", // will be set by the API route after copying to public dir
      });
      emit({ type: "image", schemaId, size, filePath });
    }
  }
  } finally {
    await sharedBrowser.close();
  }

  emit({ type: "status", step: 5, total: 5, message: "Finalizing..." });

  return { brandProfile, images };
}
