/**
 * Orb AI Perception Module
 * Queries GPT-5 mini, Claude Haiku, and Gemini Flash in parallel to get
 * each model's perception of a brand based on its training data.
 * Returns a structured AiPerception object with summaries and sentiment scores.
 */

import OpenAI from "openai";

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

const PERCEPTION_PROMPT = (brandName: string, url: string) => `You are analyzing how the brand "${brandName}" (${url}) is perceived in the market.

Based on your training data and knowledge, provide:
1. A 2-3 sentence summary of how this brand is perceived — its reputation, positioning, and what it's known for.
2. A sentiment score from 1-5 where: 1=very negative, 2=negative, 3=neutral, 4=positive, 5=very positive.

If you have limited knowledge of this brand, base your assessment on what you can infer from the URL and any context available.

Return ONLY this JSON (no markdown, no explanation):
{
  "summary": "2-3 sentence brand perception summary",
  "sentimentScore": 4
}`;

/**
 * Fetch AI perception from all three LLM families in parallel.
 * Uses the Manus OpenAI-compatible proxy which routes to each provider.
 */
export async function fetchAiPerception(
  brandName: string,
  url: string
): Promise<AiPerception> {
  // All three models are available via the Manus OpenAI-compatible proxy
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE,
  });

  const prompt = PERCEPTION_PROMPT(brandName, url);

  async function queryModel(
    model: string,
    label: "openai" | "anthropic" | "google"
  ): Promise<AiPerceptionEntry> {
    try {
      const response = await client.chat.completions.create({
        model,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const text = response.choices[0]?.message?.content?.trim() ?? "";
      const match = text.match(/\{[\s\S]*\}/);
      const jsonStr = match ? match[0] : text;

      const parsed = JSON.parse(jsonStr) as { summary: string; sentimentScore: number };
      return {
        summary: parsed.summary || "No perception data available.",
        sentimentScore: Math.min(5, Math.max(1, Math.round(parsed.sentimentScore || 3))),
        model,
      };
    } catch (err) {
      console.warn(`[fetchAiPerception] ${label} (${model}) failed:`, (err as Error).message);
      return {
        summary: "Perception data unavailable for this brand.",
        sentimentScore: 3,
        model,
      };
    }
  }

  // Fire all three in parallel
  const [openaiResult, anthropicResult, googleResult] = await Promise.all([
    queryModel("gpt-5-mini", "openai"),
    queryModel("claude-haiku-4-5", "anthropic"),
    queryModel("gemini-3-flash-preview", "google"),
  ]);

  return {
    openai: openaiResult,
    anthropic: anthropicResult,
    google: googleResult,
  };
}
