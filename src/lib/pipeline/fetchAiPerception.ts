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

// ── Startup diagnostic ────────────────────────────────────────────────────────
// Logged once at module load time so Railway boot logs show whether env vars
// are present before any request is made.
console.log("[fetchAiPerception] startup env check:", {
  OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  OPENAI_KEY: !!process.env.OPENAI_KEY,
  ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
  GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
});

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
 *
 * NOTE: The sentimentScore field intentionally uses a descriptive instruction
 * rather than an example number — models were echoing the example value
 * verbatim, producing identical scores across all companies.
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
  "sentimentScore": <integer from 1 to 5 reflecting your genuine assessment: 1=very negative, 2=negative, 3=neutral, 4=positive, 5=very positive>
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
    console.error("[fetchAiPerception] ChatGPT SKIPPED — OPENAI_API_KEY not set in environment.", {
      availableKeys: Object.keys(process.env).filter((k) => k.includes("OPENAI")),
    });
    return { summary: "OpenAI API key not configured.", sentimentScore: 3, model: "chatgpt" };
  }
  const chatgptModel = "gpt-4o-mini";
  const chatgptUrl = "https://api.openai.com/v1/chat/completions";
  try {
    console.log("[fetchAiPerception] Calling ChatGPT:", { model: chatgptModel, brandName });
    // Always use direct OpenAI endpoint — never the Manus proxy
    const client = new OpenAI({ apiKey, baseURL: "https://api.openai.com/v1" });
    const response = await client.chat.completions.create({
      model: chatgptModel,
      max_tokens: 700,
      temperature: 0.4,
      messages: [{ role: "user", content: PERCEPTION_PROMPT(brandName, url, context) }],
    });
    const text = response.choices[0]?.message?.content?.trim() ?? "";
    console.log("[fetchAiPerception] ChatGPT raw response:", text.slice(0, 200));
    const parsed = parsePerceptionResponse(text);
    console.log("[fetchAiPerception] ChatGPT parsed score:", parsed.sentimentScore);
    return { ...parsed, model: "chatgpt" };
  } catch (err) {
    const error = err as Error;
    console.error("[fetchAiPerception] ChatGPT FAILED:", {
      message: error.message,
      model: chatgptModel,
      url: chatgptUrl,
      stack: error.stack,
    });
    return { summary: "Perception data unavailable.", sentimentScore: 3, model: "chatgpt" };
  }
}

/** Query Claude via Anthropic SDK (direct) */
async function queryAnthropic(brandName: string, url: string, context?: string): Promise<AiPerceptionEntry> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[fetchAiPerception] Claude SKIPPED — ANTHROPIC_API_KEY not set in environment.");
    return { summary: "Anthropic API key not configured.", sentimentScore: 3, model: "claude" };
  }
  const claudeModel = "claude-haiku-4-5-20251001";
  try {
    console.log("[fetchAiPerception] Calling Claude:", { model: claudeModel, brandName });
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: claudeModel,
      max_tokens: 700,
      messages: [{ role: "user", content: PERCEPTION_PROMPT(brandName, url, context) }],
    });
    const text =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    console.log("[fetchAiPerception] Claude raw response:", text.slice(0, 200));
    const parsed = parsePerceptionResponse(text);
    console.log("[fetchAiPerception] Claude parsed score:", parsed.sentimentScore);
    return { ...parsed, model: "claude" };
  } catch (err) {
    const error = err as Error;
    console.error("[fetchAiPerception] Claude FAILED:", {
      message: error.message,
      model: claudeModel,
      stack: error.stack,
    });
    return { summary: "Perception data unavailable.", sentimentScore: 3, model: "claude" };
  }
}

/** Query Gemini via REST API */
async function queryGemini(brandName: string, url: string, context?: string): Promise<AiPerceptionEntry> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[fetchAiPerception] Gemini SKIPPED — GEMINI_API_KEY not set in environment.", {
      availableKeys: Object.keys(process.env).filter((k) => k.includes("GEMINI") || k.includes("GOOGLE")),
    });
    return { summary: "Gemini API key not configured.", sentimentScore: 3, model: "gemini" };
  }
  const geminiModel = "gemini-2.5-pro";
  const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: PERCEPTION_PROMPT(brandName, url, context) }] }],
    generationConfig: { maxOutputTokens: 700, temperature: 0.4 },
  };

  // Retry up to 3 times with exponential backoff — Gemini preview models return
  // HTTP 503 under high demand, which is transient and usually resolves in 1-2s.
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1500;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[fetchAiPerception] Calling Gemini (attempt ${attempt}/${MAX_RETRIES}):`, { model: geminiModel, brandName });
      const res = await fetch(geminiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        const isRetryable = res.status === 503 || res.status === 429;
        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * attempt;
          console.warn(`[fetchAiPerception] Gemini ${res.status} on attempt ${attempt} — retrying in ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new Error(`Gemini HTTP ${res.status}: ${errorBody}`);
      }

      const data = await res.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      console.log("[fetchAiPerception] Gemini raw response:", text.slice(0, 200));
      const parsed = parsePerceptionResponse(text);
      console.log("[fetchAiPerception] Gemini parsed score:", parsed.sentimentScore);
      return { ...parsed, model: "gemini" };

    } catch (err) {
      const error = err as Error;
      if (attempt < MAX_RETRIES && (error.message.includes("503") || error.message.includes("429"))) {
        const delay = BASE_DELAY_MS * attempt;
        console.warn(`[fetchAiPerception] Gemini error on attempt ${attempt} — retrying in ${delay}ms:`, error.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      console.error("[fetchAiPerception] Gemini FAILED after all retries:", {
        message: error.message,
        model: geminiModel,
        url: geminiEndpoint.replace(apiKey, "***"),
        stack: error.stack,
      });
      return { summary: "Perception data unavailable.", sentimentScore: 3, model: "gemini" };
    }
  }

  // Should never reach here, but TypeScript requires a return
  return { summary: "Perception data unavailable.", sentimentScore: 3, model: "gemini" };
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
  console.log("[fetchAiPerception] Starting parallel perception fetch for:", brandName);
  const [openaiResult, anthropicResult, googleResult] = await Promise.all([
    queryOpenAI(brandName, url, context),
    queryAnthropic(brandName, url, context),
    queryGemini(brandName, url, context),
  ]);

  console.log("[fetchAiPerception] All three complete:", {
    chatgpt: openaiResult.sentimentScore,
    claude: anthropicResult.sentimentScore,
    gemini: googleResult.sentimentScore,
  });

  return {
    openai: openaiResult,
    anthropic: anthropicResult,
    google: googleResult,
  };
}
