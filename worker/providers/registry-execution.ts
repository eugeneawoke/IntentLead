import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import type { CapabilityError } from "../../types/job";
import { ProviderResultSchema } from "./results-schema";
import {
  ProviderCancelledError,
  ProviderSelectionError,
  PROVIDER_SCHEMA_VERSION,
  type ProviderBudget,
  type ProviderCallContext,
  type ProviderDescriptor,
  type ProviderExecutionResult,
  type ProviderId,
  type ProviderReservation,
  type ProviderReservationGrant,
  type ProviderResult,
  type ProviderSelection,
  type ProviderSelectionRequest,
} from "./contracts";
import { sha256 } from "./normalization";
import { errorFor, fail, selectProvider } from "./selection";

interface ReservationState {
  descriptorFingerprint: string;
  profileFingerprint: string;
  capability: ProviderSelectionRequest["capability"];
  language: string;
  region: string;
  jurisdiction: string | null;
  traceId: string;
  signal: AbortSignal;
  requestFingerprint: string;
  reservedCost: number;
  consumed: boolean;
}

const registryReservations = new WeakMap<object, ReservationState>();

function canonicalFingerprint(value: unknown): string {
  return JSON.stringify(value) ?? "";
}

function reservationRequestFingerprint(request: ProviderSelectionRequest, selection: ProviderSelection): string {
  const profile = MarketProfileSchema.parse(request.profile);
  return canonicalFingerprint({
    profile,
    capability: request.capability,
    language: request.language,
    region: request.region,
    jurisdiction: request.jurisdiction,
    health: request.health,
    budget: request.budget,
    descriptors: request.descriptors,
    nestedDescriptors: request.nestedDescriptors ?? [],
    allowFallback: request.allowFallback,
    traceId: request.traceId ?? "provider-registry",
    excludedProviders: request.excludedProviders ?? [],
    selected: selection.descriptor,
    reservedCost: selection.reservedCost,
  });
}

function issueProviderReservation(
  request: ProviderSelectionRequest,
  selection: ProviderSelection,
  signal: AbortSignal,
): ProviderReservationGrant {
  const profile = MarketProfileSchema.parse(request.profile);
  const reservation = Object.freeze({});
  const requestFingerprint = sha256(reservationRequestFingerprint(request, selection));
  registryReservations.set(reservation, {
    descriptorFingerprint: canonicalFingerprint(selection.descriptor),
    profileFingerprint: canonicalFingerprint(profile),
    capability: request.capability,
    language: request.language,
    region: request.region,
    jurisdiction: request.jurisdiction,
    traceId: request.traceId ?? "provider-registry",
    signal,
    requestFingerprint,
    reservedCost: selection.reservedCost,
    consumed: false,
  });
  return { reservation: reservation as ProviderReservation, requestFingerprint };
}

function rejectInvalidReservation(context: ProviderCallContext): never {
  throw new ProviderSelectionError({
    schemaVersion: PROVIDER_SCHEMA_VERSION,
    code: "POLICY_DENIED",
    retryable: false,
    message: "Provider invocation requires a matching unused registry reservation",
    capability: context.capability,
    traceId: context.traceId,
    retryAfterMs: null,
  });
}

/** Consumes only registry-issued permits; no reservation constructor is exported. */
export function consumeProviderReservation(
  reservation: ProviderReservation | undefined,
  descriptor: ProviderDescriptor,
  context: ProviderCallContext,
): { reservedCost: number } {
  if (!reservation || typeof reservation !== "object") return rejectInvalidReservation(context);
  const state = registryReservations.get(reservation);
  if (!state || state.consumed) return rejectInvalidReservation(context);
  state.consumed = true;

  const profile = MarketProfileSchema.safeParse(context.profile);
  const matches = profile.success
    && state.descriptorFingerprint === canonicalFingerprint(descriptor)
    && state.profileFingerprint === canonicalFingerprint(profile.data)
    && state.capability === context.capability
    && state.capability === descriptor.capability
    && state.language === context.language
    && state.region === context.region
    && state.jurisdiction === context.jurisdiction
    && state.traceId === context.traceId
    && state.signal === context.signal
    && state.requestFingerprint === context.requestFingerprint
    && /^[0-9a-f]{64}$/.test(state.requestFingerprint);
  if (!matches) return rejectInvalidReservation(context);
  return { reservedCost: state.reservedCost };
}

function subtractBudget(budget: ProviderBudget, selection: ProviderSelection): ProviderBudget {
  const remainingCost = Math.max(0, Math.round((budget.remainingCost - selection.reservedCost) * 1_000_000_000) / 1_000_000_000);
  return {
    currency: budget.currency,
    remainingCost,
    remainingProviderCalls: Math.max(0, budget.remainingProviderCalls - 1),
  };
}

function outcomeIsSuccessful<T>(outcome: ProviderResult<T>): boolean {
  return outcome.status === "SUCCEEDED" || outcome.status === "EMPTY" || outcome.status === "PARTIAL";
}

export async function executeProviderWithFallback<T>(
  request: ProviderSelectionRequest,
  invoke: (descriptor: ProviderDescriptor, context: ProviderCallContext) => Promise<ProviderResult<T>>,
): Promise<ProviderExecutionResult<T>> {
  const attempts: ProviderExecutionResult<T>["attempts"] = [];
  const excluded: ProviderId[] = [...(request.excludedProviders ?? [])];
  let remainingBudget = { ...request.budget };
  let lastOutcome: ProviderResult<T> | null = null;
  const executionSignal = request.signal ?? new AbortController().signal;

  for (;;) {
    if (executionSignal.aborted) throw new ProviderCancelledError();
    let selection: ProviderSelection;
    let currentRequest: ProviderSelectionRequest;
    try {
      currentRequest = { ...request, signal: executionSignal, budget: remainingBudget, excludedProviders: excluded };
      selection = selectProvider(currentRequest);
    } catch (error) {
      if (!(error instanceof ProviderSelectionError)) throw error;
      if (lastOutcome && request.allowFallback && isFallbackAllowed(lastOutcome.capabilityError)
        && error.capabilityError.code === "CAPABILITY_UNAVAILABLE") {
        return { ok: false, error: lastOutcome.capabilityError, lastOutcome, attempts, remainingBudget };
      }
      return { ok: false, error: error.capabilityError, lastOutcome, attempts, remainingBudget };
    }

    remainingBudget = subtractBudget(remainingBudget, selection);
    const reservation = issueProviderReservation(currentRequest, selection, executionSignal);
    const nestedReservations: ProviderSelection[] = [];
    const invocationContext: ProviderCallContext = {
      profile: MarketProfileSchema.parse(request.profile),
      traceId: request.traceId ?? "provider-registry",
      signal: executionSignal,
      capability: currentRequest.capability as ProviderDescriptor["capability"],
      language: currentRequest.language,
      region: currentRequest.region,
      jurisdiction: currentRequest.jurisdiction,
      reservation: reservation.reservation,
      requestFingerprint: reservation.requestFingerprint,
      reserveProvider(descriptor) {
        if (executionSignal.aborted) throw new ProviderCancelledError();
        const registered = (request.nestedDescriptors ?? []).find(candidate =>
          candidate.id === descriptor.id
          && candidate.version === descriptor.version
          && canonicalFingerprint(candidate) === canonicalFingerprint(descriptor));
        if (!registered) fail(request, "POLICY_DENIED", "Nested provider is not authorized by the registry request");
        const nestedRequest: ProviderSelectionRequest = {
          ...request,
          capability: registered.capability,
          descriptors: [registered],
          signal: executionSignal,
          budget: remainingBudget,
          allowFallback: false,
          excludedProviders: [],
        };
        const nested = selectProvider(nestedRequest);
        nestedReservations.push(nested);
        remainingBudget = subtractBudget(remainingBudget, nested);
        return issueProviderReservation(nestedRequest, nested, executionSignal);
      },
    };
    const outcome = await invoke(selection.descriptor, invocationContext);
    ProviderResultSchema.parse(outcome);
    if (outcome.provider !== selection.descriptor.id || outcome.providerVersion !== selection.descriptor.version) {
      return {
        ok: false,
        error: errorFor(request, "INTERNAL_ERROR", "Provider result does not match the selected descriptor"),
        lastOutcome: null,
        attempts,
        remainingBudget,
      };
    }
    const relatedRuns = outcome.relatedRuns ?? [];
    if (relatedRuns.length !== nestedReservations.length || relatedRuns.some(run => {
      const nested = nestedReservations.find(candidate =>
        candidate.descriptor.id === run.provider && candidate.descriptor.version === run.providerVersion);
      return !nested
        || run.cost.configuredAmount !== nested.descriptor.configuredCost.amount
        || run.cost.reservedAmount !== nested.reservedCost;
    })) {
      return {
        ok: false,
        error: errorFor(request, "INTERNAL_ERROR", "Related provider run does not match its registry reservation"),
        lastOutcome: null,
        attempts,
        remainingBudget,
      };
    }
    attempts.push({
      providerId: outcome.provider,
      providerRunId: outcome.providerRunId,
      status: outcome.status,
      configuredCost: outcome.cost.configuredAmount,
    });
    for (const run of relatedRuns) {
      attempts.push({
        providerId: run.provider,
        providerRunId: run.providerRunId,
        status: run.status,
        configuredCost: run.cost.configuredAmount,
      });
    }
    lastOutcome = outcome;
    if (outcomeIsSuccessful(outcome)) return { ok: true, outcome, attempts, remainingBudget };
    const outcomeError = outcome.capabilityError;
    if (!request.allowFallback || !isFallbackAllowed(outcomeError)) {
      return {
        ok: false,
        error: outcomeError ?? errorFor(request, "INTERNAL_ERROR", "Provider failure did not include a capability error"),
        lastOutcome: outcome,
        attempts,
        remainingBudget,
      };
    }

    if (executionSignal.aborted) throw new ProviderCancelledError();
    excluded.push(selection.descriptor.id);
    if (remainingBudget.remainingProviderCalls <= 0) {
      return {
        ok: false,
        error: errorFor(request, "BUDGET_EXCEEDED", "Provider-call budget is exhausted before fallback"),
        lastOutcome: outcome,
        attempts,
        remainingBudget,
      };
    }
  }
}

function isFallbackAllowed(error: CapabilityError | null | undefined): error is CapabilityError {
  return Boolean(error?.retryable && (error.code === "DEPENDENCY_UNAVAILABLE" || error.code === "RATE_LIMITED"));
}
