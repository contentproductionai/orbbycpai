/**
 * End-to-end test: DOM discovery + Claude Vision classification
 * Usage: node scripts/test-extract.mjs <url>
 */
import { execSync } from "child_process";
import puppeteer from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2];
if (!url) { console.error("Usage: node scripts/test-extract.mjs <url>"); process.exit(1); }

function getChromiumPath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  for (const bin of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try { const p = execSync(`which ${bin}`, { encoding: "utf8" }).trim(); if (p) return p; } catch {}
  }
  return undefined;
}

const workDir = path.join(__dirname, "../.test-extract");
fs.mkdirSync(workDir, { recursive: true });

console.log(`\n[test] Launching browser for: ${url}\n`);

const browser = await puppeteer.launch({
  headless: true,
  executablePath: getChromiumPath(),
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
} catch (e) { console.warn("[test] goto error:", e.message); }

await new Promise(r => setTimeout(r, 2000));

await page.evaluate(async () => {
  await new Promise(resolve => {
    let totalHeight = 0;
    const timer = setInterval(() => {
      window.scrollBy(0, 400);
      totalHeight += 400;
      if (totalHeight >= document.body.scrollHeight) { clearInterval(timer); window.scrollTo(0, 0); resolve(); }
    }, 120);
  });
});
await new Promise(r => setTimeout(r, 1500));

const screenshotPath = path.join(workDir, "screenshot_viewport.jpg");
await page.screenshot({ path: screenshotPath, fullPage: false, type: "jpeg", quality: 80 });
console.log("[test] Screenshot saved:", screenshotPath);

// ── DOM Discovery ──────────────────────────────────────────────────────────────

const raw = await page.evaluate(() => {
  function toHex(color) {
    if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return null;
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    return "#" + [m[1], m[2], m[3]].map(v => parseInt(v).toString(16).padStart(2, "0")).join("");
  }
  function colorsSimilar(a, b) {
    const pa = a.replace("#", ""), pb = b.replace("#", "");
    if (pa.length !== 6 || pb.length !== 6) return false;
    return (
      Math.abs(parseInt(pa.slice(0,2),16) - parseInt(pb.slice(0,2),16)) <= 12 &&
      Math.abs(parseInt(pa.slice(2,4),16) - parseInt(pb.slice(2,4),16)) <= 12 &&
      Math.abs(parseInt(pa.slice(4,6),16) - parseInt(pb.slice(4,6),16)) <= 12
    );
  }
  function addColorSignal(map, hex, source, weight, area = 0) {
    if (!hex) return;
    for (const [key, entry] of map.entries()) {
      if (colorsSimilar(key, hex)) { entry.score += weight; entry.sources.push(source); entry.totalArea += area; return; }
    }
    map.set(hex, { score: weight, sources: [source], totalArea: area });
  }
  function getBgColor(el) {
    const cs = window.getComputedStyle(el);
    const bg = cs.backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return toHex(bg);
    const bgImg = cs.backgroundImage;
    if (bgImg && bgImg !== "none") {
      const m = bgImg.match(/rgba?\([\d,\s.]+\)|#[0-9a-fA-F]{3,6}/);
      if (m) return toHex(m[0]) ?? null;
    }
    return null;
  }

  const colorMap = new Map();
  const pageHeight = document.documentElement.scrollHeight;
  const pageWidth = document.documentElement.scrollWidth;

  // Area-weighted background scan
  const blockEls = Array.from(document.querySelectorAll(
    "body, header, nav, main, section, div, article, aside, footer, [class*='hero'], [class*='section'], [class*='banner'], [class*='wrapper'], [class*='container']"
  ));
  for (const el of blockEls) {
    const rect = el.getBoundingClientRect();
    const absTop = rect.top + window.scrollY;
    const w = rect.width, h = rect.height;
    if (w < 200 || h < 50 || absTop > pageHeight) continue;
    const area = w * h;
    const bg = getBgColor(el);
    if (bg) {
      const areaScore = Math.min(Math.round(area / (pageWidth * 300)), 5);
      const tag = el.tagName.toLowerCase();
      const cls = (el.className ?? "").toString().slice(0, 40);
      addColorSignal(colorMap, bg, `area:${tag}.${cls}`, Math.max(areaScore, 1), area);
    }
  }

  // Meta theme-color
  const themeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute("content") ?? null;
  addColorSignal(colorMap, toHex(themeColor ?? ""), "meta:theme-color", 5);

  // CSS vars
  const colorVarPattern = /color|primary|brand|accent|highlight|cta|button|link|main/i;
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules ?? [])) {
        if (rule instanceof CSSStyleRule) {
          const sel = rule.selectorText ?? "";
          if (sel === ":root" || sel === "html" || sel.includes("[data-theme") || sel.includes("[data-color")) {
            for (let i = 0; i < rule.style.length; i++) {
              const prop = rule.style[i];
              if (prop.startsWith("--")) {
                const val = rule.style.getPropertyValue(prop).trim();
                if (val.startsWith("#") || val.startsWith("rgb")) {
                  addColorSignal(colorMap, toHex(val), `cssvar:${prop}`, colorVarPattern.test(prop) ? 4 : 1);
                }
              }
            }
          }
        }
      }
    } catch {}
  }

  // CTA buttons
  const allButtons = Array.from(document.querySelectorAll("button, a, [role='button'], input[type='submit']"));
  for (const el of allButtons) {
    const text = (el.textContent ?? "").trim();
    if (text.length === 0 || text.length > 50) continue;
    const absTop = el.getBoundingClientRect().top + window.scrollY;
    if (absTop > pageHeight * 0.75) continue;
    if (el.closest("nav, header nav") || el.closest("footer")) continue;
    const bg = getBgColor(el);
    if (bg) {
      addColorSignal(colorMap, bg, "cta:background", 3);
      const textHex = toHex(window.getComputedStyle(el).color);
      if (textHex) addColorSignal(colorMap, textHex, "cta:text", 1);
    }
  }

  // Nav, H1, H2, footer, accent
  const navEl = document.querySelector("header, nav, [role='navigation']");
  if (navEl) { const bg = getBgColor(navEl); if (bg) addColorSignal(colorMap, bg, "nav:background", 3); }
  for (const el of Array.from(document.querySelectorAll("h1"))) {
    if (el.closest("nav, footer, aside")) continue;
    const absTop = el.getBoundingClientRect().top + window.scrollY;
    if (absTop > pageHeight * 0.65) continue;
    const textHex = toHex(window.getComputedStyle(el).color);
    if (textHex) { addColorSignal(colorMap, textHex, "h1:color", 2); break; }
  }
  const h2 = document.querySelector("h2");
  if (h2 && !h2.closest("nav, footer")) {
    const textHex = toHex(window.getComputedStyle(h2).color);
    if (textHex) addColorSignal(colorMap, textHex, "h2:color", 1);
  }
  const footer = document.querySelector("footer");
  if (footer) { const bg = getBgColor(footer); if (bg) addColorSignal(colorMap, bg, "footer:background", 2); }
  const firstLink = document.querySelector("main a, article a, section a");
  if (firstLink) { const textHex = toHex(window.getComputedStyle(firstLink).color); if (textHex) addColorSignal(colorMap, textHex, "link:color", 1); }

  const scoredPalette = Array.from(colorMap.entries())
    .sort((a, b) => b[1].score !== a[1].score ? b[1].score - a[1].score : b[1].totalArea - a[1].totalArea)
    .slice(0, 12)
    .map(([hex, { score, sources, totalArea }]) => ({ hex, score, sources, totalArea }));

  // Font discovery
  const fontMap = new Map();
  function recordFont(family, label) {
    const clean = family.split(",")[0].trim().replace(/['"]/g, "");
    if (!clean || /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system|BlinkMacSystemFont|Segoe UI|Arial|Helvetica|Times|Georgia|Courier)$/i.test(clean)) return;
    const existing = fontMap.get(clean);
    if (existing) { if (!existing.includes(label)) existing.push(label); }
    else fontMap.set(clean, [label]);
  }
  for (const { sel, label } of [
    { sel: "h1", label: "h1" }, { sel: "h2", label: "h2" }, { sel: "h3", label: "h3" },
    { sel: "p", label: "body-p" }, { sel: "body", label: "body" },
    { sel: "nav a", label: "nav-link" }, { sel: "button", label: "button" },
    { sel: "footer", label: "footer" },
  ]) {
    try {
      const el = document.querySelector(sel);
      if (el) recordFont(window.getComputedStyle(el).fontFamily, label);
    } catch {}
  }
  for (const el of Array.from(document.querySelectorAll("h1,h2,h3,h4")).slice(0, 10)) {
    recordFont(window.getComputedStyle(el).fontFamily, el.tagName.toLowerCase());
  }
  const discoveredFonts = Array.from(fontMap.entries()).map(([family, seenOn]) => ({ family, seenOn }));

  return { scoredPalette, discoveredFonts };
});

await browser.close();

console.log("\n" + "=".repeat(60));
console.log("STEP 1 — DOM DISCOVERY");
console.log("=".repeat(60));
console.log("\nscoredPalette (raw):");
console.log(JSON.stringify(raw.scoredPalette, null, 2));
console.log("\ndiscoveredFonts:");
console.log(JSON.stringify(raw.discoveredFonts, null, 2));

// ── Claude Vision Classification ───────────────────────────────────────────────

console.log("\n" + "=".repeat(60));
console.log("STEP 2 — CLAUDE VISION CLASSIFICATION");
console.log("=".repeat(60));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const imageBase64 = fs.readFileSync(screenshotPath).toString("base64");

const paletteJson = JSON.stringify(
  raw.scoredPalette.map(c => ({ hex: c.hex, score: c.score, sources: c.sources.slice(0, 5) })),
  null, 2
);
const fontsJson = JSON.stringify(raw.discoveredFonts, null, 2);

const prompt = `You are a brand designer analyzing a website screenshot.

You will be given:
1. A screenshot of the website's above-the-fold viewport
2. A scoredPalette: colors discovered from the website's DOM, with the elements they came from and a score
3. discoveredFonts: font families found in the DOM, with the elements they appeared on

Your job is CLASSIFICATION ONLY. Do not invent new colors or fonts. Only classify what is in the lists.

For each color in scoredPalette, assign exactly one semantic role:
- "primary": The dominant brand color that defines the visual identity. Usually the most visually prominent non-white, non-black color.
- "secondary": A supporting brand color used alongside the primary.
- "accent": A high-contrast color used for CTAs, highlights, or interactive elements.
- "structural": White, black, near-white, near-black, or gray used purely for layout/text — not a brand color.

For each font in discoveredFonts, assign exactly one semantic role:
- "heading": Used for H1, H2, H3 — the display/title font
- "body": Used for paragraphs, body text
- "ui": Used for buttons, nav links, labels, form elements
- "unknown": Cannot determine

Rules:
- Every color must get exactly one role. Do not skip any.
- Every font must get exactly one role. Do not skip any.
- White (#ffffff or near-white) and black (#000000 or near-black) are almost always "structural".
- Only one color should be "primary".

scoredPalette:
${paletteJson}

discoveredFonts:
${fontsJson}

Respond with ONLY valid JSON, no explanation:
{
  "colors": [{ "hex": "#xxxxxx", "role": "primary|secondary|accent|structural" }],
  "fonts": [{ "family": "Font Name", "role": "heading|body|ui|unknown" }]
}`;

const response = await client.messages.create({
  model: "claude-opus-4-5",
  max_tokens: 1024,
  messages: [{
    role: "user",
    content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
      { type: "text", text: prompt },
    ],
  }],
});

const responseText = response.content[0].text.trim();
console.log("\nClaude raw response:");
console.log(responseText);

try {
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch[0]);

  const primary = parsed.colors.find(c => c.role === "primary");
  const secondary = parsed.colors.find(c => c.role === "secondary");
  const accent = parsed.colors.find(c => c.role === "accent");
  const heading = parsed.fonts.find(f => f.role === "heading");
  const body = parsed.fonts.find(f => f.role === "body");
  const ui = parsed.fonts.find(f => f.role === "ui");

  console.log("\n" + "=".repeat(60));
  console.log("FINAL CLASSIFIED OUTPUT");
  console.log("=".repeat(60));
  console.log(`brandPrimary:   ${primary?.hex ?? "null"}`);
  console.log(`brandSecondary: ${secondary?.hex ?? "null"}`);
  console.log(`accentColor:    ${accent?.hex ?? "null"}`);
  console.log(`headingFont:    ${heading?.family ?? "null"}`);
  console.log(`bodyFont:       ${body?.family ?? "null"}`);
  console.log(`uiFont:         ${ui?.family ?? "null"}`);
} catch (e) {
  console.error("Failed to parse:", e.message);
}
