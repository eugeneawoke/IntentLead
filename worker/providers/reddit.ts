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
import { requestJson, ProviderHttpError, ProviderMalformedResponseError } from "./http";
import { normalizeHttpUrl, normalizePlainText, normalizePublicSignalText } from "./normalization";
import { mapProviderFailure, runRecordedProvider, type ProviderOperationResult } from "./results";

const TOKEN_ENDPOINT = "https://www.reddit.com/api/v1/access_token";
const SEARCH_ENDPOINT = "https://oauth.reddit.com/search.json";
const DEFAULT_USER_AGENT = "IntentLeadAI/1.0";

const RedditTokenSchema = z.object({ access_token: z.string().min(1) }).passthrough();
const RedditSearchSchema = z.object({
  data: z.object({
    children: z.array(z.object({
      data: z.object({
        id: z.string().min(1),
        url: z.string().optional(),
        permalink: z.string().optional(),
        title: z.string().nullable().optional(),
        selftext: z.string().nullable().optional(),
        subreddit: z.string().nullable().optional(),
        created_utc: z.number().finite(),
      }).passthrough(),
    }).passthrough()),
  }).passthrough(),
}).passthrough();

const NormalizedSignalSchema = z.object({
  source: z.literal("reddit"),
  externalId: z.string().min(1),
  sourceUrl: z.string().url(),
  content: z.string().min(1).max(2_000),
  context: z.string().max(200).nullable(),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

function parsePublishedAt(seconds: number): string | null {
  if (seconds < 0 || seconds > 8_640_000_000_000) return null;
  const value = new Date(seconds * 1_000);
  return Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

export function createRedditAdapter(config: {
  clientId: string;
  clientSecret: string;
  descriptor: ProviderDescriptor;
  dependencies: ProviderRuntimeDependencies;
}): SignalSourceAdapter {
  const { clientId, clientSecret, descriptor, dependencies } = config;

  return {
    descriptor,
    async search(input: SignalSearchInput, context: ProviderCallContext): Promise<ProviderResult<DiscoveredSignal[]>> {
      const keywords = input.keywords
        .map(keyword => normalizePlainText(keyword, 100))
        .filter(Boolean)
        .slice(0, dependencies.maxKeywords);
      return runRecordedProvider({
        descriptor,
        context,
        dependencies,
        inputCount: keywords.length,
        inputFingerprint: keywords.join("\n"),
        async run(operation): Promise<ProviderOperationResult<DiscoveredSignal[]>> {
          if (!clientId.trim() || !clientSecret.trim()) {
            throw new ProviderHttpError("UNAVAILABLE", 0);
          }
          if (!keywords.length) {
            return {
              value: [], status: "EMPTY", usage: { requestCount: 0, recordCount: 0 },
              provenance: [], limitations: ["No usable search keywords were provided."],
            };
          }

          let providerRequestCount = 0;
          providerRequestCount++;
          operation.recordRequest();
          const tokenPayload = await requestJson(dependencies, TOKEN_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
              "User-Agent": DEFAULT_USER_AGENT,
            },
            body: "grant_type=client_credentials",
          }, operation.signal);
          const token = RedditTokenSchema.safeParse(tokenPayload);
          if (!token.success) throw new ProviderMalformedResponseError();

          const records = new Map<string, DiscoveredSignal>();
          const provenance = new Map<string, ReturnType<typeof makeProvenance>>();
          for (let index = 0; index < keywords.length; index++) {
            if (operation.signal.aborted) throw new ProviderCancelledError();
            if (index > 0) await dependencies.sleep(1_000, operation.signal);
            const query = new URLSearchParams({
              q: keywords[index], sort: "new", limit: "25", type: "link,comment",
            });
            providerRequestCount++;
            operation.recordRequest();
            try {
              const response = await requestJson(dependencies, `${SEARCH_ENDPOINT}?${query.toString()}`, {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${token.data.access_token}`,
                  "User-Agent": DEFAULT_USER_AGENT,
                },
              }, operation.signal);
              const parsed = RedditSearchSchema.safeParse(response);
              if (!parsed.success) throw new ProviderMalformedResponseError();

              for (const child of parsed.data.data.children) {
                const post = child.data;
                const url = normalizeHttpUrl(post.url ?? post.permalink ?? "", "https://www.reddit.com");
                const content = normalizePublicSignalText([post.title, post.selftext].filter(Boolean).join("\n"), dependencies.maxContentChars);
                const postedAt = parsePublishedAt(post.created_utc);
                if (!url || !content || !postedAt) throw new ProviderMalformedResponseError();
                const normalized = NormalizedSignalSchema.safeParse({
                  source: "reddit",
                  externalId: post.id,
                  sourceUrl: url,
                  content,
                  context: normalizePublicSignalText(post.subreddit ?? "", 200) || null,
                  publishedAt: postedAt,
                });
                if (!normalized.success) throw new ProviderMalformedResponseError();
                if (!records.has(post.id)) {
                  records.set(post.id, normalized.data);
                  provenance.set(post.id, makeProvenance(post.id, url, operation.providerRunId, dependencies));
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
                usage: { requestCount: providerRequestCount, recordCount: value.length },
                provenance: [...provenance.values()],
                limitations: ["Some bounded keywords failed; completed results were retained and the raw provider payload was discarded."],
              };
            }
            if (records.size >= dependencies.maxRecords) break;
          }
          const value = [...records.values()];
          return {
            value,
            status: value.length ? "SUCCEEDED" : "EMPTY",
            usage: { requestCount: providerRequestCount, recordCount: value.length },
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
    providerId: "reddit" as const,
    providerSourceId: sourceId,
    providerRunId,
    capturedAt: dependencies.now().toISOString(),
    sourceUrl,
  };
}
