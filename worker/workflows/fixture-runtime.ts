import { createHash } from "node:crypto";
import {
  DiscoveryBriefSchema, ICPDefinitionContextSchema, MarketProfileSchema, OfferProfileContextSchema,
} from "../../lib/domain/schemas/market-profile";
import { DEFAULT_SELF_PROSPECTING_POLICY } from "../../lib/domain/opportunity-policy";
import type { LeasedJob } from "../jobs/repository";
import type {
  DiscoveredSignal, ProviderBudget, ProviderExecutionResult, ProviderId, ProviderRunEnvelope,
} from "../providers/contracts";
import type {
  SelfProspectingDependencies, SelfProspectingRegistry, SelfProspectingAssessmentEngine,
} from "../../types/self-prospecting";
import { createSupabaseSelfProspectingPersistence } from "./self-prospecting-persistence";
import { SYNTHETIC_SELF_PROSPECTING_FIXTURE } from "./fixture-data";

type RpcResult = { data: unknown; error: { message?: string } | null };
export interface FixtureRuntimeDatabaseClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
}

function deterministicUuid(purpose: string, identity: string): string {
  const bytes = Buffer.from(createHash("sha256").update(`${purpose}\0${identity}`).digest().subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function leaseArgs(job: LeasedJob): Record<string, unknown> {
  return {
    p_job_id: job.id,
    p_worker_id: job.lease.owner,
    p_lease_token: job.lease.token,
  };
}

function consumeCall(budget: ProviderBudget): ProviderBudget {
  if (budget.currency !== "USD" || budget.remainingCost !== 0 || budget.remainingProviderCalls < 1) {
    throw new Error("fixture runtime requires a zero-cost budget with an available logical call");
  }
  return { ...budget, remainingProviderCalls: budget.remainingProviderCalls - 1 };
}

function succeededRun<T>(input: {
  job: LeasedJob;
  purpose: string;
  provider: ProviderId;
  value: T;
  recordCount: number;
  provenance?: ProviderRunEnvelope<T>["provenance"];
  now: Date;
}): ProviderRunEnvelope<T> {
  return {
    schemaVersion: 1,
    providerRunId: deterministicUuid(input.purpose, input.job.id),
    provider: input.provider,
    providerVersion: SYNTHETIC_SELF_PROSPECTING_FIXTURE.version,
    status: "SUCCEEDED",
    startedAt: input.now.toISOString(),
    finishedAt: input.now.toISOString(),
    latencyMs: 0,
    usage: { requestCount: 0, recordCount: input.recordCount },
    cost: { configuredAmount: 0, reservedAmount: 0, actualAmount: 0, currency: "USD" },
    provenance: input.provenance ?? [],
    limitations: ["SYNTHETIC_CONTRACT_FIXTURE", "NO_NETWORK", "NOT_LIVE_PROVIDER_EVIDENCE"],
    value: input.value,
    failureKind: null,
    capabilityError: null,
  };
}

function execution<T>(run: ProviderRunEnvelope<T>, budget: ProviderBudget): ProviderExecutionResult<T> {
  return {
    ok: true,
    outcome: run,
    attempts: [{
      providerId: run.provider,
      providerRunId: run.providerRunId,
      status: "SUCCEEDED",
      configuredCost: 0,
    }],
    remainingBudget: consumeCall(budget),
  };
}

function fixtureRegistry(now: () => Date): SelfProspectingRegistry {
  return {
    async search({ job, signal, budget }) {
      if (signal.aborted) throw signal.reason;
      const fixture = SYNTHETIC_SELF_PROSPECTING_FIXTURE.signal;
      const value: DiscoveredSignal[] = [{ ...fixture }];
      const capturedAt = now();
      const run = succeededRun({
        job,
        purpose: "fixture-source-run",
        provider: "hackernews",
        value,
        recordCount: value.length,
        now: capturedAt,
        provenance: [{
          schemaVersion: 1,
          providerId: "hackernews",
          providerSourceId: fixture.externalId,
          providerRunId: deterministicUuid("fixture-source-run", job.id),
          capturedAt: capturedAt.toISOString(),
          sourceUrl: fixture.sourceUrl,
        }],
      });
      return { execution: execution(run, budget), providerRuns: [run] };
    },

    async resolveCompany({ job, signal, budget }) {
      if (signal.aborted) throw signal.reason;
      const fixture = SYNTHETIC_SELF_PROSPECTING_FIXTURE.company;
      const capturedAt = now();
      const runId = deterministicUuid("fixture-company-run", job.id);
      const value = [{
        companyName: fixture.name,
        companyDomain: fixture.domain,
        confidence: fixture.confidence,
        resolutionStatus: "RESOLVED" as const,
        evidence: [{
          providerId: "exa" as const,
          providerSourceId: fixture.sourceId,
          providerRunId: runId,
          sourceUrl: fixture.sourceUrl,
          title: fixture.title,
          excerpt: fixture.excerpt,
          capturedAt: capturedAt.toISOString(),
          schemaVersion: 1 as const,
        }],
      }];
      const run = succeededRun({
        job,
        purpose: "fixture-company-run",
        provider: "exa",
        value,
        recordCount: value.length,
        now: capturedAt,
        provenance: [{
          schemaVersion: 1,
          providerId: "exa",
          providerSourceId: fixture.sourceId,
          providerRunId: runId,
          capturedAt: capturedAt.toISOString(),
          sourceUrl: fixture.sourceUrl,
        }],
      });
      return { execution: execution(run, budget), providerRuns: [run] };
    },
  };
}

function fixtureAssessmentEngine(now: () => Date): SelfProspectingAssessmentEngine {
  return {
    configuredCost: { amount: 0, currency: "USD" },
    async assess(input, context) {
      if (context.signal.aborted) throw context.signal.reason;
      const payload = JSON.parse(input.messages[1].content) as {
        offer: { id: string; definition: { summary: string } };
        icp: { id: string; definition: { description: string } };
        discoveryObjective: string;
        signal: string;
        evidence: Array<{ id: string; excerpt: string | null }>;
      };
      const evidence = payload.evidence[0];
      if (!evidence?.id || evidence.excerpt !== payload.signal
        || !payload.offer?.id || !payload.offer.definition?.summary
        || !payload.icp?.id || !payload.icp.definition?.description
        || !payload.discoveryObjective) {
        throw new Error("fixture assessment requires offer, ICP, objective and normalized signal evidence");
      }
      const fixtureAssessment = SYNTHETIC_SELF_PROSPECTING_FIXTURE.assessment;
      const output = {
        decision: "REVIEW" as const,
        problemType: fixtureAssessment.problemType,
        problemStatement: payload.signal,
        evidenceStrength: fixtureAssessment.evidenceStrength,
        explicitness: fixtureAssessment.explicitness,
        urgency: fixtureAssessment.urgency,
        commercialImpact: fixtureAssessment.commercialImpact,
        icpFit: fixtureAssessment.icpFit,
        buyerRelevance: fixtureAssessment.buyerRelevance,
        actionability: fixtureAssessment.actionability,
        confidence: fixtureAssessment.confidence,
        evidenceIds: [evidence.id],
        groundedClaims: [{ text: payload.signal, evidenceIds: [evidence.id] }],
        rejectionReasons: [],
        reviewReasons: [...fixtureAssessment.reviewReasons],
      };
      return {
        output,
        run: succeededRun({
          job: { id: context.jobId } as LeasedJob,
          purpose: "fixture-assessment-run",
          provider: "openai",
          value: output,
          recordCount: 1,
          now: now(),
        }),
      };
    },
  };
}

function row(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return value.length === 1 && value[0] && typeof value[0] === "object"
    ? value[0] as Record<string, unknown> : null;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

export function createFixtureSelfProspectingDependencies(
  client: FixtureRuntimeDatabaseClient,
  clock: () => Date = () => new Date(),
): SelfProspectingDependencies {
  return {
    async loadContext(job) {
      const response = await client.rpc("intentlead_get_self_prospecting_context", leaseArgs(job));
      if (response.error) throw new Error(response.error.message || "fixture context lookup failed");
      const context = row(response.data);
      if (!context) throw new Error("fixture context lookup returned no row");
      return {
        profile: MarketProfileSchema.parse(context.profile),
        brief: DiscoveryBriefSchema.parse(context.brief),
        offer: OfferProfileContextSchema.parse(context.offer),
        icp: ICPDefinitionContextSchema.parse(context.icp),
      };
    },
    registry: fixtureRegistry(clock),
    assessmentEngine: fixtureAssessmentEngine(clock),
    persistence: createSupabaseSelfProspectingPersistence(client),
    now: clock,
    idFactory: { create: deterministicUuid },
    initialBudget: () => ({ currency: "USD", remainingCost: 0, remainingProviderCalls: 3 }),
    policy: DEFAULT_SELF_PROSPECTING_POLICY,
  };
}
