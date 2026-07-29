/**
 * Orb AI Perception Module
 * Queries GPT-4o mini, Claude Haiku, and Gemini Flash in parallel to get
 * each model's perception of a brand based on its training data.
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

const PERCEPTION_PROMPT = (brandName: string, url: string) =>
  `You are analyzing how the brand "${brandName}" (${url}) is perceived in the market.

Based on your training data and knowledge, provide:
1. A 2-3 sentence summary of how this brand is perceived — its reputation, positioning, and what it's known for.
2. A sentiment score from 1-5 where: 1=very negative, 2=negative, 3=neutral, 4=positive, 5=very positive.

If you have limited knowledge of this brand, base your assessment on what you can infer from the URL and any context available.

Return ONLY this JSON (no markdown, no explanation):
{
  "summary": "2-3 sentence brand perception summary",
  "sentimentScore": 4
}`;

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
    return { summary: "Perception data unavailable for this brand.", sentimentScore: 3 };
  }
}

/** Query GPT-4o mini via OpenAI SDK (direct, no proxy) */
async function queryOpenAI(brandName: string, url: string): Promise<AiPerceptionEntry> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[fetchAiPerception] OPENAI_API_KEY not set — skipping GPT");
    return { summary: "OpenAI API key not configured.", sentimentScore: 3, model: "gpt-4o-mini" };
  }
  try {
    // Use direct OpenAI endpoint — explicitly no baseURL override
    const client = new OpenAI({ apiKey, baseURL: "https://api.openai.com/v1" });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      temperature: 0.3,
      messages: [{ role: "user", content: PERCEPTION_PROMPT(brandName, url) }],
    });
    const text = response.choices[0]?.message?.content?.trim() ?? "";
    const parsed = parsePerceptionResponse(text);
    return { ...parsed, model: "gpt-4o-mini" };
  } catch (err) {
    console.warn("[fetchAiPerception] OpenAI failed:", (err as Error).message);
    return { summary: "Perception data unavailable.", sentimentScore: 3, model: "gpt-4o-mini" };
  }
}

/** Query Claude Haiku via Anthropic SDK (direct) */
async function queryAnthropic(brandName: string, url: string): Promise<AiPerceptionEntry> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[fetchAiPerception] ANTHROPIC_API_KEY not set — skipping Claude");
    return { summary: "Anthropic API key not configured.", sentimentScore: 3, model: "claude-haiku-4-5" };
  }
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: PERCEPTION_PROMPT(brandName, url) }],
    });
    const text =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    const parsed = parsePerceptionResponse(text);
    return { ...parsed, model: "claude-haiku-4-5" };
  } catch (err) {
    console.warn("[fetchAiPerception] Anthropic failed:", (err as Error).message);
    return { summary: "Perception data unavailable.", sentimentScore: 3, model: "claude-haiku-4-5" };
  }
}

/** Query Gemini 2.0 Flash via REST API */
async function queryGemini(brandName: string, url: string): Promise<AiPerceptionEntry> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[fetchAiPerception] GEMINI_API_KEY not set — skipping Gemini");
    return { summary: "Gemini API key not configured.", sentimentScore: 3, model: "gemini-2.0-flash" };
  }
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [{ text: PERCEPTION_PROMPT(brandName, url) }] }],
      generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
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
    return { ...parsed, model: "gemini-2.0-flash" };
  } catch (err) {
    console.warn("[fetchAiPerception] Gemini failed:", (err as Error).message);
    return { summary: "Perception data unavailable.", sentimentScore: 3, model: "gemini-2.0-flash" };
  }
}

/**
 * Fetch AI perception from all three LLM families in parallel.
 * Each provider uses its own native SDK/API — gracefully degrades if a key is missing.
 */
export async function fetchAiPerception(
  brandName: string,
  url: string
): Promise<AiPerception> {
  const [openaiResult, anthropicResult, googleResult] = await Promise.all([
    queryOpenAI(brandName, url),
    queryAnthropic(brandName, url),
    queryGemini(brandName, url),
  ]);

  return {
    openai: openaiResult,
    anthropic: anthropicResult,
    google: googleResult,
  };
}
