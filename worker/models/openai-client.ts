import OpenAI from "openai";
import type { OpenAIResponsesClient } from "./openai-adapter";

export function createOpenAIResponsesClient(apiKey: string): OpenAIResponsesClient {
  if (!apiKey.trim()) throw new Error("OpenAI API key is required");
  return new OpenAI({ apiKey, maxRetries: 0 });
}
