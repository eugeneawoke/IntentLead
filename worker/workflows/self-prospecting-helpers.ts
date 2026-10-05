import { createHash } from "node:crypto";
import { EvidenceItemSchema, SourceItemSchema } from "../../lib/domain/schemas/evidence";
import { OpportunitySchema } from "../../lib/domain/schemas/opportunity";
import { normalizeCompanyRootDomain, normalizeHttpUrl, sanitizeCompanySignal } from "../providers/normalization";
import type { CapabilityError } from "../../types/job";
import type { CompanyCandidate, DiscoveredSignal, ProviderBudget, ProviderId, ProviderRunEnvelope } from "../providers/contracts";
import type { EvidenceItem } from "../../types/evidence";
import type { SourceItem } from "../../types/source-item";
import type { OpportunitySignal } from "../../types/opportunity";
import type { LeasedJob } from "../jobs/repository";
import type { SelfProspectingDependencies, SelfProspectingPersistInput } from "../../types/self-prospecting";

export function capabilityError(job: LeasedJob, code: "BUDGET_EXCEEDED" | "POLICY_DENIED"): CapabilityError {
  return {
    schemaVersion: 1, code, retryable: false, message: code === "BUDGET_EXCEEDED"
      ? "Configured discovery budget is exhausted" : "Capability is disabled by EN_DISCOVERY_ONLY",
    capability: job.capability, traceId: job.traceId, retryAfterMs: null,
  };
}

export function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new Error("Self-prospecting operation was cancelled");
}

export function canCall(budget: ProviderBudget, cost: { amount: number; currency: string }): boolean {
  return budget.remainingProviderCalls > 0 && budget.currency === cost.currency && budget.remainingCost >= cost.amount;
}

export function afterCall(budget: ProviderBudget, cost: { amount: number; currency: string }): ProviderBudget {
  return {
    currency: budget.currency,
    remainingCost: Math.max(0, Math.round((budget.remainingCost - cost.amount) * 1_000_000_000) / 1_000_000_000),
    remainingProviderCalls: Math.max(0, budget.remainingProviderCalls - 1),
  };
}

export function providerRows(
  runs: ProviderRunEnvelope<unknown>[],
  capability: "SOURCE_SEARCH" | "COMPANY_RESOLUTION" | "OPPORTUNITY_ASSESSMENT",
): SelfProspectingPersistInput["providerRuns"] {
  return runs.map(run => ({
    id: run.providerRunId, provider: run.provider, providerVersion: run.providerVersion, capability,
    status: run.status === "EMPTY" ? "SUCCEEDED" : run.status,
    startedAt: run.startedAt, finishedAt: run.finishedAt, latencyMs: run.latencyMs,
    requestCount: run.usage.requestCount, recordCount: run.usage.recordCount,
    configuredCost: run.cost.configuredAmount, reservedCost: run.cost.reservedAmount,
    actualCost: run.cost.actualAmount, currency: run.cost.currency,
    provenance: run.provenance.map(item => ({
      providerSourceId: item.providerSourceId, sourceUrl: item.sourceUrl, capturedAt: item.capturedAt,
    })),
    limitations: run.limitations.slice(0, 12),
  }));
}

export function uniqueRuns(input: SelfProspectingPersistInput["providerRuns"]): SelfProspectingPersistInput["providerRuns"] {
  const values = new Map<string, SelfProspectingPersistInput["providerRuns"][number]>();
  for (const run of input) {
    const previous = values.get(run.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(run)) throw new Error("provider run identity conflict");
    values.set(run.id, run);
  }
  return [...values.values()];
}

export function providerId(value: string): ProviderId {
  if (["reddit", "hackernews", "exa", "serper", "openai"].includes(value)) return value as ProviderId;
  throw new Error("provider result is outside the Task 6 registry contract");
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function makeObservation(input: {
  id: string; evidenceId: string; workspaceId: string; provider: ProviderId; providerRunId: string;
  externalId: string; sourceUrl: string; content: string; capturedAt: string; publishedAt: string | null;
  structuredFacts?: Record<string, unknown>; confidence: number; sourceType: "SOCIAL" | "WEB";
}): { source: SourceItem; evidence: EvidenceItem } {
  const sourceUrl = normalizeHttpUrl(input.sourceUrl);
  const content = sanitizeCompanySignal(input.content, 2_000);
  if (!sourceUrl || !content) throw new Error("source observation did not meet the normalized evidence contract");
  const structuredFacts = input.structuredFacts ?? {};
  const sourceHash = hash(`${input.provider}:${input.externalId}:${content}`);
  const evidenceHash = hash(`${sourceHash}:evidence:${input.evidenceId}`);
  const provenance = { sourceType: input.sourceType, sourceId: input.id, providerRunId: input.providerRunId, rawArtifactId: null } as const;
  const common = {
    schemaVersion: 1 as const, workspaceId: input.workspaceId, sourceUrl, capturedAt: input.capturedAt,
    structuredFacts, provenance, jurisdiction: null,
  };
  return {
    source: SourceItemSchema.parse({
      ...common, id: input.id, externalId: input.externalId, content, publishedAt: input.publishedAt,
      contentHash: sourceHash,
    }),
    evidence: EvidenceItemSchema.parse({
      ...common, id: input.evidenceId, sourceItemId: input.id,
      type: Object.keys(structuredFacts).length ? "structured_fact" : "text", excerpt: content,
      verificationMethod: "normalized_public_source_capture", confidence: input.confidence, contentHash: evidenceHash,
    }),
  };
}

export function sourceCandidateKey(signal: DiscoveredSignal): string {
  return `${signal.source}:${signal.externalId}`.slice(0, 160);
}

export function deduplicateSignals(signals: DiscoveredSignal[]): DiscoveredSignal[] {
  const seen = new Set<string>();
  return signals.filter(signal => {
    const url = normalizeHttpUrl(signal.sourceUrl);
    const key = `${signal.source}:${signal.externalId}:${url ?? ""}`;
    if (!signal.externalId.trim() || !url || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function allowedCompany(candidate: CompanyCandidate, policy: SelfProspectingDependencies["policy"]): boolean {
  const domain = candidate.companyDomain ? normalizeCompanyRootDomain(candidate.companyDomain) : null;
  if (candidate.resolutionStatus !== "RESOLVED" || !domain || candidate.confidence < policy.minimumCompanyConfidence) return false;
  if (!candidate.companyName.trim() || candidate.evidence.length === 0) return false;
  return candidate.evidence.some(evidence => {
    const urlDomain = normalizeCompanyRootDomain(evidence.sourceUrl);
    const nameVisible = `${evidence.title} ${evidence.excerpt}`.toLocaleLowerCase("en-US").includes(candidate.companyName.toLocaleLowerCase("en-US"));
    return urlDomain === domain && nameVisible;
  });
}

export function incompleteInput(input: {
  job: LeasedJob; signal: DiscoveredSignal; classified: OpportunitySignal; sources: SourceItem[]; evidence: EvidenceItem[];
  policyReasons: SelfProspectingPersistInput["policyReasons"]; idFactory: SelfProspectingDependencies["idFactory"];
  now: Date;
}): SelfProspectingPersistInput {
  const candidateKey = sourceCandidateKey(input.signal);
  const createdAt = input.now.toISOString();
  const opportunity = OpportunitySchema.parse({
    schemaVersion: 1, id: input.idFactory.create("opportunity", candidateKey), workspaceId: input.job.workspaceId,
    discoveryBriefId: input.job.discoveryBriefId, marketProfileId: "EN_DISCOVERY_ONLY", jurisdiction: null,
    signal: input.classified, evidenceIds: input.evidence.map(item => item.id), state: "INSUFFICIENT_EVIDENCE",
    companyId: null, assessmentId: null, createdAt, updatedAt: createdAt,
  });
  return {
    schemaVersion: 1, candidateKey, modelDecision: null, groundedClaims: null, policyReasons: input.policyReasons,
    providerRuns: [], sourceItems: input.sources, evidenceItems: input.evidence,
    company: null, opportunity, assessment: null,
  };
}
