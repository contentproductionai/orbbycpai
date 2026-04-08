# Orb Pipeline Rules

Decisions, constraints, and hard-won lessons for the Orb extraction and generation pipeline.
Each rule documents **what** the rule is, **why** it exists, and **what broke** without it.

---

## 1. Pop-up / Consent Banner Suppression

### Rule
Pop-up suppression selectors in `extractDom.ts` **must cover all major consent/cookie vendors by their vendor-specific prefix**, not just generic class names like `[class*='cookie']` or `[class*='modal']`.

### Why
Each consent platform uses its own CSS class prefix. Generic selectors miss vendor-specific elements. When a cookie consent bar is not suppressed, it becomes the highest-scoring area element in the color palette (because it is large, fixed-position, and white), contaminating `classifyVisual` with the wrong brand colors.

**What broke:** Magic Mind's `classifyVisual` returned `brandPrimary: #1c1b1b` (near-black) and `accentColor: null` because `div.cky-consent-bar` (CookieYes) was not suppressed. It scored as the top area element with `score=47`, drowning out the actual brand palette.

### Known vendor prefixes — all must be in the selector list

| Vendor | CSS prefix | Notes |
|---|---|---|
| CookieYes | `cky-` | e.g. `div.cky-consent-bar` |
| OneTrust | `onetrust-` | e.g. `#onetrust-banner-sdk` |
| Osano | `osano-` | e.g. `div.osano-cm-window` |
| Cookiebot / Cybot | `CybotCookie` | e.g. `#CybotCookiebotDialog` |
| TrustArc / TRUSTe | `trustarc`, `truste` | |
| Termly | `termly` | |
| Complianz | `cmplz` | |
| Usercentrics | `usercentrics` | |

### Broader principle
When a new consent vendor is discovered in the wild (visible in `scoredPalette` sources), add its prefix to **both**:
1. The post-load DOM removal selector list in `extractDom.ts` (lines ~209–231)
2. This document

Do not patch individual brands. Fix the suppression list so all future brands benefit.

---

## 2. Color Extraction: Exclude Fixed-Position Overlays from Area Scoring

### Rule
The browser-side area color scanner (`extractDom.browser.js`) must skip elements that are `position: fixed` or `position: absolute` with high `z-index`, as these are almost always UI overlays (cookie bars, chat widgets, sticky headers) rather than brand background colors.

### Status
Partially addressed via post-load DOM removal. The area scanner itself does not yet filter by position — tracked as a future improvement.

---

## 3. classifyVisual Returns Null Colors: Root Cause Checklist

If `classifyVisual` returns `brandPrimary: null` or `accentColor: null`, check in this order:

1. **Cookie/consent bar not suppressed** — check `scoredPalette` sources for `cky-`, `onetrust-`, etc. Fix: add vendor prefix to suppression list.
2. **DNS failure** — check logs for `net::ERR_NAME_NOT_RESOLVED`. The extractor ran against a browser error page. Fix: verify the domain resolves.
3. **scoredPalette has only white/black** — the page loaded but no brand colors were found. Check if the site uses a CSS-in-JS framework that inlines styles at runtime (e.g. Emotion, styled-components). Fix: increase post-load wait time or add CSS variable extraction.
4. **Claude Vision parse failure** — check logs for `[classifyVisual] Failed to parse Claude response`. The fallback assigns roles by score order, which may produce nulls if the palette is all-neutral.

---

## 4. colorTheme Drives Layout Selection — Must Reflect Background, Not Photography

### Rule
`colorTheme` in the Creative Strategist output must be derived from the **page background luminance**, not from the mood of the brand photography.

### Why
Magic Mind uses moody, dark-toned lifestyle photography but has a light sage-green website background. If `colorTheme=dark` is inferred from photography style, the pipeline selects `dark-field-hero` layout for every generation, which is wrong for light-background brands.

### Rule
If `backgroundLuminance > 0.6` (light background), `colorTheme` must be `light` regardless of photography mood. The layout selector maps `light + social_proof + hasStat → split-stat`.

---

## 5. One Fix, One Commit

When a pipeline bug is found, fix exactly one root cause per commit. Do not bundle multiple fixes. This makes it possible to bisect regressions and confirm each fix independently before moving to the next.

## 6. The Quality Bar & Extraction Architecture (Phase 1)

### Rule
The automated pipeline must replicate the manual POC process:
1. Navigate to the brand's website in a real browser.
2. Visually inspect the rendered page (colors, fonts, hero image, copy).
3. Pull exact CSS values via `getComputedStyle` and `document.fonts` in the browser console.
4. Download key images directly from the page.
5. Read headlines, stats, and testimonials as visible text.
6. Choose the layout that best showcases the strongest available asset.
7. Build the HTML with everything correctly applied.

### Why
Headless scraping of unrendered DOMs (Puppeteer) fails on modern CSS-in-JS, WebGL, and anti-bot sites. The extraction engine must use a real browser to ensure visual rendering is complete before extraction.

## 7. Product Page Deep Dive

### Rule
The extraction engine MUST navigate to at least one product page in addition to the homepage.

### Why
Homepages are for marketing; product pages have the substance. Product pages contain ingredient lists, clinical claims, specific stats, and SKU-level copy. This is the material that makes generated copy credible, not generic.

## 8. Redundancy & Fallbacks

### Rule
Every AI call must have a non-AI fallback. If the perfect color cannot be extracted, use a close approximation. Degraded output is better than no output. Log every failure with context (URL, screenshot, extracted data, failed step) to allow for manual review.

## 9. Dual-Ingestion Model

### Rule
The platform must support both Auto-Extract (paste a URL) and Manual Profile (Brand Repository). The Manual Profile is a first-class feature, not a fallback, allowing users to upload hex codes, fonts, and product images directly into a persistent workspace.

## 10. Platform Aesthetic

### Rule
The platform aesthetic is light, warm backgrounds (e.g., `#FAF8F4` cream/off-white). Dark mode is retired. Use fluorescent accents (teal `#00e5a0`, hot pink `#ff01c7`, electric yellow `#e1ff00`) aggressively. Retain all UFO imagery and iconography. Typography must be clean, modern, confident, and large.

## 11. Development Principles

### Rule
- **Ask Before Building:** Always ask clarifying questions before building. Never start coding without confirming the approach first.
- **No Scope Creep:** Never add features that weren't explicitly requested. Build the simplest version that works, then wait for approval.
- **Diagnose Before Fixing:** When something fails, diagnose the root cause before attempting a fix. Never try more than one solution at a time.
- **Verify Completion:** Always confirm what you built works before declaring a step complete.

## 12. Subtext Design Rule — Legibility and Purpose

### Rule
Subtext on all generated images is subject to three hard constraints:

1. **12-word cap.** Subtext must never exceed 12 words. Social posts are viewed at thumbnail size on phones. If it takes more than a glance to read, it is doing the wrong job.
2. **Stat-reinforcing, not descriptive.** Subtext does not describe the product. It does one thing: reinforce the headline and/or the stat. For `split-stat` layouts, subtext names what the product is and echoes the stat's credibility (e.g. "Prebiotic soda with 9g of fiber. Zero compromise.").
3. **Minimum 40px on a 1080px canvas.** WCAG AA requires 4.5:1 contrast ratio. On a 1080px canvas rendered to a phone screen, subtext must be set at no smaller than 40px in the HTML compositor. This is a hard requirement, not a design preference.

### Why
In the POC images, subtext was illegible on mobile for users with any degree of visual impairment. A senior designer solves this with hierarchy over volume: the headline persuades, the stat credentializes, the subtext names. Three jobs, three elements, nothing more.

### Applied to layout_selector.py
The `write_subtext()` function applies this rule automatically:
- For `split-stat`: generates a stat-reinforcing line using the selected stat's value and label.
- For other layouts: caps the hero subheadline at 12 words, or falls back to the top two key messages.

### Applied to the compositor
The HTML template for every layout must enforce `font-size: 40px` minimum for subtext on a 1080px canvas. No CSS default or relative sizing may produce a smaller result.

## 13. Data Model: Generation Key is Product URL, Not Brand

### Rule
The `generations` table uses `brand_url` as its primary input field. **This column name is wrong and must be migrated to `product_url`.** A generation record represents a single pipeline run against a specific URL input — which may be a product page, a homepage, or any other URL the user provides. It is not a brand-level record.

### Why
A brand with 50 SKUs should produce 50 generation records, each scoped to a specific product page URL. Naming the column `brand_url` implies brand-level scope and conflates brand identity with product-level content generation. The `brand_id` foreign key correctly links the generation to the brand entity; the generation itself is keyed to the input URL.

### Migration Requirements
When this migration runs:
1. Rename `brand_url` → `product_url` in the `generations` table.
2. **Audit all existing `brand_url` values that are homepages.** Do not silently rename them. For any row where `brand_url` is a homepage (e.g., `https://magicmind.com`), flag it in the record's `brand_profile._orb.inputType` as `"brand"`. For rows where a product URL is known, update the value.
3. Update all code references: `DashboardClient.tsx`, `generate/route.ts`, `generations/route.ts`, `schema.ts`, `drizzle.config.ts`, and any seed scripts.
4. This is a breaking schema change. Run it as a standalone migration with a rollback plan. Do not bundle it with other changes.

### Status
**Deferred.** Flagged 2026-04-06. Implement as a standalone migration in a future session.

---

## 14. URL Intent: Homepage vs. Product Page

### Rule
The URL the user inputs is their creative brief. The pipeline must detect and respect the intent of the URL:

- **Homepage URL** (e.g., `https://magicmind.com`) → Generate brand awareness content. Scrape the homepage only. Do not crawl to product pages.
- **Product URL** (e.g., `https://drinkolipop.com/products/vintage-cola`) → Generate product-specific content. Scrape that page only. Do not fall back to the homepage.

No crawling. No inference. No mixing of homepage and product page data in a single generation run.

### UI Requirement
The generate form must display a single confirmation line below the URL input field **before** the user submits, showing detected intent:

- For a homepage: `Generating brand content from homepage`
- For a product page: `Generating product content for [product name]` (where product name is parsed from the URL slug or page title if available)

This confirmation line is not optional. It is the user's only signal that the system understood their input correctly before a generation run starts.

### Implementation Notes
- Intent detection is URL-structure-based, not AI-based. A URL containing `/products/`, `/shop/`, `/item/`, `/p/`, or `/collections/[name]/products/` is a product URL. All others default to homepage/brand intent.
- The confirmation line must update in real time as the user types, with no submit required.
- The `brand_profile._orb.inputType` field must be set to `"product"` or `"brand"` on every generation record to preserve this distinction for calibration and analytics.

---
## 15. Asset Ranking: Claude Vision Hero Image Selection

### Rule
After downloading candidate brand assets, run a single Claude Vision batch call to rank them before the Image Director agent runs. This ensures the Image Director receives visual quality scores, not just text metadata.

### Implementation
- `rankHeroAssets()` in `src/lib/pipeline/rankHeroAssets.ts`
- Filters candidates: width ≥ 300px, height ≥ 300px, not GIF, file exists locally
- Sorts candidates: inHero first, then by pixel area (largest first)
- Takes top 10 candidates, sends all in a single Claude Vision call (claude-haiku-4-5-20251001)
- Scores each on three criteria:
  - **Product Visibility** (0–3): Is the product clearly visible and the main subject?
  - **Background Cleanliness** (0–3): Is the background solid/clean/transparent?
  - **Hero Usability** (0–4): How well would this work as the main visual anchor in a social post?
- Returns `rankedAssets[]` (sorted by totalScore desc) and `heroAssetIndex` (index into original downloadedAssets)
- Both are stored on `brandProfile.brandAssets`

### Image Director Integration
- `compositorAgents.ts` Image Director receives Vision Scores and heroReason for each candidate
- Instruction added: "If Vision Scores are provided, strongly prefer the image with the highest score unless the visual concept explicitly requires a different scene"

### Color Quantization Integration
- `runPipeline.ts` color quantization pass now reads `heroAssetIndex` from the ranked result
- Falls back to `inHero` flag, then first asset if ranking is unavailable

### Fallback
- Non-fatal: if ranking fails, falls back to inHero[0] as before
- One batch call per generation run — not per post

### Rationale
The Image Director was previously guessing from alt text and URL patterns. For DTC brands (Liquid Death, OLIPOP, Poppi), the product image is the largest, squarest, most prominently placed asset — but alt text is often empty. Vision scoring eliminates the guesswork and ensures the correct hero asset is selected.

### Committed
`abedf3f` (rankHeroAssets + classifyBrand + compositorAgents), `6e57146` (runPipeline color quantization)

---
