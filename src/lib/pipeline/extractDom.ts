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
 *   - Return raw DOM data + screenshot paths
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
import { execSync } from "child_process";
import type { EmitFn } from "./types";

// Path to the plain-JS browser script (relative to this file at runtime)
const BROWSER_SCRIPT_PATH = path.join(__dirname, "extractDom.browser.js");

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

export async function extractDom(
  url: string,
  workDir: string,
  emit?: EmitFn
): Promise<Record<string, unknown>> {
  emit?.({ type: "status", step: 1, total: 5, message: "Extracting brand signals from website..." });

  // Read the browser script content from disk — this is plain JS, never compiled
  const browserScriptPath = fs.existsSync(BROWSER_SCRIPT_PATH)
    ? BROWSER_SCRIPT_PATH
    : path.join(process.cwd(), "src/lib/pipeline/extractDom.browser.js");

  if (!fs.existsSync(browserScriptPath)) {
    throw new Error(`[extractDom] Browser script not found at: ${browserScriptPath}`);
  }

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
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    } catch (e) {
      console.warn("[extractDom] page.goto error (continuing):", (e as Error).message);
    }

    await new Promise((r) => setTimeout(r, 2000));

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

    console.log("[extractDom] Injecting browser script...");

    // Inject the plain-JS browser script — this assigns window.__orbExtract
    await page.addScriptTag({ path: browserScriptPath });

    console.log("[extractDom] Running extraction...");

    // Call the extraction function — no serialization, no tsx helpers
    const raw = await page.evaluate(() => {
      return (window as unknown as { __orbExtract: () => Record<string, unknown> }).__orbExtract();
    });

    console.log("[extractDom] Extraction complete");

    const rawPath = path.join(workDir, "raw_dom_data.json");
    fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2));

    return {
      ...(raw as Record<string, unknown>),
      screenshotPath,
      viewportScreenshotPath,
    };
  } finally {
    console.log("[extractDom] Closing browser...");
    await browser.close();
    console.log("[extractDom] Browser closed");
  }
}
