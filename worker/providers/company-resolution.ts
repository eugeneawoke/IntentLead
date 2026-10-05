import { z } from "zod";
import type { CapabilityError } from "../../types/job";
import {
  ProviderCancelledError,
  ProviderSelectionError,
  PROVIDER_SCHEMA_VERSION,
  type CompanyCandidate,
  type CompanyInferenceProvider,
  type CompanyResolutionProvider,
  type ProviderDescriptor,
  type ProviderResult,
  type ProviderRuntimeDependencies,
} from "./contracts";
import { evidenceProvenance, normalizeCandidates, type SearchEvidence } from "./company-resolution-candidates";
import { COMPANY_INFERENCE_SYSTEM_INSTRUCTION } from "./inference";
import { ProviderHttpError, ProviderMalformedResponseError, requestJson } from "./http";
import {
  normalizeHttpUrl,
  normalizePublicSignalText,
  sanitizeCompanySignal,
  stableProviderSourceId,
} from "./normalization";
import { runRecordedProvider, type ProviderOperationResult } from "./results";

const EXA_ENDPOINT = "https://api.exa.ai/search";
const SERPER_ENDPOINT = "https://google.serper.dev/search";
const ExaResponseSchema = z.object({
  results: z.array(z.object({ title: z.string().min(1), url: z.string().min(1), text: z.string().nullable().optional() }).passthrough()),
}).passthrough();
const SerperResponseSchema = z.object({
  organic: z.array(z.object({ title: z.string().min(1), link: z.string().min(1), snippet: z.string().nullable().optional() }).passthrough()),
}).passthrough();

function createSearchProvider(config: {
  provider: "exa" | "serper";
  apiKey: string;
  descriptor: ProviderDescriptor;
  dependencies: ProviderRuntimeDependencies;
  inferenceProvider: CompanyInferenceProvider;
}): CompanyResolutionProvider {
  const { provider, apiKey, descriptor, dependencies, inferenceProvider } = config;
  return {
    descriptor,
    async resolve(input, context): Promise<ProviderResult<CompanyCandidate[]>> {
      const safeSignal = sanitizeCompanySignal(input.signalContent, 500);
      let inferenceRun: ProviderResult<import("./contracts").CompanyInferenceOutput> | null = null;
      const searchResult = await runRecordedProvider({
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
          const searchEvidence = provider === "exa"
            ? parseExaEvidence(raw, capturedAt, dependencies)
            : parseSerperEvidence(raw, capturedAt, dependencies);
          const evidence = searchEvidence.filter((item): item is SearchEvidence => item !== null);
          if (!evidence.length) {
            return {
              value: [], status: "EMPTY", usage: { requestCount: 1, recordCount: 0 },
              provenance: [], limitations: ["Search returned no usable public evidence; inference was not called."],
              actualCost: descriptor.configuredCost.amount === 0 ? 0 : null,
            };
          }
          if (operation.signal.aborted) throw new ProviderCancelledError();

          const promptEvidence = evidence.map(({ providerId, providerSourceId, title, excerpt, capturedAt: date, schemaVersion }) => ({
            providerId, providerSourceId, title, excerpt, capturedAt: date, schemaVersion,
          }));
          const input = {
            messages: [
              { role: "system" as const, content: COMPANY_INFERENCE_SYSTEM_INSTRUCTION },
              { role: "user" as const, content: JSON.stringify({ signal: safeSignal, evidence: promptEvidence }) },
            ] as const,
          };
          try {
            inferenceRun = await inferenceProvider.infer(input, context);
          } catch (error) {
            if (!(error instanceof ProviderSelectionError)) throw error;
            return {
              value: [],
              status: "PARTIAL",
              failureKind: error.capabilityError.code === "BUDGET_EXCEEDED" ? "BUDGET_EXCEEDED" : "UNAVAILABLE",
              capabilityError: error.capabilityError,
              usage: { requestCount: 1, recordCount: evidence.length },
              provenance: evidenceProvenance(evidence, provider, operation.providerRunId),
              limitations: ["Search evidence was collected, but model inference was not admitted by registry policy or budget."],
              actualCost: descriptor.configuredCost.amount === 0 ? 0 : null,
            };
          }
          const candidates: CompanyCandidate[] = [];
          let capabilityError: CapabilityError | undefined;
          if (inferenceRun.status === "SUCCEEDED" || inferenceRun.status === "EMPTY") {
            try {
              candidates.push(...normalizeCandidates(inferenceRun.value, evidence, provider, operation.providerRunId));
            } catch {
              capabilityError = {
                schemaVersion: PROVIDER_SCHEMA_VERSION,
                code: "INTERNAL_ERROR",
                retryable: false,
                message: "Model output did not match the evidence-bound company candidate contract",
                capability: "COMPANY_RESOLUTION",
                traceId: context.traceId,
                retryAfterMs: null,
              };
            }
          } else {
            capabilityError = inferenceRun.capabilityError ?? {
              schemaVersion: PROVIDER_SCHEMA_VERSION,
              code: "CAPABILITY_UNAVAILABLE",
              retryable: false,
              message: "Company inference did not produce an authorized outcome",
              capability: "COMPANY_RESOLUTION",
              traceId: context.traceId,
              retryAfterMs: null,
            };
          }
          const valueProvenance = evidenceProvenance(evidence, provider, operation.providerRunId);
          if (capabilityError) {
            return {
              value: candidates,
              status: "PARTIAL",
              failureKind: inferenceRun.failureKind ?? "MALFORMED_RESPONSE",
              capabilityError,
              usage: { requestCount: 1, recordCount: evidence.length },
              provenance: valueProvenance,
              limitations: ["Search evidence was collected, but company inference was unavailable or rejected."],
              actualCost: descriptor.configuredCost.amount === 0 ? 0 : null,
            };
          }
          return {
            value: candidates,
            status: candidates.length ? "SUCCEEDED" : "EMPTY",
            usage: { requestCount: 1, recordCount: evidence.length },
            provenance: valueProvenance,
            limitations: ["Company candidates remain hypotheses backed only by listed public search evidence; no person or contact lookup was performed."],
            actualCost: descriptor.configuredCost.amount === 0 ? 0 : null,
          };
        },
      });
      return inferenceRun ? { ...searchResult, relatedRuns: [inferenceRun] } : searchResult;
    },
  };
}

function parseExaEvidence(raw: unknown, capturedAt: string, dependencies: ProviderRuntimeDependencies): (SearchEvidence | null)[] {
  const parsed = ExaResponseSchema.safeParse(raw);
  if (!parsed.success) throw new ProviderMalformedResponseError();
  return parsed.data.results.slice(0, 3).map(result => normalizeSearchEvidence("exa", result.url, result.title, result.text ?? "", capturedAt, dependencies));
}

function parseSerperEvidence(raw: unknown, capturedAt: string, dependencies: ProviderRuntimeDependencies): (SearchEvidence | null)[] {
  const parsed = SerperResponseSchema.safeParse(raw);
  if (!parsed.success) throw new ProviderMalformedResponseError();
  return parsed.data.organic.slice(0, 3).map(result => normalizeSearchEvidence("serper", result.link, result.title, result.snippet ?? "", capturedAt, dependencies));
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
    schemaVersion: PROVIDER_SCHEMA_VERSION,
  };
}

export function createExaCompanyResolutionProvider(config: {
  apiKey: string;
  descriptor: ProviderDescriptor;
  dependencies: ProviderRuntimeDependencies;
  inferenceProvider: CompanyInferenceProvider;
}): CompanyResolutionProvider {
  return createSearchProvider({ ...config, provider: "exa" });
}

export function createSerperCompanyResolutionProvider(config: {
  apiKey: string;
  descriptor: ProviderDescriptor;
  dependencies: ProviderRuntimeDependencies;
  inferenceProvider: CompanyInferenceProvider;
}): CompanyResolutionProvider {
  return createSearchProvider({ ...config, provider: "serper" });
}
