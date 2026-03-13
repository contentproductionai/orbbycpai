/**
 * extractDom.ts — DOM Discovery
 *
 * Responsibility: DISCOVERY ONLY. No classification.
 * Outputs:
 *   - scoredPalette: every color found, with source list and accumulated score
 *   - discoveredFonts: every font family found, with the elements it appeared on
 *   - logo, stats, testimonials, copyText, images (unchanged)
 *
 * Classification of which color is "primary" and which font is "heading"
 * is handled downstream by classifyVisual.ts (Claude Vision).
 */

import puppeteer from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import type { EmitFn } from "./types";

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

    // Also take a viewport-only screenshot for the vision call (smaller file)
    const viewportScreenshotPath = path.join(workDir, "screenshot_viewport.jpg");
    await page.screenshot({
      path: viewportScreenshotPath,
      fullPage: false,
      type: "jpeg",
      quality: 80,
    }).catch(() => {});

    console.log("[extractDom] Starting page.evaluate...");

    const raw = await page.evaluate(() => {

      // ═══════════════════════════════════════════════════════════════════════
      // UTILITIES
      // ═══════════════════════════════════════════════════════════════════════

      function toHex(color: string): string | null {
        if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return null;
        const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return null;
        return "#" + [m[1], m[2], m[3]].map((v) => parseInt(v).toString(16).padStart(2, "0")).join("");
      }

      // Two colors are "same" if all RGB channels within ±12
      function colorsSimilar(a: string, b: string): boolean {
        const pa = a.replace("#", "");
        const pb = b.replace("#", "");
        if (pa.length !== 6 || pb.length !== 6) return false;
        return (
          Math.abs(parseInt(pa.slice(0, 2), 16) - parseInt(pb.slice(0, 2), 16)) <= 12 &&
          Math.abs(parseInt(pa.slice(2, 4), 16) - parseInt(pb.slice(2, 4), 16)) <= 12 &&
          Math.abs(parseInt(pa.slice(4, 6), 16) - parseInt(pb.slice(4, 6), 16)) <= 12
        );
      }

      // Add a color signal to the scoring map
      function addColorSignal(
        map: Map<string, { score: number; sources: string[]; totalArea: number }>,
        hex: string | null,
        source: string,
        weight: number,
        area: number = 0
      ) {
        if (!hex) return;
        for (const [key, entry] of map.entries()) {
          if (colorsSimilar(key, hex)) {
            entry.score += weight;
            entry.sources.push(source);
            entry.totalArea += area;
            return;
          }
        }
        map.set(hex, { score: weight, sources: [source], totalArea: area });
      }

      function getBgColor(el: Element): string | null {
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

      // Clean a font-family string to just the primary family name
      function cleanFont(fontFamily: string): string {
        return fontFamily.split(",")[0].trim().replace(/['"]/g, "");
      }

      // ═══════════════════════════════════════════════════════════════════════
      // COLOR DISCOVERY
      // ═══════════════════════════════════════════════════════════════════════

      const colorMap = new Map<string, { score: number; sources: string[]; totalArea: number }>();
      const pageHeight = document.documentElement.scrollHeight;
      const pageWidth = document.documentElement.scrollWidth;

      // ── 1. Area-weighted background scan (most important signal) ───────────
      // Walk all block-level elements. For each one with a non-transparent
      // background, record its rendered area. The color covering the most
      // screen real estate is the dominant brand color.
      const blockEls = Array.from(document.querySelectorAll(
        "body, header, nav, main, section, div, article, aside, footer, [class*='hero'], [class*='section'], [class*='banner'], [class*='wrapper'], [class*='container']"
      ));

      for (const el of blockEls) {
        const rect = el.getBoundingClientRect();
        const absTop = rect.top + window.scrollY;
        const w = rect.width;
        const h = rect.height;
        if (w < 200 || h < 50) continue; // skip tiny elements
        if (absTop > pageHeight) continue; // skip off-page
        const area = w * h;
        const bg = getBgColor(el);
        if (bg) {
          // Weight by area — larger elements get more score
          // Normalize: 1 viewport-width × 300px section = score 3
          const areaScore = Math.min(Math.round(area / (pageWidth * 300)), 5);
          const tag = el.tagName.toLowerCase();
          const cls = (el.className ?? "").toString().slice(0, 40);
          addColorSignal(colorMap, bg, `area:${tag}.${cls}`, Math.max(areaScore, 1), area);
        }
      }

      // ── 2. Meta theme-color (explicit brand signal, high weight) ──────────
      const themeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute("content") ?? null;
      addColorSignal(colorMap, toHex(themeColor ?? ""), "meta:theme-color", 5);

      const msTile = document.querySelector('meta[name="msapplication-TileColor"]')?.getAttribute("content") ?? null;
      addColorSignal(colorMap, toHex(msTile ?? ""), "meta:ms-tile", 3);

      // ── 3. CSS variables with color-related names ──────────────────────────
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
                      const weight = colorVarPattern.test(prop) ? 4 : 1;
                      addColorSignal(colorMap, toHex(val), `cssvar:${prop}`, weight);
                    }
                  }
                }
              }
            }
          }
        } catch {}
      }

      // ── 4. CTA buttons (explicit interactive color signal) ─────────────────
      const allButtons = Array.from(document.querySelectorAll(
        "button, a, [role='button'], input[type='submit'], input[type='button']"
      ));
      for (const el of allButtons) {
        const text = (el.textContent ?? "").trim();
        if (text.length === 0 || text.length > 50) continue;
        const rect = el.getBoundingClientRect();
        const absTop = rect.top + window.scrollY;
        if (absTop > pageHeight * 0.75) continue;
        if (el.closest("nav, header nav")) continue;
        if (el.closest("footer")) continue;
        const bg = getBgColor(el);
        if (bg) {
          addColorSignal(colorMap, bg, "cta:background", 3);
          const textHex = toHex(window.getComputedStyle(el).color);
          if (textHex) addColorSignal(colorMap, textHex, "cta:text", 1);
        }
      }

      // ── 5. Nav/header background ───────────────────────────────────────────
      const navEl = document.querySelector("header, nav, [role='navigation']");
      if (navEl) {
        const bg = getBgColor(navEl);
        if (bg) addColorSignal(colorMap, bg, "nav:background", 3);
        const textHex = toHex(window.getComputedStyle(navEl).color);
        if (textHex) addColorSignal(colorMap, textHex, "nav:text", 1);
      }

      // ── 6. H1 text color ──────────────────────────────────────────────────
      for (const el of Array.from(document.querySelectorAll("h1"))) {
        if (el.closest("nav, footer, aside")) continue;
        const absTop = el.getBoundingClientRect().top + window.scrollY;
        if (absTop > pageHeight * 0.65) continue;
        const textHex = toHex(window.getComputedStyle(el).color);
        if (textHex) addColorSignal(colorMap, textHex, "h1:color", 2);
        break;
      }

      // ── 7. H2 text color ──────────────────────────────────────────────────
      const h2 = document.querySelector("h2");
      if (h2 && !h2.closest("nav, footer")) {
        const textHex = toHex(window.getComputedStyle(h2).color);
        if (textHex) addColorSignal(colorMap, textHex, "h2:color", 1);
      }

      // ── 8. Footer background ──────────────────────────────────────────────
      const footer = document.querySelector("footer");
      if (footer) {
        const bg = getBgColor(footer);
        if (bg) addColorSignal(colorMap, bg, "footer:background", 2);
      }

      // ── 9. Accent/badge elements ──────────────────────────────────────────
      for (const sel of [
        "[class*='badge']", "[class*='tag']", "[class*='chip']", "[class*='pill']",
        "[class*='label']", "[class*='highlight']", "[class*='accent']", "mark",
      ]) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const bg = getBgColor(el);
        if (bg) addColorSignal(colorMap, bg, `accent:${sel}`, 2);
        const textHex = toHex(window.getComputedStyle(el).color);
        if (textHex) addColorSignal(colorMap, textHex, `accent-text:${sel}`, 1);
      }

      // ── 10. Link color ────────────────────────────────────────────────────
      const firstLink = document.querySelector("main a, article a, section a");
      if (firstLink) {
        const textHex = toHex(window.getComputedStyle(firstLink).color);
        if (textHex) addColorSignal(colorMap, textHex, "link:color", 1);
      }

      // Build scored palette — sorted by score desc, then area desc
      const scoredPalette = Array.from(colorMap.entries())
        .sort((a, b) => {
          if (b[1].score !== a[1].score) return b[1].score - a[1].score;
          return b[1].totalArea - a[1].totalArea;
        })
        .slice(0, 12)
        .map(([hex, { score, sources, totalArea }]) => ({ hex, score, sources, totalArea }));

      // Page background color (body)
      const bodyBg = getBgColor(document.body) ??
        toHex(window.getComputedStyle(document.documentElement).backgroundColor);

      // ═══════════════════════════════════════════════════════════════════════
      // FONT DISCOVERY
      // Weight by element importance: content elements (h1-h4, p, li) carry
      // more signal than structural elements (body, footer) which are often
      // set to a theme fallback that gets overridden everywhere visible.
      // ═══════════════════════════════════════════════════════════════════════

      const fontScoreMap = new Map<string, { score: number; seenOn: string[] }>();

      function recordFont(family: string, elementLabel: string, weight: number) {
        const clean = family.split(",")[0].trim().replace(/['"]/g, "");
        // Skip system/generic fallbacks that are never intentional brand choices
        if (!clean || /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system|BlinkMacSystemFont|Segoe\s*UI|Arial|Helvetica|Times\s*New\s*Roman|Times|Georgia|Courier\s*New|Courier|Verdana|Tahoma|Trebuchet)$/i.test(clean)) return;
        const existing = fontScoreMap.get(clean);
        if (existing) {
          existing.score += weight;
          if (!existing.seenOn.includes(elementLabel)) existing.seenOn.push(elementLabel);
        } else {
          fontScoreMap.set(clean, { score: weight, seenOn: [elementLabel] });
        }
      }

      // High-weight: content elements — these are what a user actually reads
      const highWeightTargets: Array<{ sel: string; label: string }> = [
        { sel: "h1", label: "h1" },
        { sel: "h2", label: "h2" },
        { sel: "h3", label: "h3" },
        { sel: "h4", label: "h4" },
        { sel: "p", label: "body-p" },
        { sel: "li", label: "list-item" },
        { sel: "blockquote", label: "blockquote" },
        { sel: "[class*='hero'] p, [class*='hero'] h1", label: "hero-text" },
      ];
      for (const { sel, label } of highWeightTargets) {
        try {
          const el = document.querySelector(sel);
          if (!el) continue;
          recordFont(window.getComputedStyle(el).fontFamily, label, 3);
        } catch {}
      }

      // Scan multiple headings (up to 10) to catch any font variation
      for (const el of Array.from(document.querySelectorAll("h1, h2, h3, h4")).slice(0, 10)) {
        recordFont(window.getComputedStyle(el).fontFamily, el.tagName.toLowerCase(), 2);
      }

      // Medium-weight: interactive/nav elements
      const medWeightTargets: Array<{ sel: string; label: string }> = [
        { sel: "nav a, header a", label: "nav-link" },
        { sel: "button, a[class*='btn'], input[type='submit']", label: "button" },
        { sel: "label, input, select", label: "form" },
      ];
      for (const { sel, label } of medWeightTargets) {
        try {
          const el = document.querySelector(sel);
          if (!el) continue;
          recordFont(window.getComputedStyle(el).fontFamily, label, 2);
        } catch {}
      }

      // Low-weight: structural elements — theme defaults, often overridden
      const lowWeightTargets: Array<{ sel: string; label: string }> = [
        { sel: "body", label: "body" },
        { sel: "footer", label: "footer" },
      ];
      for (const { sel, label } of lowWeightTargets) {
        try {
          const el = document.querySelector(sel);
          if (!el) continue;
          recordFont(window.getComputedStyle(el).fontFamily, label, 1);
        } catch {}
      }

      // Sort by score descending — highest-scoring font is the dominant brand font
      const discoveredFonts = Array.from(fontScoreMap.entries())
        .sort((a, b) => b[1].score - a[1].score)
        .map(([family, { score, seenOn }]) => ({ family, seenOn, score }));

      // ═══════════════════════════════════════════════════════════════════════
      // LOGO DISCOVERY (AND-validated)
      // ═══════════════════════════════════════════════════════════════════════

      type LogoResult = {
        type: string;
        src?: string;
        alt?: string;
        width?: number;
        height?: number;
        outerHTML?: string;
        confidence: string;
      };
      let logo: LogoResult | null = null;

      const navImgs = Array.from(document.querySelectorAll(
        "header img, nav img, [class*='logo'] img, [id*='logo'] img, [class*='brand'] img"
      ));
      for (const el of navImgs) {
        const img = el as HTMLImageElement;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const src = img.src ?? "";
        if (!src || src.startsWith("data:")) continue;
        if (w === 0 || h === 0) continue;
        if (w > 600 || h > 300) continue;
        if (src.includes("background") || src.includes("hero") || src.includes("banner")) continue;
        logo = { type: "img", src, alt: img.alt, width: w, height: h, confidence: "high" };
        break;
      }

      if (!logo) {
        const navSvgs = Array.from(document.querySelectorAll(
          "header svg, nav svg, [class*='logo'] svg, [id*='logo'] svg"
        ));
        for (const el of navSvgs) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 400 || rect.height > 200) continue;
          logo = { type: "svg", outerHTML: el.outerHTML.slice(0, 800), confidence: "high" };
          break;
        }
      }

      if (!logo) {
        const topImgs = Array.from(document.querySelectorAll("img")).filter((img) => {
          const rect = img.getBoundingClientRect();
          const absTop = rect.top + window.scrollY;
          return absTop < pageHeight * 0.15 && img.naturalWidth > 0 && img.naturalWidth < 400 && img.naturalHeight < 200;
        });
        if (topImgs.length > 0) {
          const img = topImgs[0] as HTMLImageElement;
          logo = { type: "img", src: img.src, alt: img.alt, width: img.naturalWidth, height: img.naturalHeight, confidence: "medium" };
        }
      }

      // ═══════════════════════════════════════════════════════════════════════
      // STATS DISCOVERY (AND-validated)
      // ═══════════════════════════════════════════════════════════════════════

      type StatResult = { value: string; label: string };
      const stats: StatResult[] = [];
      const numericPattern = /^\$?[\d,]+(\.\d+)?[%+kKmMxX]?$|^[\d,]+(\.\d+)?(\s*(million|billion|thousand|%|\+|x))?$/i;

      const candidates: Array<{ value: string; label: string; parent: Element }> = [];
      for (const el of Array.from(document.querySelectorAll("*"))) {
        if (el.closest("nav, footer, form, script, style")) continue;
        const children = Array.from(el.children);
        if (children.length < 2) continue;
        let numericChild: Element | null = null;
        let labelChild: Element | null = null;
        for (const child of children) {
          const text = (child.textContent ?? "").trim();
          if (numericPattern.test(text) && text.length < 20) numericChild = child;
          else if (text.length > 2 && text.length < 80 && !numericPattern.test(text)) labelChild = child;
        }
        if (numericChild && labelChild) {
          candidates.push({ value: (numericChild.textContent ?? "").trim(), label: (labelChild.textContent ?? "").trim(), parent: el.parentElement ?? el });
        }
      }
      const parentCounts = new Map<Element, number>();
      for (const c of candidates) parentCounts.set(c.parent, (parentCounts.get(c.parent) ?? 0) + 1);
      for (const c of candidates) {
        if ((parentCounts.get(c.parent) ?? 0) >= 2 && !stats.find((s) => s.value === c.value)) {
          stats.push({ value: c.value, label: c.label });
        }
        if (stats.length >= 6) break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // TESTIMONIALS DISCOVERY (AND-validated)
      // ═══════════════════════════════════════════════════════════════════════

      type TestimonialResult = { quote: string; author: string };
      const testimonials: TestimonialResult[] = [];
      const attributionPattern = /^[A-Z][a-z]+(\s[A-Z][a-z]+)*[,\s—\-]|CEO|Founder|Director|Manager|Co-founder/;

      for (const el of Array.from(document.querySelectorAll("*"))) {
        if (el.closest("nav, footer, form, script, style")) continue;
        const children = Array.from(el.children);
        if (children.length < 2) continue;
        let quoteChild: Element | null = null;
        let authorChild: Element | null = null;
        for (const child of children) {
          const text = (child.textContent ?? "").trim();
          if (text.length > 60 && text.length < 500 && !numericPattern.test(text.slice(0, 10))) quoteChild = child;
          else if (text.length > 3 && text.length < 80 && attributionPattern.test(text)) authorChild = child;
        }
        if (quoteChild && authorChild) {
          const quote = (quoteChild.textContent ?? "").trim().replace(/^["'"']|["'"']$/g, "");
          const author = (authorChild.textContent ?? "").trim();
          if (!testimonials.find((t) => t.quote === quote)) testimonials.push({ quote, author });
        }
        if (testimonials.length >= 4) break;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // COPY TEXT, META, PHOTOGRAPHY
      // ═══════════════════════════════════════════════════════════════════════

      const copyText = {
        h1: Array.from(document.querySelectorAll("h1")).map((el) => el.textContent?.trim() ?? "").filter(Boolean).slice(0, 5),
        h2: Array.from(document.querySelectorAll("h2")).map((el) => el.textContent?.trim() ?? "").filter(Boolean).slice(0, 8),
        nav: Array.from(document.querySelectorAll("nav a")).map((el) => el.textContent?.trim() ?? "").filter(Boolean).slice(0, 10),
        cta: allButtons.filter((el) => {
          const text = (el.textContent ?? "").trim();
          return text.length > 0 && text.length <= 50;
        }).map((el) => el.textContent?.trim() ?? "").filter(Boolean).slice(0, 5),
      };
      const bodySnippet = document.body.innerText.slice(0, 3000);

      const favicon = (document.querySelector('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]') as HTMLLinkElement)?.href ?? "";
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "";
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? document.title ?? "";
      const rawSiteName = document.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ?? "";
      const genericNames = ["my site", "home", "website", "untitled", "wix site"];
      const brandName = genericNames.includes(rawSiteName.toLowerCase()) ? "" : rawSiteName;

      const images = Array.from(document.querySelectorAll("img"))
        .filter((img) => {
          if (img.naturalWidth < 200 || img.naturalHeight < 200) return false;
          if (img.closest("nav, header")) return false;
          const src = img.src ?? "";
          if (src.includes("data:") || src.includes("logo") || src.includes("icon") || src.includes("avatar")) return false;
          return true;
        })
        .map((img) => ({
          src: img.src,
          alt: img.alt ?? "",
          width: img.naturalWidth,
          height: img.naturalHeight,
          inHero: !!img.closest('[class*="hero"], [class*="Hero"], section:first-of-type'),
        }))
        .slice(0, 15);

      const bgImages = Array.from(document.querySelectorAll('[class*="hero"], [class*="Hero"], section, div'))
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
          avgPadding: (parseVal(cs.paddingTop) + parseVal(cs.paddingBottom) + parseVal(cs.paddingLeft) + parseVal(cs.paddingRight)) / 4,
          avgMargin: (parseVal(cs.marginTop) + parseVal(cs.marginBottom)) / 2,
        };
      }
      const spatial = spatialFor("body") ?? spatialFor("section") ?? { avgPadding: 16, avgMargin: 8 };

      // Border radii
      const borderRadii: string[] = [];
      for (const el of allButtons.slice(0, 5)) {
        const r = window.getComputedStyle(el).borderRadius;
        if (r && r !== "0px") borderRadii.push(r);
      }

      // ═══════════════════════════════════════════════════════════════════════
      // OUTPUT
      // ═══════════════════════════════════════════════════════════════════════

      return {
        url: window.location.href,
        title: document.title,
        brandName,
        ogTitle,
        ogImage,
        favicon,
        // Color discovery output — classification happens in classifyVisual.ts
        scoredPalette,
        backgroundColor: bodyBg,
        // Font discovery output — classification happens in classifyVisual.ts
        discoveredFonts,
        // Validated elements
        logo,
        borderRadii,
        // Content
        copyText,
        bodySnippet,
        stats,
        testimonials,
        // Photography
        images,
        bgImages,
        spatial,
        // Legacy compat fields
        colorSamples: scoredPalette.map((c) => ({ hex: c.hex, contexts: c.sources, count: c.score })),
        logoImgs: logo?.type === "img" ? [{ src: logo.src, alt: logo.alt, width: logo.width, height: logo.height }] : [],
        logoSvgs: logo?.type === "svg" ? [{ type: "inline-svg", outerHTML: logo.outerHTML }] : [],
      };
    });

    console.log("[extractDom] page.evaluate complete");
    const rawPath = path.join(workDir, "raw_dom_data.json");
    fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2));

    // Attach screenshot paths to raw output for downstream use
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
