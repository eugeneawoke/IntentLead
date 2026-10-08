import type { CapabilityError } from "../../types/job";
import type { Capability, MarketProfile } from "../../types/market-profile";
import type { ProviderRunRecorder } from "./recorder-contracts";
export type { ProviderRunFinish, ProviderRunRecorder, ProviderRunStart } from "./recorder-contracts";

export const PROVIDER_SCHEMA_VERSION = 1 as const;

declare const providerReservationBrand: unique symbol;
/** Registry-issued, single-use permit; no public constructor exists. */
export type ProviderReservation = { readonly [providerReservationBrand]: true };
export interface ProviderReservationGrant {
  reservation: ProviderReservation;
  requestFingerprint: string;
}

export type ProviderId = "reddit" | "hackernews" | "exa" | "serper" | "openai";
export type ProviderCapability = Extract<Capability, "SOURCE_SEARCH" | "COMPANY_RESOLUTION">;
export type ProviderLegalStatus = "ALLOWED" | "RESTRICTED" | "PROHIBITED" | "UNASSESSED";
export type ProviderHealth = "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "CIRCUIT_OPEN" | "AUTH_FAILED";
export type ProviderStatus = "SUCCEEDED" | "EMPTY" | "PARTIAL" | "FAILED" | "RATE_LIMITED" | "TIMEOUT";
export type ProviderRunStatus = "STARTED" | "SUCCEEDED" | "PARTIAL" | "FAILED" | "RATE_LIMITED" | "TIMEOUT";
export type ProviderFailureKind =
  | "MALFORMED_RESPONSE"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UNAVAILABLE"
  | "CANCELLED"
  | "BUDGET_EXCEEDED";

export interface ProviderDescriptor {
  id: ProviderId;
  version: string;
  capability: ProviderCapability;
  priority: number;
  marketProfiles: MarketProfile["id"][];
  languages: string[];
  regions: string[];
  jurisdictions: string[];
  legalStatus: ProviderLegalStatus;
  available: boolean;
  configuredCost: { amount: number | null; currency: string | null };
}

export interface ProviderBudget {
  currency: string;
  remainingCost: number;
  remainingProviderCalls: number;
}

export interface ProviderSelectionRequest {
  profile: MarketProfile;
  capability: ProviderCapability;
  language: string;
  region: string;
  jurisdiction: string | null;
  health: Partial<Record<ProviderId, ProviderHealth>>;
  budget: ProviderBudget;
  descriptors: ProviderDescriptor[];
  /** Providers explicitly authorized for nested runs such as company inference. */
  nestedDescriptors?: ProviderDescriptor[];
  allowFallback: boolean;
  traceId?: string;
  signal?: AbortSignal;
  excludedProviders?: ProviderId[];
}

export interface ProviderSelection {
  descriptor: ProviderDescriptor;
  reservedCost: number;
}

export interface ProviderProvenance {
  schemaVersion: typeof PROVIDER_SCHEMA_VERSION;
  providerId: ProviderId;
  providerSourceId: string;
  providerRunId: string;
  capturedAt: string;
  sourceUrl: string | null;
}

export interface ProviderUsage {
  requestCount: number;
  recordCount: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
}

export interface ProviderCost {
  configuredAmount: number | null;
  reservedAmount: number | null;
  actualAmount: number | null;
  currency: string | null;
}

interface ProviderEnvelopeBase {
  schemaVersion: typeof PROVIDER_SCHEMA_VERSION;
  providerRunId: string;
  provider: ProviderId;
  providerVersion: string;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  usage: ProviderUsage;
  cost: ProviderCost;
  provenance: ProviderProvenance[];
  limitations: string[];
}

export type ProviderRunEnvelope<T> =
  | (ProviderEnvelopeBase & {
      status: "SUCCEEDED" | "EMPTY";
      value: T;
      failureKind: null;
      capabilityError: null;
    })
  | (ProviderEnvelopeBase & {
      status: "PARTIAL";
      value: T;
      failureKind: ProviderFailureKind;
      capabilityError: CapabilityError;
    })
  | (ProviderEnvelopeBase & {
      status: "FAILED" | "RATE_LIMITED" | "TIMEOUT";
      value: null;
      failureKind: Exclude<ProviderFailureKind, "BUDGET_EXCEEDED">;
      capabilityError: CapabilityError;
    });

export type ProviderResult<T> = ProviderRunEnvelope<T> & {
  /** Independent model/provider runs, each retaining its own identity, usage and cost. */
  relatedRuns?: ProviderRunEnvelope<unknown>[];
};

export interface ProviderAttempt {
  providerId: ProviderId;
  providerRunId: string;
  status: ProviderStatus;
  configuredCost: number | null;
}

export type ProviderExecutionResult<T> =
  | {
      ok: true;
      outcome: ProviderResult<T>;
      attempts: ProviderAttempt[];
      remainingBudget: ProviderBudget;
    }
  | {
      ok: false;
      error: CapabilityError;
      lastOutcome: ProviderResult<T> | null;
      attempts: ProviderAttempt[];
      remainingBudget: ProviderBudget;
    };

export type ProviderHttpClient = (input: string, init?: RequestInit) => Promise<Response>;

export interface ProviderRuntimeDependencies {
  http: ProviderHttpClient;
  now: () => Date;
  sleep: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  createId: () => string;
  recorder: ProviderRunRecorder;
  timeoutMs: number;
  maxResponseBytes: number;
  maxKeywords: number;
  maxRecords: number;
  maxContentChars: number;
  timer?: {
    set(callback: () => void, delayMs: number): unknown;
    clear(handle: unknown): void;
  };
}

export interface ProviderCallContext {
  profile: MarketProfile;
  traceId: string;
  signal: AbortSignal;
  capability: ProviderCapability;
  language: string;
  region: string;
  jurisdiction: string | null;
  reservation: ProviderReservation;
  requestFingerprint: string;
  reserveProvider(descriptor: ProviderDescriptor): ProviderReservationGrant;
}

export interface SignalSearchInput {
  keywords: string[];
}

export interface DiscoveredSignal {
  source: "reddit" | "hackernews";
  externalId: string;
  sourceUrl: string;
  content: string;
  context: string | null;
  publishedAt: string | null;
}

export interface SignalSourceAdapter {
  readonly descriptor: ProviderDescriptor;
  search(input: SignalSearchInput, context: ProviderCallContext): Promise<ProviderResult<DiscoveredSignal[]>>;
}

export interface CompanyEvidence {
  providerId: ProviderId;
  providerSourceId: string;
  providerRunId: string;
  sourceUrl: string;
  title: string;
  excerpt: string;
  capturedAt: string;
  schemaVersion: typeof PROVIDER_SCHEMA_VERSION;
}

export interface CompanyCandidate {
  companyName: string;
  companyDomain: string | null;
  confidence: number;
  resolutionStatus: "RESOLVED" | "UNCERTAIN" | "AMBIGUOUS";
  evidence: CompanyEvidence[];
}

export interface CompanyResolutionInput {
  signalContent: string;
}

export interface CompanyInferenceInput {
  messages: readonly [
    { role: "system"; content: string },
    { role: "user"; content: string },
  ];
}

export interface CompanyInferenceCandidate {
  companyName: string;
  companyDomain: string | null;
  confidence: number;
  evidenceSourceIds: string[];
}

export interface CompanyInferenceOutput {
  candidates: CompanyInferenceCandidate[];
}

export interface CompanyInferenceCompletion {
  content: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface CompanyInferenceProvider {
  readonly descriptor: ProviderDescriptor;
  infer(input: CompanyInferenceInput, context: ProviderCallContext): Promise<ProviderResult<CompanyInferenceOutput>>;
}

export interface CompanyResolutionProvider {
  readonly descriptor: ProviderDescriptor;
  resolve(input: CompanyResolutionInput, context: ProviderCallContext): Promise<ProviderResult<CompanyCandidate[]>>;
}

export class ProviderSelectionError extends Error {
  constructor(readonly capabilityError: CapabilityError) {
    super(capabilityError.message);
    this.name = "ProviderSelectionError";
  }
}

export class ProviderCancelledError extends Error {
  readonly kind = "CANCELLED" as const;

  constructor(message = "Provider operation was cancelled") {
    super(message);
    this.name = "ProviderCancelledError";
  }
}
