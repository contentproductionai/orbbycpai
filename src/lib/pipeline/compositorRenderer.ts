import * as fs from "fs";
import * as path from "path";
import type { Browser } from "puppeteer";
import type { Composition, Layer } from "./compositorSchema";

// ─── Image Path Resolver ──────────────────────────────────────────────────────
// Puppeteer's setContent() cannot load local file:// paths or absolute paths.
// We convert all local images to base64 data URIs before rendering.

function pathToDataUri(filePath: string): string {
  if (!filePath) return "";
  // Already a data URI or remote URL — pass through
  if (filePath.startsWith("data:") || filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }
  // Local file path — convert to base64
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "png" ? "image/png"
      : ext === "gif" ? "image/gif"
      : ext === "webp" ? "image/webp"
      : ext === "svg" ? "image/svg+xml"
      : "image/jpeg";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
}

// Pre-convert all image paths in the imageMap to data URIs
export function resolveImageMap(imageMap: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(imageMap)) {
    resolved[key] = pathToDataUri(value);
  }
  return resolved;
}

// ─── HTML Builder ─────────────────────────────────────────────────────────────
// Takes a Composition JSON and builds a deterministic, absolute-positioned HTML
// document. This replaces the old LLM-generated HTML approach.

function layerToCSS(layer: Layer): string {
  const base = `
    position: absolute;
    left: ${layer.x}px;
    top: ${layer.y}px;
    z-index: ${layer.zIndex};
    opacity: ${layer.opacity ?? 1};
    mix-blend-mode: ${layer.mixBlendMode ?? "normal"};
    ${layer.rotation ? `transform: rotate(${layer.rotation}deg);` : ""}
    ${layer.width ? `width: ${layer.width}px;` : ""}
    ${layer.height ? `height: ${layer.height}px;` : ""}
  `;
  return base;
}

function renderLayer(layer: Layer, resolvedImageMap: Record<string, string>): string {
  const baseStyle = layerToCSS(layer);

  if (layer.type === "image") {
    const src = layer.source === "custom" && layer.url
      ? layer.url
      : resolvedImageMap[layer.source] ?? "";

    if (!src) return ""; // Skip layers with no image source

    const objectFit = layer.objectFit ?? "cover";
    const filter = layer.filter ? `filter: ${layer.filter};` : "";

    return `<img
      src="${src}"
      style="${baseStyle}
        object-fit: ${objectFit};
        ${filter}
        display: block;
      "
    />`;
  }

  if (layer.type === "text") {
    const style = `
      ${baseStyle}
      font-family: '${layer.fontFamily}', sans-serif;
      font-size: ${layer.fontSize}px;
      font-weight: ${layer.fontWeight ?? 400};
      color: ${layer.color};
      text-align: ${layer.textAlign ?? "left"};
      letter-spacing: ${layer.letterSpacing ?? "normal"};
      line-height: ${layer.lineHeight ?? 1.2};
      text-transform: ${layer.textTransform ?? "none"};
      ${layer.textShadow ? `text-shadow: ${layer.textShadow};` : ""}
      ${layer.maxWidth ? `max-width: ${layer.maxWidth}px; overflow-wrap: break-word;` : ""}
      white-space: pre-wrap;
      word-wrap: break-word;
      pointer-events: none;
    `;
    return `<div style="${style}">${layer.content}</div>`;
  }

  if (layer.type === "shape") {
    let borderRadius = "";
    if (layer.shapeType === "circle") {
      borderRadius = "border-radius: 50%;";
    } else if (layer.shapeType === "pill") {
      borderRadius = "border-radius: 9999px;";
    } else if (layer.borderRadius !== undefined) {
      borderRadius = `border-radius: ${typeof layer.borderRadius === "number" ? `${layer.borderRadius}px` : layer.borderRadius};`;
    }

    const style = `
      ${baseStyle}
      background-color: ${layer.backgroundColor};
      ${borderRadius}
      ${layer.border ? `border: ${layer.border};` : ""}
      ${layer.backdropFilter ? `backdrop-filter: ${layer.backdropFilter};` : ""}
    `;
    return `<div style="${style}"></div>`;
  }

  return "";
}

export function buildCompositionHtml(
  composition: Composition,
  imageMap: Record<string, string>,
  fontFamilies: string[]
): string {
  // Pre-resolve all image paths to data URIs (Puppeteer cannot load local files)
  const resolvedImageMap = resolveImageMap(imageMap);

  // Sort layers by zIndex ascending (back to front)
  const sortedLayers = [...composition.layers].sort((a, b) => a.zIndex - b.zIndex);

  // Build Google Fonts URL for all unique font families
  const uniqueFonts = [...new Set(fontFamilies)];
  const fontsQuery = uniqueFonts
    .map((f) => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700;800;900`)
    .join("&");
  const fontsLink = uniqueFonts.length > 0
    ? `<link href="https://fonts.googleapis.com/css2?${fontsQuery}&display=swap" rel="stylesheet">`
    : "";

  const layersHtml = sortedLayers.map((layer) => renderLayer(layer, resolvedImageMap)).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${fontsLink}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${composition.canvas.width}px;
      height: ${composition.canvas.height}px;
      overflow: hidden;
      background-color: ${composition.canvas.backgroundColor};
      position: relative;
    }
  </style>
</head>
<body>
${layersHtml}
</body>
</html>`;
}

// ─── Puppeteer Renderer ───────────────────────────────────────────────────────

export async function renderComposition(
  composition: Composition,
  imageMap: Record<string, string>,
  fontFamilies: string[],
  outputPath: string,
  browser: Browser
): Promise<void> {
  const html = buildCompositionHtml(composition, imageMap, fontFamilies);

  const page = await browser.newPage();
  try {
    await page.setViewport({
      width: composition.canvas.width,
      height: composition.canvas.height,
      deviceScaleFactor: 2, // 2x for retina quality
    });

    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });

    // Wait for all images to load
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.images)
          .filter((img) => !img.complete)
          .map((img) => new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve; // Don't block on broken images
          }))
      );
    });

    // Additional wait for fonts
    await page.evaluate(() => document.fonts.ready);

    await page.screenshot({
      path: outputPath as `${string}.png`,
      type: "png",
      clip: {
        x: 0,
        y: 0,
        width: composition.canvas.width,
        height: composition.canvas.height,
      },
    });
  } finally {
    await page.close();
  }
}
