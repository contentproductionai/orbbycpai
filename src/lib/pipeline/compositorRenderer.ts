/**
 * Compositor Renderer
 * 
 * Thin Puppeteer wrapper. The Art Director now generates complete HTML/CSS directly.
 * This module's only job: write the HTML to disk, screenshot it, and return the PNG path.
 * 
 * The old JSON-to-HTML translation layer has been removed.
 */

import * as fs from "fs";
import * as path from "path";
import type { Browser } from "puppeteer";

// ─── Image Path Resolver ──────────────────────────────────────────────────────
// Puppeteer's setContent() cannot load local file:// paths.
// We convert all local image references in the HTML to base64 data URIs.

function pathToDataUri(filePath: string): string {
  if (!filePath) return "";
  if (filePath.startsWith("data:") || filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const mimeType =
      ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
      ext === "png" ? "image/png" :
      ext === "gif" ? "image/gif" :
      ext === "webp" ? "image/webp" :
      ext === "svg" ? "image/svg+xml" :
      "image/jpeg";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
}

/**
 * Scan the HTML string for local file paths in src attributes and replace them
 * with base64 data URIs so Puppeteer can render them without file:// access.
 */
export function inlineLocalImages(html: string): string {
  // Match src="..." or src='...' where the value looks like an absolute path
  return html.replace(/src=["']([^"']+)["']/g, (match, src) => {
    // Only process absolute local paths
    if (src.startsWith("/") || src.startsWith("file://")) {
      const filePath = src.startsWith("file://") ? src.slice(7) : src;
      const dataUri = pathToDataUri(filePath);
      if (dataUri) {
        return `src="${dataUri}"`;
      }
    }
    return match;
  });
}

// ─── HTML Renderer ────────────────────────────────────────────────────────────

/**
 * Render an HTML/CSS string to a PNG file using Puppeteer.
 * The HTML must be a complete document with explicit canvas dimensions.
 */
export async function renderHtml(
  html: string,
  outputPath: string,
  canvasWidth: number,
  canvasHeight: number,
  browser: Browser
): Promise<void> {
  // Inline all local image paths as data URIs
  const inlinedHtml = inlineLocalImages(html);

  const page = await browser.newPage();
  try {
    await page.setViewport({
      width: canvasWidth,
      height: canvasHeight,
      deviceScaleFactor: 2, // 2x for retina quality
    });

    // Set content and wait for network (Google Fonts) to load
    await page.setContent(inlinedHtml, { waitUntil: "networkidle0", timeout: 30000 });

    // Wait for all images to finish loading
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map(
            (img) =>
              new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve; // Don't block on broken images
              })
          )
      );
    });

    // Wait for fonts
    await page.evaluate(() => document.fonts.ready);

    // Small additional wait for any CSS animations or transitions to settle
    await new Promise((resolve) => setTimeout(resolve, 500));

    await page.screenshot({
      path: outputPath as `${string}.png`,
      type: "png",
      clip: {
        x: 0,
        y: 0,
        width: canvasWidth,
        height: canvasHeight,
      },
    });
  } finally {
    await page.close();
  }
}

// ─── Legacy compatibility shim ────────────────────────────────────────────────
// The old renderComposition() accepted a Composition JSON object.
// This shim is kept to avoid breaking any code that still imports it.
// It will be removed once all callers are updated.

export async function renderComposition(
  _composition: unknown,
  _imageMap: Record<string, string>,
  _fontFamilies: string[],
  _outputPath: string,
  _browser: Browser
): Promise<void> {
  throw new Error(
    "renderComposition() is deprecated. The Art Director now generates HTML/CSS directly. " +
    "Use renderHtml() instead."
  );
}
