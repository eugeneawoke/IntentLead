import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import {
  ProviderSelectionError,
  PROVIDER_SCHEMA_VERSION,
  type ProviderCallContext,
  type ProviderDescriptor,
  type ProviderReservation,
  type ProviderReservationGrant,
  type ProviderSelection,
  type ProviderSelectionRequest,
} from "./contracts";
import { sha256 } from "./normalization";

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

const reservations = new WeakMap<object, ReservationState>();
const fingerprint = (value: unknown) => JSON.stringify(value) ?? "";

function requestFingerprint(request: ProviderSelectionRequest, selection: ProviderSelection): string {
  return fingerprint({
    profile: MarketProfileSchema.parse(request.profile), capability: request.capability,
    language: request.language, region: request.region, jurisdiction: request.jurisdiction,
    executionMode: request.executionMode, timeoutMs: request.timeoutMs, budget: request.budget,
    descriptors: request.descriptors, nestedDescriptors: request.nestedDescriptors ?? [],
    allowFallback: request.allowFallback, traceId: request.traceId ?? "provider-registry",
    excludedProviders: request.excludedProviders ?? [], selected: selection.descriptor,
    reservedCost: selection.reservedCost,
  });
}

export function issueProviderReservation(
  request: ProviderSelectionRequest,
  selection: ProviderSelection,
  signal: AbortSignal,
): ProviderReservationGrant {
  const profile = MarketProfileSchema.parse(request.profile);
  const reservation = Object.freeze({});
  const hashedRequest = sha256(requestFingerprint(request, selection));
  reservations.set(reservation, {
    descriptorFingerprint: fingerprint(selection.descriptor), profileFingerprint: fingerprint(profile),
    capability: request.capability, language: request.language, region: request.region,
    jurisdiction: request.jurisdiction, traceId: request.traceId ?? "provider-registry", signal,
    requestFingerprint: hashedRequest, reservedCost: selection.reservedCost, consumed: false,
  });
  return { reservation: reservation as ProviderReservation, requestFingerprint: hashedRequest };
}

function reject(context: ProviderCallContext): never {
  throw new ProviderSelectionError({
    schemaVersion: PROVIDER_SCHEMA_VERSION, code: "POLICY_DENIED", retryable: false,
    message: "Provider invocation requires a matching unused registry reservation",
    capability: context.capability, traceId: context.traceId, retryAfterMs: null,
  });
}

/** Consumes only registry-issued permits; no reservation constructor is exported. */
export function consumeProviderReservation(
  reservation: ProviderReservation | undefined,
  descriptor: ProviderDescriptor,
  context: ProviderCallContext,
): { reservedCost: number } {
  if (!reservation || typeof reservation !== "object") return reject(context);
  const state = reservations.get(reservation);
  if (!state || state.consumed) return reject(context);
  const profile = MarketProfileSchema.safeParse(context.profile);
  const matches = profile.success && state.descriptorFingerprint === fingerprint(descriptor)
    && state.profileFingerprint === fingerprint(profile.data) && state.capability === context.capability
    && state.capability === descriptor.capability && state.language === context.language
    && state.region === context.region && state.jurisdiction === context.jurisdiction
    && state.traceId === context.traceId && state.signal === context.signal
    && state.requestFingerprint === context.requestFingerprint && /^[0-9a-f]{64}$/.test(state.requestFingerprint);
  if (!matches) return reject(context);
  state.consumed = true;
  return { reservedCost: state.reservedCost };
}

export function reservationWasConsumed(grant: ProviderReservationGrant): boolean {
  return reservations.get(grant.reservation)?.consumed === true;
}
