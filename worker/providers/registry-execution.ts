import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import type { CapabilityError } from "../../types/job";
import { ProviderResultSchema } from "./results-schema";
import {
  ProviderCancelledError,
  ProviderSelectionError,
  type ProviderBudget,
  type ProviderCallContext,
  type ProviderDescriptor,
  type ProviderExecutionResult,
  type ProviderId,
  type ProviderReservationGrant,
  type ProviderResult,
  type ProviderSelection,
  type ProviderSelectionRequest,
} from "./contracts";
import { errorFor, fail, selectProvider } from "./selection";
import { authorizeExecutionRequest, validateExecutionResult, validateRelatedResult } from "./execution-policy";
import { issueProviderReservation, reservationWasConsumed } from "./reservations";
export { consumeProviderReservation } from "./reservations";

function canonicalFingerprint(value: unknown): string {
  return JSON.stringify(value) ?? "";
}

async function invokeWithTimeout<T>(
  request: ProviderSelectionRequest,
  descriptor: ProviderDescriptor,
  context: ProviderCallContext,
  invoke: (descriptor: ProviderDescriptor, context: ProviderCallContext) => Promise<ProviderResult<T>>,
  controller: AbortController,
): Promise<ProviderResult<T>> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const error = new ProviderSelectionError(
        errorFor(request, "TIMEOUT", `Provider ${descriptor.id} exceeded the registry timeout`),
      );
      controller.abort(error);
      reject(error);
    }, request.timeoutMs);
  });
  try {
    return await Promise.race([invoke(descriptor, context), timeout]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
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
  const authorizationError = authorizeExecutionRequest(request);
  if (authorizationError) {
    return { ok: false, error: authorizationError, lastOutcome, attempts, remainingBudget };
  }

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

    const attemptController = new AbortController();
    const abortAttempt = () => attemptController.abort(executionSignal.reason);
    if (executionSignal.aborted) abortAttempt();
    else executionSignal.addEventListener("abort", abortAttempt, { once: true });
    currentRequest = { ...currentRequest, signal: attemptController.signal };
    remainingBudget = subtractBudget(remainingBudget, selection);
    const reservation = issueProviderReservation(currentRequest, selection, attemptController.signal);
    const nestedReservations: Array<{ selection: ProviderSelection; grant: ProviderReservationGrant }> = [];
    const invocationContext: ProviderCallContext = {
      profile: MarketProfileSchema.parse(request.profile),
      traceId: request.traceId ?? "provider-registry",
      signal: attemptController.signal,
      capability: currentRequest.capability as ProviderDescriptor["capability"],
      language: currentRequest.language,
      region: currentRequest.region,
      jurisdiction: currentRequest.jurisdiction,
      executionMode: currentRequest.executionMode,
      reservation: reservation.reservation,
      requestFingerprint: reservation.requestFingerprint,
      reserveProvider(descriptor) {
        if (attemptController.signal.aborted) throw new ProviderCancelledError();
        const registered = (request.nestedDescriptors ?? []).find(candidate =>
          candidate.id === descriptor.id
          && candidate.version === descriptor.version
          && canonicalFingerprint(candidate) === canonicalFingerprint(descriptor));
        if (!registered) fail(request, "POLICY_DENIED", "Nested provider is not authorized by the registry request");
        const nestedRequest: ProviderSelectionRequest = {
          ...request,
          capability: registered.capability,
          descriptors: [registered],
          signal: attemptController.signal,
          budget: remainingBudget,
          allowFallback: false,
          excludedProviders: [],
        };
        const nested = selectProvider(nestedRequest);
        remainingBudget = subtractBudget(remainingBudget, nested);
        const grant = issueProviderReservation(nestedRequest, nested, attemptController.signal);
        nestedReservations.push({ selection: nested, grant });
        return grant;
      },
    };
    let outcome: ProviderResult<T>;
    try {
      outcome = await invokeWithTimeout(currentRequest, selection.descriptor, invocationContext, invoke, attemptController);
    } catch (error) {
      executionSignal.removeEventListener("abort", abortAttempt);
      if (error instanceof ProviderSelectionError) {
        return { ok: false, error: error.capabilityError, lastOutcome, attempts, remainingBudget };
      }
      throw error;
    }
    executionSignal.removeEventListener("abort", abortAttempt);
    ProviderResultSchema.parse(outcome);
    if (!reservationWasConsumed(reservation)
      || nestedReservations.some(item => !reservationWasConsumed(item.grant))) {
      return {
        ok: false,
        error: errorFor(request, "INTERNAL_ERROR", "Provider invocation returned without consuming every registry reservation"),
        lastOutcome: null,
        attempts,
        remainingBudget,
      };
    }
    const validationError = validateExecutionResult(outcome, selection, currentRequest.budget.currency);
    if (validationError) {
      return {
        ok: false,
        error: errorFor(request, "INTERNAL_ERROR", validationError),
        lastOutcome: null,
        attempts,
        remainingBudget,
      };
    }
    const relatedRuns = outcome.relatedRuns ?? [];
    const unmatchedNested = [...nestedReservations];
    const uniqueRelatedRunIds = new Set(relatedRuns.map(run => run.providerRunId));
    const relatedRunsMatch = relatedRuns.every(run => {
      const index = unmatchedNested.findIndex(candidate =>
        candidate.selection.descriptor.id === run.provider
        && candidate.selection.descriptor.version === run.providerVersion
        && validateRelatedResult(run, candidate.selection, currentRequest.budget.currency));
      if (index < 0) return false;
      unmatchedNested.splice(index, 1);
      return true;
    });
    if (relatedRuns.length !== nestedReservations.length
      || uniqueRelatedRunIds.size !== relatedRuns.length || !relatedRunsMatch || unmatchedNested.length > 0) {
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
