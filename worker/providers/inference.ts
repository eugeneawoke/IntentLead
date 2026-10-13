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

const ProviderSourceIdSchema = z.string().regex(/^(?:exa|serper):[a-f0-9]{24}$/);
const InferenceEvidenceSchema = z.object({
  providerId: z.enum(["exa", "serper"]),
  providerSourceId: ProviderSourceIdSchema,
  title: z.string().min(1).max(200),
  excerpt: z.string().min(1).max(1_000),
  capturedAt: z.string().datetime({ offset: true }),
  schemaVersion: z.literal(PROVIDER_SCHEMA_VERSION),
}).strict();
const InferenceUserPayloadSchema = z.object({
  signal: z.string().min(1).max(500),
  evidence: z.array(InferenceEvidenceSchema).min(1).max(3),
}).strict();
const CompanyInferenceInputSchema = z.object({
  messages: z.tuple([
    z.object({ role: z.literal("system"), content: z.literal(COMPANY_INFERENCE_SYSTEM_INSTRUCTION) }).strict(),
    z.object({ role: z.literal("user"), content: z.string().min(1).max(12_000) }).strict(),
  ]),
}).strict();

function sanitizeInferenceInput(input: unknown): CompanyInferenceInput {
  const parsedInput = CompanyInferenceInputSchema.safeParse(input);
  if (!parsedInput.success) throw new ProviderMalformedResponseError();
  let rawPayload: unknown;
  try { rawPayload = JSON.parse(parsedInput.data.messages[1].content) as unknown; }
  catch { throw new ProviderMalformedResponseError(); }
  const parsedPayload = InferenceUserPayloadSchema.safeParse(rawPayload);
  if (!parsedPayload.success) throw new ProviderMalformedResponseError();
  const safePayload = {
    signal: redactContactLikePii(parsedPayload.data.signal),
    evidence: parsedPayload.data.evidence.map(item => ({
      ...item,
      title: redactContactLikePii(item.title),
      excerpt: redactContactLikePii(item.excerpt),
    })),
  };
  return {
    messages: [
      { role: "system", content: COMPANY_INFERENCE_SYSTEM_INSTRUCTION },
      { role: "user", content: JSON.stringify(safePayload) },
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
      const safeInput = sanitizeInferenceInput(input);
      if (typeof context.reserveProvider !== "function") {
        throw new ProviderSelectionError(authorizationError(context));
      }
      const reservationGrant = context.reserveProvider(descriptor);
      const inferenceContext = {
        ...context,
        reservation: reservationGrant.reservation,
        requestFingerprint: reservationGrant.requestFingerprint,
      };

      return runRecordedProvider({
        descriptor,
        context: inferenceContext,
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
