import { describe, expect, it } from "vitest";
import { DEFAULT_SELF_PROSPECTING_POLICY } from "../../lib/domain/opportunity-policy";
import { createSelfProspectingHandler } from "../../worker/workflows/self-prospecting";
import { candidateExternalStepKey } from "../../worker/workflows/self-prospecting-helpers";
import type { SelfProspectingDependencies } from "../../types/self-prospecting";
import {
  companyCandidate, fixtureBrief, fixtureIcp, fixtureIds, fixtureOffer, fixtureProfile, freshSignal, qualifiedAssessment,
} from "../evals/opportunity-fixtures";

const now = new Date("2026-10-05T12:00:00.000Z");
const budget = { currency: "USD", remainingCost: 1, remainingProviderCalls: 5 };
type FixtureRun = {
  schemaVersion: 1; providerRunId: string; provider: string; providerVersion: string; status: "SUCCEEDED" | "PARTIAL";
  startedAt: string; finishedAt: string; latencyMs: number; usage: { requestCount: number; recordCount: number };
  cost: { configuredAmount: number; reservedAmount: number; actualAmount: number; currency: string | null };
  provenance: Array<Record<string, unknown>>; limitations: string[]; value: unknown;
  failureKind: string | null; capabilityError: Record<string, unknown> | null;
};
const job = {
  schemaVersion: 1 as const, id: fixtureIds.job, workspaceId: fixtureIds.workspace, capability: "SOURCE_SEARCH" as const,
  marketProfileId: "EN_DISCOVERY_ONLY" as const, discoveryBriefId: fixtureIds.brief,
  idempotencyKey: "hardening-fixture", traceId: fixtureIds.job, attempt: 1, maxAttempts: 3,
  createdAt: now.toISOString(), updatedAt: now.toISOString(), state: "LEASED" as const,
  lease: { owner: "fixture-worker", token: "00000000-0000-4000-8000-000000000712", expiresAt: "2026-10-05T12:01:00.000Z" },
};

function makeHarness(options: { publishedAt?: string; partialCompanyBudget?: boolean; unsupportedFamily?: boolean } = {}) {
  const calls = { company: 0, assessment: 0, persist: 0 };
  const persisted: Array<Record<string, unknown>> = [];
  let assessmentContext: Record<string, unknown> | null = null;
  let sequence = 720;
  const providerRun = (id: string, provider: string, capabilityResult: unknown): FixtureRun => ({
    schemaVersion: 1, providerRunId: id, provider, providerVersion: "fixture-only", status: "SUCCEEDED",
    startedAt: now.toISOString(), finishedAt: now.toISOString(), latencyMs: 1,
    usage: { requestCount: 1, recordCount: 1 }, cost: { configuredAmount: 0, reservedAmount: 0, actualAmount: 0, currency: provider === "openai" ? "USD" : null },
    provenance: [], limitations: [], value: capabilityResult, failureKind: null, capabilityError: null,
  });
  const search = providerRun(fixtureIds.sourceRun, "hackernews", []);
  search.provenance = [{ schemaVersion: 1, providerId: "hackernews", providerSourceId: freshSignal.externalId,
    providerRunId: fixtureIds.sourceRun, capturedAt: now.toISOString(), sourceUrl: freshSignal.sourceUrl }];
  search.value = [{ ...freshSignal, publishedAt: options.publishedAt ?? freshSignal.publishedAt }];
  const company = providerRun(fixtureIds.companyRun, "exa", options.partialCompanyBudget ? [] : [companyCandidate]);
  if (options.partialCompanyBudget) {
    company.status = "PARTIAL";
    company.failureKind = "BUDGET_EXCEEDED";
    company.capabilityError = {
      schemaVersion: 1, code: "BUDGET_EXCEEDED", retryable: false, message: "fixture budget stop",
      capability: "COMPANY_RESOLUTION", traceId: job.traceId, retryAfterMs: null,
    };
  } else {
    company.provenance = [{ schemaVersion: 1, providerId: "exa", providerSourceId: "company-source-1",
      providerRunId: fixtureIds.companyRun, capturedAt: now.toISOString(), sourceUrl: "https://acme.example.com/about" }];
  }
  const asExecution = (run: ReturnType<typeof providerRun>, remaining = budget) => ({
    execution: { ok: true as const, outcome: run, attempts: [], remainingBudget: remaining }, providerRuns: [run],
  });
  const dependencies = {
    loadContext: async () => ({ profile: fixtureProfile,
      brief: options.unsupportedFamily ? { ...fixtureBrief, signalFamilies: ["BUSINESS_EVENT"] } : fixtureBrief,
      offer: fixtureOffer, icp: fixtureIcp }),
    registry: {
      async search() { return { signals: search.value, providerRuns: [search], remainingBudget: budget, error: null }; },
      async resolveCompany() {
        calls.company++;
        return asExecution(company, options.partialCompanyBudget ? { ...budget, remainingProviderCalls: 0 } : budget);
      },
    },
    assessmentEngine: {
      configuredCost: { amount: 0, currency: "USD" },
      async assess(input: { messages: readonly { role: string; content: string }[] }, context: Record<string, unknown>) {
        calls.assessment++;
        assessmentContext = context;
        const payload = JSON.parse(input.messages[1]!.content) as { signal: string; evidence: Array<{ id: string }> };
        const output = { ...qualifiedAssessment, problemStatement: payload.signal,
          evidenceIds: [payload.evidence[0]!.id],
          groundedClaims: [{ text: payload.signal, evidenceIds: [payload.evidence[0]!.id] }] };
        return { output, run: providerRun(fixtureIds.assessmentRun, "openai", output) };
      },
    },
    persistence: {
      async findCandidate() { return null; },
      async persistCandidate(_leasedJob: unknown, input: Record<string, unknown>) {
        calls.persist++;
        persisted.push(input);
        return (input.opportunity as { id: string }).id;
      },
    },
    now: () => now,
    idFactory: { create: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}` },
    initialBudget: () => budget,
    policy: DEFAULT_SELF_PROSPECTING_POLICY,
  } as unknown as SelfProspectingDependencies;
  const controller = new AbortController();
  const execution = {
    signal: controller.signal,
    async checkpoint() {},
    async runExternalOperation<TProvider, TResult>(_capability: string, select: () => TProvider,
      operation: (provider: TProvider, signal: AbortSignal) => Promise<TResult>) {
      return operation(select(), controller.signal);
    },
  };
  return { handler: createSelfProspectingHandler(dependencies), execution, calls, persisted,
    get assessmentContext() { return assessmentContext; } };
}

describe("Task 7 review hardening", () => {
  it("uses candidate-unique external step keys that remain stable for retries", () => {
    const first = candidateExternalStepKey("COMPANY_RESOLUTION", "hackernews:one");
    expect(first).not.toBe(candidateExternalStepKey("COMPANY_RESOLUTION", "hackernews:two"));
    expect(first).toBe(candidateExternalStepKey("COMPANY_RESOLUTION", "hackernews:one"));
    expect(candidateExternalStepKey("OPPORTUNITY_ASSESSMENT", "hackernews:one")).not.toBe(first);
  });

  it("rejects future-dated source signals before company lookup, assessment, or persistence", async () => {
    const harness = makeHarness({ publishedAt: "2026-10-06T00:00:00.000Z" });
    const result = await harness.handler(job, harness.execution);
    expect(result.result).toMatchObject({ outcome: "INSUFFICIENT_EVIDENCE", reasons: ["SIGNAL_FUTURE_DATED"] });
    expect(harness.calls).toEqual({ company: 0, assessment: 0, persist: 0 });
  });

  it("rejects future-dated unsupported-family signals before insufficient-evidence persistence", async () => {
    const harness = makeHarness({ publishedAt: "2026-10-06T00:00:00.000Z", unsupportedFamily: true });
    const result = await harness.handler(job, harness.execution);
    expect(result.result).toMatchObject({ outcome: "INSUFFICIENT_EVIDENCE", reasons: ["SIGNAL_FUTURE_DATED"] });
    expect(harness.calls).toEqual({ company: 0, assessment: 0, persist: 0 });
  });

  it("treats a PARTIAL company run with BUDGET_EXCEEDED as a budget stop", async () => {
    const harness = makeHarness({ partialCompanyBudget: true });
    const result = await harness.handler(job, harness.execution);
    expect(result.result).toMatchObject({ outcome: "BUDGET_EXHAUSTED" });
    expect(harness.persisted[0]?.policyReasons).not.toContain("COMPANY_UNCERTAIN");
    expect(harness.calls.assessment).toBe(0);
  });

  it("passes only trace/job identity and cancellation to the assessment engine", async () => {
    const harness = makeHarness();
    await harness.handler(job, harness.execution);
    expect(harness.assessmentContext).toEqual({ jobId: job.id, traceId: job.traceId, signal: expect.any(AbortSignal) });
    expect(harness.assessmentContext).not.toHaveProperty("lease");
    expect(harness.assessmentContext).not.toHaveProperty("workspaceId");
  });
});
