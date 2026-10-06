import type { Capability, MarketProfile } from "./market-profile";
import type { Opportunity, OpportunityAssessment } from "./opportunity";
import type { EvidenceItem } from "./evidence";
import type { SourceItem } from "./source-item";
import type { DiscoveryBrief } from "./discovery-brief";
import type { LeasedJob } from "../worker/jobs/repository";
import type {
  CompanyCandidate, DiscoveredSignal, ProviderBudget, ProviderExecutionResult,
  ProviderId, ProviderRunEnvelope,
} from "../worker/providers/contracts";
import type { OpportunityAssessmentOutput } from "../lib/ai/schemas/opportunity-assessment";

export type SelfProspectingReasonCode =
  | "SIGNAL_FAMILY_UNSUPPORTED" | "SIGNAL_TOO_OLD" | "SIGNAL_TOO_WEAK"
  | "INSUFFICIENT_EVIDENCE" | "COMPANY_UNCERTAIN" | "WRONG_COMPANY"
  | "LOW_COMPANY_CONFIDENCE" | "MODEL_REVIEW" | "MODEL_REJECTED"
  | "POLICY_REVIEW_REQUIRED" | "LOW_EXPLICITNESS" | "LOW_EVIDENCE_STRENGTH"
  | "LOW_ICP_FIT" | "LOW_ACTIONABILITY" | "LOW_CONFIDENCE";

export interface SelfProspectingPolicy {
  maxCandidates: number;
  maxSignalAgeDays: Readonly<Record<string, number>>;
  minimumEvidenceItems: number;
  minimumCompanyConfidence: number;
  minimumEvidenceStrength: number;
  minimumExplicitness: number;
  minimumIcpFit: number;
  minimumActionability: number;
  minimumConfidence: number;
  assessmentCost: { amount: number; currency: string };
}

export interface RegistryStepResult<T> {
  execution: ProviderExecutionResult<T>;
  providerRuns: ProviderRunEnvelope<unknown>[];
}

export interface SelfProspectingRegistry {
  search(input: {
    job: LeasedJob; profile: MarketProfile; brief: DiscoveryBrief; signal: AbortSignal; budget: ProviderBudget;
  }): Promise<RegistryStepResult<DiscoveredSignal[]>>;
  resolveCompany(input: {
    job: LeasedJob; profile: MarketProfile; brief: DiscoveryBrief; signal: AbortSignal;
    budget: ProviderBudget; signalContent: string;
  }): Promise<RegistryStepResult<CompanyCandidate[]>>;
}

export interface GroundedAssessmentInput {
  messages: readonly [
    { role: "system"; content: string },
    { role: "user"; content: string },
  ];
}

export interface SelfProspectingAssessmentEngine {
  configuredCost: { amount: number; currency: string };
  assess(input: GroundedAssessmentInput, context: {
    jobId: string; signal: AbortSignal; traceId: string;
  }): Promise<{ output: unknown; run: ProviderRunEnvelope<unknown> }>;
}

export interface SelfProspectingContext {
  profile: MarketProfile;
  brief: DiscoveryBrief;
  offer: {
    id: string;
    name: string;
    definition: { summary: string; outcomes: string[]; exclusions: string[] };
  };
  icp: {
    id: string;
    name: string;
    definition: { description: string; companyAttributes: string[]; exclusions: string[] };
  };
}

export interface SelfProspectingPersistInput {
  schemaVersion: 1;
  candidateKey: string;
  modelDecision: OpportunityAssessmentOutput["decision"] | null;
  groundedClaims: OpportunityAssessmentOutput["groundedClaims"] | null;
  policyReasons: SelfProspectingReasonCode[];
  providerRuns: Array<{
    id: string; provider: ProviderId; providerVersion: string | null;
    capability: Extract<Capability, "SOURCE_SEARCH" | "COMPANY_RESOLUTION" | "OPPORTUNITY_ASSESSMENT">;
    status: "SUCCEEDED" | "PARTIAL" | "FAILED" | "RATE_LIMITED" | "TIMEOUT";
    startedAt: string; finishedAt: string; latencyMs: number;
    requestCount: number; recordCount: number;
    configuredCost: number | null; reservedCost: number | null; actualCost: number | null; currency: string | null;
    provenance: Array<{ providerSourceId: string; sourceUrl: string | null; capturedAt: string }>;
    limitations: string[];
  }>;
  sourceItems: SourceItem[];
  evidenceItems: EvidenceItem[];
  company: {
    schemaVersion: 1; id: string; workspaceId: string; canonicalName: string;
    domain: string | null; jurisdiction: null; confidence: number;
  } | null;
  opportunity: Opportunity;
  assessment: OpportunityAssessment | null;
}

export interface FoundSelfProspectingCandidate {
  opportunityId: string;
  state: Opportunity["state"];
}

export interface SelfProspectingPersistence {
  findCandidate(job: LeasedJob, candidateKey: string): Promise<FoundSelfProspectingCandidate | null>;
  persistCandidate(job: LeasedJob, input: SelfProspectingPersistInput): Promise<string>;
}

export interface SelfProspectingIdFactory {
  create(purpose: string, identity: string): string;
}

export interface SelfProspectingDependencies {
  loadContext(job: LeasedJob): Promise<SelfProspectingContext>;
  registry: SelfProspectingRegistry;
  assessmentEngine: SelfProspectingAssessmentEngine;
  persistence: SelfProspectingPersistence;
  now(): Date;
  idFactory: SelfProspectingIdFactory;
  initialBudget(job: LeasedJob): ProviderBudget;
  policy: SelfProspectingPolicy;
}
