import { z } from "zod";
import {
  ProviderCancelledError,
  type CompanyCandidate,
  type CompanyEvidence,
  type CompanyInference,
  type CompanyResolutionProvider,
  type ProviderDescriptor,
  type ProviderId,
  type ProviderProvenance,
  type ProviderResult,
  type ProviderRuntimeDependencies,
} from "./contracts";
import { ProviderHttpError, ProviderMalformedResponseError, requestJson, withProviderDeadline } from "./http";
import { normalizeCompanyRootDomain, normalizeHttpUrl, normalizePlainText, normalizePublicSignalText, sanitizeCompanySignal, stableProviderSourceId } from "./normalization";
import { runRecordedProvider, type ProviderOperationResult } from "./results";

const EXA_ENDPOINT = "https://api.exa.ai/search";
const SERPER_ENDPOINT = "https://google.serper.dev/search";
const COMPANY_SYSTEM_INSTRUCTION = `Resolve only an organization associated with the supplied public business signal and provider evidence. Do not identify or enrich a person. Return JSON with one top-level field: candidates, an array of at most five objects with companyName, companyDomain (root domain or null), confidence (0 to 1), and evidenceSourceIds (one or more ids from the supplied evidence). Do not add email, person, role, address, technology, or other unsupported factual fields. When evidence is ambiguous, return separate low-confidence candidates or an empty array.`;

const ExaResponseSchema = z.object({
  results: z.array(z.object({ title: z.string().min(1), url: z.string().min(1), text: z.string().nullable().optional() }).passthrough()),
}).passthrough();
const SerperResponseSchema = z.object({
  organic: z.array(z.object({ title: z.string().min(1), link: z.string().min(1), snippet: z.string().nullable().optional() }).passthrough()),
}).passthrough();
const InferenceOutputSchema = z.object({
  candidates: z.array(z.object({
    companyName: z.string().min(1).max(200),
    companyDomain: z.string().max(2_048).nullable(),
    confidence: z.number().finite().min(0).max(1),
    evidenceSourceIds: z.array(z.string().min(1)).min(1).max(10),
  }).strict()).max(5),
}).strict();
const NormalizedCandidateSchema = z.object({
  companyName: z.string().min(1).max(200),
  companyDomain: z.string().max(253).nullable(),
  confidence: z.number().finite().min(0).max(1),
  resolutionStatus: z.enum(["RESOLVED", "UNCERTAIN", "AMBIGUOUS"]),
  evidence: z.array(z.object({
    providerId: z.enum(["reddit", "hackernews", "exa", "serper"]),
    providerSourceId: z.string().min(1),
    providerRunId: z.string().min(1),
    sourceUrl: z.string().url(),
    title: z.string().min(1),
    excerpt: z.string().min(1),
    capturedAt: z.string().datetime({ offset: true }),
    schemaVersion: z.literal(1),
  }).strict()).min(1),
}).strict();

type SearchEvidence = Omit<CompanyEvidence, "providerRunId">;

function parseInferenceOutput(raw: unknown): z.infer<typeof InferenceOutputSchema> {
  let candidate = raw;
  if (typeof raw === "string") {
    try { candidate = JSON.parse(raw) as unknown; }
    catch { throw new ProviderMalformedResponseError(); }
  }
  const parsed = InferenceOutputSchema.safeParse(candidate);
  if (!parsed.success) throw new ProviderMalformedResponseError();
  return parsed.data;
}

function evidenceSupportsDomain(items: SearchEvidence[], domain: string): boolean {
  return items.some(item => normalizeCompanyRootDomain(item.sourceUrl) === domain);
}

function evidenceSupportsName(items: SearchEvidence[], name: string): boolean {
  const normalized = name.toLowerCase();
  return items.some(item => `${item.title} ${item.excerpt}`.toLowerCase().includes(normalized));
}

function normalizeCandidates(
  raw: unknown,
  searchEvidence: SearchEvidence[],
  providerId: ProviderId,
  providerRunId: string,
): CompanyCandidate[] {
  const parsed = parseInferenceOutput(raw);
  const byId = new Map(searchEvidence.map(item => [item.providerSourceId, item]));
  const candidates: CompanyCandidate[] = [];
  const seen = new Set<string>();

  for (const item of parsed.candidates) {
    const companyName = normalizePlainText(item.companyName, 200);
    const companyDomain = item.companyDomain === null ? null : normalizeCompanyRootDomain(item.companyDomain);
    const evidenceItems = [...new Set(item.evidenceSourceIds)].map(id => byId.get(id));
    if (!companyName || evidenceItems.some(evidence => !evidence)) throw new ProviderMalformedResponseError();
    const validEvidence = evidenceItems as SearchEvidence[];
    if (!evidenceSupportsName(validEvidence, companyName)
      || (companyDomain !== null && !evidenceSupportsDomain(validEvidence, companyDomain))) {
      throw new ProviderMalformedResponseError();
    }
    const identity = `${companyName.toLowerCase()}|${companyDomain ?? ""}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const evidence = validEvidence.map(value => ({ ...value, providerId, providerRunId }));
    const normalized = NormalizedCandidateSchema.safeParse({
      companyName,
      companyDomain,
      confidence: item.confidence,
      resolutionStatus: "UNCERTAIN",
      evidence,
    });
    if (!normalized.success) throw new ProviderMalformedResponseError();
    candidates.push(normalized.data);
  }

  const ambiguous = candidates.length > 1;
  for (const candidate of candidates) {
    candidate.resolutionStatus = ambiguous
      ? "AMBIGUOUS"
      : candidate.confidence >= 0.7 && candidate.companyDomain !== null ? "RESOLVED" : "UNCERTAIN";
  }
  return candidates;
}

function createSearchProvider(config: {
  provider: "exa" | "serper";
  apiKey: string;
  descriptor: ProviderDescriptor;
  dependencies: ProviderRuntimeDependencies;
  inference: CompanyInference;
}): CompanyResolutionProvider {
  const { provider, apiKey, descriptor, dependencies, inference } = config;
  return {
    descriptor,
    async resolve(input, context): Promise<ProviderResult<CompanyCandidate[]>> {
      const safeSignal = sanitizeCompanySignal(input.signalContent, 500);
      return runRecordedProvider({
        descriptor,
        context,
        dependencies,
        inputCount: safeSignal ? 1 : 0,
        inputFingerprint: safeSignal,
        async run(operation): Promise<ProviderOperationResult<CompanyCandidate[]>> {
          if (!apiKey.trim()) throw new ProviderHttpError("UNAVAILABLE", 0);
          if (!safeSignal) {
            return {
              value: [], status: "EMPTY", usage: { requestCount: 0, recordCount: 0 },
              provenance: [], limitations: ["The public business signal contained no usable company-search terms."],
            };
          }

          const query = `Public business issue and company evidence: ${safeSignal}`;
          operation.recordRequest();
          const raw = provider === "exa"
            ? await requestJson(dependencies, EXA_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": apiKey, Accept: "application/json" },
                body: JSON.stringify({ query, type: "neural", numResults: 3, useAutoprompt: true }),
              }, operation.signal)
            : await requestJson(dependencies, SERPER_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-API-KEY": apiKey, Accept: "application/json" },
                body: JSON.stringify({ q: query, num: 3 }),
              }, operation.signal);
          const capturedAt = dependencies.now().toISOString();
          let searchEvidence: (SearchEvidence | null)[];
          if (provider === "exa") {
            const parsed = ExaResponseSchema.safeParse(raw);
            if (!parsed.success) throw new ProviderMalformedResponseError();
            searchEvidence = parsed.data.results.slice(0, 3).map(result =>
              normalizeSearchEvidence(provider, result.url, result.title, result.text ?? "", capturedAt, dependencies));
          } else {
            const parsed = SerperResponseSchema.safeParse(raw);
            if (!parsed.success) throw new ProviderMalformedResponseError();
            searchEvidence = parsed.data.organic.slice(0, 3).map(result =>
              normalizeSearchEvidence(provider, result.link, result.title, result.snippet ?? "", capturedAt, dependencies));
          }
          const evidence = searchEvidence.filter((item): item is SearchEvidence => item !== null);
          if (!evidence.length) {
            return {
              value: [], status: "EMPTY", usage: { requestCount: 1, recordCount: 0 },
              provenance: [], limitations: ["Search returned no usable public evidence; inference was not called."],
              actualCost: descriptor.configuredCost.amount === 0 ? 0 : null,
            };
          }
          if (operation.signal.aborted) throw new ProviderCancelledError();

          const userContent = JSON.stringify({ signal: safeSignal, evidence });
          operation.recordRequest();
          const inferenceOutput = await withProviderDeadline(dependencies, operation.signal, signal => inference.infer({
            messages: [
              { role: "system", content: COMPANY_SYSTEM_INSTRUCTION },
              { role: "user", content: userContent },
            ],
            signal,
          }));
          const candidates = normalizeCandidates(inferenceOutput, evidence, provider, operation.providerRunId);
          const valueProvenance: ProviderProvenance[] = evidence.map(item => ({
            schemaVersion: 1,
            providerId: provider,
            providerSourceId: item.providerSourceId,
            providerRunId: operation.providerRunId,
            capturedAt: item.capturedAt,
            sourceUrl: item.sourceUrl,
          }));
          return {
            value: candidates,
            status: candidates.length ? "SUCCEEDED" : "EMPTY",
            usage: { requestCount: 2, recordCount: candidates.length },
            provenance: valueProvenance,
            limitations: ["Company candidates remain hypotheses backed only by listed public search evidence; no person or contact lookup was performed."],
            actualCost: descriptor.configuredCost.amount === 0 ? 0 : null,
          };
        },
      });
    },
  };
}

function normalizeSearchEvidence(
  provider: "exa" | "serper",
  rawUrl: string,
  rawTitle: string,
  rawExcerpt: string,
  capturedAt: string,
  dependencies: ProviderRuntimeDependencies,
): SearchEvidence | null {
  const sourceUrl = normalizeHttpUrl(rawUrl);
  const title = normalizePublicSignalText(rawTitle, 200);
  const excerpt = sanitizeCompanySignal(rawExcerpt, Math.min(1_000, dependencies.maxContentChars));
  if (!sourceUrl || !title || !excerpt) return null;
  return {
    providerId: provider,
    providerSourceId: stableProviderSourceId(provider, sourceUrl),
    sourceUrl,
    title,
    excerpt,
    capturedAt,
    schemaVersion: 1,
  };
}

export function createExaCompanyResolutionProvider(config: {
  apiKey: string;
  descriptor: ProviderDescriptor;
  dependencies: ProviderRuntimeDependencies;
  inference: CompanyInference;
}): CompanyResolutionProvider {
  return createSearchProvider({ ...config, provider: "exa" });
}

export function createSerperCompanyResolutionProvider(config: {
  apiKey: string;
  descriptor: ProviderDescriptor;
  dependencies: ProviderRuntimeDependencies;
  inference: CompanyInference;
}): CompanyResolutionProvider {
  return createSearchProvider({ ...config, provider: "serper" });
}
