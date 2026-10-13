import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../lib/ratelimit";

// When UPSTASH_REDIS_REST_URL is not set (test environment), checkRateLimit
// gracefully degrades: always returns true (fail-open).
describe("checkRateLimit — graceful degradation (no Redis)", () => {
  const uid = `wt-a6ccec19-${Date.now()}`;

  it("always allows when Redis is not configured", async () => {
    for (let i = 0; i < 10; i++) {
      expect(await checkRateLimit(`${uid}-key-1`, 5, 60_000)).toBe(true);
    }
  });

  it("different keys both return true without Redis", async () => {
    expect(await checkRateLimit(`${uid}-key-a`, 3, 60_000)).toBe(true);
    expect(await checkRateLimit(`${uid}-key-b`, 3, 60_000)).toBe(true);
  });
});
