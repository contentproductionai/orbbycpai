/**
 * extractDom.browser.js — Browser-side extraction logic
 *
 * Plain JavaScript. No TypeScript. No compilation. No imports.
 * This file is read from disk and injected into the page via page.addScriptTag().
 * It assigns the extraction function to window.__orbExtract so it can be called
 * via page.evaluate(() => window.__orbExtract()).
 *
 * NEVER add TypeScript syntax to this file.
 * NEVER import from Node.js modules.
 */

window.__orbExtract = function () {

  // ═══════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  function toHex(color) {
    if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return null;
    var m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return null;
    return "#" + [m[1], m[2], m[3]].map(function (v) { return parseInt(v).toString(16).padStart(2, "0"); }).join("");
  }

  function colorsSimilar(a, b) {
    var pa = a.replace("#", "");
    var pb = b.replace("#", "");
    if (pa.length !== 6 || pb.length !== 6) return false;
    return (
      Math.abs(parseInt(pa.slice(0, 2), 16) - parseInt(pb.slice(0, 2), 16)) <= 12 &&
      Math.abs(parseInt(pa.slice(2, 4), 16) - parseInt(pb.slice(2, 4), 16)) <= 12 &&
      Math.abs(parseInt(pa.slice(4, 6), 16) - parseInt(pb.slice(4, 6), 16)) <= 12
    );
  }

  // colorMap: plain object — { [hex]: { score, sources, totalArea } }
  var colorMap = {};

  function addColorSignal(hex, source, weight, area) {
    if (!hex) return;
    area = area || 0;
    var keys = Object.keys(colorMap);
    for (var i = 0; i < keys.length; i++) {
      if (colorsSimilar(keys[i], hex)) {
        colorMap[keys[i]].score += weight;
        colorMap[keys[i]].sources.push(source);
        colorMap[keys[i]].totalArea += area;
        return;
      }
    }
    colorMap[hex] = { score: weight, sources: [source], totalArea: area };
  }

  function getBgColor(el) {
    var cs = window.getComputedStyle(el);
    var bg = cs.backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return toHex(bg);
    var bgImg = cs.backgroundImage;
    if (bgImg && bgImg !== "none") {
      var m = bgImg.match(/rgba?\([\d,\s.]+\)|#[0-9a-fA-F]{3,6}/);
      if (m) return toHex(m[0]) || null;
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COLOR DISCOVERY
  // ═══════════════════════════════════════════════════════════════════════

  var pageHeight = document.documentElement.scrollHeight;
  var pageWidth = document.documentElement.scrollWidth;

  // ── 1. Area-weighted background scan ─────────────────────────────────
  var blockEls = Array.from(document.querySelectorAll(
    "body, header, nav, main, section, div, article, aside, footer, [class*='hero'], [class*='section'], [class*='banner'], [class*='wrapper'], [class*='container']"
  ));
  for (var i = 0; i < blockEls.length; i++) {
    var el = blockEls[i];
    var rect = el.getBoundingClientRect();
    var absTop = rect.top + window.scrollY;
    var w = rect.width;
    var h = rect.height;
    if (w < 200 || h < 50) continue;
    if (absTop > pageHeight) continue;
    var area = w * h;
    var bg = getBgColor(el);
    if (bg) {
      var areaScore = Math.min(Math.round(area / (pageWidth * 300)), 5);
      var tag = el.tagName.toLowerCase();
      var cls = (el.className || "").toString().slice(0, 40);
      addColorSignal(bg, "area:" + tag + "." + cls, Math.max(areaScore, 1), area);
    }
  }

  // ── 2. Meta theme-color ───────────────────────────────────────────────
  var themeColorMeta = document.querySelector('meta[name="theme-color"]');
  var themeColor = themeColorMeta ? themeColorMeta.getAttribute("content") : null;
  addColorSignal(toHex(themeColor || ""), "meta:theme-color", 5);

  var msTileMeta = document.querySelector('meta[name="msapplication-TileColor"]');
  var msTile = msTileMeta ? msTileMeta.getAttribute("content") : null;
  addColorSignal(toHex(msTile || ""), "meta:ms-tile", 3);

  // ── 3. CSS variables ──────────────────────────────────────────────────
  var colorVarPattern = /color|primary|brand|accent|highlight|cta|button|link|main/i;
  var sheets = Array.from(document.styleSheets);
  for (var si = 0; si < sheets.length; si++) {
    try {
      var rules = Array.from(sheets[si].cssRules || []);
      for (var ri = 0; ri < rules.length; ri++) {
        var rule = rules[ri];
        if (rule instanceof CSSStyleRule) {
          var sel = rule.selectorText || "";
          if (sel === ":root" || sel === "html" || sel.indexOf("[data-theme") !== -1 || sel.indexOf("[data-color") !== -1) {
            for (var pi = 0; pi < rule.style.length; pi++) {
              var prop = rule.style[pi];
              if (prop.indexOf("--") === 0) {
                var val = rule.style.getPropertyValue(prop).trim();
                if (val.indexOf("#") === 0 || val.indexOf("rgb") === 0) {
                  var varWeight = colorVarPattern.test(prop) ? 4 : 1;
                  addColorSignal(toHex(val), "cssvar:" + prop, varWeight);
                }
              }
            }
          }
        }
      }
    } catch (e) { /* cross-origin */ }
  }

  // ── 4. CTA buttons ────────────────────────────────────────────────────
  var allButtons = Array.from(document.querySelectorAll(
    "button, a, [role='button'], input[type='submit'], input[type='button']"
  ));
  for (var bi = 0; bi < allButtons.length; bi++) {
    var btn = allButtons[bi];
    var text = (btn.textContent || "").trim();
    if (text.length === 0 || text.length > 50) continue;
    var btnRect = btn.getBoundingClientRect();
    var btnTop = btnRect.top + window.scrollY;
    if (btnTop > pageHeight * 0.75) continue;
    if (btn.closest("nav, header nav") || btn.closest("footer")) continue;
    var btnBg = getBgColor(btn);
    if (btnBg) {
      addColorSignal(btnBg, "cta:background", 3);
      var btnTextHex = toHex(window.getComputedStyle(btn).color);
      if (btnTextHex) addColorSignal(btnTextHex, "cta:text", 1);
    }
  }

  // ── 5. Nav/header background ──────────────────────────────────────────
  var navEl = document.querySelector("header, nav, [role='navigation']");
  if (navEl) {
    var navBg = getBgColor(navEl);
    if (navBg) addColorSignal(navBg, "nav:background", 3);
    var navTextHex = toHex(window.getComputedStyle(navEl).color);
    if (navTextHex) addColorSignal(navTextHex, "nav:text", 1);
  }

  // ── 6. H1 text color ──────────────────────────────────────────────────
  var h1Els = Array.from(document.querySelectorAll("h1"));
  for (var h1i = 0; h1i < h1Els.length; h1i++) {
    var h1El = h1Els[h1i];
    if (h1El.closest("nav, footer, aside")) continue;
    var h1Top = h1El.getBoundingClientRect().top + window.scrollY;
    if (h1Top > pageHeight * 0.65) continue;
    var h1Hex = toHex(window.getComputedStyle(h1El).color);
    if (h1Hex) addColorSignal(h1Hex, "h1:color", 2);
    break;
  }

  // ── 7. H2 text color ──────────────────────────────────────────────────
  var h2El = document.querySelector("h2");
  if (h2El && !h2El.closest("nav, footer")) {
    var h2Hex = toHex(window.getComputedStyle(h2El).color);
    if (h2Hex) addColorSignal(h2Hex, "h2:color", 1);
  }

  // ── 8. Footer background ──────────────────────────────────────────────
  var footerEl = document.querySelector("footer");
  if (footerEl) {
    var footerBg = getBgColor(footerEl);
    if (footerBg) addColorSignal(footerBg, "footer:background", 2);
  }

  // ── 9. Accent/badge elements ──────────────────────────────────────────
  var accentSelectors = [
    "[class*='badge']", "[class*='tag']", "[class*='chip']", "[class*='pill']",
    "[class*='label']", "[class*='highlight']", "[class*='accent']", "mark",
  ];
  for (var ai = 0; ai < accentSelectors.length; ai++) {
    var accentEl = document.querySelector(accentSelectors[ai]);
    if (!accentEl) continue;
    var accentBg = getBgColor(accentEl);
    if (accentBg) addColorSignal(accentBg, "accent:" + accentSelectors[ai], 2);
    var accentTextHex = toHex(window.getComputedStyle(accentEl).color);
    if (accentTextHex) addColorSignal(accentTextHex, "accent-text:" + accentSelectors[ai], 1);
  }

  // ── 10. Link color ────────────────────────────────────────────────────
  var firstLink = document.querySelector("main a, article a, section a");
  if (firstLink) {
    var linkHex = toHex(window.getComputedStyle(firstLink).color);
    if (linkHex) addColorSignal(linkHex, "link:color", 1);
  }

  // Build scored palette — sorted by score desc, then area desc
  var scoredPalette = Object.entries(colorMap)
    .sort(function (a, b) {
      if (b[1].score !== a[1].score) return b[1].score - a[1].score;
      return b[1].totalArea - a[1].totalArea;
    })
    .slice(0, 12)
    .map(function (entry) {
      return { hex: entry[0], score: entry[1].score, sources: entry[1].sources, totalArea: entry[1].totalArea };
    });

  // Page background color
  var bodyBg = getBgColor(document.body) ||
    toHex(window.getComputedStyle(document.documentElement).backgroundColor);

  // ═══════════════════════════════════════════════════════════════════════
  // FONT DISCOVERY
  // ═══════════════════════════════════════════════════════════════════════

  function cleanFamily(raw) {
    return raw.split(",")[0].trim().replace(/['"]/g, "");
  }

  function brandFamily(raw) {
    var clean = cleanFamily(raw);
    if (!clean) return null;
    if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system|BlinkMacSystemFont|Segoe\s*UI|Arial|Helvetica|Times\s*New\s*Roman|Times|Georgia|Courier\s*New|Courier|Verdana|Tahoma|Trebuchet)$/i.test(clean)) return null;
    return clean;
  }

  var fontElementMap = {};
  var fontScoreMap = {};

  function addFontScore(family, label, weight) {
    if (fontScoreMap[family]) {
      fontScoreMap[family].score += weight;
      if (fontScoreMap[family].seenOn.indexOf(label) === -1) fontScoreMap[family].seenOn.push(label);
    } else {
      fontScoreMap[family] = { score: weight, seenOn: [label] };
    }
  }

  // HIGH-signal content elements (weight 3)
  var highTargets = [
    { sel: "h1", label: "h1" },
    { sel: "h2", label: "h2" },
    { sel: "h3", label: "h3" },
    { sel: "h4", label: "h4" },
    { sel: "p",  label: "p" },
    { sel: "li", label: "li" },
    { sel: "blockquote", label: "blockquote" },
  ];
  for (var hti = 0; hti < highTargets.length; hti++) {
    try {
      var htEl = document.querySelector(highTargets[hti].sel);
      if (!htEl) continue;
      var htFam = brandFamily(window.getComputedStyle(htEl).fontFamily);
      fontElementMap[highTargets[hti].label] = htFam;
      if (htFam) addFontScore(htFam, highTargets[hti].label, 3);
    } catch (e) {}
  }

  // Scan up to 10 headings to catch per-heading font variation
  var headingEls = Array.from(document.querySelectorAll("h1, h2, h3, h4")).slice(0, 10);
  for (var hi = 0; hi < headingEls.length; hi++) {
    var hFam = brandFamily(window.getComputedStyle(headingEls[hi]).fontFamily);
    if (hFam) addFontScore(hFam, headingEls[hi].tagName.toLowerCase(), 2);
  }

  // MED-signal interactive elements (weight 2)
  var medTargets = [
    { sel: "nav a, header a",                              label: "nav" },
    { sel: "button, a[class*='btn'], input[type='submit']", label: "button" },
    { sel: "label, input, select",                          label: "form" },
  ];
  for (var mti = 0; mti < medTargets.length; mti++) {
    try {
      var mtEl = document.querySelector(medTargets[mti].sel);
      if (!mtEl) continue;
      var mtFam = brandFamily(window.getComputedStyle(mtEl).fontFamily);
      fontElementMap[medTargets[mti].label] = mtFam;
      if (mtFam) addFontScore(mtFam, medTargets[mti].label, 2);
    } catch (e) {}
  }

  // LOW-signal structural elements (weight 1) — recorded but used only as fallback
  var lowTargets = [
    { sel: "body",   label: "body" },
    { sel: "footer", label: "footer" },
  ];
  for (var lti = 0; lti < lowTargets.length; lti++) {
    try {
      var ltEl = document.querySelector(lowTargets[lti].sel);
      if (!ltEl) continue;
      var ltFam = brandFamily(window.getComputedStyle(ltEl).fontFamily);
      fontElementMap[lowTargets[lti].label] = ltFam;
      if (ltFam) addFontScore(ltFam, lowTargets[lti].label, 1);
    } catch (e) {}
  }

  // Ranked list for Claude context
  var discoveredFonts = Object.entries(fontScoreMap)
    .sort(function (a, b) { return b[1].score - a[1].score; })
    .map(function (entry) { return { family: entry[0], seenOn: entry[1].seenOn, score: entry[1].score }; });

  // ═══════════════════════════════════════════════════════════════════════
  // LOGO DISCOVERY (AND-validated)
  // ═══════════════════════════════════════════════════════════════════════

  var logo = null;

  var navImgs = Array.from(document.querySelectorAll(
    "header img, nav img, [class*='logo'] img, [id*='logo'] img, [class*='brand'] img"
  ));
  for (var nii = 0; nii < navImgs.length; nii++) {
    var img = navImgs[nii];
    var imgW = img.naturalWidth;
    var imgH = img.naturalHeight;
    var imgSrc = img.src || "";
    if (!imgSrc || imgSrc.indexOf("data:") === 0) continue;
    if (imgW === 0 || imgH === 0) continue;
    if (imgW > 600 || imgH > 300) continue;
    if (imgSrc.indexOf("background") !== -1 || imgSrc.indexOf("hero") !== -1 || imgSrc.indexOf("banner") !== -1) continue;
    logo = { type: "img", src: imgSrc, alt: img.alt, width: imgW, height: imgH, confidence: "high" };
    break;
  }

  if (!logo) {
    var navSvgs = Array.from(document.querySelectorAll(
      "header svg, nav svg, [class*='logo'] svg, [id*='logo'] svg"
    ));
    for (var nsi = 0; nsi < navSvgs.length; nsi++) {
      var svgRect = navSvgs[nsi].getBoundingClientRect();
      if (svgRect.width > 400 || svgRect.height > 200) continue;
      logo = { type: "svg", outerHTML: navSvgs[nsi].outerHTML.slice(0, 800), confidence: "high" };
      break;
    }
  }

  if (!logo) {
    var topImgs = Array.from(document.querySelectorAll("img")).filter(function (img) {
      var r = img.getBoundingClientRect();
      var t = r.top + window.scrollY;
      return t < pageHeight * 0.15 && img.naturalWidth > 0 && img.naturalWidth < 400 && img.naturalHeight < 200;
    });
    if (topImgs.length > 0) {
      var ti = topImgs[0];
      logo = { type: "img", src: ti.src, alt: ti.alt, width: ti.naturalWidth, height: ti.naturalHeight, confidence: "medium" };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STATS DISCOVERY (AND-validated)
  // ═══════════════════════════════════════════════════════════════════════

  var stats = [];
  var numericPattern = /^\$?[\d,]+(\.\d+)?[%+kKmMxX]?$|^[\d,]+(\.\d+)?(\s*(million|billion|thousand|%|\+|x))?$/i;

  var statCandidates = [];
  var allEls = Array.from(document.querySelectorAll("*"));
  for (var eli = 0; eli < allEls.length; eli++) {
    var elNode = allEls[eli];
    if (elNode.closest("nav, footer, form, script, style")) continue;
    var children = Array.from(elNode.children);
    if (children.length < 2) continue;
    var numericChild = null;
    var labelChild = null;
    for (var ci = 0; ci < children.length; ci++) {
      var childText = (children[ci].textContent || "").trim();
      if (numericPattern.test(childText) && childText.length < 20) numericChild = children[ci];
      else if (childText.length > 2 && childText.length < 80 && !numericPattern.test(childText)) labelChild = children[ci];
    }
    if (numericChild && labelChild) {
      statCandidates.push({
        value: (numericChild.textContent || "").trim(),
        label: (labelChild.textContent || "").trim(),
        parent: elNode.parentElement || elNode,
      });
    }
  }

  // AND condition: at least 2 stat pairs must share the same parent container
  var parentIndex = [];
  var parentCounts = [];
  for (var sci = 0; sci < statCandidates.length; sci++) {
    var idx = parentIndex.indexOf(statCandidates[sci].parent);
    if (idx === -1) { idx = parentIndex.length; parentIndex.push(statCandidates[sci].parent); parentCounts.push(0); }
    parentCounts[idx]++;
  }
  for (var sci2 = 0; sci2 < statCandidates.length; sci2++) {
    var pidx = parentIndex.indexOf(statCandidates[sci2].parent);
    if (parentCounts[pidx] >= 2 && !stats.find(function (s) { return s.value === statCandidates[sci2].value; })) {
      stats.push({ value: statCandidates[sci2].value, label: statCandidates[sci2].label });
    }
    if (stats.length >= 6) break;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TESTIMONIALS DISCOVERY (AND-validated)
  // ═══════════════════════════════════════════════════════════════════════

  var testimonials = [];
  var attributionPattern = /^[A-Z][a-z]+(\s[A-Z][a-z]+)*[,\s—\-]|CEO|Founder|Director|Manager|Co-founder/;

  for (var teli = 0; teli < allEls.length; teli++) {
    var telNode = allEls[teli];
    if (telNode.closest("nav, footer, form, script, style")) continue;
    var telChildren = Array.from(telNode.children);
    if (telChildren.length < 2) continue;
    var quoteChild = null;
    var authorChild = null;
    for (var tci = 0; tci < telChildren.length; tci++) {
      var tText = (telChildren[tci].textContent || "").trim();
      if (tText.length > 60 && tText.length < 500 && !numericPattern.test(tText.slice(0, 10))) quoteChild = telChildren[tci];
      else if (tText.length > 3 && tText.length < 80 && attributionPattern.test(tText)) authorChild = telChildren[tci];
    }
    if (quoteChild && authorChild) {
      var quote = (quoteChild.textContent || "").trim().replace(/^["'"']|["'"']$/g, "");
      var author = (authorChild.textContent || "").trim();
      if (!testimonials.find(function (t) { return t.quote === quote; })) testimonials.push({ quote: quote, author: author });
    }
    if (testimonials.length >= 4) break;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COPY TEXT, META, PHOTOGRAPHY
  // ═══════════════════════════════════════════════════════════════════════

  var copyText = {
    h1: Array.from(document.querySelectorAll("h1")).map(function (el) { return (el.textContent || "").trim(); }).filter(Boolean).slice(0, 5),
    h2: Array.from(document.querySelectorAll("h2")).map(function (el) { return (el.textContent || "").trim(); }).filter(Boolean).slice(0, 8),
    nav: Array.from(document.querySelectorAll("nav a")).map(function (el) { return (el.textContent || "").trim(); }).filter(Boolean).slice(0, 10),
    cta: allButtons.filter(function (el) {
      var t = (el.textContent || "").trim();
      return t.length > 0 && t.length <= 50;
    }).map(function (el) { return (el.textContent || "").trim(); }).filter(Boolean).slice(0, 5),
  };

  var bodySnippet = document.body.innerText.slice(0, 3000);

  var faviconEl = document.querySelector('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
  var favicon = faviconEl ? faviconEl.href : "";
  var ogImageMeta = document.querySelector('meta[property="og:image"]');
  var ogImage = ogImageMeta ? (ogImageMeta.getAttribute("content") || "") : "";
  var ogTitleMeta = document.querySelector('meta[property="og:title"]');
  var ogTitle = ogTitleMeta ? (ogTitleMeta.getAttribute("content") || document.title) : document.title;
  var siteNameMeta = document.querySelector('meta[property="og:site_name"]');
  var rawSiteName = siteNameMeta ? (siteNameMeta.getAttribute("content") || "") : "";
  var genericNames = ["my site", "home", "website", "untitled", "wix site"];
  var brandName = genericNames.indexOf(rawSiteName.toLowerCase()) !== -1 ? "" : rawSiteName;

  var images = Array.from(document.querySelectorAll("img"))
    .filter(function (img) {
      if (img.naturalWidth < 200 || img.naturalHeight < 200) return false;
      if (img.closest("nav, header")) return false;
      var src = img.src || "";
      if (src.indexOf("data:") !== -1 || src.indexOf("logo") !== -1 || src.indexOf("icon") !== -1 || src.indexOf("avatar") !== -1) return false;
      return true;
    })
    .map(function (img) {
      return {
        src: img.src,
        alt: img.alt || "",
        width: img.naturalWidth,
        height: img.naturalHeight,
        inHero: !!(img.closest('[class*="hero"], [class*="Hero"], section:first-of-type')),
      };
    })
    .slice(0, 15);

  var bgImages = Array.from(document.querySelectorAll('[class*="hero"], [class*="Hero"], section, div'))
    .map(function (el) {
      var bg = window.getComputedStyle(el).backgroundImage;
      if (bg && bg !== "none" && bg.indexOf("url(") !== -1) {
        var match = bg.match(/url\(["']?([^"')]+)["']?\)/);
        return match ? match[1] : null;
      }
      return null;
    })
    .filter(Boolean)
    .slice(0, 5);

  function spatialFor(selector) {
    var el = document.querySelector(selector);
    if (!el) return null;
    var cs = window.getComputedStyle(el);
    function parseVal(v) { return parseFloat(v) || 0; }
    return {
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
      paddingRight: cs.paddingRight,
      avgPadding: (parseVal(cs.paddingTop) + parseVal(cs.paddingBottom) + parseVal(cs.paddingLeft) + parseVal(cs.paddingRight)) / 4,
      avgMargin: (parseVal(cs.marginTop) + parseVal(cs.marginBottom)) / 2,
    };
  }
  var spatial = spatialFor("body") || spatialFor("section") || { avgPadding: 16, avgMargin: 8 };

  var borderRadii = [];
  for (var bri = 0; bri < Math.min(allButtons.length, 5); bri++) {
    var r = window.getComputedStyle(allButtons[bri]).borderRadius;
    if (r && r !== "0px") borderRadii.push(r);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // OUTPUT
  // ═══════════════════════════════════════════════════════════════════════

  return {
    url: window.location.href,
    title: document.title,
    brandName: brandName,
    ogTitle: ogTitle,
    ogImage: ogImage,
    favicon: favicon,
    scoredPalette: scoredPalette,
    backgroundColor: bodyBg,
    discoveredFonts: discoveredFonts,
    fontElementMap: fontElementMap,
    logo: logo,
    borderRadii: borderRadii,
    copyText: copyText,
    bodySnippet: bodySnippet,
    stats: stats,
    testimonials: testimonials,
    images: images,
    bgImages: bgImages,
    spatial: spatial,
    colorSamples: scoredPalette.map(function (c) { return { hex: c.hex, contexts: c.sources, count: c.score }; }),
    logoImgs: logo && logo.type === "img" ? [{ src: logo.src, alt: logo.alt, width: logo.width, height: logo.height }] : [],
    logoSvgs: logo && logo.type === "svg" ? [{ type: "inline-svg", outerHTML: logo.outerHTML }] : [],
  };
};
