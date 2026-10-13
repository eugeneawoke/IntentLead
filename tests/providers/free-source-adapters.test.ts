import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { DEFAULT_SOURCE_CATALOG } from "../../lib/domain/source-catalog";
import { createGitHubAdapter } from "../../worker/providers/github";
import { createStackExchangeAdapter } from "../../worker/providers/stackexchange";
import type { DiscoveredSignal, ProviderResult, SignalSourceAdapter } from "../../worker/providers/contracts";
import { marketProfile } from "../domain/contract-fixtures";
import { fakeResponse, makeDependencies, providerDescriptor, providerFixture, providerRequest, runWithProviderReservation } from "./helpers";

const profile = MarketProfileSchema.parse({
  ...marketProfile,
  capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "HUMAN_REVIEW"],
});

async function runAdapter(adapter: SignalSourceAdapter, keywords = ["customer intake"]): Promise<ProviderResult<DiscoveredSignal[]>> {
  return runWithProviderReservation(providerRequest(profile, [adapter.descriptor], {
    traceId: "task-k-fixture",
    budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 1 },
  }), (_selected, context) => adapter.search({ keywords }, context));
}

function expectProvenanceBijection(result: ProviderResult<DiscoveredSignal[]>): void {
  expect(result.value).not.toBeNull();
  const signals = result.value ?? [];
  expect(result.provenance).toHaveLength(signals.length);
  expect(new Set(result.provenance.map(item => item.providerSourceId)))
    .toEqual(new Set(signals.map(item => item.externalId)));
  for (const signal of signals) {
    expect(result.provenance.find(item => item.providerSourceId === signal.externalId)?.sourceUrl)
      .toBe(signal.sourceUrl);
  }
}

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("global network access is forbidden"); })));
afterEach(() => vi.unstubAllGlobals());

describe("Task K free source adapters", () => {
  it("normalizes and bounds paginated GitHub issues with exact provenance", async () => {
    const calls: string[] = [];
    const { dependencies } = makeDependencies(async input => {
      const url = new URL(String(input));
      calls.push(url.toString());
      return fakeResponse(providerFixture(url.searchParams.get("page") === "2"
        ? "github-issues-page-2.json" : "github-issues-page-1.json"));
    }, { maxRecords: 2 });
    const adapter = createGitHubAdapter({
      descriptor: providerDescriptor("github", "SOURCE_SEARCH"), dependencies, token: "fixture-token",
    });
    const result = await runAdapter(adapter);

    expect(result.status).toBe("SUCCEEDED");
    expect(result.value).toHaveLength(2);
    expect(result.value?.[0]).toMatchObject({
      source: "github", externalId: "91001", context: "fixture-org/fixture-repo",
      sourceUrl: "https://github.com/fixture-org/fixture-repo/issues/101",
    });
    expect(result.value?.[0]?.content).toContain("[email redacted]");
    expect(result.value?.[0]?.content).not.toMatch(/415|jane@example\.test/i);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("is%3Aissue");
    expectProvenanceBijection(result);
  });

  it("maps a GitHub secondary-rate-limit 403 from official headers", async () => {
    const { dependencies } = makeDependencies(async () => fakeResponse(
      { message: "rate limit" }, 403, { "x-ratelimit-remaining": "0", "retry-after": "120" },
    ));
    const result = await runAdapter(createGitHubAdapter({
      descriptor: providerDescriptor("github", "SOURCE_SEARCH"), dependencies,
    }));

    expect(result.status).toBe("RATE_LIMITED");
    expect(result.capabilityError).toMatchObject({ code: "RATE_LIMITED", retryAfterMs: 120_000 });
  });

  it("maps GitHub 429 to one terminal rate-limited provider run", async () => {
    const { dependencies, finished } = makeDependencies(async () => fakeResponse(
      { message: "secondary rate limit" }, 429, { "retry-after": "15" },
    ));
    const result = await runAdapter(createGitHubAdapter({
      descriptor: providerDescriptor("github", "SOURCE_SEARCH"), dependencies,
    }));

    expect(result).toMatchObject({
      status: "RATE_LIMITED",
      failureKind: "RATE_LIMITED",
      capabilityError: { code: "RATE_LIMITED", retryAfterMs: 15_000 },
      usage: { requestCount: 1, recordCount: 0 },
    });
    expect(finished).toEqual([
      expect.objectContaining({
        status: "RATE_LIMITED",
        responseMetadata: expect.objectContaining({ failureKind: "RATE_LIMITED", errorCode: "RATE_LIMITED" }),
      }),
    ]);
  });

  it("retains Stack Exchange results once and stops immediately on wrapper backoff", async () => {
    const calls: string[] = [];
    const { dependencies } = makeDependencies(async input => {
      calls.push(String(input));
      return fakeResponse(providerFixture("stackexchange-questions.json"));
    }, { maxRecords: 20 });
    const result = await runAdapter(createStackExchangeAdapter({
      descriptor: providerDescriptor("stackexchange", "SOURCE_SEARCH"), dependencies, apiKey: "fixture-key",
    }));

    expect(result.status).toBe("PARTIAL");
    expect(result.failureKind).toBe("RATE_LIMITED");
    expect(result.capabilityError).toMatchObject({ code: "RATE_LIMITED", retryAfterMs: 120_000 });
    expect(result.value).toHaveLength(1);
    expect(result.value?.[0]).toMatchObject({
      source: "stackexchange", externalId: "stackoverflow:81001",
      sourceUrl: "https://stackoverflow.com/questions/81001/fixture-workflow-question",
    });
    expect(result.value?.[0]?.content).toContain("[email redacted]");
    expect(calls).toHaveLength(1);
    expectProvenanceBijection(result);
  });

  it("stops Stack Exchange at the configured page bound even when has_more stays true", async () => {
    const calls: string[] = [];
    const { dependencies } = makeDependencies(async input => {
      calls.push(String(input));
      return fakeResponse({
        items: [
          {
            question_id: 81001,
            link: "https://stackoverflow.com/questions/81001/bounded-question",
            title: "Need a bounded workflow",
            body: "The same fixture remains visible on every page.",
            tags: ["workflow"],
            creation_date: 1791187200,
          },
          {
            question_id: 81001,
            link: "https://stackoverflow.com/questions/81001/bounded-question",
            title: "Duplicate bounded question",
            body: "This duplicate must not expand the result set.",
            tags: ["workflow"],
            creation_date: 1791187200,
          },
        ],
        has_more: true,
        quota_remaining: 100,
      });
    }, { maxRecords: 2 });
    const result = await runAdapter(createStackExchangeAdapter({
      descriptor: providerDescriptor("stackexchange", "SOURCE_SEARCH"), dependencies,
    }));

    expect(result.status).toBe("SUCCEEDED");
    expect(result.value).toHaveLength(1);
    expect(result.usage).toMatchObject({
      requestCount: 2, rawRecordCount: 4, normalizedRecordCount: 4, deduplicatedRecordCount: 1,
    });
    expect(calls.map(call => new URL(call).searchParams.get("page"))).toEqual(["1", "2"]);
    expectProvenanceBijection(result);
  });

  it("honors Stack Exchange backoff when quota is exhausted and records one partial terminal run", async () => {
    const { dependencies, finished } = makeDependencies(async () => fakeResponse({
      items: [{
        question_id: 81002,
        link: "https://stackoverflow.com/questions/81002/quota-question",
        title: "Need help before quota reset",
        body: "A valid result arrived with explicit backoff metadata.",
        tags: ["workflow"],
        creation_date: 1791187200,
      }],
      has_more: true,
      quota_remaining: 0,
      backoff: 30,
    }));
    const result = await runAdapter(createStackExchangeAdapter({
      descriptor: providerDescriptor("stackexchange", "SOURCE_SEARCH"), dependencies,
    }));

    expect(result).toMatchObject({
      status: "PARTIAL",
      failureKind: "RATE_LIMITED",
      capabilityError: { code: "RATE_LIMITED", retryAfterMs: 30_000 },
      usage: { requestCount: 1, recordCount: 1 },
    });
    expect(finished).toEqual([
      expect.objectContaining({
        status: "PARTIAL",
        responseMetadata: expect.objectContaining({ failureKind: "RATE_LIMITED", errorCode: "RATE_LIMITED" }),
      }),
    ]);
    expectProvenanceBijection(result);
  });

  it("stops on exhausted Stack Exchange quota even without a backoff value", async () => {
    const calls: string[] = [];
    const { dependencies } = makeDependencies(async input => {
      calls.push(String(input));
      return fakeResponse({
        items: [{
          question_id: 81003, link: "https://stackoverflow.com/questions/81003/quota-question",
          title: "Need help before quota reset", creation_date: 1791187200,
        }],
        has_more: true, quota_remaining: 0,
      });
    });
    const result = await runAdapter(createStackExchangeAdapter({
      descriptor: providerDescriptor("stackexchange", "SOURCE_SEARCH"), dependencies,
    }));
    expect(result).toMatchObject({
      status: "PARTIAL", failureKind: "RATE_LIMITED",
      capabilityError: { code: "RATE_LIMITED", retryAfterMs: null },
    });
    expect(calls).toHaveLength(1);
  });

  it("enforces one HTTP request ceiling across Stack Exchange keywords and pages", async () => {
    let questionId = 82000;
    const { dependencies } = makeDependencies(async () => fakeResponse({
      items: [{
        question_id: ++questionId, link: `https://stackoverflow.com/questions/${questionId}/bounded`,
        title: "Bounded request", creation_date: 1791187200,
      }],
      has_more: true, quota_remaining: 100,
    }), { maxRequestsPerRun: 2, maxKeywords: 5, maxRecords: 10 });
    const adapter = createStackExchangeAdapter({
      descriptor: providerDescriptor("stackexchange", "SOURCE_SEARCH"), dependencies,
    });
    const result = await runAdapter(adapter, ["one", "two", "three"]);
    expect(result.usage.requestCount).toBe(2);
    expect(result.limitations).toContain("The per-run HTTP request ceiling truncated pagination.");
  });

  it("keeps implemented adapters disabled until a live activation gate", () => {
    for (const providerKey of ["github", "stackexchange"]) {
      expect(DEFAULT_SOURCE_CATALOG.find(entry => entry.providerKey === providerKey)).toMatchObject({
        state: "DISABLED", legalStatus: "ALLOWED", configuredCost: { amount: 0, currency: "USD" },
      });
    }
  });

});
