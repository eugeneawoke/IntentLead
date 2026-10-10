import type { CapabilityError } from "../../types/job";
import { PROVIDER_CATALOG } from "./catalog";
import {
  type ProviderDescriptor,
  type ProviderResult,
  type ProviderSelection,
  type ProviderSelectionRequest,
} from "./contracts";
import { errorFor } from "./selection";

function fingerprint(value: unknown): string {
  return JSON.stringify(value) ?? "";
}

function catalogMatch(descriptor: ProviderDescriptor): ProviderDescriptor | undefined {
  return PROVIDER_CATALOG.find(candidate =>
    candidate.id === descriptor.id && candidate.capability === descriptor.capability);
}

function fixtureDescriptorIsSafe(descriptor: ProviderDescriptor): boolean {
  return descriptor.operationalState === "fixture_only"
    && descriptor.version === "fixture-v1"
    && descriptor.configuredCost.amount === 0
    && descriptor.configuredCost.currency === null;
}

export function authorizeExecutionRequest(request: ProviderSelectionRequest): CapabilityError | null {
  for (const descriptor of [...request.descriptors, ...(request.nestedDescriptors ?? [])]) {
    const trusted = catalogMatch(descriptor);
    if (!trusted) {
      return errorFor(request, "POLICY_DENIED", `Provider ${descriptor.id}/${descriptor.capability} is not in the trusted catalog`);
    }
    if (request.executionMode === "fixture") {
      if (process.env.NODE_ENV !== "test" || !fixtureDescriptorIsSafe(descriptor)) {
        return errorFor(request, "POLICY_DENIED", "Fixture execution requires a zero-cost fixture-only descriptor");
      }
      continue;
    }
    if (fingerprint(descriptor) !== fingerprint(trusted)) {
      return errorFor(request, "POLICY_DENIED", "Live execution requires the exact trusted catalog descriptor");
    }
  }
  return null;
}

function costMatches(
  result: ProviderResult<unknown>,
  selection: ProviderSelection,
  requestCurrency: string,
): boolean {
  const { configuredAmount, reservedAmount, actualAmount, currency } = result.cost;
  const expectedCurrency = selection.descriptor.configuredCost.currency;
  return configuredAmount === selection.descriptor.configuredCost.amount
    && reservedAmount === selection.reservedCost
    && currency === expectedCurrency
    && (selection.reservedCost === 0 || expectedCurrency === requestCurrency)
    && (actualAmount === null || actualAmount <= selection.reservedCost)
    && (!(result.status === "SUCCEEDED" || result.status === "EMPTY" || result.status === "PARTIAL")
      || selection.reservedCost === 0 || actualAmount !== null);
}

export function validateExecutionResult(
  result: ProviderResult<unknown>,
  selection: ProviderSelection,
  requestCurrency: string,
): string | null {
  if (result.provider !== selection.descriptor.id || result.providerVersion !== selection.descriptor.version) {
    return "Provider result does not match the selected descriptor";
  }
  if (!costMatches(result, selection, requestCurrency)) {
    return "Provider result cost does not match its registry reservation";
  }
  return null;
}

export function validateRelatedResult(
  result: ProviderResult<unknown>,
  selection: ProviderSelection,
  requestCurrency: string,
): boolean {
  return validateExecutionResult(result, selection, requestCurrency) === null;
}
