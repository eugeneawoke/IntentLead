import OpenAI from "openai";
import { logger } from "@/lib/utils/logger";

let _openai: OpenAI | null = null;
export function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// Backwards-compatible named export — lazily initialized via getter
export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return (getOpenAI() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

const RETRY_DELAYS = [1000, 2000, 4000];
const NO_RETRY_CODES = [400, 401, 403, 422];

export async function openaiWithRetry<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number }).status;
      if (status && NO_RETRY_CODES.includes(status)) throw err;
      if (attempt < 3) {
        logger.warn({ context, attempt, status }, "OpenAI retry");
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }
  throw lastError;
}
