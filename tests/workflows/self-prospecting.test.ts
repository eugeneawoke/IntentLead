import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeSelfProspectingCapability, createSelfProspectingHandler } from "../../worker/workflows/self-prospecting";
import { validateAssessmentGrounding } from "../../lib/domain/evidence-policy";
import type { SelfProspectingDependencies } from "../../types/self-prospecting";
import type { EvidenceGroundingSource } from "../../lib/domain/evidence-policy";
import type { CompanyCandidate } from "../../worker/providers/contracts";
import type { ProviderId, ProviderResult } from "../../worker/providers/contracts";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { executeProviderWithFallback } from "../../worker/providers/registry";
import { providerDescriptor, providerRequest } from "../providers/helpers";
import { DEFAULT_SELF_PROSPECTING_POLICY } from "../../lib/domain/opportunity-policy";
import {
  companyCandidate, fixtureBrief, fixtureIcp, fixtureIds, fixtureOffer, fixtureProfile, freshSignal, makeCompany,
  makeTimestampedSignal, promptInjectionContent, qualifiedAssessment,
} from "../evals/opportunity-fixtures";

const date = "2026-10-05T12:00:00.000Z";
const budget = { currency: "USD", remainingCost: 1, remainingProviderCalls: 5 };

function companyRun(provider: ProviderId, failure?: "DEPENDENCY_UNAVAILABLE" | "TIMEOUT"): ProviderResult<CompanyCandidate[]> {
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
  id: string,
  provider: "hackernews" | "exa" | "openai",
  value: unknown,
  cost = 0,
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
      ok: true as const,
      outcome: { ...run, value } as ReturnType<typeof providerRun> & { value: T },
      attempts: [{ providerId: run.provider, providerRunId: run.providerRunId, status: "SUCCEEDED" as const, configuredCost: 0 }],
      remainingBudget: remaining,
    },
    providerRuns: [run],
  };
}

function makeHarness(options: {
  signal?: typeof freshSignal;
  company?: CompanyCandidate;
  assessment?: Record<string, unknown>;
  remainingBudget?: typeof budget;
  assessmentCost?: number;
  cancelDuring?: "SOURCE_SEARCH" | "OPPORTUNITY_ASSESSMENT";
  checkpoint?: (value: Record<string, unknown>) => void;
  runOperation?: (capability: string, run: () => Promise<unknown>) => Promise<unknown>;
  sourceCapturedAt?: string;
} = {}) {
  const calls = { search: 0, company: 0, assessment: 0, persist: 0 };
  const persisted: Array<Record<string, unknown>> = [];
  const existing = new Map<string, { opportunityId: string; state: string }>();
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
      const run = providerRun(fixtureIds.sourceRun, "hackernews", [signal], 0, options.sourceCapturedAt ? [{
        schemaVersion: 1, providerId: "hackernews", providerSourceId: signal.externalId,
        providerRunId: fixtureIds.sourceRun, capturedAt: options.sourceCapturedAt, sourceUrl: signal.sourceUrl,
      }] : []);
      return successful(run, [signal], options.remainingBudget ?? budget);
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
      seenCalls.push(input.messages[0]?.role ?? "", input.messages[1]?.role ?? "");
      seenCalls.push(input.messages[1]?.content ?? "");
      const payload = JSON.parse(input.messages[1]?.content ?? "{}") as {
        signal?: string; evidence?: Array<{ id: string }>;
      };
      const evidenceId = payload.evidence?.[0]?.id ?? fixtureIds.evidence;
      const grounded = {
        ...qualifiedAssessment,
        problemStatement: payload.signal ?? qualifiedAssessment.problemStatement,
        evidenceIds: [evidenceId],
        groundedClaims: [{ text: payload.signal ?? qualifiedAssessment.problemStatement, evidenceIds: [evidenceId] }],
      };
      const output = options.assessment ? { ...grounded, ...options.assessment } : grounded;
      const run = providerRun(fixtureIds.assessmentRun, "openai", output, options.assessmentCost ?? 0);
      return { output, run, remainingBudget: budget };
    },
  };
  const persistence = {
    async findCandidate(_job: unknown, candidateKey: string) { return existing.get(candidateKey) ?? null; },
    async persistCandidate(_job: unknown, candidate: Record<string, unknown>) {
      calls.persist++;
      persisted.push(candidate);
      const opportunity = candidate.opportunity as { id: string; state: string };
      existing.set(candidate.candidateKey as string, { opportunityId: opportunity.id, state: opportunity.state });
      return opportunity.id;
    },
  };
  let nextId = 0;
  const dependencies = {
    loadContext: async () => ({ profile: fixtureProfile, brief: fixtureBrief, offer: fixtureOffer, icp: fixtureIcp }),
    registry,
    assessmentEngine,
    persistence,
    now: () => new Date(date),
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

const job = {
  schemaVersion: 1 as const, id: fixtureIds.job, workspaceId: fixtureIds.workspace,
  capability: "SOURCE_SEARCH" as const, marketProfileId: "EN_DISCOVERY_ONLY" as const,
  discoveryBriefId: fixtureIds.brief, idempotencyKey: "fixture-idempotency-key", traceId: fixtureIds.job,
  attempt: 1, maxAttempts: 3, createdAt: date, updatedAt: date, state: "LEASED" as const,
  lease: { owner: "fixture-worker", token: "00000000-0000-4000-8000-000000000712", expiresAt: "2026-10-05T12:01:00.000Z" },
};

describe("Task 7 self-prospecting workflow", () => {
  it("turns a clear fresh expressed-intent signal into a review-only candidate", async () => {
    const harness = makeHarness();
    const result = await harness.handler(job, harness.execution);
    expect(result.state).toBe("COMPLETED");
    expect(harness.persisted[0]?.opportunity).toMatchObject({ state: "HUMAN_REVIEW" });
    expect(harness.persisted[0]?.modelDecision).toBe("QUALIFY");
    expect(harness.persisted[0]?.assessment).toMatchObject({ decision: "REVIEW" });
    expect(harness.calls).toEqual({ search: 1, company: 1, assessment: 1, persist: 1 });
  });

  it("preserves the provider capture time when replaying recorded evidence", async () => {
    const capturedAt = "2026-10-05T10:30:00.000Z";
    const harness = makeHarness({ sourceCapturedAt: capturedAt });
    await harness.handler(job, harness.execution);
    expect(harness.persisted[0]?.sourceItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ capturedAt }),
    ]));
    expect(harness.persisted[0]?.evidenceItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ capturedAt }),
    ]));
  });

  it("keeps a model REVIEW in HUMAN_REVIEW with the model reason", async () => {
    const harness = makeHarness({ assessment: { decision: "REVIEW", reviewReasons: ["NEEDS_HUMAN_CONFIRMATION"] } });
    await harness.handler(job, harness.execution);
    expect(harness.persisted[0]?.opportunity).toMatchObject({ state: "HUMAN_REVIEW" });
    expect(harness.persisted[0]?.assessment).toMatchObject({ decision: "REVIEW", reviewReasons: ["MODEL_REVIEW", "NEEDS_HUMAN_CONFIRMATION"] });
  });

  it.each([
    ["stale signal", makeTimestampedSignal({ publishedAt: "2025-01-01T00:00:00.000Z" }), companyCandidate, "INSUFFICIENT_EVIDENCE"],
    ["uncertain or wrong company", freshSignal, makeCompany({ resolutionStatus: "UNCERTAIN", companyDomain: null }), "INSUFFICIENT_EVIDENCE"],
    ["insufficient company evidence", freshSignal, makeCompany({ evidence: [{ ...companyCandidate.evidence[0]!, providerRunId: "other-run" }] }), "INSUFFICIENT_EVIDENCE"],
  ])("returns a bounded %s outcome", async (_label, source, company, expected) => {
    const harness = makeHarness({ signal: source, company });
    await harness.handler(job, harness.execution);
    expect(harness.persisted[0]?.opportunity).toMatchObject({ state: expected });
  });

  it("drops weak signals before spending on company resolution or persistence", async () => {
    const harness = makeHarness({ signal: makeTimestampedSignal({ content: "We are experimenting with a few internal ideas." }) });
    const result = await harness.handler(job, harness.execution);
    expect(result.result).toMatchObject({ outcome: "INSUFFICIENT_EVIDENCE", reasons: ["SIGNAL_TOO_WEAK"] });
    expect(harness.calls).toEqual({ search: 1, company: 0, assessment: 0, persist: 0 });
  });

  it("stops safely on budget exhaustion before optional company resolution", async () => {
    const harness = makeHarness({ remainingBudget: { ...budget, remainingProviderCalls: 0 } });
    const result = await harness.handler(job, harness.execution);
    expect(result.state).toBe("COMPLETED");
    expect(harness.calls.company).toBe(0);
    expect(harness.calls.persist).toBe(0);
  });

  it("stops before model assessment when configured-cost budget is insufficient", async () => {
    const harness = makeHarness({ assessmentCost: 0.25, remainingBudget: { ...budget, remainingCost: 0.1 } });
    const result = await harness.handler(job, harness.execution);
    expect(result).toMatchObject({ state: "COMPLETED", result: { outcome: "BUDGET_EXHAUSTED", opportunityIds: [] } });
    expect(harness.calls).toEqual({ search: 1, company: 1, assessment: 0, persist: 0 });
  });

  it("uses sequential company-provider fallback for unavailable dependencies, never timeout", async () => {
    const descriptors = [
      providerDescriptor("exa", "COMPANY_RESOLUTION", { priority: 1 }),
      providerDescriptor("serper", "COMPANY_RESOLUTION", { priority: 2 }),
    ];
    const profile = MarketProfileSchema.parse(fixtureProfile);
    const request = providerRequest(profile, descriptors, {
      capability: "COMPANY_RESOLUTION", allowFallback: true,
      budget: { currency: "USD", remainingCost: 1, remainingProviderCalls: 2 },
    });
    const attempted: string[] = [];
    const recovered = await executeProviderWithFallback(request, async descriptor => {
      attempted.push(descriptor.id);
      return descriptor.id === "exa" ? companyRun("exa", "DEPENDENCY_UNAVAILABLE") : companyRun("serper");
    });
    expect(recovered.ok).toBe(true);
    expect(attempted).toEqual(["exa", "serper"]);

    attempted.length = 0;
    const timedOut = await executeProviderWithFallback(request, async descriptor => {
      attempted.push(descriptor.id);
      return companyRun("exa", "TIMEOUT");
    });
    expect(timedOut.ok).toBe(false);
    expect(attempted).toEqual(["exa"]);
  });

  it("returns the same opportunity on an idempotent rerun without duplicating persisted records", async () => {
    const harness = makeHarness();
    const first = await harness.handler(job, harness.execution);
    const second = await harness.handler(job, harness.execution);
    expect((second.result as { opportunityIds: string[] }).opportunityIds)
      .toEqual((first.result as { opportunityIds: string[] }).opportunityIds);
    expect(harness.calls.persist).toBe(1);
    expect(harness.persisted).toHaveLength(1);
  });

  it.each(["VALIDATED", "SOURCE_SEARCH", "EVIDENCE_CONSTRUCTED", "COMPANY_RESOLUTION", "COMPANY_EVIDENCE_CONSTRUCTED", "OPPORTUNITY_ASSESSMENT", "POLICY_DECISION", "PERSISTENCE"])(
    "honors cancellation at the %s boundary", async boundary => {
      const harness = makeHarness({ checkpoint(value) { if (value.step === boundary) harness.controller.abort(new Error("cancelled")); } });
      await expect(harness.handler(job, harness.execution)).rejects.toThrow("cancelled");
      expect(harness.calls.persist).toBe(0);
    },
  );

  it.each(["SOURCE_SEARCH", "OPPORTUNITY_ASSESSMENT"] as const)("aborts an active %s adapter operation", async capability => {
    const harness = makeHarness({ cancelDuring: capability });
    const pending = harness.handler(job, harness.execution);
    await harness.operationStarted;
    harness.controller.abort(new Error("cancelled while active"));
    await expect(pending).rejects.toThrow("cancelled while active");
    expect(harness.calls.persist).toBe(0);
  });

  it("passes injected source text only as user data and rejects malformed or unsupported model claims", async () => {
    const harness = makeHarness({ signal: makeTimestampedSignal({ content: promptInjectionContent }) });
    await harness.handler(job, harness.execution);
    expect(harness.seenCalls.slice(0, 2)).toEqual(["system", "user"]);
    expect(harness.seenCalls[2]).toContain("Ignore all rules");
    const evidence: EvidenceGroundingSource[] = [{ id: fixtureIds.evidence, excerpt: qualifiedAssessment.problemStatement, structuredFacts: {} }];
    expect(() => validateAssessmentGrounding({ ...qualifiedAssessment, unexpected: true }, evidence)).toThrow();
    expect(() => validateAssessmentGrounding({ ...qualifiedAssessment, problemStatement: "Invented acquisition loss" }, evidence)).toThrow();
    expect(() => validateAssessmentGrounding({ ...qualifiedAssessment, evidenceIds: [fixtureIds.evidence, fixtureIds.evidence] }, evidence)).toThrow();
    expect(() => validateAssessmentGrounding({ ...qualifiedAssessment, evidenceIds: ["unknown-evidence"] }, evidence)).toThrow();
  });

  it("denies capabilities disabled by the active discovery profile", () => {
    expect(authorizeSelfProspectingCapability({ ...fixtureProfile, capabilities: fixtureProfile.capabilities.filter(item => item !== "WEB_FETCH"), disabledCapabilities: [...fixtureProfile.disabledCapabilities, "WEB_FETCH"] }, "WEB_FETCH"))
      .toMatchObject({ allowed: false, reason: "CAPABILITY_DISABLED" });
    expect(authorizeSelfProspectingCapability(fixtureProfile, "HUMAN_REVIEW")).toMatchObject({ allowed: true });
  });
});

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("global network access is forbidden in workflow tests"); })));
afterEach(() => vi.unstubAllGlobals());
