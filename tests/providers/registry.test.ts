import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { marketProfile } from "../domain/contract-fixtures";
import { executeProviderWithFallback, selectProvider } from "../../worker/providers/registry";
import { createHackerNewsAdapter } from "../../worker/providers/hackernews";
import { createRedditAdapter } from "../../worker/providers/reddit";
import type {
  ProviderDescriptor,
  ProviderExecutionResult,
  ProviderResult,
  ProviderSelectionRequest,
} from "../../worker/providers/contracts";
import { makeDependencies, providerDescriptor, waitForAbort } from "./helpers";

const profile = MarketProfileSchema.parse({
  ...marketProfile,
  capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "HUMAN_REVIEW"],
});

function selectionRequest(
  descriptors: ProviderDescriptor[],
  overrides: Partial<ProviderSelectionRequest> = {},
): ProviderSelectionRequest {
  return {
    profile,
    capability: "SOURCE_SEARCH",
    language: "en",
    region: "US",
    jurisdiction: null,
    health: {},
    budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 3 },
    allowFallback: false,
    descriptors,
    ...overrides,
  };
}

function success(provider: ProviderDescriptor["id"], status: "SUCCEEDED" | "EMPTY" = "SUCCEEDED"): ProviderResult<string[]> {
  return {
    schemaVersion: 1,
    providerRunId: `run-${provider}`,
    provider,
    providerVersion: "fixture-v1",
    status,
    startedAt: "2026-10-05T12:00:00.000Z",
    finishedAt: "2026-10-05T12:00:00.001Z",
    latencyMs: 1,
    usage: { requestCount: 1, recordCount: status === "EMPTY" ? 0 : 1 },
    cost: { configuredAmount: 0, reservedAmount: 0, actualAmount: 0, currency: null },
    provenance: [],
    limitations: [],
    value: [],
    failureKind: null,
    capabilityError: null,
  };
}

function unavailable(provider: ProviderDescriptor["id"]): ProviderResult<string[]> {
  return {
    ...success(provider),
    status: "FAILED",
    value: null,
    failureKind: "UNAVAILABLE",
    capabilityError: {
      schemaVersion: 1,
      code: "DEPENDENCY_UNAVAILABLE",
      retryable: true,
      message: "Provider unavailable",
      capability: "SOURCE_SEARCH",
      traceId: "fixture-trace",
      retryAfterMs: null,
    },
  };
}

function forbidden(provider: ProviderDescriptor["id"]): ProviderResult<string[]> {
  return {
    schemaVersion: 1,
    providerRunId: `run-${provider}`,
    provider,
    providerVersion: "fixture-v1",
    status: "FAILED",
    startedAt: "2026-10-05T12:00:00.000Z",
    finishedAt: "2026-10-05T12:00:00.001Z",
    latencyMs: 1,
    usage: { requestCount: 1, recordCount: 0 },
    cost: { configuredAmount: 0, reservedAmount: 0, actualAmount: 0, currency: null },
    provenance: [],
    limitations: [],
    value: null,
    failureKind: "UNAUTHORIZED",
    capabilityError: {
      schemaVersion: 1,
      code: "FORBIDDEN",
      retryable: false,
      message: "Provider authorization failed",
      capability: "SOURCE_SEARCH",
      traceId: "fixture-trace",
      retryAfterMs: null,
    },
  };
}

function expectSuccess<T>(result: ProviderExecutionResult<T>): asserts result is Extract<ProviderExecutionResult<T>, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected successful provider result");
}

function expectFailure<T>(result: ProviderExecutionResult<T>): asserts result is Extract<ProviderExecutionResult<T>, { ok: false }> {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected failed provider result");
}

describe("provider registry policy", () => {
  it("rejects a profile-disabled capability before selecting a provider", () => {
    const request = selectionRequest([], { capability: "EMAIL_FIND" });
    expect(() => selectProvider(request)).toThrowError(expect.objectContaining({
      capabilityError: expect.objectContaining({ code: "POLICY_DENIED" }),
    }));
  });

  it("rejects every non-discovery capability under EN_DISCOVERY_ONLY", async () => {
    let calls = 0;
    const descriptor = providerDescriptor("reddit", "SOURCE_SEARCH");
    const result = await executeProviderWithFallback(
      selectionRequest([descriptor], { capability: "PACKAGE_VERIFIED" }),
      async () => { calls++; return success("reddit"); },
    );

    expectFailure(result);
    expect(result.error.code).toBe("POLICY_DENIED");
    expect(calls).toBe(0);
  });

  it("selects one provider deterministically and stops after successful empty", async () => {
    const descriptors = [
      providerDescriptor("hackernews", "SOURCE_SEARCH", { priority: 20 }),
      providerDescriptor("reddit", "SOURCE_SEARCH", { priority: 10 }),
    ];
    const request = selectionRequest(descriptors, { allowFallback: true });
    const selected = selectProvider(request);
    const calls: string[] = [];
    const result = await executeProviderWithFallback(request, async (descriptor) => {
      calls.push(descriptor.id);
      return success(descriptor.id, "EMPTY");
    });

    expect(selected.descriptor.id).toBe("reddit");
    expectSuccess(result);
    expect(result.outcome.status).toBe("EMPTY");
    expect(calls).toEqual(["reddit"]);
    expect(result.attempts).toHaveLength(1);
  });

  it("uses explicit sequential fallback only after retryable failure and charges each attempt", async () => {
    const descriptors = [
      providerDescriptor("reddit", "SOURCE_SEARCH", { priority: 10 }),
      providerDescriptor("hackernews", "SOURCE_SEARCH", { priority: 20 }),
    ];
    const request = selectionRequest(descriptors, {
      allowFallback: true,
      budget: { currency: "USD", remainingCost: 0.25, remainingProviderCalls: 2 },
      descriptors: [
        { ...descriptors[0], configuredCost: { amount: 0.1, currency: "USD" } },
        { ...descriptors[1], configuredCost: { amount: 0.15, currency: "USD" } },
      ],
    });
    const calls: string[] = [];
    const result = await executeProviderWithFallback(request, async (descriptor) => {
      calls.push(descriptor.id);
      return descriptor.id === "reddit" ? unavailable("reddit") : success("hackernews");
    });

    expectSuccess(result);
    expect(calls).toEqual(["reddit", "hackernews"]);
    expect(result.attempts.map(attempt => attempt.providerId)).toEqual(calls);
    expect(result.remainingBudget).toEqual({ currency: "USD", remainingCost: 0, remainingProviderCalls: 0 });
  });

  it.each([false, true])("does not fallback after non-retryable authorization (fallback=%s)", async (allowFallback) => {
    const descriptors = [
      providerDescriptor("reddit", "SOURCE_SEARCH", { priority: 1 }),
      providerDescriptor("hackernews", "SOURCE_SEARCH", { priority: 2 }),
    ];
    let calls = 0;
    const request = selectionRequest(descriptors, { allowFallback });
    const result = await executeProviderWithFallback(request, async () => {
      calls++;
      return forbidden("reddit");
    });

    expectFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(calls).toBe(1);
  });

  it("skips unhealthy, unreviewed and market-incompatible providers", () => {
    const descriptors = [
      providerDescriptor("reddit", "SOURCE_SEARCH", { priority: 1, legalStatus: "UNASSESSED" }),
      providerDescriptor("hackernews", "SOURCE_SEARCH", { priority: 2, languages: ["fr"] }),
      providerDescriptor("exa", "COMPANY_RESOLUTION", { priority: 3 }),
      providerDescriptor("serper", "SOURCE_SEARCH", { priority: 4 }),
    ];
    const request = selectionRequest(descriptors, {
      health: { serper: "CIRCUIT_OPEN" },
    });

    expect(() => selectProvider(request)).toThrowError(expect.objectContaining({
      capabilityError: expect.objectContaining({ code: "CAPABILITY_UNAVAILABLE" }),
    }));
  });

  it("leaves paid unknown-cost providers unavailable until explicit cost and budget exist", () => {
    const paid = providerDescriptor("exa", "SOURCE_SEARCH", {
      configuredCost: { amount: null, currency: null },
    });
    const request = selectionRequest([paid]);
    expect(() => selectProvider(request)).toThrowError(expect.objectContaining({
      capabilityError: expect.objectContaining({ code: "CAPABILITY_UNAVAILABLE" }),
    }));
  });

  it("returns a stable budget error before invoking an over-budget provider", async () => {
    let calls = 0;
    const paid = providerDescriptor("exa", "SOURCE_SEARCH", {
      configuredCost: { amount: 0.25, currency: "USD" },
    });
    const result = await executeProviderWithFallback(
      selectionRequest([paid], { budget: { currency: "USD", remainingCost: 0.1, remainingProviderCalls: 2 } }),
      async () => { calls++; return success("exa"); },
    );

    expectFailure(result);
    expect(result.error.code).toBe("BUDGET_EXCEEDED");
    expect(calls).toBe(0);
  });

  it("requires an explicit authorized jurisdiction for regional profiles before selecting any provider", async () => {
    const regionalProfile = MarketProfileSchema.parse({
      ...marketProfile,
      id: "CIS_RU",
      workflow: "DISCOVERY_ONLY",
      jurisdictions: [{ countryCode: "RU", subdivisionCode: null }],
      regions: ["RU"],
      languages: ["ru"],
      capabilities: ["SOURCE_SEARCH"],
    });
    const usOnly = providerDescriptor("reddit", "SOURCE_SEARCH", {
      marketProfiles: ["CIS_RU"],
      languages: ["ru"],
      regions: ["RU"],
      jurisdictions: ["US"],
    });
    let calls = 0;
    const result = await executeProviderWithFallback(
      selectionRequest([usOnly], {
        profile: regionalProfile,
        language: "ru",
        region: "RU",
        jurisdiction: null,
      }),
      async () => { calls++; return success("reddit"); },
    );

    expectFailure(result);
    expect(result.error.code).toBe("POLICY_DENIED");
    expect(calls).toBe(0);
  });

  it("rejects a request jurisdiction outside its regional profile and providers that do not support the selected jurisdiction", async () => {
    const regionalProfile = MarketProfileSchema.parse({
      ...marketProfile,
      id: "CIS_RU",
      workflow: "DISCOVERY_ONLY",
      jurisdictions: [{ countryCode: "RU", subdivisionCode: null }],
      regions: ["RU"],
      languages: ["ru"],
      capabilities: ["SOURCE_SEARCH"],
    });
    const usOnly = providerDescriptor("reddit", "SOURCE_SEARCH", {
      marketProfiles: ["CIS_RU"],
      languages: ["ru"],
      regions: ["RU"],
      jurisdictions: ["US"],
    });
    let calls = 0;

    const unauthorizedRequest = await executeProviderWithFallback(selectionRequest([usOnly], {
      profile: regionalProfile,
      language: "ru",
      region: "RU",
      jurisdiction: "US",
    }), async () => { calls++; return success("reddit"); });
    expectFailure(unauthorizedRequest);
    expect(unauthorizedRequest.error.code).toBe("POLICY_DENIED");

    const unsupportedDescriptor = await executeProviderWithFallback(selectionRequest([usOnly], {
      profile: regionalProfile,
      language: "ru",
      region: "RU",
      jurisdiction: "RU",
    }), async () => { calls++; return success("reddit"); });
    expectFailure(unsupportedDescriptor);
    expect(unsupportedDescriptor.error.code).toBe("CAPABILITY_UNAVAILABLE");
    expect(calls).toBe(0);
  });

  it("does not fall back to a second provider after a timeout", async () => {
    const descriptors = [
      providerDescriptor("reddit", "SOURCE_SEARCH", { priority: 1 }),
      providerDescriptor("hackernews", "SOURCE_SEARCH", { priority: 2 }),
    ];
    const calls: string[] = [];
    const { dependencies, started, finished } = makeDependencies(async (url, init) => {
      calls.push(url);
      return waitForAbort(init?.signal as AbortSignal);
    }, { timeoutMs: 5 });
    const adapters = new Map([
      ["reddit", createRedditAdapter({ clientId: "fixture-client", clientSecret: "fixture-secret", descriptor: descriptors[0], dependencies })],
      ["hackernews", createHackerNewsAdapter({ descriptor: descriptors[1], dependencies })],
    ]);
    const result = await executeProviderWithFallback(
      selectionRequest(descriptors, { allowFallback: true, budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 2 } }),
      async (descriptor, context) => {
        const adapter = adapters.get(descriptor.id);
        if (!adapter) throw new Error("Selected provider adapter is missing");
        return adapter.search({ keywords: ["fictional operations"] }, context);
      },
    );

    expectFailure(result);
    expect(result.error.code).toBe("TIMEOUT");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("www.reddit.com/api/v1/access_token");
    expect(started.map(event => event.provider)).toEqual(["reddit"]);
    expect(finished.map(event => ({ provider: event.providerRunId, status: event.status }))).toEqual([{ provider: "fixture-run-1", status: "TIMEOUT" }]);
    expect(result.attempts).toHaveLength(1);
  });

  it("returns a stable budget error when provider-call budget is exhausted", async () => {
    let calls = 0;
    const free = providerDescriptor("hackernews", "SOURCE_SEARCH");
    const result = await executeProviderWithFallback(
      selectionRequest([free], { budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 0 } }),
      async () => { calls++; return success("hackernews"); },
    );
    expectFailure(result);
    expect(result.error.code).toBe("BUDGET_EXCEEDED");
    expect(calls).toBe(0);
  });
});

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("global network access is forbidden in provider tests"); })));
afterEach(() => vi.unstubAllGlobals());
