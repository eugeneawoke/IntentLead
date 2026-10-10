import { z } from "zod";
import {
  ProviderCancelledError,
  type DiscoveredSignal,
  type ProviderCallContext,
  type ProviderDescriptor,
  type ProviderRuntimeDependencies,
  type ProviderResult,
  type SignalSearchInput,
  type SignalSourceAdapter,
} from "./contracts";
import { ProviderHttpError, ProviderMalformedResponseError, requestJson } from "./http";
import { normalizeHttpUrl, normalizePublicSignalText, sanitizeCompanySignal } from "./normalization";
import { mapProviderFailure, runRecordedProvider, type ProviderOperationResult } from "./results";

const SEARCH_ENDPOINT = "https://api.stackexchange.com/2.3/search/advanced";
const MAX_ANONYMOUS_PAGES = 25;

const StackExchangeSearchSchema = z.object({
  items: z.array(z.object({
    question_id: z.number().int().nonnegative(),
    link: z.string().url(),
    title: z.string().min(1),
    body: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    creation_date: z.number().int().nonnegative(),
  }).passthrough()),
  has_more: z.boolean(),
  backoff: z.number().int().nonnegative().optional(),
  quota_remaining: z.number().int().nonnegative().optional(),
}).passthrough();

const StackExchangeSignalSchema = z.object({
  source: z.literal("stackexchange"),
  externalId: z.string().min(1),
  sourceUrl: z.string().url(),
  content: z.string().min(1).max(2_000),
  context: z.string().max(2_000).nullable(),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

export function createStackExchangeAdapter(config: {
  descriptor: ProviderDescriptor;
  dependencies: ProviderRuntimeDependencies;
  apiKey?: string;
  site?: string;
}): SignalSourceAdapter {
  const { descriptor, dependencies } = config;
  const apiKey = config.apiKey?.trim();
  const site = (config.site?.trim() || "stackoverflow").toLowerCase();
  const expectedHost = stackExchangeHost(site);

  return {
    descriptor,
    async search(input: SignalSearchInput, context: ProviderCallContext): Promise<ProviderResult<DiscoveredSignal[]>> {
      const keywords = input.keywords.map(value => sanitizeCompanySignal(value, 100)).filter(Boolean)
        .slice(0, dependencies.maxKeywords);
      return runRecordedProvider({
        descriptor,
        context,
        dependencies,
        inputCount: keywords.length,
        inputFingerprint: `${site}\n${keywords.join("\n")}`,
        async run(operation): Promise<ProviderOperationResult<DiscoveredSignal[]>> {
          if (!expectedHost) throw new ProviderMalformedResponseError();
          if (!keywords.length) return emptyResult();
          const records = new Map<string, DiscoveredSignal>();
          const provenance = new Map<string, ReturnType<typeof makeProvenance>>();
          const pageSize = Math.max(1, Math.min(100, dependencies.maxRecords));
          let requestCount = 0;
          let rawRecordCount = 0;
          let normalizedRecordCount = 0;
          let requestBudgetExhausted = false;

          searchLoop:
          for (const keyword of keywords) {
            const maxPages = Math.max(1, Math.min(MAX_ANONYMOUS_PAGES, dependencies.maxRecords));
            for (let page = 1; page <= maxPages && records.size < dependencies.maxRecords; page++) {
              if (requestCount >= dependencies.maxRequestsPerRun) {
                requestBudgetExhausted = true;
                break searchLoop;
              }
              if (operation.signal.aborted) throw new ProviderCancelledError();
              const query = new URLSearchParams({
                site, q: keyword, sort: "activity", order: "desc", filter: "withbody",
                pagesize: String(pageSize), page: String(page),
              });
              if (apiKey) query.set("key", apiKey);
              requestCount++;
              operation.recordRequest();
              try {
                const response = await requestJson(dependencies, `${SEARCH_ENDPOINT}?${query}`, {
                  method: "GET", headers: { Accept: "application/json" },
                }, operation.signal);
                const parsed = StackExchangeSearchSchema.safeParse(response);
                if (!parsed.success) throw new ProviderMalformedResponseError();
                rawRecordCount += parsed.data.items.length;
                normalizedRecordCount += normalizeItems(
                  parsed.data.items, records, provenance, operation.providerRunId, dependencies, site, expectedHost,
                );
                if (parsed.data.backoff !== undefined || parsed.data.quota_remaining === 0) {
                  const backoff = new ProviderHttpError("RATE_LIMITED", 429,
                    parsed.data.backoff === undefined ? null : parsed.data.backoff * 1_000);
                  return partialOrThrow(backoff, records, provenance, requestCount, rawRecordCount, normalizedRecordCount, descriptor, context);
                }
                if (!parsed.data.has_more || parsed.data.items.length < pageSize) break;
              } catch (error) {
                if (error instanceof ProviderCancelledError || operation.signal.aborted) throw new ProviderCancelledError();
                return partialOrThrow(error, records, provenance, requestCount, rawRecordCount, normalizedRecordCount, descriptor, context);
              }
            }
          }
          return completedResult(records, provenance, requestCount, rawRecordCount, normalizedRecordCount, descriptor, requestBudgetExhausted);
        },
      });
    },
  };
}

function normalizeItems(
  items: z.infer<typeof StackExchangeSearchSchema>["items"],
  records: Map<string, DiscoveredSignal>,
  provenance: Map<string, ReturnType<typeof makeProvenance>>,
  providerRunId: string,
  dependencies: ProviderRuntimeDependencies,
  site: string,
  expectedHost: string,
): number {
  let normalizedCount = 0;
  for (const item of items) {
    const externalId = `${site}:${item.question_id}`;
    const sourceUrl = stackExchangeQuestionUrl(item.link, expectedHost, item.question_id);
    const content = normalizePublicSignalText([item.title, item.body].filter(Boolean).join("\n"), dependencies.maxContentChars);
    const context = normalizePublicSignalText(item.tags?.join(", ") ?? site, 2_000) || site;
    const publishedAt = new Date(item.creation_date * 1_000);
    if (!sourceUrl || !content || !Number.isFinite(publishedAt.getTime())) throw new ProviderMalformedResponseError();
    const normalized = StackExchangeSignalSchema.safeParse({
      source: "stackexchange", externalId, sourceUrl, content, context, publishedAt: publishedAt.toISOString(),
    });
    if (!normalized.success) throw new ProviderMalformedResponseError();
    normalizedCount++;
    if (!records.has(externalId) && records.size < dependencies.maxRecords) {
      records.set(externalId, normalized.data);
      provenance.set(externalId, makeProvenance(externalId, sourceUrl, providerRunId, dependencies));
    }
  }
  return normalizedCount;
}

function stackExchangeHost(site: string): string | null {
  const standaloneHosts: Record<string, string> = {
    askubuntu: "askubuntu.com",
    mathoverflow: "mathoverflow.net",
    serverfault: "serverfault.com",
    stackapps: "stackapps.com",
    stackoverflow: "stackoverflow.com",
    superuser: "superuser.com",
  };
  if (standaloneHosts[site]) return standaloneHosts[site];
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(site) ? `${site}.stackexchange.com` : null;
}

function stackExchangeQuestionUrl(value: string, expectedHost: string, questionId: number): string | null {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  const parts = url.pathname.split("/").filter(Boolean);
  const validPath = parts.length >= 2 && parts.length <= 3 && parts[0] === "questions"
    && parts[1] === String(questionId) && (parts.length === 2 || Boolean(parts[2]));
  return url.protocol === "https:" && url.hostname === expectedHost && !url.port && !url.search && !url.hash && validPath
    ? url.toString() : null;
}

function emptyResult(): ProviderOperationResult<DiscoveredSignal[]> {
  return { value: [], status: "EMPTY", usage: { requestCount: 0, recordCount: 0 }, provenance: [], limitations: ["No usable search keywords were provided."] };
}

function partialOrThrow(
  error: unknown,
  records: Map<string, DiscoveredSignal>,
  provenance: Map<string, ReturnType<typeof makeProvenance>>,
  requestCount: number,
  rawRecordCount: number,
  normalizedRecordCount: number,
  descriptor: ProviderDescriptor,
  context: ProviderCallContext,
): ProviderOperationResult<DiscoveredSignal[]> {
  if (!records.size) throw error;
  const mapped = mapProviderFailure(error, descriptor, context);
  const value = [...records.values()];
  return {
    value, status: "PARTIAL", failureKind: mapped.failureKind, capabilityError: mapped.capabilityError,
    usage: { requestCount, recordCount: value.length, rawRecordCount, normalizedRecordCount, deduplicatedRecordCount: value.length },
    provenance: [...provenance.values()],
    limitations: ["Stack Exchange requested backoff or a bounded page failed; normalized results already obtained were retained."],
  };
}

function completedResult(
  records: Map<string, DiscoveredSignal>,
  provenance: Map<string, ReturnType<typeof makeProvenance>>,
  requestCount: number,
  rawRecordCount: number,
  normalizedRecordCount: number,
  descriptor: ProviderDescriptor,
  requestBudgetExhausted = false,
): ProviderOperationResult<DiscoveredSignal[]> {
  const value = [...records.values()];
  return {
    value, status: value.length ? "SUCCEEDED" : "EMPTY",
    usage: { requestCount, recordCount: value.length, rawRecordCount, normalizedRecordCount, deduplicatedRecordCount: value.length },
    provenance: [...provenance.values()], limitations: [
      "Bounded public Stack Exchange questions were normalized; raw payloads were discarded.",
      ...(requestBudgetExhausted ? ["The per-run HTTP request ceiling truncated pagination."] : []),
    ],
    actualCost: descriptor.configuredCost.amount === 0 ? 0 : null,
  };
}

function makeProvenance(sourceId: string, sourceUrl: string, providerRunId: string, dependencies: ProviderRuntimeDependencies) {
  return { schemaVersion: 1 as const, providerId: "stackexchange", providerSourceId: sourceId, providerRunId, capturedAt: dependencies.now().toISOString(), sourceUrl };
}
