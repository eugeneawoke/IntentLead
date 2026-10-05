import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { marketProfile } from "../domain/contract-fixtures";
import { COMPANY_INFERENCE_SYSTEM_INSTRUCTION, createCompanyInferenceAdapter } from "../../worker/providers/inference";
import { ProviderHttpError } from "../../worker/providers/http";
import { executeProviderWithFallback } from "../../worker/providers/registry";
import type { CompanyInferenceCompletion, CompanyInferenceInput, CompanyInferenceOutput, ProviderResult } from "../../worker/providers/contracts";
import { fakeResponse, makeDependencies, providerDescriptor, providerRequest } from "./helpers";

const profile = MarketProfileSchema.parse({
  ...marketProfile,
  capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "HUMAN_REVIEW"],
});
const openaiDescriptor = providerDescriptor("openai", "COMPANY_RESOLUTION", {
  configuredCost: { amount: 0.05, currency: "USD" },
});
const parentDescriptor = providerDescriptor("exa", "COMPANY_RESOLUTION");
const evidence = {
  providerId: "exa",
  providerSourceId: "exa:0123456789abcdef01234567",
  title: "Acme Example company evidence",
  excerpt: "Acme Example researches customer intake tools",
  capturedAt: "2026-10-05T12:00:00.000Z",
  schemaVersion: 1,
};
const inferenceInput: CompanyInferenceInput = {
  messages: [
    { role: "system", content: COMPANY_INFERENCE_SYSTEM_INSTRUCTION },
    { role: "user", content: JSON.stringify({ signal: "Sanitized fictional company signal", evidence: [evidence] }) },
  ],
};
const completion = (content: unknown = { candidates: [] }): CompanyInferenceCompletion => ({
  content,
  inputTokens: 17,
  outputTokens: 8,
});

function parentResult(relatedRun: ProviderResult<CompanyInferenceOutput>): ProviderResult<CompanyInferenceOutput> {
  return {
    schemaVersion: 1,
    providerRunId: "fixture-parent-run",
    relatedRuns: [relatedRun],
    provider: "exa",
    providerVersion: parentDescriptor.version,
    status: "EMPTY",
    startedAt: "2026-10-05T12:00:00.000Z",
    finishedAt: "2026-10-05T12:00:00.001Z",
    latencyMs: 1,
    usage: { requestCount: 0, recordCount: 0 },
    cost: { configuredAmount: 0, reservedAmount: 0, actualAmount: 0, currency: null },
    provenance: [],
    limitations: [],
    value: { candidates: [] },
    failureKind: null,
    capabilityError: null,
  };
}

async function runRegisteredInference(
  provider: ReturnType<typeof createCompanyInferenceAdapter>,
  input: CompanyInferenceInput,
  signal: AbortSignal = new AbortController().signal,
) {
  let inferenceResult: Awaited<ReturnType<typeof provider.infer>> | undefined;
  const execution = await executeProviderWithFallback(providerRequest(profile, [parentDescriptor], {
    traceId: "inference-fixture",
    signal,
    nestedDescriptors: [openaiDescriptor],
    budget: { currency: "USD", remainingCost: 1, remainingProviderCalls: 2 },
  }), async (_descriptor, context) => {
    inferenceResult = await provider.infer(input, context);
    return parentResult(inferenceResult!);
  });
  if (!execution.ok) throw new Error("Test registry did not run its fake parent capability");
  if (!inferenceResult) throw new Error("Registry callback did not invoke inference");
  return inferenceResult;
}

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

    const result = await runRegisteredInference(provider, inferenceInput);

    expect(result.status).toBe("EMPTY");
    expect(result.provider).toBe("openai");
    expect(result.usage).toMatchObject({ requestCount: 1, inputTokens: 17, outputTokens: 8 });
    expect(result.cost).toEqual({ configuredAmount: 0.05, reservedAmount: 0.05, actualAmount: null, currency: "USD" });
    expect(observedInput).toEqual(inferenceInput);
    expect(observedSignal).toBeInstanceOf(AbortSignal);
    expect(started.map(event => event.provider)).toEqual(["openai"]);
    expect(finished.map(event => event.providerRunId)).toEqual([result.providerRunId]);
  });

  it("redacts contact-like PII again at the model boundary", async () => {
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
        { role: "user", content: JSON.stringify({
          signal: "Acme needs customer intake help. Call +1 (415) 555-0199, email jane@example.test, @jane_ops or https://acme.example.com/team.",
          evidence: [{ ...evidence, excerpt: "Acme needs customer intake help; phone 020 7946 0958." }],
        }) },
      ],
    };

    await runRegisteredInference(provider, directInput);
    expect(sentText).toContain("Acme needs customer intake help");
    expect(sentText).not.toMatch(/415|7946|jane@example\.test|@jane_ops|https:\/\/acme\.example\.com/i);
  });

  it.each([
    ["providerSourceId email", { providerSourceId: "exa:janedoe@example.test" }],
    ["providerSourceId phone", { providerSourceId: "exa:+1 (415) 555-0199" }],
    ["externalId phone", { providerSourceId: evidence.providerSourceId, externalId: "+1 (415) 555-0199" }],
  ])("rejects unsafe structural IDs (%s) before model or recorder", async (_label, unsafeFields) => {
    const { dependencies, started, finished } = makeDependencies(async () => fakeResponse({}));
    let modelCalls = 0;
    const provider = createCompanyInferenceAdapter({
      descriptor: openaiDescriptor,
      dependencies,
      async complete() { modelCalls++; return completion(); },
    });
    const malformedInput = {
      messages: [
        { role: "system", content: COMPANY_INFERENCE_SYSTEM_INSTRUCTION },
        { role: "user", content: JSON.stringify({
          signal: "Acme Example is researching customer intake tools",
          evidence: [{ ...evidence, ...unsafeFields }],
        }) },
      ],
    } as unknown as CompanyInferenceInput;

    await expect(runRegisteredInference(provider, malformedInput)).rejects.toMatchObject({ name: "ProviderMalformedResponseError" });
    expect(modelCalls).toBe(0);
    expect(started).toHaveLength(0);
    expect(finished).toHaveLength(0);
  });

  it.each([
    [new ProviderHttpError("UNAUTHORIZED", 401), "FAILED", "UNAUTHORIZED", "FORBIDDEN"],
    [new ProviderHttpError("RATE_LIMITED", 429, 1_500), "RATE_LIMITED", "RATE_LIMITED", "RATE_LIMITED"],
    [new ProviderHttpError("UNAVAILABLE", 503), "FAILED", "UNAVAILABLE", "DEPENDENCY_UNAVAILABLE"],
  ] as const)("maps injected provider failure %s to a typed inference outcome", async (error, status, kind, code) => {
    const { dependencies, finished } = makeDependencies(async () => fakeResponse({}));
    const provider = createCompanyInferenceAdapter({ descriptor: openaiDescriptor, dependencies, async complete() { throw error; } });

    const result = await runRegisteredInference(provider, inferenceInput);
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

    const result = await runRegisteredInference(provider, inferenceInput);
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

    const result = await runRegisteredInference(provider, inferenceInput);
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
    const running = runRegisteredInference(provider, inferenceInput, controller.signal);
    await new Promise(resolve => setTimeout(resolve, 0));
    controller.abort(new Error("fixture cancellation"));

    await expect(running).rejects.toMatchObject({ kind: "CANCELLED" });
    expect(requestSignal?.aborted).toBe(true);
    expect(finished[0]?.responseMetadata.failureKind).toBe("CANCELLED");
  });
});
