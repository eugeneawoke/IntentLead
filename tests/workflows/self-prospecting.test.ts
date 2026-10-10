import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeSelfProspectingCapability } from "../../worker/workflows/self-prospecting";
import { validateAssessmentGrounding } from "../../lib/domain/evidence-policy";
import type { EvidenceGroundingSource } from "../../lib/domain/evidence-policy";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { executeProviderWithFallback } from "../../worker/providers/registry";
import { consumeFixtureReservation, providerDescriptor, providerRequest } from "../providers/helpers";
import {
  companyCandidate, fixtureIds, fixtureProfile, freshSignal, makeCompany,
  makeTimestampedSignal, promptInjectionContent, qualifiedAssessment,
} from "../evals/opportunity-fixtures";
import { budget, companyRun, job, makeHarness } from "./self-prospecting-harness";

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

  it("fails closed when a signal has no exact provider-run provenance", async () => {
    const harness = makeHarness({ omitSourceProvenance: true });
    await expect(harness.handler(job, harness.execution)).rejects.toThrow("signal provenance does not match");
    expect(harness.calls.company).toBe(0);
    expect(harness.calls.persist).toBe(0);
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
    const recovered = await executeProviderWithFallback(request, async (descriptor, context) => {
      attempted.push(descriptor.id);
      consumeFixtureReservation(descriptor, context);
      return descriptor.id === "exa" ? companyRun("exa", "DEPENDENCY_UNAVAILABLE") : companyRun("serper");
    });
    expect(recovered.ok).toBe(true);
    expect(attempted).toEqual(["exa", "serper"]);

    attempted.length = 0;
    const timedOut = await executeProviderWithFallback(request, async (descriptor, context) => {
      attempted.push(descriptor.id);
      consumeFixtureReservation(descriptor, context);
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
