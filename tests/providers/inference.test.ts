import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { marketProfile } from "../domain/contract-fixtures";
import { COMPANY_INFERENCE_SYSTEM_INSTRUCTION, createCompanyInferenceAdapter } from "../../worker/providers/inference";
import type { CompanyInferenceCompletion, CompanyInferenceInput, ProviderCallContext, ProviderDescriptor } from "../../worker/providers/contracts";
import { ProviderHttpError } from "../../worker/providers/http";
import { fakeResponse, makeDependencies, providerDescriptor } from "./helpers";

const profile = MarketProfileSchema.parse({
  ...marketProfile,
  capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "HUMAN_REVIEW"],
});
const openaiDescriptor = providerDescriptor("openai" as ProviderDescriptor["id"], "COMPANY_RESOLUTION", {
  configuredCost: { amount: 0.05, currency: "USD" },
});
const context = (signal: AbortSignal = new AbortController().signal): ProviderCallContext => ({
  profile,
  traceId: "inference-fixture",
  signal,
  reserveProvider(descriptor) { return { descriptor, reservedCost: descriptor.configuredCost.amount ?? 0 }; },
});
const inferenceInput: CompanyInferenceInput = {
  messages: [
    { role: "system", content: COMPANY_INFERENCE_SYSTEM_INSTRUCTION },
    { role: "user", content: "Sanitized fictional company signal" },
  ],
};
const completion = (content: unknown = { candidates: [] }): CompanyInferenceCompletion => ({
  content,
  inputTokens: 17,
  outputTokens: 8,
});

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("global network access is forbidden in provider tests"); })));
afterEach(() => vi.unstubAllGlobals());

describe("typed company-inference provider boundary", () => {
  it("records inference independently with its own provider id, configured reserve, actual cost and token usage", async () => {
    const { dependencies, started, finished } = makeDependencies(async () => fakeResponse({}));
    let observedSignal: AbortSignal | undefined;
    let observedInput: CompanyInferenceInput | undefined;
    const provider = createCompanyInferenceAdapter({
      descriptor: openaiDescriptor,
      dependencies,
      async complete(input, signal) {
        observedInput = input;
        observedSignal = signal;
        return completion();
      },
    });

    const result = await provider.infer(inferenceInput, context());

    expect(result.status).toBe("EMPTY");
    expect(result.provider).toBe("openai");
    expect(result.usage).toMatchObject({ requestCount: 1, inputTokens: 17, outputTokens: 8 });
    expect(result.cost).toEqual({ configuredAmount: 0.05, reservedAmount: 0.05, actualAmount: null, currency: "USD" });
    expect(observedInput).toEqual(inferenceInput);
    expect(observedSignal).toBeInstanceOf(AbortSignal);
    expect(started.map(event => event.provider)).toEqual(["openai"]);
    expect(finished.map(event => event.providerRunId)).toEqual([result.providerRunId]);
  });

  it("redacts contact-like PII again at the model boundary, even for a direct typed invocation", async () => {
    const { dependencies } = makeDependencies(async () => fakeResponse({}));
    let sentText = "";
    const provider = createCompanyInferenceAdapter({
      descriptor: openaiDescriptor,
      dependencies,
      async complete(input) {
        sentText = input.messages[1].content;
        return completion();
      },
    });
    const directInput: CompanyInferenceInput = {
      messages: [
        { role: "system", content: COMPANY_INFERENCE_SYSTEM_INSTRUCTION },
        { role: "user", content: "Acme needs customer intake help. Call +1 (415) 555-0199, email jane@example.test, @jane_ops or https://acme.example.com/team." },
      ],
    };

    await provider.infer(directInput, context());
    expect(sentText).toContain("Acme needs customer intake help");
    expect(sentText).not.toMatch(/415|jane@example\.test|@jane_ops|https:\/\/acme\.example\.com/i);
  });

  it.each([
    [new ProviderHttpError("UNAUTHORIZED", 401), "FAILED", "UNAUTHORIZED", "FORBIDDEN"],
    [new ProviderHttpError("RATE_LIMITED", 429, 1_500), "RATE_LIMITED", "RATE_LIMITED", "RATE_LIMITED"],
    [new ProviderHttpError("UNAVAILABLE", 503), "FAILED", "UNAVAILABLE", "DEPENDENCY_UNAVAILABLE"],
  ] as const)("maps injected provider failure %s to a typed inference outcome", async (error, status, kind, code) => {
    const { dependencies, finished } = makeDependencies(async () => fakeResponse({}));
    const provider = createCompanyInferenceAdapter({
      descriptor: openaiDescriptor,
      dependencies,
      async complete() { throw error; },
    });

    const result = await provider.infer(inferenceInput, context());
    expect(result.status).toBe(status);
    expect(result.failureKind).toBe(kind);
    expect(result.capabilityError?.code).toBe(code);
    expect(finished).toHaveLength(1);
  });

  it("bounds model deadlines, aborts the injected request, and records TIMEOUT", async () => {
    const { dependencies, finished } = makeDependencies(async () => fakeResponse({}), { timeoutMs: 5 });
    let requestSignal: AbortSignal | undefined;
    const provider = createCompanyInferenceAdapter({
      descriptor: openaiDescriptor,
      dependencies,
      complete(_input, signal) {
        requestSignal = signal;
        return new Promise<CompanyInferenceCompletion>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
    });

    const result = await provider.infer(inferenceInput, context());
    expect(result.status).toBe("TIMEOUT");
    expect(result.capabilityError?.code).toBe("TIMEOUT");
    expect(requestSignal?.aborted).toBe(true);
    expect(finished[0]?.responseMetadata.failureKind).toBe("TIMEOUT");
  });

  it("maps malformed model output without returning it as a candidate", async () => {
    const { dependencies, finished } = makeDependencies(async () => fakeResponse({}));
    const provider = createCompanyInferenceAdapter({
      descriptor: openaiDescriptor,
      dependencies,
      async complete() { return completion({ candidates: [{ companyName: "unsupported extra", email: "person@example.test" }] }); },
    });

    const result = await provider.infer(inferenceInput, context());
    expect(result.status).toBe("FAILED");
    expect(result.failureKind).toBe("MALFORMED_RESPONSE");
    expect(result.value).toBeNull();
    expect(finished[0]?.responseMetadata.failureKind).toBe("MALFORMED_RESPONSE");
  });

  it("propagates cancellation to the injected model call and records a terminal run", async () => {
    const { dependencies, finished } = makeDependencies(async () => fakeResponse({}), { timeoutMs: 100 });
    const controller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const provider = createCompanyInferenceAdapter({
      descriptor: openaiDescriptor,
      dependencies,
      complete(_input, signal) {
        requestSignal = signal;
        return new Promise<CompanyInferenceCompletion>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
    });
    const running = provider.infer(inferenceInput, context(controller.signal));
    await new Promise(resolve => setTimeout(resolve, 0));
    controller.abort(new Error("fixture cancellation"));

    await expect(running).rejects.toMatchObject({ kind: "CANCELLED" });
    expect(requestSignal?.aborted).toBe(true);
    expect(finished[0]?.responseMetadata.failureKind).toBe("CANCELLED");
  });
});
