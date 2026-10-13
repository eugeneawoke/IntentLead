import {
  GroundedModelClaimSchema, ModelInvocationPolicySchema, ModelProviderDescriptorSchema,
} from "../../lib/domain/schemas/model-provider";
import { z } from "zod";
import type { ModelProviderDescriptor } from "../../types/model-provider";
import type { ModelAdapter, ModelAdapterRequest, ModelAdapterResponse, ModelCallContext, ModelExecutionRequest, ModelExecutionResult, ModelReservation, ModelRunEnvelope } from "../../types/model-runtime";
import { MODEL_PROVIDER_CATALOG } from "./catalog";
import { sha256 } from "../providers/normalization";
import { modelPromptFor } from "./prompts";
import { ModelAdapterFailure } from "./model-adapter-failure";

interface ReservationState {
  descriptorFingerprint: string;
  capability: string;
  requestFingerprint: string;
  consumed: boolean;
}

const reservations = new WeakMap<object, ReservationState>();

function fingerprint(value: unknown): string {
  return JSON.stringify(value) ?? "";
}

function validStructuredOutput(value: unknown): value is ModelExecutionRequest<unknown>["structuredOutput"] {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ModelExecutionRequest<unknown>["structuredOutput"]>;
  if (typeof candidate.name !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(candidate.name)) return false;
  if (!candidate.schema || typeof candidate.schema !== "object" || candidate.schema.type !== "object") return false;
  try {
    const serialized = JSON.stringify(candidate.schema);
    return serialized.length > 0 && serialized.length <= 50_000;
  } catch {
    return false;
  }
}

function safeFixture(descriptor: ModelProviderDescriptor): boolean {
  return process.env.NODE_ENV === "test" && descriptor.id === "local" && descriptor.operationalState === "fixture_only"
    && descriptor.version === "fixture-v1"
    && descriptor.configuredCostPerMillionInputTokens === 0
    && descriptor.configuredCostPerMillionOutputTokens === 0;
}

function issueReservation<T>(
  request: ModelExecutionRequest<T>,
  descriptor: ModelProviderDescriptor,
  adapterRequest: ModelAdapterRequest,
  prompt: ReturnType<typeof modelPromptFor>,
) {
  const reservation = Object.freeze({}) as ModelReservation;
  const requestFingerprint = sha256(fingerprint({
    descriptor, policy: request.policy, executionMode: request.executionMode,
    providerId: request.providerId ?? null, timeoutMs: request.timeoutMs,
    adapterRequest,
    prompt: { id: prompt.id, version: prompt.version, systemHash: prompt.systemHash },
  }));
  reservations.set(reservation, {
    descriptorFingerprint: fingerprint(descriptor), capability: request.policy.capability,
    requestFingerprint, consumed: false,
  });
  return { reservation, requestFingerprint };
}

export function consumeModelReservation(
  descriptor: ModelProviderDescriptor,
  capability: string,
  context: ModelCallContext,
): void {
  const state = reservations.get(context.reservation);
  if (!state || state.consumed || state.descriptorFingerprint !== fingerprint(descriptor)
    || state.capability !== capability || state.requestFingerprint !== context.requestFingerprint) {
    throw new Error("Model invocation requires a matching unused registry reservation");
  }
  state.consumed = true;
}

function selectDescriptor<T>(request: ModelExecutionRequest<T>, adapter: ModelAdapter): ModelProviderDescriptor | null {
  const parsed = ModelProviderDescriptorSchema.safeParse(adapter.descriptor);
  if (!parsed.success || !parsed.data.capabilities.includes(request.policy.capability)) return null;
  if (request.providerId && parsed.data.id !== request.providerId) return null;
  const trusted = MODEL_PROVIDER_CATALOG.find(candidate => candidate.id === parsed.data.id);
  if (!trusted) return null;
  if (request.executionMode === "fixture") return safeFixture(parsed.data) ? parsed.data : null;
  if (fingerprint(parsed.data) !== fingerprint(trusted)) return null;
  return parsed.data.operationalState === "configured" || parsed.data.operationalState === "degraded" ? parsed.data : null;
}

function subtractBudget<T>(request: ModelExecutionRequest<T>, inputTokens: number, outputTokens: number, cost: number) {
  return {
    ...request.policy.budget,
    remainingCost: Math.max(0, request.policy.budget.remainingCost - cost),
    remainingInputTokens: Math.max(0, request.policy.budget.remainingInputTokens - inputTokens),
    remainingOutputTokens: Math.max(0, request.policy.budget.remainingOutputTokens - outputTokens),
    remainingCalls: Math.max(0, request.policy.budget.remainingCalls - 1),
  };
}

function failed<T>(
  request: ModelExecutionRequest<T>,
  code: Extract<ModelExecutionResult<T>, { ok: false }>["code"],
  message: string,
  remainingBudget = request.policy.budget,
  run: ModelRunEnvelope<never> | null = null,
): ModelExecutionResult<T> {
  return { ok: false, code, message, run, remainingBudget };
}

function failureRun<T>(
  request: ModelExecutionRequest<T>,
  descriptor: ModelProviderDescriptor,
  status: "FAILED" | "TIMEOUT",
  inputTokens: number,
  outputTokens: number,
  chargedCost: number,
  latencyMs: number,
  provenance: Pick<ModelAdapterResponse, "providerResponseId" | "reportedModel"> = {},
): ModelRunEnvelope<never> {
  const prompt = modelPromptFor(request.policy.capability);
  return {
    providerId: descriptor.id, model: provenance.reportedModel ?? descriptor.model,
    providerResponseId: provenance.providerResponseId ?? null,
    providerVersion: descriptor.version,
    promptId: prompt.id, promptVersion: prompt.version, promptSystemHash: prompt.systemHash,
    capability: request.policy.capability, status, output: null, inputTokens, outputTokens,
    latencyMs,
    cost: { amount: chargedCost, currency: request.policy.budget.currency },
    evidenceIds: [...request.policy.evidenceIds], limitations: [], traceId: request.traceId ?? "model-registry",
  };
}

export async function executeModel<T>(request: ModelExecutionRequest<T>, adapter: ModelAdapter): Promise<ModelExecutionResult<T>> {
  const startedAt = Date.now();
  const policy = ModelInvocationPolicySchema.safeParse(request.policy);
  if (!policy.success || !Number.isInteger(request.timeoutMs) || request.timeoutMs < 1 || request.timeoutMs > 60_000
    || !Number.isInteger(request.maxInputTokens) || request.maxInputTokens < 1
    || !Number.isInteger(request.maxOutputTokens) || request.maxOutputTokens < 1
    || !validStructuredOutput(request.structuredOutput)) {
    return failed(request, "INVALID_INPUT", "Model invocation policy or timeout is invalid");
  }
  if (request.policy.evidenceIds.some(id => !request.evidenceExists(id))) {
    return failed(request, "POLICY_DENIED", "Every model evidence reference must already exist");
  }
  const prompt = modelPromptFor(request.policy.capability);
  let payload: string;
  try {
    payload = JSON.stringify({
      input: request.input,
      sourceContent: request.sourceContent.map(content => ({ trust: "UNTRUSTED_DATA", content })),
      evidenceIds: request.policy.evidenceIds,
    });
  } catch {
    return failed(request, "INVALID_INPUT", "Model input cannot be serialized");
  }
  const adapterRequest: ModelAdapterRequest = {
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: payload },
    ],
    maxOutputTokens: request.maxOutputTokens,
    maxInputTokens: request.maxInputTokens,
    structuredOutput: request.structuredOutput,
  };
  const conservativeInputTokenUpperBound = new TextEncoder().encode(fingerprint({
    messages: adapterRequest.messages,
    structuredOutput: adapterRequest.structuredOutput,
  })).byteLength;
  if (conservativeInputTokenUpperBound > request.maxInputTokens) {
    return failed(request, "BUDGET_EXCEEDED", "Serialized model input exceeds its conservative preflight token bound");
  }
  if (request.policy.budget.remainingCalls < 1
    || request.maxInputTokens > request.policy.budget.remainingInputTokens
    || request.maxOutputTokens > request.policy.budget.remainingOutputTokens) {
    return failed(request, "BUDGET_EXCEEDED", "Model budget is exhausted before invocation");
  }
  const descriptor = selectDescriptor(request, adapter);
  if (!descriptor) return failed(request, "CAPABILITY_UNAVAILABLE", "No trusted active model satisfies the request");
  if (request.maxInputTokens > descriptor.maxInputTokens) {
    return failed(request, "BUDGET_EXCEEDED", "Model input ceiling exceeds provider capacity");
  }
  const inputRate = descriptor.configuredCostPerMillionInputTokens;
  const outputRate = descriptor.configuredCostPerMillionOutputTokens;
  if (inputRate === null || outputRate === null) return failed(request, "CAPABILITY_UNAVAILABLE", "Model cost is not configured");
  if ((inputRate > 0 || outputRate > 0) && descriptor.configuredCostCurrency !== request.policy.budget.currency) {
    return failed(request, "POLICY_DENIED", "Model cost currency does not match its budget");
  }
  const reservedCost = (request.maxInputTokens * inputRate + request.maxOutputTokens * outputRate) / 1_000_000;
  if (reservedCost > request.policy.budget.remainingCost) {
    return failed(request, "BUDGET_EXCEEDED", "Model cost reservation exceeds the remaining budget");
  }
  const reservedBudget = subtractBudget(request, request.maxInputTokens, request.maxOutputTokens, reservedCost);

  const traceId = request.traceId ?? "model-registry";
  const controller = new AbortController();
  const grant = issueReservation(request, descriptor, adapterRequest, prompt);
  const context: ModelCallContext = {
    signal: controller.signal,
    traceId,
    capability: request.policy.capability,
    ...grant,
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort(new Error("model timeout"));
        reject(new Error("model timeout"));
      }, request.timeoutMs);
    });
    const response = await Promise.race([adapter.complete(adapterRequest, context), timeout]);
    if (!reservations.get(grant.reservation)?.consumed) {
      return failed(request, "POLICY_DENIED", "Model adapter returned without consuming its registry reservation", reservedBudget,
        failureRun(request, descriptor, "FAILED", 0, 0, reservedCost, Date.now() - startedAt, response));
    }
    if (!Number.isInteger(response.inputTokens) || response.inputTokens < 0
      || !Number.isInteger(response.outputTokens) || response.outputTokens < 0) {
      return failed(request, "MALFORMED_RESPONSE", "Model usage is invalid", reservedBudget,
        failureRun(request, descriptor, "FAILED", 0, 0, reservedCost, Date.now() - startedAt, response));
    }
    const cost = (response.inputTokens * inputRate + response.outputTokens * outputRate) / 1_000_000;
    if (response.inputTokens > request.maxInputTokens || response.outputTokens > request.maxOutputTokens || cost > reservedCost) {
      return failed(request, "BUDGET_EXCEEDED", "Model usage exceeded its reserved budget",
        subtractBudget(request, response.inputTokens, response.outputTokens, cost),
        failureRun(request, descriptor, "FAILED", response.inputTokens, response.outputTokens, cost, Date.now() - startedAt, response));
    }
    if (response.reportedModel && response.reportedModel !== descriptor.model) {
      return failed(request, "POLICY_DENIED", "Model provider returned a different model than authorized", reservedBudget,
        failureRun(request, descriptor, "FAILED", response.inputTokens, response.outputTokens, cost, Date.now() - startedAt, response));
    }
    const evidenceRequired = request.policy.capability !== "STRUCTURE_DISCOVERY_BRIEF"
      && request.policy.capability !== "PROPOSE_SOURCE_PLAN";
    if (evidenceRequired) {
      const grounded = z.object({ claims: z.array(GroundedModelClaimSchema).min(1) }).passthrough().safeParse(response.output);
      const allowed = new Set(request.policy.evidenceIds);
      if (!grounded.success) {
        return failed(request, "MALFORMED_RESPONSE", "Grounded model output must include evidence-linked claims", reservedBudget,
          failureRun(request, descriptor, "FAILED", response.inputTokens, response.outputTokens, reservedCost, Date.now() - startedAt, response));
      }
      if (grounded.data.claims.some(claim => claim.evidenceIds.some(id => !allowed.has(id)))) {
        return failed(request, "POLICY_DENIED", "Grounded model output must use only authorized evidence", reservedBudget,
          failureRun(request, descriptor, "FAILED", response.inputTokens, response.outputTokens, reservedCost, Date.now() - startedAt, response));
      }
    }
    const output = request.outputSchema.safeParse(response.output);
    if (!output.success) return failed(request, "MALFORMED_RESPONSE", "Model output failed its capability schema", reservedBudget,
      failureRun(request, descriptor, "FAILED", response.inputTokens, response.outputTokens, reservedCost, Date.now() - startedAt, response));
    const run: ModelRunEnvelope<T> = {
      providerId: descriptor.id, model: response.reportedModel ?? descriptor.model,
      providerResponseId: response.providerResponseId ?? null, providerVersion: descriptor.version,
      promptId: prompt.id, promptVersion: prompt.version, promptSystemHash: prompt.systemHash,
      capability: request.policy.capability, status: "SUCCEEDED", output: output.data,
      inputTokens: response.inputTokens, outputTokens: response.outputTokens,
      latencyMs: Date.now() - startedAt,
      cost: { amount: cost, currency: request.policy.budget.currency },
      evidenceIds: [...request.policy.evidenceIds], limitations: response.limitations, traceId,
    };
    return { ok: true, run, remainingBudget: subtractBudget(request, response.inputTokens, response.outputTokens, cost) };
  } catch (error) {
    if (controller.signal.aborted) return failed(request, "TIMEOUT", "Model invocation exceeded its timeout", reservedBudget,
      failureRun(request, descriptor, "TIMEOUT", 0, 0, reservedCost, Date.now() - startedAt));
    if (error instanceof ModelAdapterFailure) {
      const hasValidUsage = Number.isInteger(error.inputTokens) && error.inputTokens! >= 0
        && Number.isInteger(error.outputTokens) && error.outputTokens! >= 0;
      const inputTokens = hasValidUsage ? error.inputTokens! : 0;
      const outputTokens = hasValidUsage ? error.outputTokens! : 0;
      const chargedCost = hasValidUsage
        ? (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000
        : reservedCost;
      const remainingBudget = hasValidUsage
        ? subtractBudget(request, inputTokens, outputTokens, chargedCost)
        : reservedBudget;
      return failed(request, error.code, error.message, remainingBudget,
        failureRun(request, descriptor, "FAILED", inputTokens, outputTokens, chargedCost, Date.now() - startedAt, error));
    }
    return failed(request, "CAPABILITY_UNAVAILABLE", error instanceof Error ? error.message : "Model provider failed", reservedBudget,
      failureRun(request, descriptor, "FAILED", 0, 0, reservedCost, Date.now() - startedAt));
  } finally {
    if (timer) clearTimeout(timer);
  }
}
