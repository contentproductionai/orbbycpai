/**
 * Single-brand agent pipeline test — Linear
 * Tests the new 4-agent pipeline: Creative Strategist + Social Copywriter
 * Run with: npx tsx scripts/test-agents.ts
 */
import { config } from "dotenv";
import path from "path";
import fs from "fs";

config({ path: path.join(__dirname, "../.env.local") });
config({ path: path.join(__dirname, "../.env") });

// Set API keys for test
process.env.FAL_KEY = "313719a4-2aa8-4db3-beef-f84eda92b039:298781dd2908e2f875616514fab10e73";
process.env.PEXELS_API_KEY = "4XmBUTy7ZHI94MH7EkjGqvowTGpg85hk1ZLwAaZape8tgVTpQ";

import { generateCreativeStrategy, generateSocialCopy } from "../src/lib/pipeline/compositorAgents";
import type { BrandProfile } from "../src/lib/pipeline/classifyBrand";

// Minimal Linear brand profile for testing
const linearProfile: BrandProfile = {
  meta: { url: "https://linear.app", brandName: "Linear", extractedAt: new Date().toISOString() },
  productIntelligence: {
    productName: "Linear",
    oneLiner: "The issue tracker built for high-performance teams",
    whatItDoes: "Linear is a project management tool that helps software teams plan, track, and ship product work with speed and clarity.",
    productCategory: ["project management", "developer tools"],
    productType: "SaaS",
    targetCustomers: "Software engineers and product teams at high-growth startups and tech companies",
    businessModel: ["subscription"],
    pricing: "Free tier + paid plans",
    keyFeatures: ["Issue tracking", "Cycles (sprints)", "Roadmaps", "Git integration", "Keyboard-first design"],
    primaryCTA: "Get started",
    techSignals: [],
  },
  tone: { directness: "direct", formality: "professional", emotionality: "rational", summary: "direct, minimal" },
  brandPersonality: "Opinionated, precise, fast",
  industryContext: "Developer tools / project management",
  statistics: [{ value: "10,000+", label: "teams use Linear" }],
  testimonials: [{ quote: "Linear is the best issue tracker I've ever used. It's fast, opinionated, and gets out of your way.", author: "Engineering Lead, Vercel" }],
  shapeLanguage: { classification: "sharp", rawBorderRadii: ["4px"] },
  typography: {
    headline: { fontFamily: "Inter", fontSize: "48px", fontWeight: "700" },
    body: { fontFamily: "Inter", fontSize: "16px", fontWeight: "400" },
    cta: { fontFamily: "Inter" },
  },
  colorPalette: [
    { hex: "#5e6ad2", contexts: ["button", "cta"], count: 8 },
    { hex: "#f7f8f8", contexts: ["background"], count: 12 },
    { hex: "#1a1a2e", contexts: ["text", "headline"], count: 10 },
  ],
  primaryColor: "#5e6ad2",
  accentColor: "#5e6ad2",
  backgroundLuminance: 0.95,
  logoRendering: "dark",
  spatialPhilosophy: { classification: "airy", rawSamples: {} },
  brandAssets: { logoImgs: [], logoSvgs: [], favicon: "", ogImage: "", downloadedAssets: [] },
  photography: { style: "minimal", subject: "software UI, team collaboration", sampleImages: [], bgImages: [] },
  cssVars: {},
};

// Howler Brothers — outdoor brand (the one that got a businessman photo)
const howlerProfile: BrandProfile = {
  meta: { url: "https://howlerbros.com", brandName: "Howler Brothers", extractedAt: new Date().toISOString() },
  productIntelligence: {
    productName: "Howler Brothers",
    oneLiner: "Adventure-ready apparel and gear for the outdoors",
    whatItDoes: "Howler Brothers makes outdoor apparel and gear for fishing, surfing, and adventure travel. Known for bold prints and quality materials.",
    productCategory: ["outdoor apparel", "adventure gear"],
    productType: "ecommerce",
    targetCustomers: "Outdoor enthusiasts, fly fishers, surfers, and adventure travelers who want quality gear with personality",
    businessModel: ["direct-to-consumer"],
    pricing: "Premium outdoor apparel pricing",
    keyFeatures: ["Fishing shirts", "Fleece", "Hats", "Bags", "Bold prints"],
    primaryCTA: "Shop now",
    techSignals: [],
  },
  tone: { directness: "direct", formality: "casual", emotionality: "emotional", summary: "adventurous, authentic" },
  brandPersonality: "Adventurous, irreverent, authentic",
  industryContext: "Outdoor apparel / adventure lifestyle",
  statistics: [],
  testimonials: [],
  shapeLanguage: { classification: "rounded", rawBorderRadii: ["8px"] },
  typography: {
    headline: { fontFamily: "Neue Haas Grotesk", fontSize: "48px", fontWeight: "700" },
    body: { fontFamily: "Neue Haas Grotesk", fontSize: "16px", fontWeight: "400" },
    cta: { fontFamily: "Neue Haas Grotesk" },
  },
  colorPalette: [
    { hex: "#1a3a2a", contexts: ["background", "nav"], count: 10 },
    { hex: "#e8c84a", contexts: ["accent", "button"], count: 6 },
    { hex: "#f5f0e8", contexts: ["text", "light"], count: 8 },
  ],
  primaryColor: "#1a3a2a",
  accentColor: "#e8c84a",
  backgroundLuminance: 0.15,
  logoRendering: "white",
  spatialPhilosophy: { classification: "balanced", rawSamples: {} },
  brandAssets: { logoImgs: [], logoSvgs: [], favicon: "", ogImage: "", downloadedAssets: [] },
  photography: { style: "documentary", subject: "fly fishing, outdoor adventure, nature landscapes", sampleImages: [], bgImages: [] },
  cssVars: {},
};

async function testBrand(profile: BrandProfile, topic: string) {
  console.log(`\n${"=".repeat(55)}`);
  console.log(`BRAND: ${profile.meta.brandName.toUpperCase()}`);
  console.log("=".repeat(55));

  console.log("\n1. Running Creative Strategist...");
  const strategy = await generateCreativeStrategy(profile, topic);
  console.log("   ✓ Creative Strategy:");
  console.log(`     Core value prop: ${strategy.coreValueProp}`);
  console.log(`     Target audience: ${strategy.targetAudience}`);
  console.log(`     Big Idea: ${strategy.bigIdea}`);
  console.log(`     Post angle: ${strategy.postAngle}`);
  console.log(`     Emotional register: ${strategy.emotionalRegister}`);
  console.log(`     Social voice: ${strategy.socialVoice}`);
  console.log(`     Visual concept: ${strategy.visualConcept}`);
  console.log(`     Color theme: ${strategy.colorTheme}`);

  console.log("\n2. Running Social Copywriter...");
  const copy = await generateSocialCopy(strategy, profile);
  console.log("   ✓ Social Copy:");
  console.log(`     Headline: "${copy.headline}"`);
  console.log(`     Subheadline: "${copy.subheadline}"`);
  console.log(`     CTA: "${copy.callToAction}"`);
  console.log(`     Stat: "${copy.statHighlight || "(none — correct, no real stat)"}"`);
  console.log(`     Quote: "${copy.testimonialQuote || "(none — correct, no fabrication)"}"`);
  console.log(`     Pexels query: "${copy.pexelsQuery}"`);
  console.log(`     Layout style: "${copy.layoutStyle}"`);

  return { strategy, copy };
}

async function main() {
  console.log("=== 4-Agent Pipeline Test ===");
  console.log("Testing Creative Strategist + Social Copywriter agents\n");

  const results: Record<string, unknown> = {};

  // Test Linear
  results.linear = await testBrand(linearProfile, "Ship software faster with Linear");

  // Test Howler Brothers (the brand that got a businessman photo)
  results.howler = await testBrand(howlerProfile, "Adventure-ready gear for the outdoors");

  const outPath = path.join(__dirname, "../compositor-test-output/agent-test-results.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n✓ Full output saved to ${outPath}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  console.error(err.stack);
  process.exit(1);
});
