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
 * Merges strategy + copy + image direction into one structured brief.
 */
export interface FullCreativeBrief {
  strategy: CreativeStrategy;
  copy: SocialCopy;
  imageDirection?: ImageDirectorResult;
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
    model: "claude-sonnet-4-5",
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
    model: "claude-sonnet-4-5",
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

// ─── Agent 3: Image Director ─────────────────────────────────────────────────

/**
 * ImageDirectorResult — output of the Image Director agent.
 * Decides the image sourcing strategy and writes a Flux generation prompt.
 */
export interface ImageDirectorResult {
  /** Whether to use a brand site image (if available) instead of generating */
  useBrandImage: boolean;
  /** Index into brandProfile.brandAssets.images to use (if useBrandImage is true) */
  brandImageIndex: number;
  /** The Flux generation prompt (used if useBrandImage is false or no brand images exist) */
  fluxPrompt: string;
  /** Pexels fallback query (used only if Flux fails) */
  pexelsQuery: string;
  /** Subject description for segmentation guidance */
  subjectDescription: string;
}

const IMAGE_DIRECTOR_SYSTEM = `You are an Image Director at a world-class social media agency. Your job is to decide what visual will anchor a social media post — and either select an existing brand image or write a precise AI image generation prompt.

You have two options:
1. SELECT a brand image from the brand's own website (preferred when a suitable image exists)
2. GENERATE a new image using Flux AI (when no suitable brand image exists, or when the concept requires something specific)

For SELECTION: choose the image that best matches the creative concept. Prefer lifestyle/product images over abstract graphics. Avoid screenshots, UI mockups, or images with text already on them.

For GENERATION: write a Flux prompt that produces a photorealistic commercial image. Your prompt must:
- Describe the subject, environment, lighting, and composition precisely
- Match the brand's actual visual world (not generic stock photo aesthetics)
- Position the subject to leave space for text overlay (typically right-third or bottom-third)
- Specify color temperature and mood that matches the brand's palette
- Include negative prompts for things to avoid
- Be 2-4 sentences, not a list of keywords

Examples of GOOD Flux prompts:
- "A woman in a teal blazer sits confidently on a throne of stacked paper documents, pointing upward, on a clean lavender studio background. Bright, editorial lighting. Shot from a low angle to convey authority. Leave the left third of frame empty for text."
- "A fly fisherman in waders stands knee-deep in a golden-lit mountain river at dusk, casting a line. The water reflects amber and orange. Shot from behind, wide angle, leaving the upper half of frame as open sky for headline text."
- "A developer's hands on a mechanical keyboard in a dark studio, dual monitors showing clean code in the background, soft blue ambient lighting. Close crop on hands, shallow depth of field."

Examples of BAD Flux prompts:
- "Professional business photo of success" (too generic)
- "outdoor lifestyle adventure" (no subject, no composition)
- "person using software" (no visual specificity)

Output ONLY valid JSON. No markdown. Start with { and end with }.`;

export async function generateImageDirection(
  strategy: CreativeStrategy,
  copy: SocialCopy,
  brandProfile: BrandProfile
): Promise<ImageDirectorResult> {
  const client = new Anthropic();

  // Build a list of available brand images for the agent to choose from
  const brandImages = (brandProfile.brandAssets?.downloadedAssets ?? []).slice(0, 10);
  const brandImageList = brandImages.length > 0
    ? brandImages.map((img, i) => `  [${i}] ${img.alt || "(no alt)"} — ${img.src.slice(0, 80)} (${img.width}x${img.height})`).join("\n")
    : "  (none available)";

  const payload = `CREATIVE BRIEF:
  Brand: ${brandProfile.meta?.brandName ?? "Unknown"}
  Big Idea: ${strategy.bigIdea}
  Visual concept: ${strategy.visualConcept}
  Emotional register: ${strategy.emotionalRegister}
  Color theme: ${strategy.colorTheme}
  Layout style: ${copy.layoutStyle}
  Headline: "${copy.headline}"

BRAND VISUAL IDENTITY:
  Photography style: ${brandProfile.photography?.style ?? ""}
  Photography subjects: ${brandProfile.photography?.subject ?? ""}
  Primary color: ${brandProfile.primaryColor ?? ""}
  Industry: ${brandProfile.industryContext ?? ""}
  Dominant visual type: ${brandProfile.designSignal?.dominantVisualType ?? ""}
  Photography treatment: ${brandProfile.designSignal?.photographyTreatment ?? ""}

AVAILABLE BRAND IMAGES (from their website — prefer these if suitable):
${brandImageList}

---
Decide: should we use an existing brand image, or generate a new one?

Rules:
- Use a brand image (useBrandImage: true) if one of the available images closely matches the visual concept
- Generate (useBrandImage: false) if no brand image fits, or if the concept requires a specific scene not present in brand assets
- For software/SaaS brands: prefer generation for editorial concepts (like Vanta's "person on paper throne") over generic UI screenshots
- For DTC/lifestyle brands: prefer brand images if they show the product in use
- NEVER use a brand image that has text already on it
- NEVER use a brand image that is a UI screenshot or product mockup (for non-software brands)

Output JSON:
{
  "useBrandImage": boolean,
  "brandImageIndex": number (index from the list above, or 0 if useBrandImage is false),
  "fluxPrompt": "string (full generation prompt — required even if useBrandImage is true, as fallback)",
  "pexelsQuery": "${copy.pexelsQuery}",
  "subjectDescription": "string (brief description of the main subject for segmentation)"
}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: IMAGE_DIRECTOR_SYSTEM,
    messages: [{ role: "user", content: payload }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Image Director");

  const cleaned = content.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as ImageDirectorResult;
  } catch (e) {
    // Fallback: generate, don't use brand image
    console.warn(`[ImageDirector] Failed to parse response, using fallback: ${(e as Error).message}`);
    return {
      useBrandImage: false,
      brandImageIndex: 0,
      fluxPrompt: `${strategy.visualConcept}, professional commercial photography, ${strategy.colorTheme === "dark" ? "dark moody lighting" : "bright natural lighting"}, subject positioned right-third of frame with space for text overlay on left`,
      pexelsQuery: copy.pexelsQuery,
      subjectDescription: strategy.visualConcept,
    };
  }
}

// ─── Combined: run all agents and return FullCreativeBrief ────────────────────

export async function generateFullCreativeBrief(
  brandProfile: BrandProfile,
  postTopic: string
): Promise<FullCreativeBrief> {
  // Step 1: Creative Strategist decodes the brand and sets the Big Idea
  const strategy = await generateCreativeStrategy(brandProfile, postTopic);

  // Step 2: Social Copywriter writes copy grounded in the strategy and real brand data
  const copy = await generateSocialCopy(strategy, brandProfile);

  // Step 3: Image Director decides image sourcing strategy and writes Flux prompt
  let imageDirection: ImageDirectorResult | undefined;
  try {
    imageDirection = await generateImageDirection(strategy, copy, brandProfile);
  } catch (e) {
    console.warn(`[ImageDirector] Agent failed, will use Pexels fallback: ${(e as Error).message}`);
  }

  return { strategy, copy, imageDirection };
}

// ─── Agent 0: Topic Generator ─────────────────────────────────────────────────

/**
 * PostTopic — one entry in the 10-topic plan produced by the Topic Generator.
 */
export interface PostTopic {
  /** Short label for this topic, used in logs and filenames */
  label: string;
  /** The post angle this topic targets */
  angle: "brand_awareness" | "product_feature" | "social_proof" | "educational" | "contextual";
  /** The specific creative direction for this post — what story to tell */
  direction: string;
  /** The platform this post is primarily optimised for */
  primaryPlatform: "instagram" | "linkedin" | "facebook" | "twitter";
}

const TOPIC_GENERATOR_SYSTEM = `You are a Social Content Strategist at a world-class creative agency. Your job is to produce a 10-post content plan for a brand — one plan that covers the full strategic spectrum of what a brand needs to say on social media.

Each post must serve a distinct purpose. No two posts should tell the same story. Together, the 10 posts should feel like a complete month of social content: some build brand equity, some drive consideration, some convert.

RULES:
1. Cover all 5 post angles across the 10 posts. Suggested distribution:
   - brand_awareness: 2 posts (emotional connection, brand story)
   - product_feature: 3 posts (specific capabilities, use cases, differentiators)
   - social_proof: 2 posts (results, community, testimonials — only if real data exists)
   - educational: 2 posts (teach something valuable the audience doesn't know)
   - contextual: 1 post (tie brand to a current moment, trend, or cultural context)
2. If no real testimonials exist in the brand data, replace social_proof posts with additional product_feature or educational posts.
3. Each direction must be SPECIFIC to this brand — not generic. Reference real features, real customer types, real use cases from the brand profile.
4. Vary the primary platform across the 10 posts. Not all posts should target Instagram.
5. The label must be 3–5 words, lowercase, suitable for use as a filename slug.

Output ONLY valid JSON array. No markdown. Start with [ and end with ].`;

/**
 * Generate 10 strategically distinct post topics from the brand profile.
 * This runs before any composition begins — it is the editorial plan for the generation.
 */
export async function generatePostTopics(
  brandProfile: BrandProfile
): Promise<PostTopic[]> {
  const client = new Anthropic();

  const pi = brandProfile.productIntelligence ?? {};
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
TONE SUMMARY: ${brandProfile.tone?.summary ?? ""}
REAL STATISTICS (from website — use these, do not invent):
${stats || "none found"}
REAL TESTIMONIALS (from website — use these, do not invent):
${testimonials || "none found"}
---
Produce a 10-post content plan for this brand. Output a JSON array of 10 objects:
[
  {
    "label": "string (3-5 words, lowercase, filename-safe)",
    "angle": "brand_awareness" | "product_feature" | "social_proof" | "educational" | "contextual",
    "direction": "string (specific creative direction for this post — what story to tell, what to show)",
    "primaryPlatform": "instagram" | "linkedin" | "facebook" | "twitter"
  },
  ...
]`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: TOPIC_GENERATOR_SYSTEM,
    messages: [{ role: "user", content: payload }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Topic Generator");

  const cleaned = content.text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    const topics = JSON.parse(cleaned) as PostTopic[];
    if (!Array.isArray(topics) || topics.length === 0) {
      throw new Error("Topic Generator returned empty array");
    }
    // Ensure exactly 10 topics
    return topics.slice(0, 10);
  } catch (e) {
    throw new Error(`Topic Generator returned invalid JSON: ${(e as Error).message}\n\nRaw: ${content.text.slice(0, 500)}`);
  }
}
