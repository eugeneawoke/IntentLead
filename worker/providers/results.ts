import { DiscoveryCapabilitySchema } from "../../lib/domain/schemas/common";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import type { CapabilityError } from "../../types/job";
import {
  ProviderCancelledError,
  ProviderSelectionError,
  PROVIDER_SCHEMA_VERSION,
  type ProviderCallContext,
  type ProviderDescriptor,
  type ProviderFailureKind,
  type ProviderProvenance,
  type ProviderResult,
  type ProviderRuntimeDependencies,
  type ProviderRunStatus,
  type ProviderStatus,
  type ProviderUsage,
} from "./contracts";
import {
  isProviderHttpFailure,
  ProviderHttpError,
  ProviderMalformedResponseError,
  ProviderTimeoutError,
} from "./http";
import { sha256 } from "./normalization";
import { ProviderResultSchema } from "./results-schema";
import { consumeProviderReservation } from "./registry-execution";

export { ProviderResultSchema } from "./results-schema";

export interface ProviderOperationContext {
  providerRunId: string;
  signal: AbortSignal;
  recordRequest(): void;
}

export interface ProviderOperationResult<T> {
  value: T;
  status: "SUCCEEDED" | "EMPTY" | "PARTIAL";
  usage: ProviderUsage;
  provenance: ProviderProvenance[];
  limitations: string[];
  actualCost?: number | null;
  failureKind?: ProviderFailureKind;
  capabilityError?: CapabilityError;
}

function createCapabilityError(
  descriptor: ProviderDescriptor,
  context: ProviderCallContext,
  code: CapabilityError["code"],
  message: string,
  retryAfterMs: number | null = null,
): CapabilityError {
  if (code === "TIMEOUT" || code === "RATE_LIMITED" || code === "DEPENDENCY_UNAVAILABLE") {
    return { schemaVersion: 1, code, retryable: true, message, capability: descriptor.capability, traceId: context.traceId, retryAfterMs };
  }
  return { schemaVersion: 1, code, retryable: false, message, capability: descriptor.capability, traceId: context.traceId, retryAfterMs: null };
}

function assertProviderCapability(descriptor: ProviderDescriptor, context: ProviderCallContext): void {
  const profile = MarketProfileSchema.safeParse(context.profile);
  const enabled = profile.success
    && profile.data.capabilities.includes(descriptor.capability)
    && !profile.data.disabledCapabilities.includes(descriptor.capability);
  const deniedInDiscovery = profile.success
    && profile.data.id === "EN_DISCOVERY_ONLY"
    && (!DiscoveryCapabilitySchema.safeParse(descriptor.capability).success || profile.data.workflow !== "DISCOVERY_ONLY");
  if (!enabled || deniedInDiscovery) {
    throw new ProviderSelectionError(createCapabilityError(
      descriptor, context, "POLICY_DENIED", "Capability is disabled by the authorized MarketProfile",
    ));
  }
}

export function mapProviderFailure(
  error: unknown,
  descriptor: ProviderDescriptor,
  context: ProviderCallContext,
): { status: ProviderStatus; failureKind: ProviderFailureKind; capabilityError: CapabilityError } {
  if (error instanceof ProviderTimeoutError) {
    return { status: "TIMEOUT", failureKind: "TIMEOUT", capabilityError: createCapabilityError(descriptor, context, "TIMEOUT", "Provider request timed out") };
  }
  if (isProviderHttpFailure(error)) {
    const httpError = error as ProviderHttpError;
    if (httpError.kind === "UNAUTHORIZED") {
      return { status: "FAILED", failureKind: "UNAUTHORIZED", capabilityError: createCapabilityError(descriptor, context, "FORBIDDEN", "Provider authorization failed") };
    }
    if (httpError.kind === "RATE_LIMITED") {
      return { status: "RATE_LIMITED", failureKind: "RATE_LIMITED", capabilityError: createCapabilityError(descriptor, context, "RATE_LIMITED", "Provider rate limit was reached", httpError.retryAfterMs) };
    }
    if (httpError.kind === "MALFORMED_RESPONSE") {
      return { status: "FAILED", failureKind: "MALFORMED_RESPONSE", capabilityError: createCapabilityError(descriptor, context, "INTERNAL_ERROR", "Provider response was invalid") };
    }
  }
  if (error instanceof ProviderMalformedResponseError) {
    return { status: "FAILED", failureKind: "MALFORMED_RESPONSE", capabilityError: createCapabilityError(descriptor, context, "INTERNAL_ERROR", "Provider response was invalid") };
  }
  if (error instanceof ProviderSelectionError) {
    return { status: "FAILED", failureKind: "MALFORMED_RESPONSE", capabilityError: error.capabilityError };
  }
  return {
    status: "FAILED",
    failureKind: "UNAVAILABLE",
    capabilityError: createCapabilityError(descriptor, context, "DEPENDENCY_UNAVAILABLE", "Provider dependency is unavailable"),
  };
}

function terminalRunStatus(status: ProviderStatus): Exclude<ProviderRunStatus, "STARTED"> {
  if (status === "EMPTY" || status === "SUCCEEDED") return "SUCCEEDED";
  return status;
}

export async function runRecordedProvider<T>(input: {
  descriptor: ProviderDescriptor;
  context: ProviderCallContext;
  dependencies: ProviderRuntimeDependencies;
  inputCount: number;
  inputFingerprint: string;
  run(operation: ProviderOperationContext): Promise<ProviderOperationResult<T>>;
}): Promise<ProviderResult<T>> {
  const { descriptor, context, dependencies } = input;
  const reservation = consumeProviderReservation(context.reservation, descriptor, context);
  assertProviderCapability(descriptor, context);
  if (context.signal.aborted) throw new ProviderCancelledError();

  const startedAt = dependencies.now().toISOString();
  const requestedRunId = dependencies.createId();
  await dependencies.recorder.start({
    providerRunId: requestedRunId,
    capability: descriptor.capability,
    provider: descriptor.id,
    providerVersion: descriptor.version,
    startedAt,
    requestMetadata: {
      marketProfileId: context.profile.id,
      traceId: context.traceId,
      inputCount: input.inputCount,
      inputHash: sha256(input.inputFingerprint),
    },
  });

  let requestCount = 0;
  let operationResult: ProviderOperationResult<T> | null = null;
  let failed: ReturnType<typeof mapProviderFailure> | null = null;
  let cancelled = false;
  try {
    operationResult = await input.run({
      providerRunId: requestedRunId,
      signal: context.signal,
      recordRequest() { requestCount++; },
    });
    if (context.signal.aborted) throw new ProviderCancelledError();
    if (operationResult.status === "PARTIAL" && !operationResult.capabilityError) {
      throw new ProviderMalformedResponseError();
    }
  } catch (error) {
    if (error instanceof ProviderCancelledError || context.signal.aborted) cancelled = true;
    else failed = mapProviderFailure(error, descriptor, context);
  }

  const finishedDate = dependencies.now();
  const startedDate = new Date(startedAt);
  const finishedAt = finishedDate.getTime() < startedDate.getTime() ? startedAt : finishedDate.toISOString();
  const latencyMs = Math.max(0, Date.parse(finishedAt) - startedDate.getTime());
  const usage: ProviderUsage = {
    requestCount,
    recordCount: operationResult?.usage.recordCount ?? 0,
    ...(operationResult?.usage.inputTokens !== undefined ? { inputTokens: operationResult.usage.inputTokens } : {}),
    ...(operationResult?.usage.outputTokens !== undefined ? { outputTokens: operationResult.usage.outputTokens } : {}),
  };
  const cost = {
    configuredAmount: descriptor.configuredCost.amount,
    reservedAmount: reservation.reservedCost,
    actualAmount: operationResult?.actualCost ?? (descriptor.configuredCost.amount === 0 ? 0 : null),
    currency: descriptor.configuredCost.currency,
  };
  const status: ProviderStatus = cancelled ? "FAILED" : failed?.status ?? operationResult?.status ?? "FAILED";
  const error = failed?.capabilityError ?? operationResult?.capabilityError ?? null;
  const failureKind = cancelled ? "CANCELLED" : failed?.failureKind ?? operationResult?.failureKind ?? null;
  await dependencies.recorder.finish({
    providerRunId: requestedRunId,
    status: terminalRunStatus(status),
    finishedAt,
    latencyMs,
    usage,
    cost,
    responseMetadata: {
      recordCount: usage.recordCount,
      failureKind,
      errorCode: error?.code ?? null,
    },
  });

  if (cancelled) throw new ProviderCancelledError();
  const common = {
    schemaVersion: PROVIDER_SCHEMA_VERSION,
    providerRunId: requestedRunId,
    provider: descriptor.id,
    providerVersion: descriptor.version,
    startedAt,
    finishedAt,
    latencyMs,
    usage,
    cost,
    provenance: operationResult?.provenance ?? [],
    limitations: operationResult?.limitations ?? ["Provider output was not available; raw payloads are not retained."],
  };
  let result: ProviderResult<T>;
  if (failed) {
    result = {
      ...common,
      status: failed.status as "FAILED" | "RATE_LIMITED" | "TIMEOUT",
      value: null,
      failureKind: failed.failureKind as Exclude<ProviderFailureKind, "BUDGET_EXCEEDED">,
      capabilityError: failed.capabilityError,
    };
  } else if (!operationResult) {
    const mapped = mapProviderFailure(new Error("No provider result"), descriptor, context);
    result = { ...common, status: "FAILED", value: null, failureKind: "UNAVAILABLE", capabilityError: mapped.capabilityError };
  } else if (operationResult.status === "PARTIAL") {
    result = {
      ...common,
      status: "PARTIAL",
      value: operationResult.value,
      failureKind: operationResult.failureKind ?? "UNAVAILABLE",
      capabilityError: operationResult.capabilityError!,
    };
  } else {
    result = {
      ...common,
      status: operationResult.status,
      value: operationResult.value,
      failureKind: null,
      capabilityError: null,
    };
  }
  ProviderResultSchema.parse(result);
  return result;
}
