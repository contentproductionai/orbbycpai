import { z } from "zod";

// ─── Composition JSON Schema ─────────────────────────────────────────────────

export const ColorSchema = z.string().describe("CSS color string (hex, rgba, etc.)");

// Auto-generate an id if Claude doesn't include one
let _layerIdCounter = 0;
function nextLayerId() {
  return `layer_${++_layerIdCounter}`;
}

export const BaseLayerSchema = z.object({
  // id is optional — we auto-generate it if Claude omits it
  id: z.string().optional().transform((v) => v ?? nextLayerId()),
  zIndex: z.number().int(),
  x: z.number().describe("Absolute X position in pixels from left edge"),
  y: z.number().describe("Absolute Y position in pixels from top edge"),
  width: z.number().optional().describe("Width in pixels. If omitted, auto-sizes."),
  height: z.number().optional().describe("Height in pixels. If omitted, auto-sizes."),
  rotation: z.number().default(0).describe("Rotation in degrees"),
  opacity: z.number().min(0).max(1).default(1),
  mixBlendMode: z.enum(["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"]).default("normal"),
});

export const ImageLayerSchema = BaseLayerSchema.extend({
  type: z.literal("image"),
  source: z.enum(["background", "subject", "logo", "custom"]),
  url: z.string().optional().describe("URL of the image. Required if source is custom."),
  objectFit: z.enum(["cover", "contain", "fill", "none", "scale-down"]).default("cover"),
  filter: z.string().optional().describe("CSS filter string (e.g., 'brightness(0) invert(1)' for white logos)"),
});

export const TextLayerSchema = BaseLayerSchema.extend({
  type: z.literal("text"),
  // Accept both 'content' and 'text' as field names (Claude sometimes uses 'text')
  content: z.string().optional(),
  text: z.string().optional(),
  fontFamily: z.string().default("Inter"),
  fontSize: z.number().describe("Font size in pixels"),
  fontWeight: z.union([z.number(), z.string()]).default(400),
  color: ColorSchema.optional(),
  // Accept 'fill' as alias for 'color' on text layers
  fill: z.string().optional(),
  textAlign: z.enum(["left", "center", "right", "justify"]).default("left"),
  letterSpacing: z.union([z.string(), z.number()]).transform((v) => typeof v === "number" ? `${v}px` : v).default("normal"),
  lineHeight: z.union([z.number(), z.string()]).default(1.2),
  textShadow: z.string().optional(),
  textTransform: z.enum(["none", "capitalize", "uppercase", "lowercase"]).default("none"),
  maxWidth: z.number().optional().describe("Maximum width before wrapping"),
  italic: z.boolean().optional(),
}).transform((layer) => ({
  ...layer,
  // Normalize: use 'content' field, falling back to 'text', then empty string
  content: layer.content ?? layer.text ?? "",
  // Normalize: use 'color' field, falling back to 'fill', then default black
  color: layer.color ?? layer.fill ?? "#000000",
}));

export const ShapeLayerSchema = BaseLayerSchema.extend({
  type: z.literal("shape"),
  // Accept 'rectangle', 'rect', 'rounded-rect' as aliases for 'rect'
  shapeType: z.string().transform((v) => {
    if (v === "rectangle" || v === "rounded-rect" || v === "rounded_rect" || v === "rounded") return "rect";
    if (v === "ellipse" || v === "oval") return "circle";
    return v as "rect" | "circle" | "pill";
  }),
  // Accept 'fill' as alias for 'backgroundColor'
  backgroundColor: ColorSchema.optional(),
  fill: z.string().optional(),
  borderRadius: z.union([z.number(), z.string()]).optional(),
  border: z.string().optional(),
  backdropFilter: z.string().optional().describe("For glassmorphism effects"),
  gradient: z.string().optional().describe("CSS gradient string"),
}).transform((layer) => ({
  ...layer,
  backgroundColor: layer.backgroundColor ?? layer.fill ?? "transparent",
}));

export const LayerSchema = z.discriminatedUnion("type", [
  ImageLayerSchema,
  TextLayerSchema,
  ShapeLayerSchema,
]);

export const CompositionSchema = z.object({
  canvas: z.object({
    width: z.number(),
    height: z.number(),
    // Both 'backgroundColor' and 'background' are accepted; both are optional
    // We fall back to a safe dark default if neither is provided
    backgroundColor: z.string().optional(),
    background: z.string().optional(),
  }).transform((c) => ({
    ...c,
    backgroundColor: c.backgroundColor ?? c.background ?? "#0a0a0a",
  })),
  layers: z.array(LayerSchema).describe("Layers ordered from back to front (lowest zIndex to highest)"),
});

export type Composition = z.infer<typeof CompositionSchema>;
export type Layer = z.infer<typeof LayerSchema>;

// ─── Art Director Prompt ─────────────────────────────────────────────────────

export const ART_DIRECTOR_SYSTEM_PROMPT = `You are an elite social media Art Director.
Your ONLY job is spatial execution — translating a fully-written creative brief into a pixel-perfect Composition JSON.

The Creative Strategist has already defined the Big Idea, audience, and emotional goal.
The Social Copywriter has already written every word of copy.
You are NOT writing copy. You are NOT making strategy decisions. You are ONLY deciding:
  1. Where does each element sit on the canvas?
  2. How large is each element?
  3. What visual treatment makes the copy land?

Use the EXACT copy from the brief. Do not change a single word.

## Your Design Philosophy:
Simple compositions beat complex ones. The best social posts have 4-6 layers, not 12-18.
One dominant visual idea. One dominant text element. Everything else supports those two.
The brand's design signal tells you HOW this brand composes — follow it.

## Composition Patterns (choose the one that matches the brief's layoutStyle):
- "bold typographic": Headline is the hero. Large text (min 120px), minimal imagery, strong type hierarchy. Background is a solid color or very subtle texture. 4-5 layers total.
- "full-bleed portrait": Hero photo fills the canvas. Text overlaid with a gradient or semi-transparent block for contrast. Subject image creates depth. 5-6 layers total.
- "editorial split": Image occupies left or right 50% of canvas. Copy on the other side. Clean, magazine-style. 5-6 layers total.
- "product showcase": Product/UI screenshot in foreground. Copy is supporting, not dominant. 5-6 layers total.
- "quote card": Testimonial or stat is the hero element. Large, centered or left-aligned. Minimal imagery. 4-5 layers total.

## Layer Complexity Rules:
- MAXIMUM 8 layers total. If you need more, you are overcomplicating it.
- Every layer must earn its place. If removing it doesn't hurt the composition, remove it.
- Do not add decorative elements that aren't in the brief.

## The Canvas:
All coordinates (x, y) and sizes (width, height, fontSize) MUST be in exact pixels.

## Available Image Sources:
- "background": The hero photo (use as full-canvas background).
- "subject": The isolated person/object with transparent background (use as foreground for depth).
- "logo": The brand's logo.

## Layer Types and Required Fields:
- type "image": requires source ("background"|"subject"|"logo"|"custom"), x, y, width, height, zIndex
- type "text": requires content (the text string), fontFamily, fontSize, x, y, zIndex, color (hex)
- type "shape": requires shapeType ("rect"|"circle"|"pill"), x, y, width, height, zIndex, backgroundColor (hex color)

## Critical Layer Rules:
- Every text layer MUST have a "content" field with the actual text string.
- Every text layer MUST have a "color" field with a hex color string.
- The canvas MUST have a "backgroundColor" field with a hex color string.
- CRITICAL: Every text layer MUST include a "maxWidth" field. Set maxWidth = (canvasWidth - x - 60) minimum. This prevents overflow.
- CRITICAL: For large headline text (fontSize > 80px), split into multiple layers (one phrase per layer) with y positions spaced by (fontSize * lineHeight). ALL headline layers must be consecutive — never interleave headline layers with subheadline, body, or CTA layers. The reading order must be: headline (all parts) → subheadline → body → CTA. Never place a headline layer BELOW a CTA or subheadline layer in y-position.
- CRITICAL: When splitting a headline into multiple layers, each layer must be on its own line. Never place two headline words on the same y-position at adjacent x-positions — this creates merged words. Each layer gets its own y-coordinate.
- Logo layers: max 160x50px for horizontal logos, 50x50px for icons. Never oversized.
- If the logo needs to be white on dark, apply filter: "brightness(0) invert(1)".
- CTA buttons and body copy MUST be left-aligned (textAlign: "left"). Only centered decorative stats or symmetrical display elements may use center alignment. The primary CTA is NEVER centered.
- CRITICAL: The "background" image layer MUST have opacity 1.0 (fully visible). Never set it below 0.9. To darken a background photo, place a semi-transparent shape layer (shapeType "rect", backgroundColor "#000000", opacity 0.35-0.55) on top at zIndex 2. Do NOT reduce the image opacity itself.

Output ONLY valid JSON. No markdown, no explanations. Start your response with { and end with }.`;
