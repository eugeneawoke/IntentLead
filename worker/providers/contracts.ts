import type { CapabilityError } from "../../types/job";
import type { Capability, MarketProfile } from "../../types/market-profile";

export const PROVIDER_SCHEMA_VERSION = 1 as const;

export type ProviderId = "reddit" | "hackernews" | "exa" | "serper";
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
  capability: Capability;
  language: string;
  region: string;
  jurisdiction: string | null;
  health: Partial<Record<ProviderId, ProviderHealth>>;
  budget: ProviderBudget;
  descriptors: ProviderDescriptor[];
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
}

export interface ProviderCost {
  configuredAmount: number | null;
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

export type ProviderResult<T> =
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

export interface ProviderRunStart {
  providerRunId: string;
  capability: ProviderCapability;
  provider: ProviderId;
  providerVersion: string;
  startedAt: string;
  requestMetadata: {
    marketProfileId: MarketProfile["id"];
    traceId: string;
    inputCount: number;
    inputHash: string | null;
  };
}

export interface ProviderRunFinish {
  providerRunId: string;
  status: Exclude<ProviderRunStatus, "STARTED">;
  finishedAt: string;
  latencyMs: number;
  usage: ProviderUsage;
  cost: ProviderCost;
  responseMetadata: {
    recordCount: number;
    failureKind: ProviderFailureKind | null;
    errorCode: CapabilityError["code"] | null;
  };
}

/** A narrow audit seam; implementations may call the lease-bound Task 4 RPC, never generic table writes. */
export interface ProviderRunRecorder {
  start(input: ProviderRunStart): Promise<void>;
  finish(input: ProviderRunFinish): Promise<void>;
}

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
  signal: AbortSignal;
}

export interface CompanyInference {
  infer(input: CompanyInferenceInput): Promise<unknown>;
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
