import OpenAI from "openai";
import type { IntentType } from "../../types/lead";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CLASSIFY_SYSTEM = `You are an intent classifier for B2B sales signals.
Analyze the provided text and return a JSON object with:
- score: integer 0-100 representing buying intent confidence
- intentType: one of "pain", "recommendation_request", "comparison", "hiring"

Score guide:
- 90-100: Explicit pain + actively seeking solution
- 80-89: Clear pain or recommendation request
- 60-79: Possible pain, unclear fit
- 0-59: Low signal, no clear intent

Return ONLY valid JSON. No explanation.`;

export interface ClassifyResult {
  score: number;
  intentType: IntentType | null;
}

const VALID_INTENT_TYPES: IntentType[] = ["pain", "recommendation_request", "comparison", "hiring"];

export async function classifySignal(content: string, context: string | null): Promise<ClassifyResult> {
  // Signal content is user data — goes in role:'user', NOT system
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: CLASSIFY_SYSTEM },
      { role: "user", content: `Signal content:\n${content}\n\nContext: ${context ?? "unknown"}` },
    ],
    response_format: { type: "json_object" },
    max_tokens: 100,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { score?: number; intentType?: string };
    return {
      score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, parsed.score)) : 0,
      intentType: (VALID_INTENT_TYPES.includes(parsed.intentType as IntentType)
        ? parsed.intentType
        : null) as IntentType | null,
    };
  } catch {
    return { score: 0, intentType: null };
  }
}
