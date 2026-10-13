import { describe, expect, it } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { createGitHubAdapter } from "../../worker/providers/github";
import { createStackExchangeAdapter } from "../../worker/providers/stackexchange";
import type { DiscoveredSignal, ProviderResult, SignalSourceAdapter } from "../../worker/providers/contracts";
import { marketProfile } from "../domain/contract-fixtures";
import {
  fakeResponse, makeDependencies, providerDescriptor, providerFixture, providerRequest, runWithProviderReservation,
} from "./helpers";

const profile = MarketProfileSchema.parse({
  ...marketProfile,
  capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "HUMAN_REVIEW"],
});

async function runAdapter(adapter: SignalSourceAdapter): Promise<ProviderResult<DiscoveredSignal[]>> {
  return runWithProviderReservation(providerRequest(profile, [adapter.descriptor], {
    traceId: "task-k-provenance-fixture",
    budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 1 },
  }), (_selected, context) => adapter.search({ keywords: ["customer intake"] }, context));
}

function expectProvenanceBijection(result: ProviderResult<DiscoveredSignal[]>): void {
  const signals = result.value ?? [];
  expect(result.provenance).toHaveLength(signals.length);
  expect(new Set(result.provenance.map(item => item.providerSourceId)))
    .toEqual(new Set(signals.map(item => item.externalId)));
  for (const signal of signals) {
    expect(result.provenance.find(item => item.providerSourceId === signal.externalId)?.sourceUrl)
      .toBe(signal.sourceUrl);
  }
}

describe("Task K free-source provenance identity", () => {
  it.each([
    ["GitHub host", "github", {
      total_count: 1,
      items: [{
        id: 91, number: 7, html_url: "https://attacker.example/acme/repo/issues/7",
        repository_url: "https://api.github.com/repos/acme/repo", title: "Blocked", body: null,
        created_at: "2026-10-04T08:30:00Z",
      }],
    }],
    ["GitHub repository path identity", "github", {
      total_count: 1,
      items: [{
        id: 92, number: 7, html_url: "https://github.com/acme/repo/issues/7",
        repository_url: "https://api.github.com/repos/other/repo", title: "Blocked", body: null,
        created_at: "2026-10-04T08:30:00Z",
      }],
    }],
    ["GitHub issue number identity", "github", {
      total_count: 1,
      items: [{
        id: 93, number: 8, html_url: "https://github.com/acme/repo/issues/7",
        repository_url: "https://api.github.com/repos/acme/repo", title: "Blocked", body: null,
        created_at: "2026-10-04T08:30:00Z",
      }],
    }],
    ["Stack Exchange host", "stackexchange", {
      items: [{
        question_id: 81, link: "https://attacker.example/questions/81/example", title: "Blocked",
        creation_date: 1791187200,
      }],
      has_more: false,
    }],
    ["Stack Exchange question path identity", "stackexchange", {
      items: [{
        question_id: 81, link: "https://stackoverflow.com/questions/82/example", title: "Blocked",
        creation_date: 1791187200,
      }],
      has_more: false,
    }],
  ] as const)("fails closed when %s does not match the API record", async (_label, provider, payload) => {
    const { dependencies } = makeDependencies(async () => fakeResponse(payload));
    const descriptor = providerDescriptor(provider, "SOURCE_SEARCH");
    const adapter = provider === "github"
      ? createGitHubAdapter({ descriptor, dependencies })
      : createStackExchangeAdapter({ descriptor, dependencies });

    await expect(runAdapter(adapter)).resolves.toMatchObject({
      status: "FAILED", failureKind: "MALFORMED_RESPONSE", value: null,
    });
  });

  it("namespaces Stack Exchange external identity by the requested site", async () => {
    const { dependencies } = makeDependencies(async () => fakeResponse({
      items: [{
        question_id: 81, link: "https://superuser.com/questions/81/example", title: "Blocked workflow",
        creation_date: 1791187200,
      }],
      has_more: false,
    }));
    const result = await runAdapter(createStackExchangeAdapter({
      descriptor: providerDescriptor("stackexchange", "SOURCE_SEARCH"), dependencies, site: "superuser",
    }));

    expect(result.value?.[0]).toMatchObject({
      externalId: "superuser:81", sourceUrl: "https://superuser.com/questions/81/example",
    });
    expectProvenanceBijection(result);
  });

  it("keeps exact GitHub signal/provenance identity across repeated runs", async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { dependencies } = makeDependencies(async () => fakeResponse({
        total_count: 1,
        items: [providerFixture("github-issues-page-1.json") as object].flatMap(value =>
          (value as { items: unknown[] }).items.slice(0, 1)),
      }), { maxRecords: 1 });
      const result = await runAdapter(createGitHubAdapter({
        descriptor: providerDescriptor("github", "SOURCE_SEARCH"), dependencies,
      }));
      expect(result.usage).toEqual(expect.objectContaining({ requestCount: 1, recordCount: 1 }));
      expectProvenanceBijection(result);
    }
  });
});
