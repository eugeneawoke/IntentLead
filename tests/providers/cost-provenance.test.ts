import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { marketProfile } from "../domain/contract-fixtures";
import { createExaCompanyResolutionProvider } from "../../worker/providers/company-resolution";
import { createCompanyInferenceAdapter } from "../../worker/providers/inference";
import type { CompanyInferenceInput, ProviderCallContext, ProviderDescriptor, ProviderSelectionRequest } from "../../worker/providers/contracts";
import { executeProviderWithFallback } from "../../worker/providers/registry";
import { fakeResponse, makeDependencies, providerDescriptor } from "./helpers";

const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8")) as unknown;
const profile = MarketProfileSchema.parse({ ...marketProfile, capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "HUMAN_REVIEW"] });
const searchDescriptor = providerDescriptor("exa", "COMPANY_RESOLUTION", { configuredCost: { amount: 0.02, currency: "USD" } });
const inferenceDescriptor = providerDescriptor("openai" as ProviderDescriptor["id"], "COMPANY_RESOLUTION", {
  configuredCost: { amount: 0.05, currency: "USD" },
});

function request(
  budget: ProviderSelectionRequest["budget"],
  nestedDescriptors: ProviderSelectionRequest["nestedDescriptors"] = [inferenceDescriptor],
): ProviderSelectionRequest {
  return {
    profile,
    capability: "COMPANY_RESOLUTION",
    language: "en",
    region: "US",
    jurisdiction: null,
    health: {},
    budget,
    descriptors: [searchDescriptor],
    nestedDescriptors,
    allowFallback: true,
    traceId: "cost-provenance-fixture",
    signal: new AbortController().signal,
  };
}

function isCallContext(value: unknown): value is ProviderCallContext {
  return Boolean(value && typeof value === "object" && "reserveProvider" in value);
}

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("global network access is forbidden in provider tests"); })));
afterEach(() => vi.unstubAllGlobals());

describe("separate company search and inference cost/provenance", () => {
  it("denies inference before construction/call when its reserved cost exceeds the remaining budget", async () => {
    const { dependencies, started, finished } = makeDependencies(async () => fakeResponse(fixture("exa-success.json")));
    let inferenceCalls = 0;
    const inference = createCompanyInferenceAdapter({
      descriptor: inferenceDescriptor,
      dependencies,
      async complete() { inferenceCalls++; return { content: { candidates: [] }, inputTokens: null, outputTokens: null }; },
    });
    const resolver = createExaCompanyResolutionProvider({
      apiKey: "fixture-key",
      descriptor: searchDescriptor,
      dependencies,
      inferenceProvider: inference,
    });
    const execution = await executeProviderWithFallback(
      request({ currency: "USD", remainingCost: 0.06, remainingProviderCalls: 2 }),
      async (_descriptor, context) => {
        if (!isCallContext(context)) throw new Error("registry must pass its reservation context");
        return resolver.resolve({ signalContent: "Acme Example public operations issue" }, context);
      },
    );

    expect(execution.ok).toBe(true);
    if (!execution.ok) throw new Error("Expected partial company-resolution result");
    expect(execution.outcome.status).toBe("PARTIAL");
    expect(execution.outcome.capabilityError?.code).toBe("BUDGET_EXCEEDED");
    expect(inferenceCalls).toBe(0);
    expect(started.map(event => event.provider)).toEqual(["exa"]);
    expect(finished).toHaveLength(1);
    expect(execution.remainingBudget).toEqual({ currency: "USD", remainingCost: 0.04, remainingProviderCalls: 1 });
  });

  it("does not select paid inference when its configured cost is unknown", async () => {
    const { dependencies, started } = makeDependencies(async () => fakeResponse(fixture("exa-success.json")));
    let inferenceCalls = 0;
    const unknownInferenceDescriptor = providerDescriptor("openai", "COMPANY_RESOLUTION", { configuredCost: { amount: null, currency: null } });
    const inference = createCompanyInferenceAdapter({
      descriptor: unknownInferenceDescriptor,
      dependencies,
      async complete() { inferenceCalls++; return { content: { candidates: [] }, inputTokens: null, outputTokens: null }; },
    });
    const resolver = createExaCompanyResolutionProvider({ apiKey: "fixture-key", descriptor: searchDescriptor, dependencies, inferenceProvider: inference });
    const execution = await executeProviderWithFallback(
      request({ currency: "USD", remainingCost: 0.1, remainingProviderCalls: 2 }, [unknownInferenceDescriptor]),
      async (_descriptor, context) => resolver.resolve({ signalContent: "Acme Example public operations issue" }, context),
    );

    expect(execution.ok).toBe(true);
    if (!execution.ok) throw new Error("Expected partial company-resolution result");
    expect(execution.outcome.status).toBe("PARTIAL");
    expect(execution.outcome.capabilityError?.code).toBe("CAPABILITY_UNAVAILABLE");
    expect(inferenceCalls).toBe(0);
    expect(started.map(event => event.provider)).toEqual(["exa"]);
  });

  it("records separate Exa and OpenAI envelopes and charges both configured reserves", async () => {
    const { dependencies, started, finished } = makeDependencies(async () => fakeResponse(fixture("exa-success.json")));
    const inference = createCompanyInferenceAdapter({
      descriptor: inferenceDescriptor,
      dependencies,
      async complete(input: CompanyInferenceInput) {
        const evidence = JSON.parse(input.messages[1].content) as { evidence: Array<{ providerSourceId: string }> };
        return {
          content: {
            candidates: [{ companyName: "Acme Example", companyDomain: "example.com", confidence: 0.93, evidenceSourceIds: [evidence.evidence[0].providerSourceId] }],
          },
          inputTokens: 41,
          outputTokens: 13,
        };
      },
    });
    const resolver = createExaCompanyResolutionProvider({ apiKey: "fixture-key", descriptor: searchDescriptor, dependencies, inferenceProvider: inference });
    const execution = await executeProviderWithFallback(
      request({ currency: "USD", remainingCost: 0.1, remainingProviderCalls: 2 }),
      async (_descriptor, context) => {
        if (!isCallContext(context)) throw new Error("registry must pass its reservation context");
        return resolver.resolve({ signalContent: "Acme Example public operations issue" }, context);
      },
    );

    expect(execution.ok).toBe(true);
    if (!execution.ok) throw new Error("Expected company resolution");
    expect(execution.outcome.value?.[0].resolutionStatus).toBe("RESOLVED");
    expect(execution.outcome.provider).toBe("exa");
    expect(execution.outcome.usage).toMatchObject({ requestCount: 1 });
    expect(execution.outcome.cost).toEqual({ configuredAmount: 0.02, reservedAmount: 0.02, actualAmount: null, currency: "USD" });
    expect(execution.outcome.relatedRuns).toHaveLength(1);
    expect(execution.outcome.relatedRuns?.[0]).toMatchObject({
      provider: "openai",
      providerVersion: inferenceDescriptor.version,
      status: "SUCCEEDED",
      usage: { requestCount: 1, inputTokens: 41, outputTokens: 13 },
      cost: { configuredAmount: 0.05, reservedAmount: 0.05, actualAmount: null, currency: "USD" },
    });
    expect(started.map(event => event.provider)).toEqual(["exa", "openai"]);
    expect(finished).toHaveLength(2);
    expect(execution.remainingBudget).toEqual({ currency: "USD", remainingCost: 0.03, remainingProviderCalls: 0 });
  });

  it("redacts contact-like PII and URLs from search requests and model input, including evidence excerpts", async () => {
    let searchBody = "";
    let modelInput: CompanyInferenceInput | undefined;
    const searchResponse = {
      results: [{
        id: "fixture-private-contact",
        title: "Acme Example is hiring for customer intake; call +1 (415) 555-0199",
        url: "https://acme.example.com/about?owner=jane@example.test",
        text: "Acme Example needs workflow help. Email jane@example.test, contact @jane_ops at https://acme.example.com/contact or 020 7946 0958.",
      }],
    };
    const { dependencies } = makeDependencies(async (_url, init) => {
      searchBody = String(init?.body ?? "");
      return fakeResponse(searchResponse);
    });
    const inference = createCompanyInferenceAdapter({
      descriptor: inferenceDescriptor,
      dependencies,
      async complete(input) {
        modelInput = input;
        const evidence = JSON.parse(input.messages[1].content) as { evidence: Array<{ providerSourceId: string }> };
        return {
          content: { candidates: [{ companyName: "Acme Example", companyDomain: "example.com", confidence: 0.91, evidenceSourceIds: [evidence.evidence[0].providerSourceId] }] },
          inputTokens: null,
          outputTokens: null,
        };
      },
    });
    const resolver = createExaCompanyResolutionProvider({ apiKey: "fixture-key", descriptor: searchDescriptor, dependencies, inferenceProvider: inference });
    const execution = await executeProviderWithFallback(
      request({ currency: "USD", remainingCost: 0.1, remainingProviderCalls: 2 }),
      async (_descriptor, context) => resolver.resolve({
        signalContent: "Acme workflow launch; +44 20 7946 0958, jane@example.test, @jane_ops, https://acme.example.com/team",
      }, context as ProviderCallContext),
    );

    expect(execution.ok).toBe(true);
    expect(searchBody).toContain("Acme workflow launch");
    expect(searchBody).not.toMatch(/7946|jane@example\.test|@jane_ops|https:\/\/acme\.example\.com/i);
    const modelText = modelInput?.messages[1].content ?? "";
    expect(modelText).toContain("Acme Example needs workflow help");
    expect(modelText).not.toMatch(/415|7946|jane@example\.test|@jane_ops|https:\/\/acme\.example\.com/i);
    expect(modelText).not.toContain("sourceUrl");
    const canonicalExcerpt = execution.ok ? execution.outcome.value?.[0]?.evidence[0]?.excerpt ?? "" : "";
    expect(canonicalExcerpt).toContain("Acme Example needs workflow help");
    expect(canonicalExcerpt).not.toMatch(/415|7946|jane@example\.test|@jane_ops|https:\/\/acme\.example\.com/i);
  });
});
