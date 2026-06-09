/**
 * Distributed rate limiter via Upstash Redis.
 * Gracefully degrades to allow-all if UPSTASH_REDIS_REST_URL is not configured.
 *
 * Required env vars (add to Vercel + .env.local):
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Cache limiter instances per (limit, window) combination
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Redis not configured — rate limiting disabled. Add env vars to enable.
    return null;
  }
  const cacheKey = `${limit}:${windowMs}`;
  if (!limiterCache.has(cacheKey)) {
    const windowSeconds = Math.ceil(windowMs / 1000);
    limiterCache.set(
      cacheKey,
      new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
        prefix: "il_rl",
        analytics: false,
      })
    );
  }
  return limiterCache.get(cacheKey)!;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const limiter = getLimiter(limit, windowMs);
  if (!limiter) return true; // graceful degradation

  try {
    const { success } = await limiter.limit(key);
    return success;
  } catch {
    // Redis error — fail open (allow request), log warning
    console.warn("[ratelimit] Redis error, allowing request");
    return true;
  }
}
