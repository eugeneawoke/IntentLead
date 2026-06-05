import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/ratelimit";

describe("checkRateLimit", () => {
  it("allows requests within limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("test-key-1", 5, 60_000)).toBe(true);
    }
  });

  it("blocks when limit exceeded", () => {
    const key = "test-key-2";
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000);
    expect(checkRateLimit(key, 5, 60_000)).toBe(false);
  });

  it("different keys are independent", () => {
    for (let i = 0; i < 10; i++) checkRateLimit("key-a-3", 3, 60_000);
    expect(checkRateLimit("key-b-3", 3, 60_000)).toBe(true);
  });
});
