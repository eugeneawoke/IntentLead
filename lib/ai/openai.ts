import OpenAI from "openai";
import { logger } from "@/lib/utils/logger";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const RETRY_DELAYS = [1000, 2000, 4000];
const NO_RETRY_CODES = [400, 401, 403, 422];

export async function openaiWithRetry<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number }).status;
      if (status && NO_RETRY_CODES.includes(status)) throw err;
      if (attempt < RETRY_DELAYS.length) {
        logger.warn({ context, attempt, status }, "OpenAI retry");
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }
  throw lastError;
}
