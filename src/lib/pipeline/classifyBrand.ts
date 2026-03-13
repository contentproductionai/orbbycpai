/**
 * Orb Brand Classifier
 * Classifies raw DOM data into a structured BrandProfile using Claude Haiku.
 * Ported from classify_brand.py
 */

import Anthropic from "@anthropic-ai/sdk";

const CLASSIFICATION_MODEL = "claude-3-5-haiku-20241022";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColorSample {
  hex: string;
  contexts: string[];
  count: number;
}

export interface BrandProfile {
  meta: {
    url: string;
    brandName: string;
    extractedAt: string;
  };
  tone: {
    directness: string;
    formality: string;
    emotionality: string;
    summary: string;
  };
  brandPersonality: string;
  industryContext: string;
  statistics: Array<{ value: string; label: string }>;
  testimonials: Array<{ quote: string; author: string }>;
  shapeLanguage: {
    classification: string;
    rawBorderRadii: string[];
  };
  typography: {
    headline: Record<string, string | undefined>;
    body: Record<string, string | undefined>;
    cta: Record<string, string | undefined>;
  };
  colorPalette: ColorSample[];
  primaryColor: string;
  accentColor: string;
  backgroundLuminance: number;
  logoRendering: string;
  spatialPhilosophy: {
    classification: string;
    rawSamples: Record<string, unknown>;
  };
  brandAssets: {
    logoImgs: string[];
    logoSvgs: string[];
    favicon: string;
    ogImage: string;
  };
  photography: {
    style: string;
    subject: string;
    sampleImages: string[];
    bgImages: string[];
  };
  cssVars: Record<string, string>;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "");
  if (h.length !== 6) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return Math.max(...rgb) - Math.min(...rgb);
}

function contextWeight(contexts: string[]): number {
  const ctx = contexts.join(" ").toLowerCase();
  let weight = 1.0;
  if (/background|hero|page|section/.test(ctx)) weight *= 2.0;
  if (/subheadline|headline|h1|h2/.test(ctx)) weight *= 1.5;
  if (/border|icon|divider/.test(ctx)) weight *= 0.5;
  return weight;
}

// ─── Shape language classifier ────────────────────────────────────────────────

function classifyShapeLanguage(borderRadii: string[]): string {
  if (!borderRadii || borderRadii.length === 0) return "geometric";
  const parsed: number[] = [];
  for (const r of borderRadii) {
    const m = r.match(/^(\d+(?:\.\d+)?)/);
    if (m) parsed.push(parseFloat(m[1]));
  }
  if (parsed.length === 0) return "geometric";
  const avg = parsed.reduce((a, b) => a + b, 0) / parsed.length;
  if (avg === 0) return "geometric";
  if (avg <= 4) return "sharp";
  if (avg <= 12) return "slightly-rounded";
  if (avg <= 24) return "rounded";
  return "pill";
}

// ─── Spatial philosophy classifier ───────────────────────────────────────────

function classifySpatialPhilosophy(spatial: Record<string, unknown>): string {
  const padding = (spatial.avgPadding as number) ?? 0;
  const margin = (spatial.avgMargin as number) ?? 0;
  const avg = (padding + margin) / 2;
  if (avg < 8) return "dense";
  if (avg < 16) return "compact";
  if (avg < 32) return "balanced";
  if (avg < 48) return "airy";
  return "expansive";
}

// ─── Color deduplication ──────────────────────────────────────────────────────

function parseRgb(rgb: string): [number, number, number] | null {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(v).toString(16).padStart(2, "0"))
      .join("")
  );
}

function colorDistance(h1: string, h2: string): number {
  const r1 = hexToRgb(h1);
  const r2 = hexToRgb(h2);
  if (!r1 || !r2) return 999;
  return Math.sqrt(
    Math.pow(r1[0] - r2[0], 2) +
      Math.pow(r1[1] - r2[1], 2) +
      Math.pow(r1[2] - r2[2], 2)
  );
}

function dedupeColors(
  rawSamples: Array<{ hex?: string; color?: string; contexts?: string[]; count?: number }>,
  cssVars: Record<string, string>
): ColorSample[] {
  const samples: ColorSample[] = [];

  // Convert raw samples to ColorSample
  for (const s of rawSamples) {
    let hex = s.hex || s.color || "";
    if (!hex) continue;
    if (hex.startsWith("rgb")) {
      const rgb = parseRgb(hex);
      if (!rgb) continue;
      hex = rgbToHex(...rgb);
    }
    if (!hex.startsWith("#") || hex.length !== 7) continue;
    samples.push({
      hex: hex.toLowerCase(),
      contexts: s.contexts ?? [],
      count: s.count ?? 1,
    });
  }

  // Add CSS vars
  for (const [key, val] of Object.entries(cssVars)) {
    if (val && val.startsWith("#") && val.length === 7) {
      samples.push({ hex: val.toLowerCase(), contexts: [`css-var:${key}`], count: 1 });
    }
  }

  // Deduplicate by proximity (threshold 30)
  const deduped: ColorSample[] = [];
  for (const s of samples) {
    const existing = deduped.find((d) => colorDistance(d.hex, s.hex) < 30);
    if (existing) {
      existing.count += s.count;
      existing.contexts.push(...s.contexts);
    } else {
      deduped.push({ ...s });
    }
  }

  // Filter near-white and near-black, sort by count desc
  return deduped
    .filter((c) => {
      const rgb = hexToRgb(c.hex);
      if (!rgb) return false;
      const lum = rgbToLuminance(c.hex);
      return lum > 0.02 && lum < 0.97; // exclude pure black and pure white
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// ─── LLM Classification ───────────────────────────────────────────────────────

interface LlmClassification {
  tone: {
    directness: string;
    formality: string;
    emotionality: string;
    summary: string;
  };
  brandPersonality: string;
  industryContext: string;
  photographyStyle: string;
  photographySubject: string;
  statistics: Array<{ value: string; label: string }>;
  testimonials: Array<{ quote: string; author: string }>;
}

async function llmClassify(raw: Record<string, unknown>): Promise<LlmClassification> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const bodySnippet = (raw.bodySnippet as string) ?? (raw.copyText as string) ?? "";
  const title = (raw.title as string) ?? "";
  const ogTitle = (raw.ogTitle as string) ?? "";
  const ogDesc = (raw.ogDescription as string) ?? "";
  const h1s = ((raw.copyText as Record<string, string[]>)?.h1 ?? []).slice(0, 3).join(" | ");

  const prompt = `You are a brand analyst. Analyze this website data and return a JSON object.

Website: ${raw.url}
Title: ${title}
OG Title: ${ogTitle}
OG Description: ${ogDesc}
H1s: ${h1s}
Body text snippet: ${bodySnippet.slice(0, 1500)}

Return ONLY this JSON object (no markdown, no explanation):
{
  "tone": {
    "directness": "direct|indirect",
    "formality": "formal|casual|professional",
    "emotionality": "emotional|rational|balanced",
    "summary": "2-3 word tone description"
  },
  "brandPersonality": "2-4 word personality archetype",
  "industryContext": "industry/sector in 3-5 words",
  "photographyStyle": "cinematic|documentary|product|lifestyle|abstract|minimal|none",
  "photographySubject": "what the photography focuses on in 3-5 words",
  "statistics": [
    {"value": "the stat number/percentage", "label": "what it measures"}
  ],
  "testimonials": [
    {"quote": "exact quote text", "author": "Name, Title"}
  ]
}

For statistics: extract up to 3 real statistics or metrics the brand uses to prove value. If none found, return [].
For testimonials: extract up to 3 real customer quotes from the body text. If none found, return [].
Return ONLY the JSON object, no other text.`;

  const response = await client.messages.create({
    model: CLASSIFICATION_MODEL,
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const text = (response.content[0] as { text: string }).text.trim();
  // Extract JSON if wrapped in markdown
  const match = text.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : text;
  return JSON.parse(jsonStr) as LlmClassification;
}

// ─── Main classifier ──────────────────────────────────────────────────────────

export async function classifyBrand(raw: Record<string, unknown>): Promise<BrandProfile> {
  const shape = classifyShapeLanguage((raw.borderRadii as string[]) ?? []);
  const spatialClass = classifySpatialPhilosophy((raw.spatial as Record<string, unknown>) ?? {});
  const colors = dedupeColors(
    (raw.colorSamples as ColorSample[]) ?? [],
    (raw.cssVars as Record<string, string>) ?? {}
  );

  const llmData = await llmClassify(raw);

  // Background luminance + logo rendering
  let bgColor: string | null = null;
  for (const c of colors) {
    const ctx = c.contexts.join(" ").toLowerCase();
    if (/background|page/.test(ctx)) {
      bgColor = c.hex;
      break;
    }
  }
  const bgLuminance = bgColor ? rgbToLuminance(bgColor) : 0.5;
  const logoRendering = bgLuminance < 0.5 ? "white" : "dark";

  // Primary and accent colors
  const sortedColors = [...colors].sort(
    (a, b) =>
      saturation(b.hex) * Math.sqrt(b.count) * contextWeight(b.contexts) -
      saturation(a.hex) * Math.sqrt(a.count) * contextWeight(a.contexts)
  );
  const primaryColor = sortedColors[0]?.hex ?? "#000000";
  const accentColor = sortedColors[1]?.hex ?? primaryColor;

  const typo = (raw.typography as Record<string, Record<string, string>>) ?? {};
  const h1Font = typo.h1 ?? {};
  const bodyFont = typo.body ?? {};

  const brandName =
    (raw.brandName as string) ||
    (raw.ogTitle as string) ||
    (raw.title as string) ||
    ((raw.copyText as Record<string, string[]>)?.h1?.[0] ?? "").split(".")[0].trim();

  return {
    meta: {
      url: raw.url as string,
      brandName,
      extractedAt: new Date().toISOString(),
    },
    tone: llmData.tone,
    brandPersonality: llmData.brandPersonality,
    industryContext: llmData.industryContext,
    statistics: llmData.statistics ?? [],
    testimonials: llmData.testimonials ?? [],
    shapeLanguage: {
      classification: shape,
      rawBorderRadii: ((raw.borderRadii as string[]) ?? []).slice(0, 5),
    },
    typography: {
      headline: {
        fontFamily: h1Font.fontFamily ?? "sans-serif",
        fontSize: h1Font.fontSize ?? "48px",
        fontWeight: h1Font.fontWeight ?? "700",
        lineHeight: h1Font.lineHeight ?? "1.1",
        letterSpacing: h1Font.letterSpacing ?? "normal",
        textTransform: h1Font.textTransform ?? "none",
        color: h1Font.color,
      },
      body: {
        fontFamily: bodyFont.fontFamily ?? "sans-serif",
        fontSize: bodyFont.fontSize ?? "16px",
        fontWeight: bodyFont.fontWeight ?? "400",
        lineHeight: bodyFont.lineHeight ?? "1.5",
      },
      cta: (typo.cta as Record<string, string>) ?? {},
    },
    colorPalette: colors,
    primaryColor,
    accentColor,
    backgroundLuminance: Math.round(bgLuminance * 1000) / 1000,
    logoRendering,
    spatialPhilosophy: {
      classification: spatialClass,
      rawSamples: (raw.spatial as Record<string, unknown>) ?? {},
    },
    brandAssets: {
      logoImgs: (raw.logoImgs as string[]) ?? [],
      logoSvgs: (raw.logoSvgs as string[]) ?? [],
      favicon: (raw.favicon as string) ?? "",
      ogImage: (raw.ogImage as string) ?? "",
    },
    photography: {
      style: llmData.photographyStyle,
      subject: llmData.photographySubject,
      sampleImages: ((raw.images as string[]) ?? []).slice(0, 5),
      bgImages: ((raw.bgImages as string[]) ?? []).slice(0, 3),
    },
    cssVars: (raw.cssVars as Record<string, string>) ?? {},
  };
}
