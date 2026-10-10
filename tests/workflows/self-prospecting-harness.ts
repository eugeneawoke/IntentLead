import { createSelfProspectingHandler } from "../../worker/workflows/self-prospecting";
import type { SelfProspectingDependencies } from "../../types/self-prospecting";
import type { CompanyCandidate, ProviderId, ProviderResult } from "../../worker/providers/contracts";
import { DEFAULT_SELF_PROSPECTING_POLICY } from "../../lib/domain/opportunity-policy";
import {
  companyCandidate, fixtureBrief, fixtureIcp, fixtureIds, fixtureOffer, fixtureProfile, freshSignal,
  qualifiedAssessment,
} from "../evals/opportunity-fixtures";

export const date = "2026-10-05T12:00:00.000Z";
export const budget = { currency: "USD", remainingCost: 1, remainingProviderCalls: 5 };

export function companyRun(provider: ProviderId, failure?: "DEPENDENCY_UNAVAILABLE" | "TIMEOUT"): ProviderResult<CompanyCandidate[]> {
  const base = {
    schemaVersion: 1 as const, providerRunId: `fallback-${provider}`, provider,
    providerVersion: "fixture-v1", startedAt: date, finishedAt: date, latencyMs: 0,
    usage: { requestCount: 1, recordCount: failure ? 0 : 1 },
    cost: { configuredAmount: 0, reservedAmount: 0, actualAmount: 0, currency: null },
    provenance: [], limitations: [],
  };
  return failure ? {
    ...base, status: "FAILED", value: null,
    failureKind: failure === "TIMEOUT" ? "TIMEOUT" : "UNAVAILABLE",
    capabilityError: {
      schemaVersion: 1, code: failure, retryable: true,
      message: "Fixture company provider failed", capability: "COMPANY_RESOLUTION",
      traceId: "fixture-trace", retryAfterMs: null,
    },
  } : { ...base, status: "SUCCEEDED", value: [companyCandidate], failureKind: null, capabilityError: null };
}

function providerRun(
  id: string, provider: "hackernews" | "exa" | "openai", value: unknown, cost = 0,
  provenance: Array<{
    schemaVersion: 1; providerId: "hackernews"; providerSourceId: string;
    providerRunId: string; capturedAt: string; sourceUrl: string;
  }> = [],
) {
  return {
    schemaVersion: 1 as const, providerRunId: id, provider,
    providerVersion: "fixture-v1", status: "SUCCEEDED" as const,
    startedAt: date, finishedAt: date, latencyMs: 0,
    usage: { requestCount: 1, recordCount: 1 },
    cost: { configuredAmount: cost, reservedAmount: cost, actualAmount: cost, currency: provider === "openai" ? "USD" : null },
    provenance, limitations: [], value, failureKind: null, capabilityError: null,
  };
}

function successful<T>(run: ReturnType<typeof providerRun>, value: T, remaining = budget) {
  return {
    execution: {
      ok: true as const, outcome: { ...run, value } as ReturnType<typeof providerRun> & { value: T },
      attempts: [{ providerId: run.provider, providerRunId: run.providerRunId, status: "SUCCEEDED" as const, configuredCost: 0 }],
      remainingBudget: remaining,
    },
    providerRuns: [run],
  };
}

export function makeHarness(options: {
  signal?: typeof freshSignal;
  company?: CompanyCandidate;
  assessment?: Record<string, unknown>;
  remainingBudget?: typeof budget;
  assessmentCost?: number;
  cancelDuring?: "SOURCE_SEARCH" | "OPPORTUNITY_ASSESSMENT";
  checkpoint?: (value: Record<string, unknown>) => void;
  runOperation?: (capability: string, run: () => Promise<unknown>) => Promise<unknown>;
  sourceCapturedAt?: string;
  omitSourceProvenance?: boolean;
} = {}) {
  const calls = { search: 0, company: 0, assessment: 0, persist: 0 };
  const persisted: Array<Record<string, unknown>> = [];
  const existing = new Map<string, { opportunityId: string; state: string; signalConfirmed: boolean; companyIdentity: string | null }>();
  const seenCalls: string[] = [];
  let signalOperationStarted!: () => void;
  const operationStarted = new Promise<void>(resolve => { signalOperationStarted = resolve; });
  const waitForAbort = (signal: AbortSignal) => {
    signalOperationStarted();
    return new Promise<never>((_resolve, reject) => {
      if (signal.aborted) reject(signal.reason);
      else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  };
  const signal = options.signal ?? freshSignal;
  const registry = {
    async search(input: { signal: AbortSignal }) {
      calls.search++;
      if (options.cancelDuring === "SOURCE_SEARCH") await waitForAbort(input.signal);
      const run = providerRun(fixtureIds.sourceRun, "hackernews", [signal], 0, options.omitSourceProvenance ? [] : [{
        schemaVersion: 1, providerId: "hackernews", providerSourceId: signal.externalId,
        providerRunId: fixtureIds.sourceRun, capturedAt: options.sourceCapturedAt ?? date, sourceUrl: signal.sourceUrl,
      }]);
      return { signals: [signal], providerRuns: [run], remainingBudget: options.remainingBudget ?? budget, error: null };
    },
    async resolveCompany() {
      calls.company++;
      const run = providerRun(fixtureIds.companyRun, "exa", [options.company ?? companyCandidate]);
      return successful(run, [options.company ?? companyCandidate], options.remainingBudget ?? budget);
    },
  };
  const assessmentEngine = {
    configuredCost: { amount: options.assessmentCost ?? 0, currency: "USD" },
    async assess(input: { messages: Array<{ role: string; content: string }> }, context: { signal: AbortSignal }) {
      calls.assessment++;
      if (options.cancelDuring === "OPPORTUNITY_ASSESSMENT") await waitForAbort(context.signal);
      seenCalls.push(input.messages[0]?.role ?? "", input.messages[1]?.role ?? "", input.messages[1]?.content ?? "");
      const payload = JSON.parse(input.messages[1]?.content ?? "{}") as { signal?: string; evidence?: Array<{ id: string }> };
      const evidenceId = payload.evidence?.[0]?.id ?? fixtureIds.evidence;
      const grounded = {
        ...qualifiedAssessment, problemStatement: payload.signal ?? qualifiedAssessment.problemStatement,
        evidenceIds: [evidenceId],
        groundedClaims: [{ text: payload.signal ?? qualifiedAssessment.problemStatement, evidenceIds: [evidenceId] }],
      };
      const output = options.assessment ? { ...grounded, ...options.assessment } : grounded;
      return { output, run: providerRun(fixtureIds.assessmentRun, "openai", output, options.assessmentCost ?? 0), remainingBudget: budget };
    },
  };
  const persistence = {
    async findCandidate(_job: unknown, candidateKey: string) { return existing.get(candidateKey) ?? null; },
    async persistCandidate(_job: unknown, candidate: Record<string, unknown>) {
      calls.persist++;
      persisted.push(candidate);
      const opportunity = candidate.opportunity as { id: string; state: string };
      const company = candidate.company as { id?: string; domain?: string | null } | null;
      const reasons = candidate.policyReasons as string[];
      existing.set(candidate.candidateKey as string, {
        opportunityId: opportunity.id, state: opportunity.state,
        signalConfirmed: !reasons.some(reason => ["SIGNAL_FAMILY_UNSUPPORTED", "SIGNAL_TOO_OLD"].includes(reason)),
        companyIdentity: company?.domain ?? company?.id ?? null,
      });
      return opportunity.id;
    },
  };
  let nextId = 0;
  const dependencies = {
    loadContext: async () => ({ profile: fixtureProfile, brief: fixtureBrief, offer: fixtureOffer, icp: fixtureIcp }),
    registry, assessmentEngine, persistence, now: () => new Date(date),
    idFactory: { create: () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}` },
    initialBudget: () => budget,
    policy: { ...DEFAULT_SELF_PROSPECTING_POLICY, assessmentCost: { amount: options.assessmentCost ?? 0, currency: "USD" } },
  } as unknown as SelfProspectingDependencies;
  const controller = new AbortController();
  const execution = {
    signal: controller.signal,
    async checkpoint(value: Record<string, unknown>) {
      options.checkpoint?.(value);
      if (controller.signal.aborted) throw controller.signal.reason;
    },
    async runExternalOperation<TProvider, TResult>(
      capability: string, select: () => TProvider,
      operation: (provider: TProvider, signal: AbortSignal) => Promise<TResult>,
    ) {
      const run = () => operation(select(), controller.signal);
      if (options.runOperation) return options.runOperation(capability, run) as Promise<TResult>;
      return run();
    },
  };
  return { calls, persisted, dependencies, execution, controller, existing, seenCalls, operationStarted, handler: createSelfProspectingHandler(dependencies) };
}

export const job = {
  schemaVersion: 1 as const, id: fixtureIds.job, workspaceId: fixtureIds.workspace,
  capability: "SOURCE_SEARCH" as const, marketProfileId: "EN_DISCOVERY_ONLY" as const,
  discoveryBriefId: fixtureIds.brief, idempotencyKey: "fixture-idempotency-key", traceId: fixtureIds.job,
  attempt: 1, maxAttempts: 3, createdAt: date, updatedAt: date, state: "LEASED" as const,
  lease: { owner: "fixture-worker", token: "00000000-0000-4000-8000-000000000712", expiresAt: "2026-10-05T12:01:00.000Z" },
};
