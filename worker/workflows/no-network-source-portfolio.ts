import { createHash } from "node:crypto";
import { DEFAULT_SOURCE_CATALOG } from "../../lib/domain/source-catalog";
import { buildSourcePlan } from "../../lib/domain/source-plan";
import type { DiscoverySearchResult, SelfProspectingRegistry } from "../../types/self-prospecting";
import { createGitHubAdapter } from "../providers/github";
import { executeSourcePortfolio } from "../providers/source-portfolio";
import { createStackExchangeAdapter } from "../providers/stackexchange";
import type {
  ProviderDescriptor, ProviderHttpClient, ProviderRunRecorder, ProviderRuntimeDependencies, SignalSourceAdapter,
} from "../providers/contracts";
import type { NoNetworkExecutionAuthority } from "../providers/no-network-authority";

const OBSERVED_AT = "2026-10-10T00:00:00.000Z";

function fixtureDescriptor(id: "github" | "stackexchange", priority: number): ProviderDescriptor {
  return {
    id, version: "fixture-v1", capability: "SOURCE_SEARCH", priority,
    marketProfiles: ["EN_DISCOVERY_ONLY"], languages: ["en"], regions: ["*"], jurisdictions: ["*"],
    legalStatus: "ALLOWED", operationalState: "fixture_only", stateObservedAt: OBSERVED_AT,
    stateReason: "Deterministic no-network contract fixture", retryAfterMs: null,
    configuredCost: { amount: 0, currency: null },
  };
}

function deterministicId(value: string): string {
  const bytes = Buffer.from(createHash("sha256").update(value).digest().subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function recordedHttp(): ProviderHttpClient {
  return async input => {
    const url = new URL(input);
    if (url.hostname === "api.github.com" && url.pathname === "/search/issues") {
      return new Response(JSON.stringify({
        total_count: 1,
        items: [{
          id: 1001, number: 41, html_url: "https://github.com/acme-example/platform/issues/41",
          repository_url: "https://api.github.com/repos/acme-example/platform",
          title: "Looking for a better vendor review workflow",
          body: "Repeated manual vendor checks are blocking our launch.", created_at: "2026-10-05T10:00:00Z",
        }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.hostname === "api.stackexchange.com" && url.pathname === "/2.3/search/advanced") {
      return new Response(JSON.stringify({
        items: [{
          question_id: 2002, link: "https://stackoverflow.com/questions/2002/vendor-review-workflow",
          title: "Looking for a better vendor review workflow",
          body: "Our repeated manual vendor checks are delaying operations.", tags: ["workflow"],
          creation_date: 1791187200,
        }],
        has_more: false, quota_remaining: 299,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`No-network source fixture rejected URL: ${url.origin}${url.pathname}`);
  };
}

function dependencies(jobId: string, now: () => Date): ProviderRuntimeDependencies {
  const recorder: ProviderRunRecorder = { async start() {}, async finish() {} };
  let sequence = 0;
  return {
    http: recordedHttp(), now, sleep: async () => undefined,
    createId: () => deterministicId(`${jobId}:source-run:${++sequence}`), recorder,
    timeoutMs: 250, maxResponseBytes: 100_000, maxRequestsPerRun: 2,
    maxKeywords: 1, maxRecords: 1, maxContentChars: 2_000,
  };
}

export function createNoNetworkPortfolioSearch(
  clock: () => Date = () => new Date(),
  authority?: NoNetworkExecutionAuthority,
): SelfProspectingRegistry["search"] {
  return async ({ job, profile, brief, signal, budget }): Promise<DiscoverySearchResult> => {
    const runtime = dependencies(job.id, clock);
    const adapters: SignalSourceAdapter[] = [
      createGitHubAdapter({ descriptor: fixtureDescriptor("github", 10), dependencies: runtime }),
      createStackExchangeAdapter({ descriptor: fixtureDescriptor("stackexchange", 20), dependencies: runtime }),
    ];
    const catalog = DEFAULT_SOURCE_CATALOG.filter(source => adapters.some(adapter => adapter.descriptor.id === source.providerKey))
      .map(source => ({ ...source, state: "READY" as const }));
    const plan = buildSourcePlan({
      schemaVersion: 1, id: deterministicId(`${job.id}:source-plan`), workspaceId: job.workspaceId,
      discoveryBriefId: brief.id, marketProfileId: "EN_DISCOVERY_ONLY", languages: [...brief.languages],
      businessType: "SAAS", signalFamilies: [...brief.signalFamilies], requestedConfirmedSignals: 20,
      maxProviders: adapters.length, budget: { currency: budget.currency, maxCost: budget.remainingCost },
      createdAt: clock().toISOString(),
    }, catalog);
    const result = await executeSourcePortfolio({
      plan, authority: { workspaceId: job.workspaceId, discoveryBriefId: brief.id },
      adapters: new Map(adapters.map(adapter => [adapter.descriptor.id, adapter])),
      selection: {
        profile, language: brief.languages[0]!, region: profile.regions[0] ?? "GLOBAL", jurisdiction: null,
        executionMode: authority ? "no_network" : "fixture", noNetworkAuthority: authority,
        timeoutMs: 500, traceId: job.traceId, signal,
      },
      budget, keywords: [brief.objective],
    });
    return {
      signals: result.signals, providerRuns: result.providerRuns, remainingBudget: result.remainingBudget,
      error: result.signals.length === 0 ? result.unavailableSources.find(item => item.error)?.error ?? null : null,
    };
  };
}
