/**
 * Orb AI Perception Module
 * Queries ChatGPT, Claude, and Gemini in parallel to get each model's
 * perception of a company based on its training data.
 *
 * Uses native SDKs/APIs for each provider so it works in Railway production
 * without depending on the Manus proxy.
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export interface AiPerceptionEntry {
  summary: string;
  sentimentScore: number; // 1-5 scale
  model: string;
}

export interface AiPerception {
  openai: AiPerceptionEntry;
  anthropic: AiPerceptionEntry;
  google: AiPerceptionEntry;
}

/**
 * Build the perception prompt. Includes scraped context so models can
 * reason from actual site content rather than just memory.
 */
const PERCEPTION_PROMPT = (brandName: string, url: string, context?: string) => {
  const contextBlock = context
    ? `\n\nHere is content scraped directly from their website to inform your analysis:\n---\n${context.slice(0, 1500)}\n---\n`
    : "";

  return `You are a senior analyst specializing in brand and company intelligence. Analyze how the company "${brandName}" (${url}) is perceived — drawing on both your training data and the website content provided below.${contextBlock}

Provide a substantive analysis covering:
- What this company does and what it is known for
- How it positions itself in its market and who it serves
- Key brand associations, values, and qualities
- How AI systems and the broader market are likely to perceive it
- Overall sentiment and why

Be direct and specific. Do not hedge excessively — make your best assessment based on available evidence.

Return ONLY this JSON object (no markdown, no explanation, no code fences):
{
  "summary": "4-6 sentence analysis covering what the company does, its positioning, key associations, and overall sentiment",
  "sentimentScore": 4
}`;
};

function parsePerceptionResponse(text: string): { summary: string; sentimentScore: number } {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const jsonStr = match ? match[0] : text;
    const parsed = JSON.parse(jsonStr) as { summary: string; sentimentScore: number };
    return {
      summary: parsed.summary || "No perception data available.",
      sentimentScore: Math.min(5, Math.max(1, Math.round(parsed.sentimentScore || 3))),
    };
  } catch {
    return { summary: "Perception data unavailable for this company.", sentimentScore: 3 };
  }
}

/** Query ChatGPT via OpenAI SDK (direct, no proxy) */
async function queryOpenAI(brandName: string, url: string, context?: string): Promise<AiPerceptionEntry> {
  // Support both OPENAI_API_KEY and OPENAI_KEY as fallback
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) {
    console.warn("[fetchAiPerception] OPENAI_API_KEY not set — skipping ChatGPT");
    return { summary: "OpenAI API key not configured.", sentimentScore: 3, model: "chatgpt" };
  }
  try {
    // Always use direct OpenAI endpoint — never the Manus proxy
    const client = new OpenAI({ apiKey, baseURL: "https://api.openai.com/v1" });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 700,
      temperature: 0.4,
      messages: [{ role: "user", content: PERCEPTION_PROMPT(brandName, url, context) }],
    });
    const text = response.choices[0]?.message?.content?.trim() ?? "";
    const parsed = parsePerceptionResponse(text);
    return { ...parsed, model: "chatgpt" };
  } catch (err) {
    console.warn("[fetchAiPerception] OpenAI failed:", (err as Error).message);
    return { summary: "Perception data unavailable.", sentimentScore: 3, model: "chatgpt" };
  }
}

/** Query Claude via Anthropic SDK (direct) */
async function queryAnthropic(brandName: string, url: string, context?: string): Promise<AiPerceptionEntry> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[fetchAiPerception] ANTHROPIC_API_KEY not set — skipping Claude");
    return { summary: "Anthropic API key not configured.", sentimentScore: 3, model: "claude" };
  }
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      messages: [{ role: "user", content: PERCEPTION_PROMPT(brandName, url, context) }],
    });
    const text =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    const parsed = parsePerceptionResponse(text);
    return { ...parsed, model: "claude" };
  } catch (err) {
    console.warn("[fetchAiPerception] Anthropic failed:", (err as Error).message);
    return { summary: "Perception data unavailable.", sentimentScore: 3, model: "claude" };
  }
}

/** Query Gemini via REST API */
async function queryGemini(brandName: string, url: string, context?: string): Promise<AiPerceptionEntry> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[fetchAiPerception] GEMINI_API_KEY not set — skipping Gemini");
    return { summary: "Gemini API key not configured.", sentimentScore: 3, model: "gemini" };
  }
  try {
    // gemini-3-flash-preview is the current working model for this key
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [{ text: PERCEPTION_PROMPT(brandName, url, context) }] }],
      generationConfig: { maxOutputTokens: 700, temperature: 0.4 },
    };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    const parsed = parsePerceptionResponse(text);
    return { ...parsed, model: "gemini" };
  } catch (err) {
    console.warn("[fetchAiPerception] Gemini failed:", (err as Error).message);
    return { summary: "Perception data unavailable.", sentimentScore: 3, model: "gemini" };
  }
}

/**
 * Fetch AI perception from all three LLM families in parallel.
 * Pass optional scraped context (page copy) to ground the analysis.
 * Each provider uses its own native SDK/API — gracefully degrades if a key is missing.
 */
export async function fetchAiPerception(
  brandName: string,
  url: string,
  context?: string
): Promise<AiPerception> {
  const [openaiResult, anthropicResult, googleResult] = await Promise.all([
    queryOpenAI(brandName, url, context),
    queryAnthropic(brandName, url, context),
    queryGemini(brandName, url, context),
  ]);

  return {
    openai: openaiResult,
    anthropic: anthropicResult,
    google: googleResult,
  };
}
