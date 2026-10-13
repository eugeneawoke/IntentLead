import type { z } from "zod";
import type { ModelBudget, ModelCapability, ModelInvocationPolicy, ModelProviderDescriptor } from "./model-provider";

export interface ModelMessage {
  role: "system" | "user";
  content: string;
}

export interface ModelStructuredOutputDefinition {
  name: string;
  schema: Readonly<Record<string, unknown>>;
}

export interface ModelAdapterRequest {
  messages: readonly [ModelMessage & { role: "system" }, ModelMessage & { role: "user" }];
  maxOutputTokens: number;
  maxInputTokens: number;
  structuredOutput: ModelStructuredOutputDefinition;
}

export interface ModelAdapterResponse {
  output: unknown;
  inputTokens: number;
  outputTokens: number;
  limitations: string[];
  providerResponseId?: string;
  reportedModel?: string;
}

declare const modelReservationBrand: unique symbol;
export type ModelReservation = { readonly [modelReservationBrand]: true };

export interface ModelCallContext {
  signal: AbortSignal;
  reservation: ModelReservation;
  requestFingerprint: string;
  traceId: string;
  capability: ModelCapability;
}

export interface ModelAdapter {
  readonly descriptor: ModelProviderDescriptor;
  complete(request: ModelAdapterRequest, context: ModelCallContext): Promise<ModelAdapterResponse>;
}

export interface ModelExecutionRequest<T> {
  executionMode: "fixture" | "live";
  providerId?: ModelProviderDescriptor["id"];
  policy: ModelInvocationPolicy;
  input: unknown;
  sourceContent: string[];
  timeoutMs: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  evidenceExists: (evidenceId: string) => boolean;
  outputSchema: z.ZodType<T>;
  structuredOutput: ModelStructuredOutputDefinition;
  traceId?: string;
}

export interface ModelRunEnvelope<T> {
  providerId: ModelProviderDescriptor["id"];
  model: string;
  providerResponseId: string | null;
  providerVersion: string;
  promptId: string;
  promptVersion: string;
  promptSystemHash: string;
  capability: ModelCapability;
  status: "SUCCEEDED" | "FAILED" | "TIMEOUT";
  output: T | null;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cost: { amount: number; currency: string };
  evidenceIds: string[];
  limitations: string[];
  traceId: string;
}

export type ModelExecutionResult<T> =
  | { ok: true; run: ModelRunEnvelope<T>; remainingBudget: ModelBudget }
  | { ok: false; code: "INVALID_INPUT" | "POLICY_DENIED" | "CAPABILITY_UNAVAILABLE" | "BUDGET_EXCEEDED" | "TIMEOUT" | "MALFORMED_RESPONSE"; message: string; run: ModelRunEnvelope<never> | null; remainingBudget: ModelBudget };
