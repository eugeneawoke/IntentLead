import { z } from "zod";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import type { CapabilityError } from "../../types/job";
import { redactContactLikePii } from "./normalization";
import {
  ProviderCancelledError,
  ProviderSelectionError,
  PROVIDER_SCHEMA_VERSION,
  type CompanyInferenceCompletion,
  type CompanyInferenceInput,
  type CompanyInferenceOutput,
  type CompanyInferenceProvider,
  type ProviderCallContext,
  type ProviderDescriptor,
  type ProviderResult,
  type ProviderRuntimeDependencies,
} from "./contracts";
import { ProviderHttpError, ProviderMalformedResponseError, ProviderTimeoutError, withProviderDeadline } from "./http";
import { runRecordedProvider } from "./results";

export const COMPANY_INFERENCE_SYSTEM_INSTRUCTION = `Resolve only an organization associated with the supplied public business signal and provider evidence. Do not identify or enrich a person. Return JSON with one top-level field: candidates, an array of at most five objects with companyName, companyDomain (root domain or null), confidence (0 to 1), and evidenceSourceIds (one or more ids from the supplied evidence). Do not add email, person, role, address, technology, or other unsupported factual fields. When evidence is ambiguous, return separate low-confidence candidates or an empty array.`;

export const CompanyInferenceOutputSchema = z.object({
  candidates: z.array(z.object({
    companyName: z.string().min(1).max(200),
    companyDomain: z.string().max(2_048).nullable(),
    confidence: z.number().finite().min(0).max(1),
    evidenceSourceIds: z.array(z.string().min(1)).min(1).max(10),
  }).strict()).max(5),
}).strict();

export type CompanyInferenceCall = (input: CompanyInferenceInput, signal: AbortSignal) => Promise<CompanyInferenceCompletion>;

const STRUCTURAL_TEXT_FIELDS = new Set([
  "providerSourceId", "providerRunId", "sourceId", "externalId", "providerId", "capturedAt", "publishedAt", "schemaVersion",
]);

function sanitizeInferenceValue(value: unknown, key?: string): unknown {
  if (typeof value === "string") return key && STRUCTURAL_TEXT_FIELDS.has(key) ? value : redactContactLikePii(value);
  if (Array.isArray(value)) return value.map(item => sanitizeInferenceValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, sanitizeInferenceValue(child, childKey)]));
  }
  return value;
}

function sanitizeInferenceInput(input: CompanyInferenceInput): CompanyInferenceInput {
  let userContent: string;
  try {
    userContent = JSON.stringify(sanitizeInferenceValue(JSON.parse(input.messages[1].content)));
  } catch {
    userContent = redactContactLikePii(input.messages[1].content);
  }
  return {
    messages: [
      { role: "system", content: COMPANY_INFERENCE_SYSTEM_INSTRUCTION },
      { role: "user", content: userContent },
    ],
  };
}

function authorizationError(context: ProviderCallContext): CapabilityError {
  return {
    schemaVersion: PROVIDER_SCHEMA_VERSION,
    code: "POLICY_DENIED",
    retryable: false,
    message: "Company inference requires an authorized registry reservation",
    capability: "COMPANY_RESOLUTION",
    traceId: context.traceId,
    retryAfterMs: null,
  };
}

function parseOutput(value: unknown): CompanyInferenceOutput {
  let candidate = value;
  if (typeof value === "string") {
    try { candidate = JSON.parse(value) as unknown; }
    catch { throw new ProviderMalformedResponseError(); }
  }
  const parsed = CompanyInferenceOutputSchema.safeParse(candidate);
  if (!parsed.success) throw new ProviderMalformedResponseError();
  return parsed.data;
}

function retryAfterMs(error: unknown): number | null {
  const headers = (error as { headers?: Headers | Record<string, string> } | null)?.headers;
  const value = headers instanceof Headers ? headers.get("retry-after") : headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(60_000, Math.round(seconds * 1_000)) : null;
}

function normalizeOpenAIError(error: unknown): never {
  if (error instanceof ProviderHttpError || error instanceof ProviderMalformedResponseError
    || error instanceof ProviderCancelledError || error instanceof ProviderTimeoutError) throw error;
  const status = (error as { status?: number; statusCode?: number } | null)?.status
    ?? (error as { statusCode?: number } | null)?.statusCode;
  if (status === 401 || status === 403) throw new ProviderHttpError("UNAUTHORIZED", status);
  if (status === 429) throw new ProviderHttpError("RATE_LIMITED", status, retryAfterMs(error));
  if (typeof status === "number" && status >= 500) throw new ProviderHttpError("UNAVAILABLE", status);
  throw new ProviderHttpError("UNAVAILABLE", 0);
}

export function createCompanyInferenceAdapter(config: {
  descriptor: ProviderDescriptor;
  dependencies: ProviderRuntimeDependencies;
  complete: CompanyInferenceCall;
}): CompanyInferenceProvider {
  const { descriptor, dependencies, complete } = config;
  if (descriptor.id !== "openai" || descriptor.capability !== "COMPANY_RESOLUTION") {
    throw new Error("Company inference requires an OpenAI COMPANY_RESOLUTION descriptor");
  }

  return {
    descriptor,
    async infer(input, context): Promise<ProviderResult<CompanyInferenceOutput>> {
      if (context.signal.aborted) throw new ProviderCancelledError();
      assertCompanyInferenceProfile(context);
      if (input.messages[0].role !== "system"
        || input.messages[0].content !== COMPANY_INFERENCE_SYSTEM_INSTRUCTION
        || input.messages[1].role !== "user") {
        throw new ProviderSelectionError(authorizationError(context));
      }
      const safeInput = sanitizeInferenceInput(input);
      if (typeof context.reserveProvider !== "function") {
        throw new ProviderSelectionError(authorizationError(context));
      }
      const reservation = context.reserveProvider(descriptor);
      if (reservation.descriptor.id !== descriptor.id
        || reservation.descriptor.version !== descriptor.version
        || reservation.reservedCost !== descriptor.configuredCost.amount) {
        throw new ProviderSelectionError(authorizationError(context));
      }

      return runRecordedProvider({
        descriptor,
        context,
        dependencies,
        inputCount: 1,
        inputFingerprint: safeInput.messages[1].content,
        async run(operation) {
          operation.recordRequest();
          let response: CompanyInferenceCompletion;
          try {
            response = await withProviderDeadline(dependencies, operation.signal, signal => complete(safeInput, signal));
          } catch (error) {
            normalizeOpenAIError(error);
          }
          const value = parseOutput(response.content);
          return {
            value,
            status: value.candidates.length ? "SUCCEEDED" : "EMPTY",
            usage: {
              requestCount: 1,
              recordCount: value.candidates.length,
              inputTokens: response.inputTokens,
              outputTokens: response.outputTokens,
            },
            provenance: [],
            limitations: ["Model output is limited to company candidates and evidence ids; the model did not perform contact discovery."],
            actualCost: null,
          };
        },
      });
    },
  };
}

export function createLazyOpenAICompanyInferenceProvider(config: {
  descriptor: ProviderDescriptor;
  dependencies: ProviderRuntimeDependencies;
  apiKey: string;
}): CompanyInferenceProvider {
  return createCompanyInferenceAdapter({
    descriptor: config.descriptor,
    dependencies: config.dependencies,
    async complete(input, signal) {
      if (!config.apiKey.trim()) throw new ProviderHttpError("UNAVAILABLE", 0);
      try {
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey: config.apiKey });
        const response = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: input.messages.map(message => ({ role: message.role, content: message.content })),
          response_format: { type: "json_object" },
          max_tokens: 300,
        }, { signal });
        return {
          content: response.choices[0]?.message?.content ?? "",
          inputTokens: response.usage?.prompt_tokens ?? null,
          outputTokens: response.usage?.completion_tokens ?? null,
        };
      } catch (error) {
        normalizeOpenAIError(error);
      }
    },
  });
}

export function assertCompanyInferenceProfile(context: ProviderCallContext): void {
  const parsed = MarketProfileSchema.safeParse(context.profile);
  if (!parsed.success || !parsed.data.capabilities.includes("COMPANY_RESOLUTION")
    || parsed.data.disabledCapabilities.includes("COMPANY_RESOLUTION")) {
    throw new ProviderSelectionError(authorizationError(context));
  }
}
