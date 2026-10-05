import { getServiceClient } from "../../lib/supabase/client";
import type { FoundSelfProspectingCandidate, SelfProspectingPersistence, SelfProspectingPersistInput } from "../../types/self-prospecting";
import type { LeasedJob, JobDatabaseClient } from "../jobs/repository";

function rpcRow(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return value.length && value[0] && typeof value[0] === "object" ? value[0] as Record<string, unknown> : null;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function rpcError(error: { message?: string } | null): void {
  if (error) throw new Error(error.message || "self-prospecting persistence failed");
}

function leaseArgs(job: LeasedJob) {
  return { p_job_id: job.id, p_worker_id: job.lease.owner, p_lease_token: job.lease.token };
}

function persistenceSlice(input: SelfProspectingPersistInput): Record<string, unknown> {
  const providersByRun = new Map(input.providerRuns.map(run => [run.id, run.provider]));
  return {
    schemaVersion: input.schemaVersion,
    candidateKey: input.candidateKey,
    modelDecision: input.modelDecision,
    groundedClaims: input.groundedClaims,
    policyReasons: input.policyReasons,
    providerRuns: input.providerRuns,
    sourceItems: input.sourceItems.map(source => {
      const provider = source.provenance.providerRunId
        ? providersByRun.get(source.provenance.providerRunId) : null;
      if (!provider) throw new Error("source item provider run is missing");
      return {
        id: source.id, provider, externalId: source.externalId, sourceUrl: source.sourceUrl, content: source.content,
        normalizedFacts: source.structuredFacts, provenance: source.provenance, contentHash: source.contentHash,
        capturedAt: source.capturedAt, publishedAt: source.publishedAt,
      };
    }),
    evidenceItems: input.evidenceItems.map(evidence => ({
      id: evidence.id, sourceItemId: evidence.sourceItemId, type: evidence.type,
      sourceUrl: evidence.sourceUrl, capturedAt: evidence.capturedAt, excerpt: evidence.excerpt,
      structuredFacts: evidence.structuredFacts, verificationMethod: evidence.verificationMethod,
      confidence: evidence.confidence, contentHash: evidence.contentHash, provenance: evidence.provenance,
    })),
    company: input.company && {
      id: input.company.id, canonicalName: input.company.canonicalName, domain: input.company.domain,
      jurisdiction: input.company.jurisdiction, confidence: input.company.confidence,
    },
    opportunity: {
      id: input.opportunity.id, state: input.opportunity.state, signal: input.opportunity.signal,
      jurisdiction: input.opportunity.jurisdiction,
      evidenceIds: input.opportunity.evidenceIds, assessmentId: input.opportunity.assessmentId,
      createdAt: input.opportunity.createdAt, updatedAt: input.opportunity.updatedAt,
    },
    assessment: input.assessment && {
      id: input.assessment.id, decision: input.assessment.decision, problemType: input.assessment.problemType,
      problemStatement: input.assessment.problemStatement, evidenceStrength: input.assessment.evidenceStrength,
      explicitness: input.assessment.explicitness, urgency: input.assessment.urgency,
      freshness: input.assessment.freshness, commercialImpact: input.assessment.commercialImpact,
      icpFit: input.assessment.icpFit, companyConfidence: input.assessment.companyConfidence,
      buyerRelevance: input.assessment.buyerRelevance, actionability: input.assessment.actionability,
      confidence: input.assessment.confidence, evidenceIds: input.assessment.evidenceIds,
      rejectionReasons: input.assessment.rejectionReasons,
      reviewReasons: "reviewReasons" in input.assessment ? input.assessment.reviewReasons : [],
      modelRunId: input.assessment.modelRunId, assessedAt: input.assessment.assessedAt,
    },
  };
}

export function createSupabaseSelfProspectingPersistence(
  client: JobDatabaseClient = getServiceClient() as unknown as JobDatabaseClient,
): SelfProspectingPersistence {
  return {
    async findCandidate(job, candidateKey): Promise<FoundSelfProspectingCandidate | null> {
      const response = await client.rpc("intentlead_get_self_prospecting_candidate", {
        ...leaseArgs(job), p_candidate_key: candidateKey,
      });
      rpcError(response.error);
      const row = rpcRow(response.data);
      if (!row) return null;
      if (typeof row.opportunityId !== "string" || typeof row.state !== "string") {
        throw new Error("self-prospecting lookup returned an invalid result");
      }
      return { opportunityId: row.opportunityId, state: row.state as FoundSelfProspectingCandidate["state"] };
    },

    async persistCandidate(job, input): Promise<string> {
      const response = await client.rpc("intentlead_persist_self_prospecting_candidate", {
        ...leaseArgs(job), p_candidate_key: input.candidateKey, p_slice: persistenceSlice(input),
      });
      rpcError(response.error);
      if (typeof response.data !== "string" || response.data.length === 0) {
        throw new Error("self-prospecting persistence returned no Opportunity id");
      }
      return response.data;
    },
  };
}
