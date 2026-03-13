/**
 * extractDom.ts — Scoring-model brand signal extractor
 *
 * Phase 1: Collect all signals independently (colors, fonts, logo, stats, testimonials)
 * Phase 2: Cross-validate colors by weight — same color from multiple sources = higher score
 * Phase 3: AND-validate elements (logo, H1, CTA, stats, testimonials)
 * Phase 4: Output ranked brandPrimary, brandSecondary, accentColor + validated elements
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

    // Screenshot for reference
    const screenshotPath = path.join(workDir, "screenshot.png");
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});

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

      // True if color is near-white, near-black, or gray (not a brand color)
      function isNeutral(hex: string): boolean {
        const h = hex.replace("#", "");
        if (h.length !== 6) return true;
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        // Saturation too low OR near-white OR near-black
        return (max - min) < 20 || lum > 0.93 || lum < 0.03;
      }

      // Add a color signal to the scoring map
      function addColorSignal(
        map: Map<string, { score: number; sources: string[] }>,
        hex: string | null,
        source: string,
        weight: number
      ) {
        if (!hex) return;
        // Find existing entry that's similar
        for (const [key, entry] of map.entries()) {
          if (colorsSimilar(key, hex)) {
            entry.score += weight;
            entry.sources.push(source);
            return;
          }
        }
        map.set(hex, { score: weight, sources: [source] });
      }

      // Read background-color AND background shorthand (catches gradients → first color)
      function getBgColor(el: Element): string | null {
        const cs = window.getComputedStyle(el);
        const bg = cs.backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return toHex(bg);
        // Try to extract first color from gradient
        const bgImg = cs.backgroundImage;
        if (bgImg && bgImg !== "none") {
          const m = bgImg.match(/rgba?\([\d,\s.]+\)|#[0-9a-fA-F]{3,6}/);
          if (m) return toHex(m[0]) ?? null;
        }
        return null;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 1: SIGNAL COLLECTION
      // ═══════════════════════════════════════════════════════════════════════

      const colorMap = new Map<string, { score: number; sources: string[] }>();
      const pageHeight = document.documentElement.scrollHeight;

      // ── 1a. Meta signals (highest confidence) ──────────────────────────────

      const themeColor = document.querySelector('meta[name="theme-color"]')?.getAttribute("content") ?? null;
      addColorSignal(colorMap, toHex(themeColor ?? ""), "meta:theme-color", 3);

      const msTile = document.querySelector('meta[name="msapplication-TileColor"]')?.getAttribute("content") ?? null;
      addColorSignal(colorMap, toHex(msTile ?? ""), "meta:ms-tile", 2);

      // ── 1b. CSS variable scan (:root, html, [data-theme]) ──────────────────

      const cssVars: Record<string, string> = {};
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
                      cssVars[prop] = val;
                      // Only score vars with color-related names
                      if (colorVarPattern.test(prop)) {
                        addColorSignal(colorMap, toHex(val), `cssvar:${prop}`, 3);
                      } else {
                        addColorSignal(colorMap, toHex(val), `cssvar:${prop}`, 1);
                      }
                    }
                  }
                }
              }
            }
          }
        } catch {}
      }

      // ── 1c. CTA buttons (weight 3 — highest DOM signal) ────────────────────

      // AND conditions for CTA: has non-transparent bg, short text, not in nav/footer, in top 70%
      const allButtons = Array.from(document.querySelectorAll("button, a, [role='button'], input[type='submit'], input[type='button']"));
      for (const el of allButtons) {
        const text = (el.textContent ?? "").trim();
        if (text.length === 0 || text.length > 50) continue;
        const rect = el.getBoundingClientRect();
        const absTop = rect.top + window.scrollY;
        if (absTop > pageHeight * 0.75) continue; // not in bottom 25%
        if (el.closest("nav, header nav")) continue; // not a nav link
        if (el.closest("footer")) continue;
        const bg = getBgColor(el);
        if (bg && !isNeutral(bg)) {
          addColorSignal(colorMap, bg, "cta:background", 3);
          // Also read text color of CTA
          const textHex = toHex(window.getComputedStyle(el).color);
          if (textHex && !isNeutral(textHex)) addColorSignal(colorMap, textHex, "cta:text", 1);
        }
      }

      // ── 1d. H1 color (weight 2) ────────────────────────────────────────────

      // AND conditions: font-size ≥ 24px, not in nav/footer, in top 60% of page
      const allH1 = Array.from(document.querySelectorAll("h1, [role='heading'][aria-level='1']"));
      let validatedH1: Element | null = null;
      for (const el of allH1) {
        const cs = window.getComputedStyle(el);
        const fs = parseFloat(cs.fontSize);
        if (fs < 24) continue;
        if (el.closest("nav, footer, aside")) continue;
        const rect = el.getBoundingClientRect();
        const absTop = rect.top + window.scrollY;
        if (absTop > pageHeight * 0.65) continue;
        validatedH1 = el;
        const textHex = toHex(cs.color);
        if (textHex && !isNeutral(textHex)) addColorSignal(colorMap, textHex, "h1:color", 2);
        break;
      }

      // ── 1e. H2 color (weight 1) ────────────────────────────────────────────

      const h2 = document.querySelector("h2");
      if (h2 && !h2.closest("nav, footer")) {
        const textHex = toHex(window.getComputedStyle(h2).color);
        if (textHex && !isNeutral(textHex)) addColorSignal(colorMap, textHex, "h2:color", 1);
      }

      // ── 1f. Nav/header background (weight 2) ───────────────────────────────

      const navEl = document.querySelector("header, nav, [role='navigation']");
      if (navEl) {
        const bg = getBgColor(navEl);
        if (bg && !isNeutral(bg)) addColorSignal(colorMap, bg, "nav:background", 2);
      }

      // ── 1g. Hero/first section background (weight 2) ───────────────────────

      const heroSelectors = [
        "[class*='hero']", "[class*='Hero']", "[id*='hero']",
        "section:first-of-type", "main > div:first-child", "main > section:first-child",
      ];
      for (const sel of heroSelectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const bg = getBgColor(el);
        if (bg && !isNeutral(bg)) {
          addColorSignal(colorMap, bg, "hero:background", 2);
          break;
        }
      }

      // ── 1h. Footer background (weight 1) ───────────────────────────────────

      const footer = document.querySelector("footer");
      if (footer) {
        const bg = getBgColor(footer);
        if (bg && !isNeutral(bg)) addColorSignal(colorMap, bg, "footer:background", 1);
      }

      // ── 1i. Accent elements: badges, tags, highlights (weight 2) ──────────

      const accentSelectors = [
        "[class*='badge']", "[class*='tag']", "[class*='chip']", "[class*='pill']",
        "[class*='label']", "[class*='highlight']", "[class*='accent']",
        "mark", "strong", "[class*='primary']",
      ];
      for (const sel of accentSelectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const bg = getBgColor(el);
        if (bg && !isNeutral(bg)) addColorSignal(colorMap, bg, `accent:${sel}`, 2);
        const textHex = toHex(window.getComputedStyle(el).color);
        if (textHex && !isNeutral(textHex)) addColorSignal(colorMap, textHex, `accent-text:${sel}`, 1);
      }

      // ── 1j. Link color (weight 1) ──────────────────────────────────────────

      const firstLink = document.querySelector("main a, article a, section a");
      if (firstLink) {
        const textHex = toHex(window.getComputedStyle(firstLink).color);
        if (textHex && !isNeutral(textHex)) addColorSignal(colorMap, textHex, "link:color", 1);
      }

      // ── 1k. Body/page background (separate track — neutrals allowed) ────────

      const bodyBg = getBgColor(document.body) ?? toHex(window.getComputedStyle(document.documentElement).backgroundColor);

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 2: CROSS-VALIDATION SCORING → ranked brand colors
      // ═══════════════════════════════════════════════════════════════════════

      const rankedColors = Array.from(colorMap.entries())
        .filter(([hex]) => !isNeutral(hex))
        .sort((a, b) => b[1].score - a[1].score);

      const brandPrimary = rankedColors[0]?.[0] ?? null;
      const brandSecondary = rankedColors.find(([hex]) => !colorsSimilar(hex, brandPrimary ?? ""))?.[0] ?? null;
      const accentColor = rankedColors.find(
        ([hex]) => !colorsSimilar(hex, brandPrimary ?? "") && !colorsSimilar(hex, brandSecondary ?? "")
      )?.[0] ?? null;

      // Full scored palette for debugging
      const scoredPalette = rankedColors.slice(0, 8).map(([hex, { score, sources }]) => ({ hex, score, sources }));

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 3: AND-VALIDATED ELEMENT READS
      // ═══════════════════════════════════════════════════════════════════════

      // ── 3a. Logo (AND-validated) ───────────────────────────────────────────

      type LogoResult = { type: string; src?: string; alt?: string; width?: number; height?: number; outerHTML?: string; confidence: string };
      let logo: LogoResult | null = null;

      // Try img first: must be in header/nav, small dimensions (logo not photo), not data URI
      const navImgs = Array.from(document.querySelectorAll("header img, nav img, [class*='logo'] img, [id*='logo'] img, [class*='brand'] img"));
      for (const el of navImgs) {
        const img = el as HTMLImageElement;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const src = img.src ?? "";
        if (!src || src.startsWith("data:")) continue;
        if (w === 0 || h === 0) continue; // not loaded
        if (w > 600 || h > 300) continue; // too large to be a logo
        if (src.includes("background") || src.includes("hero") || src.includes("banner")) continue;
        logo = { type: "img", src, alt: img.alt, width: w, height: h, confidence: "high" };
        break;
      }

      // Try inline SVG if no img found
      if (!logo) {
        const navSvgs = Array.from(document.querySelectorAll("header svg, nav svg, [class*='logo'] svg, [id*='logo'] svg"));
        for (const el of navSvgs) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 400 || rect.height > 200) continue; // too large
          logo = { type: "svg", outerHTML: el.outerHTML.slice(0, 800), confidence: "high" };
          break;
        }
      }

      // Fallback: any img in top 15% of page that's small
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

      // ── 3b. Typography (AND-validated) ────────────────────────────────────

      function readTypo(el: Element) {
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

      const h1Typo = validatedH1 ? readTypo(validatedH1) : null;

      // Body font: first <p> not in nav/header/footer with real text
      let bodyTypo = null;
      for (const p of Array.from(document.querySelectorAll("p"))) {
        if (p.closest("nav, header, footer")) continue;
        if ((p.textContent ?? "").trim().length < 20) continue;
        bodyTypo = readTypo(p);
        break;
      }

      // CTA font: from the first AND-validated CTA button
      let ctaTypo = null;
      for (const el of allButtons) {
        const text = (el.textContent ?? "").trim();
        if (text.length === 0 || text.length > 50) continue;
        const rect = el.getBoundingClientRect();
        const absTop = rect.top + window.scrollY;
        if (absTop > pageHeight * 0.75) continue;
        if (el.closest("nav, header nav, footer")) continue;
        const bg = getBgColor(el);
        if (bg && !isNeutral(bg)) {
          ctaTypo = readTypo(el);
          break;
        }
      }

      // ── 3c. Border radii ───────────────────────────────────────────────────

      const borderRadii: string[] = [];
      for (const el of allButtons.slice(0, 5)) {
        const r = window.getComputedStyle(el).borderRadius;
        if (r && r !== "0px") borderRadii.push(r);
      }
      for (const sel of ["[class*='card']", "input", "img"]) {
        const el = document.querySelector(sel);
        if (el) {
          const r = window.getComputedStyle(el).borderRadius;
          if (r && r !== "0px") borderRadii.push(r);
        }
      }

      // ── 3d. Stats (AND-validated) ──────────────────────────────────────────

      // AND conditions:
      // - Contains a numeric value (with optional suffix: %, +, k, M, x, $)
      // - Paired with short descriptive text (< 60 chars) in the same container
      // - At least 2 such pairs exist in the same parent container (it's a stats block)

      type StatResult = { value: string; label: string };
      const stats: StatResult[] = [];
      const numericPattern = /^\$?[\d,]+(\.\d+)?[%+kKmMxX]?$|^[\d,]+(\.\d+)?(\s*(million|billion|thousand|%|\+|x))?$/i;

      // Walk all elements, look for numeric text nodes paired with sibling/child descriptors
      const candidates: Array<{ value: string; label: string; parent: Element }> = [];
      const allEls = Array.from(document.querySelectorAll("*"));
      for (const el of allEls) {
        // Skip nav, footer, form elements
        if (el.closest("nav, footer, form, input, button, script, style")) continue;
        const children = Array.from(el.children);
        if (children.length < 2) continue;

        // Look for a child with numeric text and a sibling with label text
        let numericChild: Element | null = null;
        let labelChild: Element | null = null;
        for (const child of children) {
          const text = (child.textContent ?? "").trim();
          if (numericPattern.test(text) && text.length < 20) {
            numericChild = child;
          } else if (text.length > 2 && text.length < 80 && !numericPattern.test(text)) {
            labelChild = child;
          }
        }
        if (numericChild && labelChild) {
          candidates.push({
            value: (numericChild.textContent ?? "").trim(),
            label: (labelChild.textContent ?? "").trim(),
            parent: el.parentElement ?? el,
          });
        }
      }

      // AND condition: at least 2 pairs in the same parent = it's a stats block
      const parentCounts = new Map<Element, number>();
      for (const c of candidates) {
        parentCounts.set(c.parent, (parentCounts.get(c.parent) ?? 0) + 1);
      }
      for (const c of candidates) {
        if ((parentCounts.get(c.parent) ?? 0) >= 2) {
          if (!stats.find((s) => s.value === c.value)) {
            stats.push({ value: c.value, label: c.label });
          }
        }
        if (stats.length >= 6) break;
      }

      // ── 3e. Testimonials (AND-validated) ──────────────────────────────────

      // AND conditions:
      // - Extended text (> 60 chars, < 500 chars) — the quote
      // - Paired with short attribution text (< 60 chars) in the same container
      // - Attribution contains a name pattern (capitalized words, comma, dash, or "—")
      // - Not a product description or nav element

      type TestimonialResult = { quote: string; author: string };
      const testimonials: TestimonialResult[] = [];
      const attributionPattern = /^[A-Z][a-z]+(\s[A-Z][a-z]+)*[,\s—\-]|CEO|Founder|Director|Manager|Co-founder/;

      for (const el of allEls) {
        if (el.closest("nav, footer, form, script, style")) continue;
        const children = Array.from(el.children);
        if (children.length < 2) continue;

        let quoteChild: Element | null = null;
        let authorChild: Element | null = null;

        for (const child of children) {
          const text = (child.textContent ?? "").trim();
          if (text.length > 60 && text.length < 500 && !numericPattern.test(text.slice(0, 10))) {
            quoteChild = child;
          } else if (text.length > 3 && text.length < 80 && attributionPattern.test(text)) {
            authorChild = child;
          }
        }

        if (quoteChild && authorChild) {
          const quote = (quoteChild.textContent ?? "").trim().replace(/^["'"']|["'"']$/g, "");
          const author = (authorChild.textContent ?? "").trim();
          if (!testimonials.find((t) => t.quote === quote)) {
            testimonials.push({ quote, author });
          }
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
          return text.length > 0 && text.length <= 50 && !el.closest("nav header nav");
        }).map((el) => el.textContent?.trim() ?? "").filter(Boolean).slice(0, 5),
      };
      const bodySnippet = document.body.innerText.slice(0, 3000);

      const favicon = (document.querySelector('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]') as HTMLLinkElement)?.href ?? "";
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "";
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? document.title ?? "";
      const rawSiteName = document.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ?? "";
      const genericNames = ["my site", "home", "website", "untitled", "wix site"];
      const brandName = genericNames.includes(rawSiteName.toLowerCase()) ? "" : rawSiteName;

      // Photography: large images not in nav/header, not logos/icons
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

      // Spatial
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

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 4: OUTPUT
      // ═══════════════════════════════════════════════════════════════════════

      return {
        url: window.location.href,
        title: document.title,
        brandName,
        ogTitle,
        ogImage,
        favicon,
        // Scored color output
        brandPrimary,
        brandSecondary,
        accentColor,
        backgroundColor: bodyBg,
        scoredPalette,
        // Validated elements
        logo,
        typography: { h1: h1Typo, body: bodyTypo, cta: ctaTypo },
        borderRadii,
        // Content signals
        copyText,
        bodySnippet,
        stats,
        testimonials,
        // Photography
        images,
        bgImages,
        // Raw CSS vars for classifyBrand to use
        cssVars,
        // Spatial
        spatial,
        // Legacy fields for backward compat
        colorSamples: scoredPalette.map((c) => ({ hex: c.hex, contexts: c.sources, count: c.score })),
        logoImgs: logo?.type === "img" ? [{ src: logo.src, alt: logo.alt, width: logo.width, height: logo.height }] : [],
        logoSvgs: logo?.type === "svg" ? [{ type: "inline-svg", outerHTML: logo.outerHTML }] : [],
      };
    });

    console.log("[extractDom] page.evaluate complete");
    const rawPath = path.join(workDir, "raw_dom_data.json");
    fs.writeFileSync(rawPath, JSON.stringify(raw, null, 2));

    return raw as Record<string, unknown>;
  } finally {
    console.log("[extractDom] Closing browser...");
    await browser.close();
    console.log("[extractDom] Browser closed");
  }
}
