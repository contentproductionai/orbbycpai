/**
 * Orb Schema Library
 * Defines all content schemas (layouts) available for generation.
 * Ported from schemas.py
 */

export interface Schema {
  id: string;
  name: string;
  description: string;
  sizes: string[];
  requiresPhoto: boolean;
  definition: string;
}

export const SIZE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1350 },
  story:    { width: 1080, height: 1920 },
  square:   { width: 1080, height: 1080 },
};

const SCHEMAS: Schema[] = [
  {
    id: "bold_statement",
    name: "Bold Statement",
    description: "Large headline-driven post with minimal copy and strong brand color usage.",
    sizes: ["portrait", "story", "square"],
    requiresPhoto: false,
    definition: `Schema: Bold Statement
Layout:
1. Solid brand background (primary or accent color) covering entire canvas.
2. Logo top-left, 40px from edges. Max height 80px.
3. One bold headline: 3–7 words, centered or left-aligned, min 96px, brand headline font.
4. Optional 1-line subtext below headline, min 36px, lighter weight.
5. Geometric accent element: horizontal rule, circle, or rectangle using complementary color.
6. Bottom watermark bar: full-width, 48px tall, semi-transparent dark background.
   Text: "MADE WITH ORB · CONTENTPRODUCTION.AI" centered, 18px, white, 60% opacity.
Rules:
- Maximum 12 words of copy (excluding watermark and brand name).
- No photography — pure typography and brand color.
- Headline must be readable at thumbnail size.
- All text must contrast with background (WCAG AA minimum).`,
  },
  {
    id: "editorial_photo",
    name: "Editorial Photo",
    description: "Full-bleed photography with brand-consistent overlay and headline.",
    sizes: ["portrait", "story", "square"],
    requiresPhoto: true,
    definition: `Schema: Editorial Photo
Layout:
1. Full-bleed photo background covering entire canvas (use PHOTO_PLACEHOLDER as img src).
2. Dark gradient overlay on bottom 50%: linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.0) 100%).
3. Logo top-left, 40px from edges. Max height 72px. Use white or light version if brand is dark.
4. Headline: large, bold, bottom-left, above subtext. Min 80px. Brand font. White or near-white.
5. Subtext: 1–2 lines below headline. Min 32px. Lighter weight. 80% white opacity.
6. Optional accent element: short horizontal rule, colored badge, or geometric shape using accent color.
7. Bottom watermark bar: full-width, 48px tall, rgba(0,0,0,0.45) background.
   Text: "MADE WITH ORB · CONTENTPRODUCTION.AI" centered, 18px, white, 60% opacity.
Rules:
- The bottom 50% must have a dark overlay so white text is always readable.
- Maximum 15 words of copy (excluding watermark and brand name).
- Photo must fill 100% of canvas — no letterboxing or white borders.`,
  },
  {
    id: "stat_callout",
    name: "Stat Callout",
    description: "A single compelling statistic rendered with brand typography and color.",
    sizes: ["portrait", "square"],
    requiresPhoto: false,
    definition: `Schema: Stat Callout
Layout:
1. Solid brand background (primary or dark background color) covering entire canvas.
2. Logo top-left, 40px from edges. Max height 72px.
3. Large number/stat: centered, min 160px, brand headline font, accent color.
4. Stat label: below the number, min 40px, brand body font, primary text color.
5. Optional 1-line context sentence below label, min 28px, muted color.
6. Thin horizontal rule above the stat, accent color, 4px tall, 60% canvas width, centered.
7. Bottom watermark bar: full-width, 48px tall, semi-transparent dark background.
   Text: "MADE WITH ORB · CONTENTPRODUCTION.AI" centered, 18px, white, 60% opacity.
Rules:
- Maximum 20 words of copy (excluding watermark and brand name).
- The stat number must be the dominant visual element — largest element on canvas.
- No photography.`,
  },
  {
    id: "testimonial",
    name: "Testimonial",
    description: "Customer quote rendered with brand typography and a subtle background.",
    sizes: ["portrait", "square"],
    requiresPhoto: false,
    definition: `Schema: Testimonial
Layout:
1. Solid brand background (light or dark, matching brand background luminance) covering entire canvas.
2. Logo top-left, 40px from edges. Max height 72px.
3. Large opening quote mark: top-center or top-left, 120px+, accent color, 30% opacity.
4. Quote text: centered, min 44px, brand body font, primary text color. Max 3 lines.
5. Attribution line: below quote, min 28px, muted color. Format: "— First Last, Title".
6. Thin horizontal rule between quote and attribution, accent color, 2px, 40% canvas width, centered.
7. Bottom watermark bar: full-width, 48px tall, semi-transparent dark background.
   Text: "MADE WITH ORB · CONTENTPRODUCTION.AI" centered, 18px, white, 60% opacity.
Rules:
- Maximum 40 words of copy (excluding watermark and brand name).
- Quote must be a real testimonial from the brand profile — do not fabricate.
- No photography.`,
  },
];

export const SCHEMA_BY_ID: Record<string, Schema> = Object.fromEntries(
  SCHEMAS.map((s) => [s.id, s])
);

export const ALL_SCHEMA_IDS = SCHEMAS.map((s) => s.id);

/**
 * Select schemas based on available brand data.
 * Returns a list of schema IDs appropriate for the given brand profile.
 */
export function selectSchemas(brandProfile: Record<string, unknown>): string[] {
  const selected: string[] = ["bold_statement", "editorial_photo"];

  const stats = (brandProfile.statistics as unknown[]) ?? [];
  if (stats.length > 0) {
    selected.push("stat_callout");
  }

  const testimonials = (brandProfile.testimonials as unknown[]) ?? [];
  if (testimonials.length > 0) {
    selected.push("testimonial");
  }

  return selected;
}
