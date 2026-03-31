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

// ─── Layer Sanitizer ──────────────────────────────────────────────────────────
// Enforces hard constraints on layers before rendering.
// This is the safety net — the Art Director prompt is the first line of defense,
// the renderer is the last.

export function sanitizeLayers(layers: Layer[], canvasWidth: number, canvasHeight: number): Layer[] {
  // 1. Sort by zIndex ascending (back to front) — enforce correct render order
  const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);

  // 2. Enforce z-index uniqueness and ordering:
  //    - background image: zIndex 1
  //    - overlay shapes (darkening scrim): zIndex 2
  //    - subject image: zIndex 3
  //    - logo: zIndex 4 (above subject, below text)
  //    - text layers: zIndex 5+
  //    - CTA button shape: just below CTA text
  //    - CTA text: highest zIndex
  // We don't reassign zIndexes — we trust the Art Director — but we do enforce
  // that no text layer has a lower zIndex than any background image layer.
  const backgroundLayers = sorted.filter(
    (l) => l.type === "image" && (l as { source: string }).source === "background"
  );
  const maxBackgroundZ = backgroundLayers.length > 0
    ? Math.max(...backgroundLayers.map((l) => l.zIndex))
    : 0;

  const sanitized = sorted.map((layer) => {
    // ── Text layers must always be above the background image ────────────────
    if (layer.type === "text" && layer.zIndex <= maxBackgroundZ) {
      console.warn(`[renderer] Text layer "${(layer as { content?: string }).content?.slice(0, 30)}" has zIndex ${layer.zIndex} ≤ background zIndex ${maxBackgroundZ} — bumping to ${maxBackgroundZ + 5}`);
      return { ...layer, zIndex: maxBackgroundZ + 5 };
    }

    // ── Logo: enforce max bounding box ────────────────────────────────────────
    // Logo layers must never exceed 200x70px (horizontal) or 70x70px (icon).
    // We cap width/height here; the CSS uses object-fit: contain so the logo
    // scales down proportionally without clipping.
    if (layer.type === "image" && (layer as { source: string }).source === "logo") {
      const logoLayer = layer as Layer & { width?: number; height?: number };
      const maxW = 200;
      const maxH = 70;
      let w = logoLayer.width ?? maxW;
      let h = logoLayer.height ?? maxH;
      if (w > maxW || h > maxH) {
        // Scale down proportionally
        const scaleW = w > maxW ? maxW / w : 1;
        const scaleH = h > maxH ? maxH / h : 1;
        const scale = Math.min(scaleW, scaleH);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        console.warn(`[renderer] Logo layer oversized — clamped to ${w}x${h}px`);
      }
      return { ...layer, width: w, height: h };
    }

    // ── Text layers: enforce maxWidth to prevent canvas overflow ─────────────
    if (layer.type === "text") {
      const textLayer = layer as Layer & { maxWidth?: number; x: number };
      const impliedMaxWidth = canvasWidth - textLayer.x - 40;
      if (!textLayer.maxWidth || textLayer.maxWidth > impliedMaxWidth) {
        return { ...layer, maxWidth: Math.max(impliedMaxWidth, 100) };
      }
    }

    return layer;
  });

  return sanitized;
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

    const isLogo = layer.source === "logo";
    // Logos always use contain so they scale to fit without clipping.
    // Background and subject images use cover (or whatever the Art Director specified).
    const objectFit = isLogo ? "contain" : (layer.objectFit ?? "cover");
    const filter = layer.filter ? `filter: ${layer.filter};` : "";

    // For logo layers: use max-width/max-height with auto dimensions so the logo
    // never overflows its bounding box regardless of intrinsic image size.
    const logoConstraints = isLogo
      ? `max-width: ${layer.width ?? 200}px; max-height: ${layer.height ?? 70}px; width: auto; height: auto;`
      : "";

    return `<img
      src="${src}"
      style="${baseStyle}
        object-fit: ${objectFit};
        ${filter}
        ${logoConstraints}
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
  fontFamilies: string[],
  canvasWidth?: number,
  canvasHeight?: number
): string {
  // Pre-resolve all image paths to data URIs (Puppeteer cannot load local files)
  const resolvedImageMap = resolveImageMap(imageMap);

  const w = canvasWidth ?? composition.canvas.width;
  const h = canvasHeight ?? composition.canvas.height;

  // Sanitize layers: enforce z-index ordering, logo sizing, text overflow
  const sanitizedLayers = sanitizeLayers(composition.layers, w, h);

  // Build Google Fonts URL for all unique font families
  const uniqueFonts = [...new Set(fontFamilies)];
  const fontsQuery = uniqueFonts
    .map((f) => `family=${encodeURIComponent(f)}:wght@300;400;500;600;700;800;900`)
    .join("&");
  const fontsLink = uniqueFonts.length > 0
    ? `<link href="https://fonts.googleapis.com/css2?${fontsQuery}&display=swap" rel="stylesheet">`
    : "";

  const layersHtml = sanitizedLayers.map((layer) => renderLayer(layer, resolvedImageMap)).join("\n");

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
  const html = buildCompositionHtml(
    composition,
    imageMap,
    fontFamilies,
    composition.canvas.width,
    composition.canvas.height
  );

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
