import { describe, expect, it } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { buildSourcePlan } from "../../lib/domain/source-plan";
import { DEFAULT_SOURCE_CATALOG } from "../../lib/domain/source-catalog";
import { createGitHubAdapter } from "../../worker/providers/github";
import { createStackExchangeAdapter } from "../../worker/providers/stackexchange";
import { executeSourcePortfolio } from "../../worker/providers/source-portfolio";
import { marketProfile } from "../domain/contract-fixtures";
import { fakeResponse, makeDependencies, providerDescriptor } from "./helpers";

const profile = MarketProfileSchema.parse({
  ...marketProfile,
  capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "HUMAN_REVIEW"],
});

describe("source-plan portfolio execution", () => {
  it("runs every executable planned adapter and combines unique signals", async () => {
    const catalog = DEFAULT_SOURCE_CATALOG.filter(entry => ["github", "stackexchange"].includes(entry.providerKey))
      .map(entry => ({ ...entry, state: "READY" as const }));
    const plan = buildSourcePlan({
      schemaVersion: 1, id: "plan-1", workspaceId: "workspace-1", discoveryBriefId: "brief-1",
      marketProfileId: "EN_DISCOVERY_ONLY", languages: ["en"], businessType: "SAAS",
      signalFamilies: ["DETECTED_PROBLEM"], requestedConfirmedSignals: 20, maxProviders: 2,
      budget: { currency: "USD", maxCost: 0 }, createdAt: "2026-10-06T12:00:00.000Z",
    }, catalog);
    const githubRuntime = makeDependencies(async () => fakeResponse({
      total_count: 1,
      items: [{
        id: 1, number: 1, html_url: "https://github.com/acme/repo/issues/1",
        repository_url: "https://api.github.com/repos/acme/repo", title: "Need workflow help", body: "Launch is blocked",
        created_at: "2026-10-05T10:00:00Z",
      }],
    }), { maxRecords: 1 });
    const stackRuntime = makeDependencies(async () => fakeResponse({
      items: [{
        question_id: 2, link: "https://stackoverflow.com/questions/2/example", title: "Need workflow help",
        body: "Implementation is blocked", tags: ["workflow"], creation_date: 1791187200,
      }],
      has_more: false,
    }), { maxRecords: 1, createId: () => "fixture-stack-run-1" });
    const github = createGitHubAdapter({
      descriptor: providerDescriptor("github", "SOURCE_SEARCH"), dependencies: githubRuntime.dependencies,
    });
    const stackexchange = createStackExchangeAdapter({
      descriptor: providerDescriptor("stackexchange", "SOURCE_SEARCH"), dependencies: stackRuntime.dependencies,
    });
    const result = await executeSourcePortfolio({
      plan,
      authority: { workspaceId: "workspace-1", discoveryBriefId: "brief-1" },
      adapters: new Map([["github", github], ["stackexchange", stackexchange]]),
      selection: {
        profile, language: "en", region: "US", jurisdiction: null, executionMode: "fixture", timeoutMs: 100,
        traceId: "portfolio-fixture",
      },
      budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 2 },
      keywords: ["workflow"],
    });

    expect(result.attemptedSources).toEqual(["github", "stackexchange"]);
    expect(result.signals.map(signal => signal.source)).toEqual(["github", "stackexchange"]);
    expect(result.providerRuns).toHaveLength(2);
    expect(result.unavailableSources).toEqual([]);
    expect(result.remainingBudget.remainingProviderCalls).toBe(0);
  });

  it("reports a missing adapter instead of treating a catalog entry as active", async () => {
    const catalog = DEFAULT_SOURCE_CATALOG.filter(entry => entry.providerKey === "github")
      .map(entry => ({ ...entry, state: "READY" as const }));
    const plan = buildSourcePlan({
      schemaVersion: 1, id: "plan-2", workspaceId: "workspace-1", discoveryBriefId: "brief-1",
      marketProfileId: "EN_DISCOVERY_ONLY", languages: ["en"], businessType: "SAAS",
      signalFamilies: ["DETECTED_PROBLEM"], requestedConfirmedSignals: 20, maxProviders: 1,
      budget: { currency: "USD", maxCost: 0 }, createdAt: "2026-10-06T12:00:00.000Z",
    }, catalog);
    const result = await executeSourcePortfolio({
      plan, authority: { workspaceId: "workspace-1", discoveryBriefId: "brief-1" }, adapters: new Map(),
      selection: { profile, language: "en", region: "US", jurisdiction: null, executionMode: "fixture", timeoutMs: 100 },
      budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 1 }, keywords: ["workflow"],
    });
    expect(result.attemptedSources).toEqual([]);
    expect(result.unavailableSources).toEqual([{ providerKey: "github", error: null }]);
  });

  it("rejects a plan outside the authorized workspace or brief", async () => {
    const plan = buildSourcePlan({
      schemaVersion: 1, id: "plan-3", workspaceId: "workspace-1", discoveryBriefId: "brief-1",
      marketProfileId: "EN_DISCOVERY_ONLY", languages: ["en"], businessType: "SAAS",
      signalFamilies: ["DETECTED_PROBLEM"], requestedConfirmedSignals: 20, maxProviders: 1,
      budget: { currency: "USD", maxCost: 0 }, createdAt: "2026-10-06T12:00:00.000Z",
    }, DEFAULT_SOURCE_CATALOG);
    await expect(executeSourcePortfolio({
      plan, authority: { workspaceId: "workspace-other", discoveryBriefId: "brief-1" }, adapters: new Map(),
      selection: { profile, language: "en", region: "US", jurisdiction: null, executionMode: "fixture", timeoutMs: 100 },
      budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 1 }, keywords: ["workflow"],
    })).rejects.toThrow("authorized workspace");
  });
});
