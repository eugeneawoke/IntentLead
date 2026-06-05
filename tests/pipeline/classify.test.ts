import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

describe("classifySignal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns score < 80 for low intent content", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ score: 45, intentType: "pain" }) } }],
    });

    const { classifySignal } = await import("@/worker/pipeline/classify");
    const result = await classifySignal("general post about technology", null);
    expect(result.score).toBe(45);
    expect(result.score).toBeLessThan(80);
  });

  it("returns score >= 80 for high intent signal", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ score: 92, intentType: "pain" }) } }],
    });

    const { classifySignal } = await import("@/worker/pipeline/classify");
    const result = await classifySignal("our conversion rate dropped 40%, desperately need CRO help", "SaaS");
    expect(result.score).toBe(92);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.intentType).toBe("pain");
  });

  it("handles malformed JSON from OpenAI gracefully", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "not valid json{{{" } }],
    });

    const { classifySignal } = await import("@/worker/pipeline/classify");
    const result = await classifySignal("some content", null);
    expect(result.score).toBe(0);
    expect(result.intentType).toBeNull();
  });

  it("clamps score between 0 and 100", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ score: 150, intentType: "pain" }) } }],
    });

    const { classifySignal } = await import("@/worker/pipeline/classify");
    const result = await classifySignal("test", null);
    expect(result.score).toBe(100); // clamped
  });
});
