import { CapabilityErrorSchema } from "../../lib/domain/schemas/job";
import { DiscoveryCapabilitySchema } from "../../lib/domain/schemas/common";
import type { Capability, MarketProfile } from "../../types/market-profile";
import type { CapabilityError } from "../../types/job";
import type { LeasedJob } from "./repository";

export function structuredError(job: LeasedJob, capability: LeasedJob["capability"], code: CapabilityError["code"], message: string): CapabilityError {
  return code === "TIMEOUT" || code === "RATE_LIMITED" || code === "DEPENDENCY_UNAVAILABLE"
    ? { schemaVersion: 1, message, capability, traceId: job.traceId, code, retryable: true, retryAfterMs: null }
    : { schemaVersion: 1, message, capability, traceId: job.traceId, code, retryable: false, retryAfterMs: null };
}

export function assertCapabilityAllowed(profile: MarketProfile, capability: Capability, job: LeasedJob): void {
  const enabled = (profile.capabilities as readonly Capability[]).includes(capability)
    && !(profile.disabledCapabilities as readonly Capability[]).includes(capability);
  const discoveryDenied = profile.id === "EN_DISCOVERY_ONLY"
    && (!DiscoveryCapabilitySchema.safeParse(capability).success || profile.workflow !== "DISCOVERY_ONLY");
  if (!enabled || discoveryDenied) {
    throw new PolicyError(structuredError(job, job.capability, "POLICY_DENIED", "Capability is disabled by the authorized MarketProfile"));
  }
}

export class PolicyError extends Error {
  constructor(readonly capabilityError: CapabilityError) { super(capabilityError.message); }
}

export function toCapabilityError(error: unknown, job: LeasedJob): CapabilityError {
  if (error instanceof PolicyError) return error.capabilityError;
  const parsed = CapabilityErrorSchema.safeParse(error);
  if (parsed.success) return parsed.data;
  return structuredError(job, job.capability, "INTERNAL_ERROR", "Discovery job failed");
}
