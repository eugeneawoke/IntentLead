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
import { ProviderMalformedResponseError, requestJson } from "./http";
import { normalizeHttpUrl, normalizePublicSignalText, sanitizeCompanySignal } from "./normalization";
import { mapProviderFailure, runRecordedProvider, type ProviderOperationResult } from "./results";

const SEARCH_ENDPOINT = "https://api.github.com/search/issues";
const MAX_SEARCH_PAGES = 10;

const GitHubSearchSchema = z.object({
  total_count: z.number().int().nonnegative(),
  items: z.array(z.object({
    id: z.number().int().nonnegative(),
    number: z.number().int().nonnegative(),
    html_url: z.string().url(),
    repository_url: z.string().url(),
    title: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    created_at: z.string().datetime({ offset: true }),
    pull_request: z.unknown().optional(),
  }).passthrough()),
}).passthrough();

const GitHubSignalSchema = z.object({
  source: z.literal("github"),
  externalId: z.string().min(1),
  sourceUrl: z.string().url(),
  content: z.string().min(1).max(2_000),
  context: z.string().max(2_000).nullable(),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

export function createGitHubAdapter(config: {
  descriptor: ProviderDescriptor;
  dependencies: ProviderRuntimeDependencies;
  token?: string;
  apiVersion?: string;
  userAgent?: string;
}): SignalSourceAdapter {
  const { descriptor, dependencies } = config;
  const token = config.token?.trim();
  const apiVersion = config.apiVersion ?? "2026-03-10";
  const userAgent = config.userAgent ?? "IntentLeadAI/1.0";

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
        inputFingerprint: keywords.join("\n"),
        async run(operation): Promise<ProviderOperationResult<DiscoveredSignal[]>> {
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
            const maxPages = Math.max(1, Math.min(MAX_SEARCH_PAGES, dependencies.maxRecords));
            for (let page = 1; page <= maxPages && records.size < dependencies.maxRecords; page++) {
              if (requestCount >= dependencies.maxRequestsPerRun) {
                requestBudgetExhausted = true;
                break searchLoop;
              }
              if (operation.signal.aborted) throw new ProviderCancelledError();
              const query = new URLSearchParams({
                q: `${keyword} is:issue`, sort: "created", order: "desc", per_page: String(pageSize), page: String(page),
              });
              requestCount++;
              operation.recordRequest();
              try {
                const response = await requestJson(dependencies, `${SEARCH_ENDPOINT}?${query}`, {
                  method: "GET",
                  headers: {
                    Accept: "application/vnd.github+json",
                    "User-Agent": userAgent,
                    "X-GitHub-Api-Version": apiVersion,
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                }, operation.signal);
                const parsed = GitHubSearchSchema.safeParse(response);
                if (!parsed.success) throw new ProviderMalformedResponseError();
                rawRecordCount += parsed.data.items.length;
                for (const item of parsed.data.items) {
                  if (item.pull_request !== undefined) continue;
                  const externalId = String(item.id);
                  const identity = githubIssueIdentity(item.html_url, item.repository_url, item.number);
                  const content = normalizePublicSignalText([item.title, item.body].filter(Boolean).join("\n"), dependencies.maxContentChars);
                  if (!identity || !content) throw new ProviderMalformedResponseError();
                  const normalized = GitHubSignalSchema.safeParse({
                    source: "github", externalId, sourceUrl: identity.sourceUrl, content, context: identity.repository,
                    publishedAt: new Date(item.created_at).toISOString(),
                  });
                  if (!normalized.success) throw new ProviderMalformedResponseError();
                  normalizedRecordCount++;
                  if (!records.has(externalId)) {
                    records.set(externalId, normalized.data);
                    provenance.set(externalId, makeProvenance(externalId, identity.sourceUrl, operation.providerRunId, dependencies));
                  }
                  if (records.size >= dependencies.maxRecords) break;
                }
                if (page * pageSize >= parsed.data.total_count || parsed.data.items.length < pageSize) break;
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

function githubIssueIdentity(issueValue: string, repositoryValue: string, issueNumber: number): { sourceUrl: string; repository: string } | null {
  const issueUrl = strictHttpsUrl(issueValue, "github.com");
  const repositoryUrl = strictHttpsUrl(repositoryValue, "api.github.com");
  if (!issueUrl || !repositoryUrl) return null;
  const issueParts = issueUrl.pathname.split("/").filter(Boolean);
  const repositoryParts = repositoryUrl.pathname.split("/").filter(Boolean);
  const validIssuePath = issueParts.length === 4 && issueParts[2] === "issues" && /^\d+$/.test(issueParts[3] ?? "");
  const validRepositoryPath = repositoryParts.length === 3 && repositoryParts[0] === "repos";
  if (!validIssuePath || !validRepositoryPath || issueParts[3] !== String(issueNumber)) return null;
  const issueRepository = `${issueParts[0]}/${issueParts[1]}`;
  const apiRepository = `${repositoryParts[1]}/${repositoryParts[2]}`;
  if (issueRepository.toLowerCase() !== apiRepository.toLowerCase()) return null;
  return { sourceUrl: issueUrl.toString(), repository: apiRepository };
}

function strictHttpsUrl(value: string, expectedHost: string): URL | null {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  return url.protocol === "https:" && url.hostname === expectedHost && !url.port && !url.search && !url.hash
    ? url : null;
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
    limitations: ["A bounded page or keyword failed; normalized results already obtained were retained."],
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
      "Bounded public GitHub issue excerpts were normalized; raw payloads were discarded.",
      ...(requestBudgetExhausted ? ["The per-run HTTP request ceiling truncated pagination."] : []),
    ],
    actualCost: descriptor.configuredCost.amount === 0 ? 0 : null,
  };
}

function makeProvenance(sourceId: string, sourceUrl: string, providerRunId: string, dependencies: ProviderRuntimeDependencies) {
  return { schemaVersion: 1 as const, providerId: "github", providerSourceId: sourceId, providerRunId, capturedAt: dependencies.now().toISOString(), sourceUrl };
}
