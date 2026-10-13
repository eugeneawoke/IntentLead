import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { marketProfile } from "../domain/contract-fixtures";
import { executeProviderWithFallback } from "../../worker/providers/registry";
import { createHackerNewsAdapter } from "../../worker/providers/hackernews";
import { createRedditAdapter } from "../../worker/providers/reddit";
import type { ProviderDescriptor, ProviderExecutionResult, ProviderResult, ProviderSelectionRequest } from "../../worker/providers/contracts";
import { consumeFixtureReservation, makeDependencies, providerDescriptor, waitForAbort } from "./helpers";

const profile = MarketProfileSchema.parse({
  ...marketProfile,
  capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "HUMAN_REVIEW"],
});

function selectionRequest(descriptors: ProviderDescriptor[], overrides: Partial<ProviderSelectionRequest> = {}): ProviderSelectionRequest {
  return {
    profile,
    capability: "SOURCE_SEARCH",
    language: "en",
    region: "US",
    jurisdiction: null,
    executionMode: "fixture",
    timeoutMs: 250,
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
    ...success(provider),
    status: "FAILED",
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

describe("provider registry execution and fallback", () => {
  it("uses explicit sequential fallback only after retryable failure and charges each attempt", async () => {
    const descriptors = [
      providerDescriptor("reddit", "SOURCE_SEARCH", { priority: 10 }),
      providerDescriptor("hackernews", "SOURCE_SEARCH", { priority: 20 }),
    ];
    const request = selectionRequest(descriptors, {
      allowFallback: true,
      budget: { currency: "USD", remainingCost: 0.25, remainingProviderCalls: 2 },
    });
    const calls: string[] = [];
    const result = await executeProviderWithFallback(request, async (descriptor, context) => {
      calls.push(descriptor.id);
      consumeFixtureReservation(descriptor, context);
      return descriptor.id === "reddit" ? unavailable("reddit") : success("hackernews");
    });

    expectSuccess(result);
    expect(calls).toEqual(["reddit", "hackernews"]);
    expect(result.attempts.map(attempt => attempt.providerId)).toEqual(calls);
    expect(result.remainingBudget).toEqual({ currency: "USD", remainingCost: 0.25, remainingProviderCalls: 0 });
  });

  it.each([false, true])("does not fallback after non-retryable authorization (fallback=%s)", async allowFallback => {
    const descriptors = [providerDescriptor("reddit", "SOURCE_SEARCH", { priority: 1 }), providerDescriptor("hackernews", "SOURCE_SEARCH", { priority: 2 })];
    let calls = 0;
    const result = await executeProviderWithFallback(selectionRequest(descriptors, { allowFallback }), async (descriptor, context) => {
      calls++;
      consumeFixtureReservation(descriptor, context);
      return forbidden("reddit");
    });

    expectFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(calls).toBe(1);
  });

  it("does not fall back to a second provider after a timeout", async () => {
    const descriptors = [providerDescriptor("reddit", "SOURCE_SEARCH", { priority: 1 }), providerDescriptor("hackernews", "SOURCE_SEARCH", { priority: 2 })];
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

  it("enforces a registry timeout even when a provider ignores its abort signal", async () => {
    const descriptor = providerDescriptor("hackernews", "SOURCE_SEARCH");
    const result = await executeProviderWithFallback(
      selectionRequest([descriptor], { timeoutMs: 5 }),
      async (_selected, context) => {
        consumeFixtureReservation(descriptor, context);
        return new Promise(() => undefined);
      },
    );
    expectFailure(result);
    expect(result.error.code).toBe("TIMEOUT");
  });

  it("rejects a callback that returns without consuming its reservation", async () => {
    const descriptor = providerDescriptor("hackernews", "SOURCE_SEARCH");
    const result = await executeProviderWithFallback(selectionRequest([descriptor]), async () => success("hackernews"));
    expectFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("rejects caller-forged live activation before invocation", async () => {
    const forged = providerDescriptor("exa", "SOURCE_SEARCH", {
      operationalState: "configured",
      version: "live-forged",
    });
    let calls = 0;
    const result = await executeProviderWithFallback(selectionRequest([forged], {
      executionMode: "live",
    }), async () => { calls++; return success("prospeo"); });
    expectFailure(result);
    expect(result.error.code).toBe("POLICY_DENIED");
    expect(calls).toBe(0);
  });

  it("does not expose generic fixture execution outside the test environment", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const descriptor = providerDescriptor("hackernews", "SOURCE_SEARCH");
      let calls = 0;
      const result = await executeProviderWithFallback(selectionRequest([descriptor]), async () => {
        calls++;
        return success("hackernews");
      });
      expectFailure(result);
      expect(result.error.code).toBe("POLICY_DENIED");
      expect(calls).toBe(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects result cost that exceeds its reservation", async () => {
    const descriptor = providerDescriptor("hackernews", "SOURCE_SEARCH");
    const result = await executeProviderWithFallback(selectionRequest([descriptor]), async (selected, context) => {
      consumeFixtureReservation(selected, context);
      return { ...success("hackernews"), cost: { configuredAmount: 0, reservedAmount: 0, actualAmount: 1, currency: null } };
    });
    expectFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("rejects duplicate related-run identities for distinct nested reservations", async () => {
    const parent = providerDescriptor("exa", "COMPANY_RESOLUTION");
    const nested = providerDescriptor("openai", "COMPANY_RESOLUTION");
    const result = await executeProviderWithFallback(selectionRequest([parent], {
      capability: "COMPANY_RESOLUTION",
      nestedDescriptors: [nested],
      budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 3 },
    }), async (selected, context) => {
      consumeFixtureReservation(selected, context);
      for (let index = 0; index < 2; index++) {
        const grant = context.reserveProvider(nested);
        consumeFixtureReservation(nested, {
          ...context,
          capability: "COMPANY_RESOLUTION",
          reservation: grant.reservation,
          requestFingerprint: grant.requestFingerprint,
        });
      }
      const related = success("openai");
      return { ...success("exa"), relatedRuns: [related, { ...related }] };
    });
    expectFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("global network access is forbidden in provider tests"); })));
afterEach(() => vi.unstubAllGlobals());
