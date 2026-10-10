import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { createGitHubAdapter } from "../../worker/providers/github";
import { createStackExchangeAdapter } from "../../worker/providers/stackexchange";
import type { DiscoveredSignal, ProviderResult, SignalSourceAdapter } from "../../worker/providers/contracts";
import { marketProfile } from "../domain/contract-fixtures";
import {
  fakeResponse, makeDependencies, providerDescriptor, providerRequest, runWithProviderReservation, waitForAbort,
} from "./helpers";

const profile = MarketProfileSchema.parse({
  ...marketProfile, capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "HUMAN_REVIEW"],
});

async function runAdapter(adapter: SignalSourceAdapter): Promise<ProviderResult<DiscoveredSignal[]>> {
  return runWithProviderReservation(providerRequest(profile, [adapter.descriptor], {
    traceId: "task-k-failure-fixture",
    budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 1 },
  }), (_selected, context) => adapter.search({ keywords: ["customer intake"] }, context));
}

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("global network access is forbidden"); })));
afterEach(() => vi.unstubAllGlobals());

describe("Task K free source failure contracts", () => {
  it.each(["github", "stackexchange"] as const)("bounds oversized %s responses without retaining the body", async provider => {
    const secretBody = `do-not-persist-${"x".repeat(200)}`;
    const { dependencies, finished } = makeDependencies(
      async () => new Response(secretBody, { status: 200, headers: { "content-length": String(secretBody.length) } }),
      { maxResponseBytes: 32 },
    );
    const descriptor = providerDescriptor(provider, "SOURCE_SEARCH");
    const adapter = provider === "github" ? createGitHubAdapter({ descriptor, dependencies })
      : createStackExchangeAdapter({ descriptor, dependencies });
    const result = await runAdapter(adapter);
    expect(result).toMatchObject({ status: "FAILED", failureKind: "MALFORMED_RESPONSE", value: null });
    expect(finished).toEqual([expect.objectContaining({ status: "FAILED",
      responseMetadata: expect.objectContaining({ failureKind: "MALFORMED_RESPONSE", errorCode: "INTERNAL_ERROR" }) })]);
    expect(JSON.stringify({ result, finished })).not.toContain(secretBody);
  });

  it.each(["github", "stackexchange"] as const)("times out %s HTTP work with one terminal run", async provider => {
    const { dependencies, finished } = makeDependencies(
      async (_input, init) => waitForAbort(init?.signal as AbortSignal), { timeoutMs: 5 },
    );
    const descriptor = providerDescriptor(provider, "SOURCE_SEARCH");
    const adapter = provider === "github" ? createGitHubAdapter({ descriptor, dependencies })
      : createStackExchangeAdapter({ descriptor, dependencies });
    expect(await runAdapter(adapter)).toMatchObject({ status: "TIMEOUT", failureKind: "TIMEOUT", value: null });
    expect(finished).toEqual([expect.objectContaining({ status: "TIMEOUT",
      responseMetadata: expect.objectContaining({ failureKind: "TIMEOUT", errorCode: "TIMEOUT" }) })]);
  });

  it.each(["github", "stackexchange"] as const)("cancels active %s HTTP work with one terminal run", async provider => {
    const controller = new AbortController();
    const { dependencies, finished } = makeDependencies(
      async (_input, init) => waitForAbort(init?.signal as AbortSignal), { timeoutMs: 100 },
    );
    const descriptor = providerDescriptor(provider, "SOURCE_SEARCH");
    const adapter = provider === "github" ? createGitHubAdapter({ descriptor, dependencies })
      : createStackExchangeAdapter({ descriptor, dependencies });
    const running = runWithProviderReservation(providerRequest(profile, [descriptor], {
      traceId: "task-k-cancelled-fixture", signal: controller.signal,
      budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 1 },
    }), (_selected, context) => adapter.search({ keywords: ["customer intake"] }, context));
    setTimeout(() => controller.abort(new Error("fixture cancellation")), 5);
    await expect(running).rejects.toMatchObject({ kind: "CANCELLED" });
    expect(finished).toEqual([expect.objectContaining({ status: "FAILED",
      responseMetadata: expect.objectContaining({ failureKind: "CANCELLED", errorCode: null }) })]);
  });

  it("fails closed on malformed source payloads", async () => {
    for (const provider of ["github", "stackexchange"] as const) {
      const { dependencies } = makeDependencies(async () => fakeResponse({ items: "drift" }));
      const descriptor = providerDescriptor(provider, "SOURCE_SEARCH");
      const adapter = provider === "github" ? createGitHubAdapter({ descriptor, dependencies })
        : createStackExchangeAdapter({ descriptor, dependencies });
      expect(await runAdapter(adapter)).toMatchObject({ status: "FAILED", failureKind: "MALFORMED_RESPONSE", value: null });
    }
  });
});
