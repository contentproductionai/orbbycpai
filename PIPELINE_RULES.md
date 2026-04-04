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
