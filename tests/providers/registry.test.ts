import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { marketProfile } from "../domain/contract-fixtures";
import { executeProviderWithFallback, selectProvider } from "../../worker/providers/registry";
import type {
  ProviderDescriptor,
  ProviderExecutionResult,
  ProviderResult,
  ProviderSelectionRequest,
} from "../../worker/providers/contracts";
import { providerDescriptor } from "./helpers";

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
    const request = selectionRequest([], { capability: "WEB_FETCH" as ProviderSelectionRequest["capability"] });
    expect(() => selectProvider(request)).toThrowError(expect.objectContaining({
      capabilityError: expect.objectContaining({ code: "POLICY_DENIED" }),
    }));
  });

  it("rejects a disabled non-provider discovery capability before execution", async () => {
    let calls = 0;
    const descriptor = providerDescriptor("reddit", "SOURCE_SEARCH");
    const result = await executeProviderWithFallback(
      selectionRequest([descriptor], { capability: "WEB_FETCH" as ProviderSelectionRequest["capability"] }),
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

});

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("global network access is forbidden in provider tests"); })));
afterEach(() => vi.unstubAllGlobals());
