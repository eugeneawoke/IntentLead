import { z } from "zod";
import { DiscoveryCapabilitySchema } from "../../lib/domain/schemas/common";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import type { CapabilityError } from "../../types/job";
import {
  ProviderCancelledError,
  ProviderSelectionError,
  PROVIDER_SCHEMA_VERSION,
  type ProviderBudget,
  type ProviderDescriptor,
  type ProviderExecutionResult,
  type ProviderId,
  type ProviderResult,
  type ProviderSelection,
  type ProviderSelectionRequest,
} from "./contracts";
import { ProviderResultSchema } from "./results";
import { descriptorSupportsJurisdiction, isValidJurisdiction, profileAllowsJurisdiction } from "./jurisdiction";

const ProviderDescriptorSchema = z.object({
  id: z.enum(["reddit", "hackernews", "exa", "serper", "openai"]),
  version: z.string().min(1),
  capability: z.enum(["SOURCE_SEARCH", "COMPANY_RESOLUTION"]),
  priority: z.number().int(),
  marketProfiles: z.array(z.enum(["EN_DISCOVERY_ONLY", "CIS_RU", "LOCAL_CUSTOM"])),
  languages: z.array(z.string().min(1)),
  regions: z.array(z.string().min(1)),
  jurisdictions: z.array(z.string().min(1)),
  legalStatus: z.enum(["ALLOWED", "RESTRICTED", "PROHIBITED", "UNASSESSED"]),
  available: z.boolean(),
  configuredCost: z.object({
    amount: z.number().finite().nonnegative().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  }).strict(),
}).strict();

function errorFor(request: ProviderSelectionRequest, code: CapabilityError["code"], message: string): CapabilityError {
  if (code === "RATE_LIMITED" || code === "DEPENDENCY_UNAVAILABLE" || code === "TIMEOUT") {
    return {
      schemaVersion: PROVIDER_SCHEMA_VERSION,
      code,
      retryable: true,
      message,
      capability: request.capability,
      traceId: request.traceId ?? "provider-registry",
      retryAfterMs: null,
    };
  }
  return {
    schemaVersion: PROVIDER_SCHEMA_VERSION,
    code,
    retryable: false,
    message,
    capability: request.capability,
    traceId: request.traceId ?? "provider-registry",
    retryAfterMs: null,
  };
}

function fail(request: ProviderSelectionRequest, code: CapabilityError["code"], message: string): never {
  throw new ProviderSelectionError(errorFor(request, code, message));
}

function languageMatches(supported: string[], requested: string): boolean {
  const normalized = requested.toLowerCase();
  const base = normalized.split("-")[0];
  return supported.some(language => {
    const value = language.toLowerCase();
    return value === "*" || value === normalized || value === base;
  });
}

function regionMatches(supported: string[], requested: string): boolean {
  return supported.includes("*") || supported.some(region => region.toLowerCase() === requested.toLowerCase());
}

function validateSelectionRequest(request: ProviderSelectionRequest): void {
  const profile = MarketProfileSchema.safeParse(request.profile);
  if (!profile.success) fail(request, "INVALID_INPUT", "Authorized MarketProfile is invalid");
  if (!profile.data.capabilities.some(capability => capability === request.capability)
    || profile.data.disabledCapabilities.some(capability => capability === request.capability)) {
    fail(request, "POLICY_DENIED", "Capability is disabled by the authorized MarketProfile");
  }
  if (profile.data.id === "EN_DISCOVERY_ONLY"
    && (!DiscoveryCapabilitySchema.safeParse(request.capability).success || profile.data.workflow !== "DISCOVERY_ONLY")) {
    fail(request, "POLICY_DENIED", "Capability is forbidden by EN_DISCOVERY_ONLY");
  }
  if (!Number.isFinite(request.budget.remainingCost) || request.budget.remainingCost < 0
    || !Number.isInteger(request.budget.remainingProviderCalls) || request.budget.remainingProviderCalls < 0
    || !/^[A-Z]{3}$/.test(request.budget.currency)
    || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(request.language)
    || !request.region.trim()) {
    fail(request, "INVALID_INPUT", "Provider selection context is invalid");
  }
  if (!languageMatches(profile.data.languages, request.language)) {
    fail(request, "POLICY_DENIED", "Language is outside the authorized MarketProfile");
  }
  if (request.jurisdiction !== null && !isValidJurisdiction(request.jurisdiction)) {
    fail(request, "INVALID_INPUT", "Request jurisdiction is invalid");
  }
  if (profile.data.id !== "EN_DISCOVERY_ONLY") {
    if (request.jurisdiction === null) {
      fail(request, "POLICY_DENIED", "Regional MarketProfiles require an explicit request jurisdiction");
    }
    if (!profileAllowsJurisdiction(profile.data, request.jurisdiction)) {
      fail(request, "POLICY_DENIED", "Jurisdiction is outside the authorized MarketProfile");
    }
  } else if (request.jurisdiction !== null && profile.data.jurisdictions.length > 0
    && !profileAllowsJurisdiction(profile.data, request.jurisdiction)) {
    fail(request, "POLICY_DENIED", "Jurisdiction is outside the authorized MarketProfile");
  }
  for (const descriptor of request.descriptors) {
    if (!ProviderDescriptorSchema.safeParse(descriptor).success) {
      fail(request, "INVALID_INPUT", "Provider descriptor is invalid");
    }
  }
}

export function selectProvider(request: ProviderSelectionRequest): ProviderSelection {
  validateSelectionRequest(request);
  if (request.budget.remainingProviderCalls <= 0) {
    fail(request, "BUDGET_EXCEEDED", "Provider-call budget is exhausted");
  }

  const excluded = new Set(request.excludedProviders ?? []);
  let costExceeded = false;
  const eligible = request.descriptors
    .filter(descriptor => descriptor.capability === request.capability)
    .filter(descriptor => descriptor.marketProfiles.includes(request.profile.id))
    .filter(descriptor => languageMatches(descriptor.languages, request.language))
    .filter(descriptor => regionMatches(descriptor.regions, request.region))
    .filter(descriptor => !request.jurisdiction || descriptorSupportsJurisdiction(descriptor.jurisdictions, request.jurisdiction))
    .filter(() => request.profile.regions.length === 0 || regionMatches(request.profile.regions, request.region))
    .filter(descriptor => descriptor.legalStatus === "ALLOWED" && descriptor.available)
    .filter(descriptor => !excluded.has(descriptor.id))
    .filter(descriptor => {
      const health = request.health[descriptor.id] ?? "HEALTHY";
      return health === "HEALTHY" || health === "DEGRADED";
    })
    .filter(descriptor => {
      const amount = descriptor.configuredCost.amount;
      if (amount === null) return false;
      if (amount > 0 && descriptor.configuredCost.currency !== request.budget.currency) return false;
      if (amount > request.budget.remainingCost) {
        costExceeded = true;
        return false;
      }
      return true;
    })
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  const descriptor = eligible[0];
  if (!descriptor) {
    if (costExceeded) fail(request, "BUDGET_EXCEEDED", "No provider fits the remaining job budget");
    fail(request, "CAPABILITY_UNAVAILABLE", "No provider is available for the requested capability and market");
  }
  return { descriptor, reservedCost: descriptor.configuredCost.amount! };
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
  invoke: (descriptor: ProviderDescriptor, context: import("./contracts").ProviderCallContext) => Promise<ProviderResult<T>>,
): Promise<ProviderExecutionResult<T>> {
  const attempts: ProviderExecutionResult<T>["attempts"] = [];
  const excluded: ProviderId[] = [...(request.excludedProviders ?? [])];
  let remainingBudget = { ...request.budget };
  let lastOutcome: ProviderResult<T> | null = null;

  for (;;) {
    if (request.signal?.aborted) throw new ProviderCancelledError();
    let selection: ProviderSelection;
    try {
      selection = selectProvider({ ...request, budget: remainingBudget, excludedProviders: excluded });
    } catch (error) {
      if (!(error instanceof ProviderSelectionError)) throw error;
      if (lastOutcome && request.allowFallback && isFallbackAllowed(lastOutcome.capabilityError)
        && error.capabilityError.code === "CAPABILITY_UNAVAILABLE") {
        return { ok: false, error: lastOutcome.capabilityError, lastOutcome, attempts, remainingBudget };
      }
      return { ok: false, error: error.capabilityError, lastOutcome, attempts, remainingBudget };
    }

    remainingBudget = subtractBudget(remainingBudget, selection);
    const nestedReservations: ProviderSelection[] = [];
    const invocationContext: import("./contracts").ProviderCallContext = {
      profile: request.profile,
      traceId: request.traceId ?? "provider-registry",
      signal: request.signal ?? new AbortController().signal,
      reserveProvider(descriptor) {
        if (request.signal?.aborted) throw new ProviderCancelledError();
        const nested = selectProvider({
          ...request,
          capability: descriptor.capability,
          descriptors: [descriptor],
          budget: remainingBudget,
          allowFallback: false,
          excludedProviders: [],
        });
        nestedReservations.push(nested);
        remainingBudget = subtractBudget(remainingBudget, nested);
        return nested;
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
      const reservation = nestedReservations.find(candidate =>
        candidate.descriptor.id === run.provider && candidate.descriptor.version === run.providerVersion);
      return !reservation
        || run.cost.configuredAmount !== reservation.descriptor.configuredCost.amount
        || run.cost.reservedAmount !== reservation.reservedCost;
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

    if (request.signal?.aborted) throw new ProviderCancelledError();
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
