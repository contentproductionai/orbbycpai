/**
 * compositorAgents.ts
 *
 * Four dedicated pipeline agents for social content generation:
 *
 *  1. Creative Strategist  — decodes brand DNA, identifies Big Idea, sets post angle
 *  2. Social Copywriter    — writes social-first copy grounded in real brand data
 *  3. Art Director         — executes spatial composition from copy + design signal
 *  4. (Performance Designer is the existing renderer — no changes needed)
 *
 * These replace the monolithic generateCreativeBrief() in compositorGenerate.ts.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { BrandProfile } from "./classifyBrand";

// ─── Shared Types ─────────────────────────────────────────────────────────────

/**
 * CreativeStrategy — output of the Creative Strategist agent.
 * Answers the "why" before any copy or design work begins.
 */
export interface CreativeStrategy {
  /** The core value proposition in one sentence — what this brand uniquely delivers */
  coreValueProp: string;
  /** The specific audience segment this post targets */
  targetAudience: string;
  /** The primary pain point or desire this post addresses */
  painPoint: string;
  /** The Big Idea — the single creative concept that drives this post */
  bigIdea: string;
  /** The post angle: "brand_awareness" | "product_feature" | "social_proof" | "educational" | "contextual" */
  postAngle: "brand_awareness" | "product_feature" | "social_proof" | "educational" | "contextual";
  /** The emotional register: what the audience should feel after seeing this */
  emotionalRegister: string;
  /** The brand's social voice — how they actually communicate, not how they could */
  socialVoice: string;
  /** Visual concept — what the imagery needs to communicate (not a Pexels query yet) */
  visualConcept: string;
  /** Color theme decision based on brand's social content, not just website */
  colorTheme: "light" | "dark";
}

/**
 * SocialCopy — output of the Social Copywriter agent.
 * All copy is grounded in real brand data. Nothing fabricated.
 */
export interface SocialCopy {
  /** The primary headline — social-first, stops the scroll */
  headline: string;
  /** Supporting line — optional, adds context without repeating the headline */
  subheadline: string;
  /** CTA text — action-oriented, brand-appropriate */
  callToAction: string;
  /** A real statistic from the brand profile (empty string if none available) */
  statHighlight: string;
  /** A real testimonial quote from the brand profile (empty string if none available) */
  testimonialQuote: string;
  /** Attribution for the testimonial (empty string if no testimonial) */
  testimonialAuthor: string;
  /** The Pexels search query — precise 3-5 words matching brand's actual photography */
  pexelsQuery: string;
  /** Layout style recommendation for the Art Director */
  layoutStyle: string;
}

/**
 * FullCreativeBrief — the combined output passed to the Art Director.
 * Merges strategy + copy into one structured brief.
 */
export interface FullCreativeBrief {
  strategy: CreativeStrategy;
  copy: SocialCopy;
}

// ─── Agent 1: Creative Strategist ────────────────────────────────────────────

const CREATIVE_STRATEGIST_SYSTEM = `You are a senior creative strategist at a world-class social media agency.

Your job is NOT to write copy or design anything. Your job is to decode the brand's DNA and identify the Big Idea that will drive a single social media post.

You answer four questions before any creative work begins:
1. What does this brand uniquely deliver that no competitor does?
2. Who specifically is this post speaking to, and what do they want or fear?
3. What is the single most compelling creative angle for this post?
4. What emotional state should the audience be in after seeing this?

You are trained to distinguish between what a brand SAYS about itself and what it MEANS to its customers. The Big Idea lives in that gap.

For postAngle, choose the most appropriate:
- "brand_awareness": building recognition and emotional connection
- "product_feature": showcasing a specific capability or benefit
- "social_proof": leveraging results, testimonials, or community size
- "educational": teaching something valuable the audience doesn't know
- "contextual": tying the brand to a current moment, trend, or cultural event

For colorTheme: weight the brand's photography style, personality, and industry over the website background color. A brand with moody photography and a dark personality should be "dark" even if their website is white.

For socialVoice: describe HOW this brand communicates on social — their sentence structure, vocabulary level, use of humor or authority, length of posts. Be specific. "Professional but approachable" is not specific. "Short declarative sentences, no jargon, occasional dry wit, never uses exclamation points" is specific.

Output ONLY valid JSON. No markdown. Start with { and end with }.`;

export async function generateCreativeStrategy(
  brandProfile: BrandProfile,
  postTopic: string
): Promise<CreativeStrategy> {
  const client = new Anthropic();

  const pi = brandProfile.productIntelligence ?? {};
  const tone = brandProfile.tone ?? {};
  const stats = (brandProfile.statistics ?? [])
    .map((s) => `${s.value} ${s.label}`)
    .join(", ");
  const testimonials = (brandProfile.testimonials ?? [])
    .slice(0, 3)
    .map((t) => `"${t.quote}" — ${t.author}`)
    .join("\n");

  const payload = `BRAND: ${brandProfile.meta?.brandName ?? "Unknown"}
URL: ${brandProfile.meta?.url ?? ""}
INDUSTRY: ${brandProfile.industryContext ?? ""}
BRAND PERSONALITY: ${brandProfile.brandPersonality ?? ""}

PRODUCT INTELLIGENCE:
  One-liner: ${pi.oneLiner ?? ""}
  What it does: ${pi.whatItDoes ?? ""}
  Target customers: ${pi.targetCustomers ?? ""}
  Key features: ${(pi.keyFeatures ?? []).join(", ")}
  Primary CTA on site: ${pi.primaryCTA ?? ""}

TONE:
  Directness: ${tone.directness ?? ""}
  Formality: ${tone.formality ?? ""}
  Emotionality: ${tone.emotionality ?? ""}
  Summary: ${tone.summary ?? ""}

REAL STATISTICS (from website — use these, do not invent):
${stats || "none found"}

REAL TESTIMONIALS (from website — use these, do not invent):
${testimonials || "none found"}

VISUAL IDENTITY:
  Photography style: ${brandProfile.photography?.style ?? ""}
  Photography subjects: ${brandProfile.photography?.subject ?? ""}
  Background luminance: ${(brandProfile.backgroundLuminance ?? 0.5) > 0.5 ? "light" : "dark"}
  Shape language: ${brandProfile.shapeLanguage?.classification ?? ""}

POST TOPIC: ${postTopic}

---
Based on all of the above, output a creative strategy JSON:
{
  "coreValueProp": "string",
  "targetAudience": "string",
  "painPoint": "string",
  "bigIdea": "string",
  "postAngle": "brand_awareness" | "product_feature" | "social_proof" | "educational" | "contextual",
  "emotionalRegister": "string",
  "socialVoice": "string",
  "visualConcept": "string",
  "colorTheme": "light" | "dark"
}`;

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    system: CREATIVE_STRATEGIST_SYSTEM,
    messages: [{ role: "user", content: payload }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Creative Strategist");

  const cleaned = content.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as CreativeStrategy;
  } catch (e) {
    throw new Error(`Creative Strategist returned invalid JSON: ${(e as Error).message}\n\nRaw: ${content.text.slice(0, 500)}`);
  }
}

// ─── Agent 2: Social Copywriter ───────────────────────────────────────────────

const SOCIAL_COPYWRITER_SYSTEM = `You are a social media copywriter trained in Direct-Response and Social-First Copy.

Your job is to write copy that stops the scroll in the first 3 seconds. You are NOT writing ad copy. You are writing editorial, contextual, conversational content that earns attention.

You are trained on AIDA (Attention, Interest, Desire, Action) and PAS (Problem, Agitate, Solution) frameworks. You know when to use each.

CRITICAL RULES:
1. Every piece of copy must be grounded in the brand's REAL voice and REAL data. Do not invent statistics, testimonials, or claims.
2. If no real testimonial exists in the brand data, set testimonialQuote and testimonialAuthor to empty strings. Do NOT fabricate a quote.
3. If no real statistic exists in the brand data, set statHighlight to an empty string. Do NOT fabricate a number.
4. The headline must stop the scroll. It should be short (under 8 words ideally), specific, and emotionally resonant.
5. The subheadline adds context — it does NOT repeat the headline. It can be empty if the headline stands alone.
6. The CTA must be action-oriented and brand-appropriate. "Learn more" is weak. "Start free" or "Get the guide" is strong.
7. Write in the brand's actual social voice — the tone, vocabulary, and sentence structure described in the creative strategy.
8. Social content is editorial, not promotional. It earns attention rather than demanding it.

For pexelsQuery: write a precise 3-5 word query that describes the EXACT type of photo this brand would use on their own social feed.
- Match the subject matter AND the visual treatment (lighting, color temperature, composition style)
- Examples: "author writing desk warm", "fly fishing river golden hour", "startup team whiteboard", "chef plating restaurant kitchen"
- Never use generic mood words: "success", "motivation", "professional", "lifestyle" are all wrong
- CRITICAL — Brand type determines photo type:
  * Software/SaaS/Tech brands (B2B software, developer tools, cybersecurity, project management): query must target UI screenshots, people at computers, abstract tech, or team collaboration — NEVER physical environments, nature, or consumer lifestyle
  * DTC/Consumer brands (apparel, food, outdoor gear, beauty, home goods): query must target product photography, lifestyle shots with the product, or people using the product in its natural context
  * Professional services (consulting, finance, legal): query must target business environments, professional people, or relevant work contexts
  * The dominantVisualType from the brand's design signal tells you what they actually show — use it

For layoutStyle: recommend one of these based on the copy and brand:
- "bold typographic" — headline dominates, minimal imagery, strong type hierarchy
- "full-bleed portrait" — hero photo fills canvas, text overlaid with contrast treatment
- "editorial split" — image on one side, copy on the other
- "product showcase" — product/UI in foreground, copy supporting
- "quote card" — testimonial or stat as the hero element

Output ONLY valid JSON. No markdown. Start with { and end with }.`;

export async function generateSocialCopy(
  strategy: CreativeStrategy,
  brandProfile: BrandProfile
): Promise<SocialCopy> {
  const client = new Anthropic();

  const stats = (brandProfile.statistics ?? [])
    .map((s) => `${s.value} ${s.label}`)
    .join(", ");
  const testimonials = (brandProfile.testimonials ?? [])
    .slice(0, 3)
    .map((t) => `"${t.quote}" — ${t.author}`)
    .join("\n");

  const payload = `CREATIVE STRATEGY:
  Brand: ${brandProfile.meta?.brandName ?? "Unknown"}
  Core value prop: ${strategy.coreValueProp}
  Target audience: ${strategy.targetAudience}
  Pain point: ${strategy.painPoint}
  Big Idea: ${strategy.bigIdea}
  Post angle: ${strategy.postAngle}
  Emotional register: ${strategy.emotionalRegister}
  Social voice: ${strategy.socialVoice}
  Visual concept: ${strategy.visualConcept}
  Color theme: ${strategy.colorTheme}

REAL STATISTICS (only use these — do not invent):
${stats || "none"}

REAL TESTIMONIALS (only use these — do not invent):
${testimonials || "none"}

BRAND VISUAL IDENTITY:
  Photography style: ${brandProfile.photography?.style ?? ""}
  Photography subjects: ${brandProfile.photography?.subject ?? ""}
  Primary color: ${brandProfile.primaryColor ?? ""}
  Accent color: ${brandProfile.accentColor ?? ""}
  Industry: ${brandProfile.industryContext ?? ""}
  Dominant visual type: ${brandProfile.designSignal?.dominantVisualType ?? ""}
  Photography treatment: ${brandProfile.designSignal?.photographyTreatment ?? ""}

---
Write social copy for this post. Output JSON:
{
  "headline": "string",
  "subheadline": "string",
  "callToAction": "string",
  "statHighlight": "string (empty if no real stat available)",
  "testimonialQuote": "string (empty if no real testimonial available)",
  "testimonialAuthor": "string (empty if no testimonial)",
  "pexelsQuery": "string",
  "layoutStyle": "string"
}`;

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    system: SOCIAL_COPYWRITER_SYSTEM,
    messages: [{ role: "user", content: payload }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Social Copywriter");

  const cleaned = content.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as SocialCopy;
  } catch (e) {
    throw new Error(`Social Copywriter returned invalid JSON: ${(e as Error).message}\n\nRaw: ${content.text.slice(0, 500)}`);
  }
}

// ─── Combined: run both agents and return FullCreativeBrief ───────────────────

export async function generateFullCreativeBrief(
  brandProfile: BrandProfile,
  postTopic: string
): Promise<FullCreativeBrief> {
  // Step 1: Creative Strategist decodes the brand and sets the Big Idea
  const strategy = await generateCreativeStrategy(brandProfile, postTopic);

  // Step 2: Social Copywriter writes copy grounded in the strategy and real brand data
  const copy = await generateSocialCopy(strategy, brandProfile);

  return { strategy, copy };
}
