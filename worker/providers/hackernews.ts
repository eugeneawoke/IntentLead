import { z } from "zod";
import {
  ProviderCancelledError,
  type DiscoveredSignal,
  type ProviderCallContext,
  type ProviderDescriptor,
  type ProviderRuntimeDependencies,
  type ProviderResult,
  type SignalSourceAdapter,
  type SignalSearchInput,
} from "./contracts";
import { requestJson, ProviderMalformedResponseError } from "./http";
import { normalizeHttpUrl, normalizePublicSignalText, sanitizeCompanySignal } from "./normalization";
import { mapProviderFailure, runRecordedProvider, type ProviderOperationResult } from "./results";

const SEARCH_ENDPOINT = "https://hn.algolia.com/api/v1/search";

const HackerNewsSearchSchema = z.object({
  hits: z.array(z.object({
    objectID: z.string().min(1),
    url: z.string().nullable().optional(),
    comment_text: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    story_title: z.string().nullable().optional(),
    created_at: z.string().datetime({ offset: true }),
  }).passthrough()),
}).passthrough();

const NormalizedSignalSchema = z.object({
  source: z.literal("hackernews"),
  externalId: z.string().min(1),
  sourceUrl: z.string().url(),
  content: z.string().min(1).max(2_000),
  context: z.string().max(2_000).nullable(),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

export function createHackerNewsAdapter(config: {
  descriptor: ProviderDescriptor;
  dependencies: ProviderRuntimeDependencies;
}): SignalSourceAdapter {
  const { descriptor, dependencies } = config;

  return {
    descriptor,
    async search(input: SignalSearchInput, context: ProviderCallContext): Promise<ProviderResult<DiscoveredSignal[]>> {
      const keywords = input.keywords
        .map(keyword => sanitizeCompanySignal(keyword, 100))
        .filter(Boolean)
        .slice(0, dependencies.maxKeywords);
      return runRecordedProvider({
        descriptor,
        context,
        dependencies,
        inputCount: keywords.length,
        inputFingerprint: keywords.join("\n"),
        async run(operation): Promise<ProviderOperationResult<DiscoveredSignal[]>> {
          if (!keywords.length) {
            return {
              value: [], status: "EMPTY", usage: { requestCount: 0, recordCount: 0 },
              provenance: [], limitations: ["No usable search keywords were provided."],
            };
          }

          let providerRequestCount = 0;
          let rawRecordCount = 0;
          let normalizedRecordCount = 0;
          const records = new Map<string, DiscoveredSignal>();
          const seenUrls = new Set<string>();
          const provenance = new Map<string, ReturnType<typeof makeProvenance>>();
          for (const keyword of keywords) {
            if (operation.signal.aborted) throw new ProviderCancelledError();
            const query = new URLSearchParams({ query: keyword, tags: "comment,story", hitsPerPage: "20" });
            providerRequestCount++;
            operation.recordRequest();
            try {
              const response = await requestJson(dependencies, `${SEARCH_ENDPOINT}?${query.toString()}`, {
                method: "GET",
                headers: { Accept: "application/json" },
              }, operation.signal);
              const parsed = HackerNewsSearchSchema.safeParse(response);
              if (!parsed.success) throw new ProviderMalformedResponseError();
              rawRecordCount += parsed.data.hits.length;

              for (const hit of parsed.data.hits) {
                const fallbackUrl = `https://news.ycombinator.com/item?id=${encodeURIComponent(hit.objectID)}`;
                const url = normalizeHttpUrl(hit.url ?? fallbackUrl, SEARCH_ENDPOINT);
                const content = normalizePublicSignalText([hit.title ?? hit.story_title, hit.comment_text].filter(Boolean).join("\n"), dependencies.maxContentChars);
                const publishedAt = new Date(hit.created_at).toISOString();
                if (!url || !content || !publishedAt) throw new ProviderMalformedResponseError();
                const normalized = NormalizedSignalSchema.safeParse({
                  source: "hackernews",
                  externalId: hit.objectID,
                  sourceUrl: url,
                  content,
                  context: normalizePublicSignalText(hit.story_title ?? "HN", 2_000) || "HN",
                  publishedAt,
                });
                if (!normalized.success) throw new ProviderMalformedResponseError();
                normalizedRecordCount++;
                if (!records.has(hit.objectID) && !seenUrls.has(url)) {
                  records.set(hit.objectID, normalized.data);
                  seenUrls.add(url);
                  provenance.set(hit.objectID, makeProvenance(hit.objectID, url, operation.providerRunId, dependencies));
                }
                if (records.size >= dependencies.maxRecords) break;
              }
            } catch (error) {
              if (error instanceof ProviderCancelledError || operation.signal.aborted) throw new ProviderCancelledError();
              if (!records.size) throw error;
              const mapped = mapProviderFailure(error, descriptor, context);
              const value = [...records.values()];
              return {
                value,
                status: "PARTIAL",
                failureKind: mapped.failureKind,
                capabilityError: mapped.capabilityError,
                usage: { requestCount: providerRequestCount, recordCount: value.length, rawRecordCount, normalizedRecordCount, deduplicatedRecordCount: value.length },
                provenance: [...provenance.values()],
                limitations: ["Some bounded keywords failed; completed results were retained and raw provider payloads were discarded."],
              };
            }
            if (records.size >= dependencies.maxRecords) break;
          }
          const value = [...records.values()];
          return {
            value,
            status: value.length ? "SUCCEEDED" : "EMPTY",
            usage: { requestCount: providerRequestCount, recordCount: value.length, rawRecordCount, normalizedRecordCount, deduplicatedRecordCount: value.length },
            provenance: [...provenance.values()],
            limitations: ["Only bounded public result excerpts were normalized; the raw provider payload was discarded."],
            actualCost: descriptor.configuredCost.amount === 0 ? 0 : null,
          };
        },
      });
    },
  };
}

function makeProvenance(
  sourceId: string,
  sourceUrl: string,
  providerRunId: string,
  dependencies: ProviderRuntimeDependencies,
) {
  return {
    schemaVersion: 1 as const,
    providerId: "hackernews" as const,
    providerSourceId: sourceId,
    providerRunId,
    capturedAt: dependencies.now().toISOString(),
    sourceUrl,
  };
}
