import type { Campaign } from "../../types/campaign";
import type { CreateSignalInput } from "../../types/signal";
import type { MarketProfile } from "../../types/market-profile";
import {
  ProviderCancelledError,
  type CompanyResolutionProvider,
  type ProviderBudget,
  type ProviderDescriptor,
  type ProviderHealth,
  type ProviderId,
  type ProviderCallContext,
  type SignalSourceAdapter,
} from "./contracts";
import { executeProviderWithFallback } from "./registry";
import { createRedditAdapter } from "./reddit";
import { createHackerNewsAdapter } from "./hackernews";
import { createExaCompanyResolutionProvider, createSerperCompanyResolutionProvider } from "./company-resolution";
import { createProviderRuntimeDependencies } from "./runtime";

export interface AuthorizedLegacyProviderContext {
  profile: MarketProfile;
  language: string;
  region: string;
  jurisdiction: string | null;
  traceId: string;
  signal: AbortSignal;
  budget: ProviderBudget;
  health: Partial<Record<ProviderId, ProviderHealth>>;
}

interface LegacyProviders {
  sources: Map<ProviderId, SignalSourceAdapter>;
  companies: Map<ProviderId, CompanyResolutionProvider>;
}

interface LegacyProviderBridgeOptions {
  resolveContext(campaign: Campaign | null): Promise<AuthorizedLegacyProviderContext | null>;
  createProviders(): LegacyProviders;
  warn(event: string, traceId?: string): void;
}

export function createLegacyProviderBridge(options: LegacyProviderBridgeOptions) {
  return {
    async fetchSignals(campaign: Campaign): Promise<CreateSignalInput[]> {
      const context = await options.resolveContext(campaign);
      if (!context) {
        options.warn("legacy_provider_context_unavailable");
        return [];
      }
      if (context.signal.aborted) throw new ProviderCancelledError();

      const providers = options.createProviders();
      const descriptors = [...providers.sources.values()].map(provider => provider.descriptor);
      const result = await executeProviderWithFallback({
        profile: context.profile,
        capability: "SOURCE_SEARCH",
        language: context.language,
        region: context.region,
        jurisdiction: context.jurisdiction,
        health: context.health,
        budget: context.budget,
        descriptors,
        allowFallback: true,
        traceId: context.traceId,
        signal: context.signal,
      }, descriptor => {
        const adapter = providers.sources.get(descriptor.id);
        if (!adapter) throw new Error("Selected source adapter is not registered");
        return adapter.search({ keywords: campaign.keywords }, callContext(context));
      });
      if (!result.ok || result.outcome.status === "FAILED" || result.outcome.status === "RATE_LIMITED"
        || result.outcome.status === "TIMEOUT") {
        options.warn("legacy_provider_source_search_unavailable", context.traceId);
        return [];
      }

      if (!result.outcome.value) return [];
      return result.outcome.value.map(signal => ({
        campaign_id: campaign.id,
        source: signal.source,
        source_url: signal.sourceUrl,
        author_handle: "unknown",
        content: signal.content,
        ...(signal.context ? { context: signal.context } : {}),
        ...(signal.publishedAt ? { posted_at: signal.publishedAt } : {}),
      }));
    },

    async identifyCompany(_authorHandle: string, signalContent: string): Promise<{ companyName: string | null; companyDomain: string | null }> {
      const context = await options.resolveContext(null);
      if (!context) {
        options.warn("legacy_provider_context_unavailable");
        return { companyName: null, companyDomain: null };
      }
      if (context.signal.aborted) throw new ProviderCancelledError();

      const providers = options.createProviders();
      const descriptors = [...providers.companies.values()].map(provider => provider.descriptor);
      const result = await executeProviderWithFallback({
        profile: context.profile,
        capability: "COMPANY_RESOLUTION",
        language: context.language,
        region: context.region,
        jurisdiction: context.jurisdiction,
        health: context.health,
        budget: context.budget,
        descriptors,
        allowFallback: true,
        traceId: context.traceId,
        signal: context.signal,
      }, descriptor => {
        const provider = providers.companies.get(descriptor.id);
        if (!provider) throw new Error("Selected company provider is not registered");
        return provider.resolve({ signalContent }, callContext(context));
      });
      if (!result.ok || result.outcome.status === "FAILED" || result.outcome.status === "RATE_LIMITED"
        || result.outcome.status === "TIMEOUT") {
        options.warn("legacy_provider_company_resolution_unavailable", context.traceId);
        return { companyName: null, companyDomain: null };
      }
      const candidates = result.outcome.value;
      if (!candidates) return { companyName: null, companyDomain: null };
      const candidate = candidates.length === 1 ? candidates[0] : null;
      return candidate?.resolutionStatus === "RESOLVED"
        ? { companyName: candidate.companyName, companyDomain: candidate.companyDomain }
        : { companyName: null, companyDomain: null };
    },
  };
}

function callContext(context: AuthorizedLegacyProviderContext): ProviderCallContext {
  return { profile: context.profile, traceId: context.traceId, signal: context.signal };
}

function readLegalStatus(key: string): ProviderDescriptor["legalStatus"] {
  const value = process.env[key];
  return value === "ALLOWED" || value === "RESTRICTED" || value === "PROHIBITED" ? value : "UNASSESSED";
}

function readConfiguredCost(key: string): ProviderDescriptor["configuredCost"] {
  const rawAmount = process.env[key];
  const currency = process.env.INTENTLEAD_PROVIDER_COST_CURRENCY;
  if (!rawAmount || !currency || !/^[A-Z]{3}$/.test(currency)) return { amount: null, currency: null };
  const amount = Number(rawAmount);
  return Number.isFinite(amount) && amount >= 0
    ? { amount, currency }
    : { amount: null, currency: null };
}

function envDescriptor(input: {
  id: ProviderId;
  capability: ProviderDescriptor["capability"];
  priority: number;
  available: boolean;
  legalKey: string;
  cost: ProviderDescriptor["configuredCost"];
}): ProviderDescriptor {
  return {
    id: input.id,
    version: "1",
    capability: input.capability,
    priority: input.priority,
    marketProfiles: ["EN_DISCOVERY_ONLY"],
    languages: ["en"],
    regions: ["*"],
    jurisdictions: ["*"],
    legalStatus: readLegalStatus(input.legalKey),
    available: input.available,
    configuredCost: input.cost,
  };
}

async function inferCompany(input: Parameters<import("./contracts").CompanyInference["infer"]>[0]): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Company inference is not configured");
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: input.messages.map(message => ({ role: message.role, content: message.content })),
    response_format: { type: "json_object" },
    max_tokens: 300,
  }, { signal: input.signal });
  return response.choices[0]?.message?.content ?? "";
}

function createEnvironmentProviders(): LegacyProviders {
  const dependencies = createProviderRuntimeDependencies();
  const reddit = envDescriptor({
    id: "reddit", capability: "SOURCE_SEARCH", priority: 10,
    available: Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET),
    legalKey: "INTENTLEAD_REDDIT_LEGAL_STATUS",
    cost: { amount: 0, currency: null },
  });
  const hackernews = envDescriptor({
    id: "hackernews", capability: "SOURCE_SEARCH", priority: 20,
    available: true, legalKey: "INTENTLEAD_HN_LEGAL_STATUS",
    cost: { amount: 0, currency: null },
  });
  const inferenceReady = Boolean(process.env.OPENAI_API_KEY);
  const exa = envDescriptor({
    id: "exa", capability: "COMPANY_RESOLUTION", priority: 10,
    available: inferenceReady && Boolean(process.env.EXA_API_KEY),
    legalKey: "INTENTLEAD_EXA_LEGAL_STATUS",
    cost: readConfiguredCost("INTENTLEAD_EXA_COST_PER_RESOLUTION"),
  });
  const serper = envDescriptor({
    id: "serper", capability: "COMPANY_RESOLUTION", priority: 20,
    available: inferenceReady && Boolean(process.env.SERPER_API_KEY),
    legalKey: "INTENTLEAD_SERPER_LEGAL_STATUS",
    cost: readConfiguredCost("INTENTLEAD_SERPER_COST_PER_RESOLUTION"),
  });
  const inference = { infer: inferCompany };
  return {
    sources: new Map([
      ["reddit", createRedditAdapter({ clientId: process.env.REDDIT_CLIENT_ID ?? "", clientSecret: process.env.REDDIT_CLIENT_SECRET ?? "", descriptor: reddit, dependencies })],
      ["hackernews", createHackerNewsAdapter({ descriptor: hackernews, dependencies })],
    ]),
    companies: new Map([
      ["exa", createExaCompanyResolutionProvider({ apiKey: process.env.EXA_API_KEY ?? "", descriptor: exa, dependencies, inference })],
      ["serper", createSerperCompanyResolutionProvider({ apiKey: process.env.SERPER_API_KEY ?? "", descriptor: serper, dependencies, inference })],
    ]),
  };
}

// Legacy campaigns contain no authorized MarketProfile. Keep these public wrappers
// dormant until a trusted caller supplies the server-resolved context.
export const legacyProviderBridge = createLegacyProviderBridge({
  resolveContext: async () => null,
  createProviders: createEnvironmentProviders,
  warn(event, traceId) {
    process.stdout.write(`${JSON.stringify({ level: "warn", event, traceId: traceId ?? null })}\n`);
  },
});
