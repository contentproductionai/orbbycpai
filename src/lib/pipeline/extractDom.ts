/**
 * extractDom.ts — Node.js orchestrator
 *
 * Responsibility: browser lifecycle only.
 *   - Launch Puppeteer
 *   - Navigate to URL
 *   - Scroll to trigger lazy-loaded content
 *   - Take screenshots
 *   - Inject extractDom.browser.js via page.addScriptTag (plain JS, no compilation)
 *   - Call window.__orbExtract() to run the browser-side extraction
 *   - Close browser
 *   - Download brand asset images (≥100px, not nav/header) to workDir
 *   - Return raw DOM data + screenshot paths + local asset paths
 *
 * All browser-side extraction logic lives in extractDom.browser.js (plain JavaScript).
 * Classification of colors and fonts lives in classifyVisual.ts.
 *
 * WHY addScriptTag instead of page.evaluate(fn):
 *   page.evaluate(fn) serializes the function via fn.toString(). When tsx/esbuild
 *   compiles TypeScript, it injects __name() helpers for function name tracking.
 *   These helpers are not available in the browser context, causing ReferenceError.
 *   page.addScriptTag reads the file as-is from disk — no compilation, no helpers.
 */

import puppeteer from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { execSync } from "child_process";
import type { EmitFn } from "./types";

// Path to the plain-JS browser script (relative to this file at runtime)
const BROWSER_SCRIPT_PATH = path.join(__dirname, "extractDom.browser.js");

// Read the browser script content once at module load time.
// We inject via addScriptTag({content}) rather than {path} so it works even
// on pages with a strict Content-Security-Policy that blocks external scripts.
function readBrowserScript(): string {
  const candidates = [
    BROWSER_SCRIPT_PATH,
    path.join(process.cwd(), "src/lib/pipeline/extractDom.browser.js"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  }
  throw new Error(`[extractDom] Browser script not found. Tried: ${candidates.join(", ")}`);
}
const BROWSER_SCRIPT_CONTENT = readBrowserScript();

function getChromiumPath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  for (const bin of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      const p = execSync(`which ${bin}`, { encoding: "utf8" }).trim();
      if (p) {
        console.log(`[Puppeteer] Found browser at: ${p}`);
        return p;
      }
    } catch {}
  }
  console.log("[Puppeteer] Using bundled Chrome");
  return undefined;
}

// ─── Image downloader ─────────────────────────────────────────────────────────

function downloadImage(url: string, destPath: string): Promise<void> {
  return new Promise((resolve) => {
    const proto = url.startsWith("https") ? https : http;
    const req = proto.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": new URL(url).origin,
      },
      timeout: 8000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirect = res.headers.location;
        if (redirect) {
          downloadImage(redirect, destPath).then(resolve).catch(() => resolve());
        } else {
          resolve();
        }
        return;
      }
      if (!res.statusCode || res.statusCode >= 400) {
        resolve();
        return;
      }
      const contentType = res.headers["content-type"] || "";
      if (!contentType.startsWith("image/")) {
        resolve();
        return;
      }
      const stream = fs.createWriteStream(destPath);
      res.pipe(stream);
      stream.on("finish", () => resolve());
      stream.on("error", () => resolve());
    });
    req.on("error", () => resolve());
    req.on("timeout", () => { req.destroy(); resolve(); });
  });
}

function sanitizeFilename(url: string, index: number): string {
  try {
    const u = new URL(url);
    const ext = path.extname(u.pathname).toLowerCase() || ".jpg";
    const safe = u.pathname.replace(/[^a-zA-Z0-9]/g, "_").slice(-30);
    return `asset_${index}_${safe}${ext}`;
  } catch {
    return `asset_${index}.jpg`;
  }
}

// ─── Main extractor ───────────────────────────────────────────────────────────

export async function extractDom(
  url: string,
  workDir: string,
  emit?: EmitFn
): Promise<Record<string, unknown>> {

  // Browser script content is pre-loaded at module init (BROWSER_SCRIPT_CONTENT)

  emit?.({ type: "status", step: 1, total: 6, message: `Connecting to ${new URL(url).hostname}...` });

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

  let raw: Record<string, unknown> = {};

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    } catch (e) {
      console.warn("[extractDom] page.goto error (continuing):", (e as Error).message);
    }

    await new Promise((r) => setTimeout(r, 2000));

    emit?.({ type: "status", step: 2, total: 6, message: "Scanning colors and fonts..." });

    // Scroll to trigger lazy-loaded content
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

    // Full-page screenshot for Claude Vision classification step
    const screenshotPath = path.join(workDir, "screenshot.png");
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

    // Viewport-only screenshot for the vision call (smaller file)
    const viewportScreenshotPath = path.join(workDir, "screenshot_viewport.jpg");
    await page.screenshot({
      path: viewportScreenshotPath,
      fullPage: false,
      type: "jpeg",
      quality: 80,
    }).catch(() => {});

    emit?.({ type: "status", step: 3, total: 6, message: "Reading page copy and product signals..." });

    console.log("[extractDom] Injecting browser script...");

    // Inject the plain-JS browser script as inline content.
    // Using {content} instead of {path} bypasses strict CSP on sites like Stripe/HubSpot
    // that whitelist only specific script origins.
    await page.addScriptTag({ content: BROWSER_SCRIPT_CONTENT });

    console.log("[extractDom] Running extraction...");

    // Call the extraction function — no serialization, no tsx helpers
    raw = await page.evaluate(() => {
      return (window as unknown as { __orbExtract: () => Record<string, unknown> }).__orbExtract();
    }) as Record<string, unknown>;

    console.log("[extractDom] Extraction complete");

    const rawPath = path.join(workDir, "raw_dom_data.json");
    fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2));

    raw = {
      ...raw,
      screenshotPath,
      viewportScreenshotPath,
    };

  } finally {
    console.log("[extractDom] Closing browser...");
    await browser.close();
    console.log("[extractDom] Browser closed");
  }

  // ─── Download brand asset images ──────────────────────────────────────
  emit?.({ type: "status", step: 4, total: 6, message: "Collecting brand images..." });

  const brandAssetImages = (raw.brandAssetImages as Array<{
    src: string;
    alt: string;
    width: number;
    height: number;
    ext: string;
    isGif: boolean;
    inHero: boolean;
    positionY: number;
  }>) ?? [];

  const assetsDir = path.join(workDir, "brand_assets");
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const downloadedAssets: Array<{
    src: string;
    localPath: string;
    localUrl: string;
    alt: string;
    width: number;
    height: number;
    ext: string;
    isGif: boolean;
    inHero: boolean;
  }> = [];

  // Download up to 12 brand assets (hero first, then by position)
  const toDownload = brandAssetImages.slice(0, 12);
  for (let i = 0; i < toDownload.length; i++) {
    const asset = toDownload[i];
    if (!asset.src || asset.src.startsWith("data:")) continue;
    const filename = sanitizeFilename(asset.src, i);
    const destPath = path.join(assetsDir, filename);
    try {
      await downloadImage(asset.src, destPath);
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
        // Derive a server-relative URL from the workDir path
        // workDir is like /app/public/generations/{id} or similar
        // We'll store the relative path and let the caller resolve the URL
        downloadedAssets.push({
          src: asset.src,
          localPath: destPath,
          localUrl: "", // filled in by the route handler
          alt: asset.alt,
          width: asset.width,
          height: asset.height,
          ext: asset.ext,
          isGif: asset.isGif,
          inHero: asset.inHero,
        });
      }
    } catch (e) {
      console.warn("[extractDom] Failed to download asset:", asset.src, (e as Error).message);
    }
  }

  emit?.({ type: "status", step: 5, total: 6, message: "Identifying tech stack..." });

  console.log(`[extractDom] Downloaded ${downloadedAssets.length} brand assets`);

  emit?.({ type: "status", step: 6, total: 6, message: "Classifying brand with AI..." });

  return {
    ...raw,
    downloadedAssets,
  };
}
