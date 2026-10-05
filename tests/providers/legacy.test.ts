import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import type { Campaign } from "../../types/campaign";
import { marketProfile } from "../domain/contract-fixtures";
import { createLegacyProviderBridge } from "../../worker/providers/legacy";
import type {
  CompanyResolutionProvider,
  DiscoveredSignal,
  ProviderResult,
  SignalSourceAdapter,
} from "../../worker/providers/contracts";
import { providerDescriptor } from "./helpers";

const profile = MarketProfileSchema.parse({
  ...marketProfile,
  capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "HUMAN_REVIEW"],
});

function success<T>(provider: ProviderResult<T>["provider"], value: T): ProviderResult<T> {
  return {
    schemaVersion: 1,
    providerRunId: "legacy-fixture-run",
    provider,
    providerVersion: "fixture-v1",
    status: "SUCCEEDED",
    startedAt: "2026-10-05T12:00:00.000Z",
    finishedAt: "2026-10-05T12:00:00.001Z",
    latencyMs: 1,
    usage: { requestCount: 1, recordCount: 1 },
    cost: { configuredAmount: 0, reservedAmount: 0, actualAmount: 0, currency: null },
    provenance: [],
    limitations: [],
    value,
    failureKind: null,
    capabilityError: null,
  };
}

describe("legacy provider wrappers", () => {
  it("imports without credentials and keeps empty/null fallback shapes without network access", async () => {
    vi.stubEnv("REDDIT_CLIENT_ID", "");
    vi.stubEnv("REDDIT_CLIENT_SECRET", "");
    vi.stubEnv("EXA_API_KEY", "");
    vi.stubEnv("SERPER_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("INTENTLEAD_REDDIT_LEGAL_STATUS", "");
    vi.stubEnv("INTENTLEAD_HN_LEGAL_STATUS", "");
    vi.stubEnv("INTENTLEAD_EXA_LEGAL_STATUS", "");
    vi.stubEnv("INTENTLEAD_SERPER_LEGAL_STATUS", "");
    vi.stubEnv("INTENTLEAD_EXA_COST_PER_RESOLUTION", "");
    vi.stubEnv("INTENTLEAD_SERPER_COST_PER_RESOLUTION", "");
    vi.stubEnv("INTENTLEAD_PROVIDER_COST_CURRENCY", "");
    const globalFetch = vi.fn(() => { throw new Error("provider tests must not use global fetch"); });
    vi.stubGlobal("fetch", globalFetch);

    const signals = await import("../../worker/pipeline/signals");
    const company = await import("../../worker/pipeline/company");
    const campaign = {
      id: "campaign-fixture",
      keywords: ["synthetic public signal"],
    } as Campaign;

    await expect(signals.fetchSignals(campaign)).resolves.toEqual([]);
    await expect(company.identifyCompany("synthetic_person_handle", "Fictional public business signal"))
      .resolves.toEqual({ companyName: null, companyDomain: null });
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it("does not construct providers or inference when secrets exist but trusted context is missing", async () => {
    vi.stubEnv("REDDIT_CLIENT_ID", "fixture-client-id");
    vi.stubEnv("REDDIT_CLIENT_SECRET", "fixture-client-secret");
    vi.stubEnv("EXA_API_KEY", "fixture-exa-key");
    vi.stubEnv("SERPER_API_KEY", "fixture-serper-key");
    vi.stubEnv("OPENAI_API_KEY", "fixture-openai-key");
    vi.stubEnv("INTENTLEAD_REDDIT_LEGAL_STATUS", "ALLOWED");
    vi.stubEnv("INTENTLEAD_HN_LEGAL_STATUS", "ALLOWED");
    vi.stubEnv("INTENTLEAD_EXA_LEGAL_STATUS", "ALLOWED");
    vi.stubEnv("INTENTLEAD_SERPER_LEGAL_STATUS", "ALLOWED");
    vi.stubEnv("INTENTLEAD_OPENAI_LEGAL_STATUS", "ALLOWED");
    vi.stubEnv("INTENTLEAD_EXA_COST_PER_CALL", "0.02");
    vi.stubEnv("INTENTLEAD_SERPER_COST_PER_CALL", "0.02");
    vi.stubEnv("INTENTLEAD_OPENAI_COST_PER_INFERENCE", "0.05");
    vi.stubEnv("INTENTLEAD_PROVIDER_COST_CURRENCY", "USD");
    const globalFetch = vi.fn(() => { throw new Error("provider tests must not use global fetch"); });
    vi.stubGlobal("fetch", globalFetch);
    const createProviders = vi.fn(() => { throw new Error("provider construction must wait for trusted context"); });
    const bridge = createLegacyProviderBridge({
      async resolveContext() { return null; },
      createProviders,
      warn() {},
    });
    const campaign = { id: "campaign-with-secrets", keywords: ["synthetic search"] } as Campaign;

    await expect(bridge.fetchSignals(campaign)).resolves.toEqual([]);
    await expect(bridge.identifyCompany("synthetic_handle", "synthetic company signal")).resolves.toEqual({ companyName: null, companyDomain: null });
    expect(createProviders).not.toHaveBeenCalled();
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it("maps registry-selected injected adapters to the existing legacy return shapes", async () => {
    const signalController = new AbortController();
    const signal: DiscoveredSignal = {
      source: "hackernews",
      externalId: "fixture-hn-legacy",
      sourceUrl: "https://acme.test/operations",
      content: "Fictional public business signal",
      context: "fixture",
      publishedAt: "2026-10-05T10:00:00.000Z",
    };
    const sourceProvider: SignalSourceAdapter = {
      descriptor: providerDescriptor("hackernews", "SOURCE_SEARCH"),
      async search() { return success("hackernews", [signal]); },
    };
    const companyProvider: CompanyResolutionProvider = {
      descriptor: providerDescriptor("exa", "COMPANY_RESOLUTION"),
      async resolve() {
        return success("exa", [{
          companyName: "Acme Example",
          companyDomain: "example.com",
          confidence: 0.9,
          resolutionStatus: "RESOLVED",
          evidence: [],
        }]);
      },
    };
    const bridge = createLegacyProviderBridge({
      async resolveContext() { return {
        profile,
        language: "en",
        region: "US",
        jurisdiction: null,
        traceId: "legacy-fixture-trace",
        signal: signalController.signal,
        budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 2 },
        health: {},
      }; },
      createProviders: () => ({
        sources: new Map([["hackernews", sourceProvider]]),
        companies: new Map([["exa", companyProvider]]),
      }),
      warn() { throw new Error("Unexpected legacy adapter warning"); },
    });
    const campaign = { id: "campaign-fixture", keywords: ["fictional operations"] } as Campaign;

    await expect(bridge.fetchSignals(campaign)).resolves.toEqual([{
      campaign_id: campaign.id,
      source: "hackernews",
      source_url: signal.sourceUrl,
      author_handle: "unknown",
      content: signal.content,
      context: signal.context,
      posted_at: signal.publishedAt,
    }]);
    await expect(bridge.identifyCompany("ignored_author", signal.content)).resolves.toEqual({
      companyName: "Acme Example",
      companyDomain: "example.com",
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
