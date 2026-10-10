import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { marketProfile } from "../domain/contract-fixtures";
import { createExaCompanyResolutionProvider } from "../../worker/providers/company-resolution";
import { createHackerNewsAdapter } from "../../worker/providers/hackernews";
import { createRedditAdapter } from "../../worker/providers/reddit";
import { executeProviderWithFallback } from "../../worker/providers/registry";
import type { ProviderCallContext, ProviderDescriptor, ProviderResult, ProviderSelectionRequest } from "../../worker/providers/contracts";
import { consumeFixtureReservation, fakeResponse, makeDependencies, providerDescriptor } from "./helpers";

const profile = MarketProfileSchema.parse({
  ...marketProfile,
  capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "HUMAN_REVIEW"],
});

function request(descriptors: ProviderDescriptor[], overrides: Partial<ProviderSelectionRequest> = {}): ProviderSelectionRequest {
  return {
    profile,
    capability: descriptors[0]?.capability ?? "SOURCE_SEARCH",
    language: "en",
    region: "US",
    jurisdiction: null,
    executionMode: "fixture",
    timeoutMs: 250,
    budget: { currency: "USD", remainingCost: 1, remainingProviderCalls: descriptors.length },
    allowFallback: false,
    descriptors,
    traceId: "reservation-fixture",
    ...overrides,
  };
}

function untrustedContext(profileOverride = profile, extras: Record<string, unknown> = {}): ProviderCallContext {
  return {
    profile: profileOverride,
    traceId: "reservation-fixture",
    signal: new AbortController().signal,
    reserveProvider(descriptor: ProviderDescriptor) { return { descriptor, reservedCost: descriptor.configuredCost.amount ?? 0 }; },
    ...extras,
  } as unknown as ProviderCallContext;
}

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("global network access is forbidden in provider tests"); })));
afterEach(() => vi.unstubAllGlobals());

describe("opaque provider reservations", () => {
  it("rejects a direct source-adapter call without registry selection before recorder or HTTP", async () => {
    let httpCalls = 0;
    const { dependencies, started, finished } = makeDependencies(async () => {
      httpCalls++;
      return fakeResponse({ access_token: "fixture-token" });
    });
    const descriptor = providerDescriptor("reddit", "SOURCE_SEARCH");
    const provider = createRedditAdapter({ clientId: "fixture-id", clientSecret: "fixture-secret", descriptor, dependencies });

    await expect(provider.search({ keywords: ["Acme Example"] }, untrustedContext())).rejects.toMatchObject({
      capabilityError: { code: "POLICY_DENIED" },
    });
    expect(started).toHaveLength(0);
    expect(finished).toHaveLength(0);
    expect(httpCalls).toBe(0);
  });

  it("rejects a direct company-adapter call without registry selection before search, inference, or recorder", async () => {
    let httpCalls = 0;
    let inferenceCalls = 0;
    const { dependencies, started, finished } = makeDependencies(async () => {
      httpCalls++;
      return fakeResponse({ results: [] });
    });
    const descriptor = providerDescriptor("exa", "COMPANY_RESOLUTION");
    const inferenceDescriptor = providerDescriptor("openai", "COMPANY_RESOLUTION");
    const inference = {
      descriptor: inferenceDescriptor,
      async infer() {
        inferenceCalls++;
        throw new Error("inference must not run without reservation");
      },
    } as never;
    const provider = createExaCompanyResolutionProvider({ apiKey: "fixture-key", descriptor, dependencies, inferenceProvider: inference });

    await expect(provider.resolve({ signalContent: "Acme Example public business signal" }, untrustedContext())).rejects.toMatchObject({
      capabilityError: { code: "POLICY_DENIED" },
    });
    expect(started).toHaveLength(0);
    expect(finished).toHaveLength(0);
    expect(httpCalls).toBe(0);
    expect(inferenceCalls).toBe(0);
  });

  it.each([
    ["RU profile with US-only descriptor", { marketProfiles: ["CIS_RU"], languages: ["ru"], regions: ["RU"], jurisdictions: ["US"] }, "regional"],
    ["prohibited descriptor", { legalStatus: "PROHIBITED" }, "normal"],
    ["disabled descriptor", { operationalState: "disabled", stateReason: "fixture disabled" }, "normal"],
    ["unknown-cost descriptor", { configuredCost: { amount: null, currency: null } }, "normal"],
  ] as Array<[string, Partial<ProviderDescriptor>, "regional" | "normal"]>)("does not let direct adapter calls bypass %s selection", async (_label, overrides, profileKind) => {
    let httpCalls = 0;
    const { dependencies, started, finished } = makeDependencies(async () => {
      httpCalls++;
      return fakeResponse({ access_token: "fixture-token" });
    });
    const regionalProfile = MarketProfileSchema.parse({
      ...marketProfile,
      id: "CIS_RU",
      workflow: "DISCOVERY_ONLY",
      jurisdictions: [{ countryCode: "RU", subdivisionCode: null }],
      regions: ["RU"],
      languages: ["ru"],
      capabilities: ["SOURCE_SEARCH"],
    });
    const descriptor = providerDescriptor("reddit", "SOURCE_SEARCH", overrides);
    const provider = createRedditAdapter({ clientId: "fixture-id", clientSecret: "fixture-secret", descriptor, dependencies });
    const selectedProfile = profileKind === "regional" ? regionalProfile : profile;
    const direct = untrustedContext(selectedProfile, {
      language: profileKind === "regional" ? "ru" : "en",
      region: profileKind === "regional" ? "RU" : "US",
      jurisdiction: profileKind === "regional" ? "RU" : null,
      budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 0 },
      reservation: Object.freeze({}),
    });

    await expect(provider.search({ keywords: ["Acme Example"] }, direct)).rejects.toMatchObject({
      capabilityError: { code: "POLICY_DENIED" },
    });
    expect(started).toHaveLength(0);
    expect(finished).toHaveLength(0);
    expect(httpCalls).toBe(0);
  });

  it("rejects use of a registry reservation with the wrong adapter before recorder or HTTP", async () => {
    let httpCalls = 0;
    const { dependencies, started, finished } = makeDependencies(async () => {
      httpCalls++;
      return fakeResponse({ hits: [] });
    });
    const redditDescriptor = providerDescriptor("reddit", "SOURCE_SEARCH");
    const hackerNewsDescriptor = providerDescriptor("hackernews", "SOURCE_SEARCH");
    const wrongAdapter = createHackerNewsAdapter({ descriptor: hackerNewsDescriptor, dependencies });

    const result = await executeProviderWithFallback(request([redditDescriptor]), async (_descriptor, context) =>
      wrongAdapter.search({ keywords: ["Acme Example"] }, context));
    expect(result).toMatchObject({ ok: false, error: { code: "POLICY_DENIED" } });
    expect(started).toHaveLength(0);
    expect(finished).toHaveLength(0);
    expect(httpCalls).toBe(0);
  });

  it("rejects a valid reservation when the adapter receives a different market request", async () => {
    let httpCalls = 0;
    const { dependencies, started, finished } = makeDependencies(async () => {
      httpCalls++;
      return fakeResponse({ access_token: "fixture-token" });
    });
    const descriptor = providerDescriptor("reddit", "SOURCE_SEARCH");
    const provider = createRedditAdapter({ clientId: "fixture-id", clientSecret: "fixture-secret", descriptor, dependencies });

    const result = await executeProviderWithFallback(request([descriptor]), async (_selected, context) =>
      provider.search({ keywords: ["Acme Example"] }, { ...context, region: "CA" }));
    expect(result).toMatchObject({ ok: false, error: { code: "POLICY_DENIED" } });
    expect(started).toHaveLength(0);
    expect(finished).toHaveLength(0);
    expect(httpCalls).toBe(0);
  });

  it("consumes a reservation once, before any second recorder or provider call", async () => {
    let httpCalls = 0;
    const { dependencies, started, finished } = makeDependencies(async (input) => {
      httpCalls++;
      if (String(input).includes("access_token")) return fakeResponse({ access_token: "fixture-token" });
      return fakeResponse({ data: { children: [] } });
    });
    const descriptor = providerDescriptor("reddit", "SOURCE_SEARCH");
    const provider = createRedditAdapter({ clientId: "fixture-id", clientSecret: "fixture-secret", descriptor, dependencies });
    const result = await executeProviderWithFallback(request([descriptor]), async (_selected, context) => {
      const first = await provider.search({ keywords: ["Acme Example"] }, context);
      await expect(provider.search({ keywords: ["Acme Example"] }, context)).rejects.toMatchObject({
        capabilityError: { code: "POLICY_DENIED" },
      });
      return first;
    });

    expect(result.ok).toBe(true);
    expect(started).toHaveLength(1);
    expect(finished).toHaveLength(1);
    expect(httpCalls).toBe(2);
  });

  it("issues a distinct reservation for each sequential fallback attempt", async () => {
    const descriptors = [
      providerDescriptor("reddit", "SOURCE_SEARCH", { priority: 1 }),
      providerDescriptor("hackernews", "SOURCE_SEARCH", { priority: 2 }),
    ];
    const reservations: unknown[] = [];
    const result = await executeProviderWithFallback(request(descriptors, {
      allowFallback: true,
      budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 2 },
    }), async (descriptor, context) => {
      reservations.push((context as ProviderCallContext & { reservation?: unknown }).reservation);
      consumeFixtureReservation(descriptor, context);
      return descriptor.id === "reddit" ? failedResult("reddit") : succeededResult("hackernews");
    });

    expect(result.ok).toBe(true);
    expect(reservations).toHaveLength(2);
    expect(reservations[0]).toBeDefined();
    expect(reservations[0]).not.toBe(reservations[1]);
  });
});

function failedResult(provider: "reddit" | "hackernews"): ProviderResult<never[]> {
  return {
    schemaVersion: 1 as const,
    providerRunId: `${provider}-failed`,
    provider,
    providerVersion: "fixture-v1",
    status: "FAILED" as const,
    startedAt: "2026-10-05T12:00:00.000Z",
    finishedAt: "2026-10-05T12:00:00.001Z",
    latencyMs: 1,
    usage: { requestCount: 1, recordCount: 0 },
    cost: { configuredAmount: 0, reservedAmount: 0, actualAmount: 0, currency: null },
    provenance: [],
    limitations: [],
    value: null,
    failureKind: "UNAVAILABLE" as const,
    capabilityError: {
      schemaVersion: 1 as const,
      code: "DEPENDENCY_UNAVAILABLE" as const,
      retryable: true,
      message: "Fixture unavailable",
      capability: "SOURCE_SEARCH" as const,
      traceId: "reservation-fixture",
      retryAfterMs: null,
    },
  };
}

function succeededResult(provider: "reddit" | "hackernews"): ProviderResult<never[]> {
  return {
    schemaVersion: 1 as const,
    providerRunId: `${provider}-success`,
    provider,
    providerVersion: "fixture-v1",
    status: "SUCCEEDED" as const,
    startedAt: "2026-10-05T12:00:00.000Z",
    finishedAt: "2026-10-05T12:00:00.001Z",
    latencyMs: 1,
    usage: { requestCount: 1, recordCount: 0 },
    cost: { configuredAmount: 0, reservedAmount: 0, actualAmount: 0, currency: null },
    provenance: [],
    limitations: [],
    value: [],
    failureKind: null,
    capabilityError: null,
  };
}
