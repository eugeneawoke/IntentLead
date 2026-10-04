import { describe, expect, expectTypeOf, it } from "vitest";
import { EvidenceItemSchema, SourceItemSchema } from "../../lib/domain/schemas/evidence";
import { OpportunitySchema } from "../../lib/domain/schemas/opportunity";
import { JobSchema } from "../../lib/domain/schemas/job";
import * as f from "./contract-fixtures";

describe("normalized version 1 fact vocabulary", () => {
  it.each(["apollo_id", "organization_id", "vendor", "raw", "customFact"])("rejects flat provider/arbitrary key %s", key => {
    const structuredFacts = { [key]: "provider-value" };
    expect(EvidenceItemSchema.safeParse({ ...f.evidence, structuredFacts }).success).toBe(false);
    expect(SourceItemSchema.safeParse({ ...f.sourceItem, structuredFacts }).success).toBe(false);
  });
  it("accepts normalized company, technology, location, problem and measurement facts", () => {
    const structuredFacts = {
      companyName: "Example", companyDomain: "example.com", employeeCount: 12,
      technologies: ["WordPress"], location: { ...f.jurisdiction, locality: "Boston" },
      problem: { category: "website", observedCondition: "Checkout returned HTTP 500" },
      sourceMeasurement: { metric: "HTTP_STATUS", value: 500, observedAt: f.timestamp },
    };
    expect(SourceItemSchema.parse({ ...f.sourceItem, content: null, structuredFacts }).structuredFacts).toEqual(structuredFacts);
    expect(EvidenceItemSchema.parse({ ...f.evidence, excerpt: null, structuredFacts }).structuredFacts).toEqual(structuredFacts);
  });
  it.each([
    { employeeCount: "12" }, { employeeCount: -1 }, { employeeCount: 1.5 },
    { companyDomain: "https://example.com/path" }, { technologies: [" "] },
    { sourceMeasurement: { metric: "HTTP_STATUS", value: 42, observedAt: f.timestamp } },
    { sourceMeasurement: { metric: "REVIEW_COUNT", value: 1.5, observedAt: f.timestamp } },
    { sourceMeasurement: { metric: "REVIEW_RATING", value: 6, scaleMax: 5, observedAt: f.timestamp } },
    { location: { ...f.jurisdiction, locality: "Boston", organization_id: "vendor-1" } },
  ])("rejects invalid normalized fact values %j", structuredFacts => {
    expect(EvidenceItemSchema.safeParse({ ...f.evidence, structuredFacts }).success).toBe(false);
  });
  it("accepts each finite source measurement family", () => {
    for (const measurement of [
      { metric: "REVIEW_COUNT", value: 0 }, { metric: "MENTION_COUNT", value: 2 },
      { metric: "CITATION_COUNT", value: 2 }, { metric: "OBSERVATION_COUNT", value: 3 },
      { metric: "SEARCH_RANK", value: 1 }, { metric: "REVIEW_RATING", value: 8, scaleMax: 10 },
    ]) {
      expect(EvidenceItemSchema.safeParse({ ...f.evidence, structuredFacts: { sourceMeasurement: { ...measurement, observedAt: f.timestamp } } }).success).toBe(true);
    }
  });
  it("does not treat absent optional facts as evidence", () => {
    const structuredFacts = { companyName: undefined };
    expect(SourceItemSchema.safeParse({ ...f.sourceItem, content: null, structuredFacts }).success).toBe(false);
    expect(EvidenceItemSchema.safeParse({ ...f.evidence, excerpt: null, structuredFacts }).success).toBe(false);
  });
});

describe("state-dependent Opportunity snapshots", () => {
  it.each(["DISCOVERED", "ENRICHING", "INSUFFICIENT_EVIDENCE"])("allows unresolved early state %s", state => {
    expect(OpportunitySchema.safeParse({ ...f.opportunity, state, companyId: null, assessmentId: null }).success).toBe(true);
  });
  it("requires company resolution before assessment readiness", () => {
    expect(OpportunitySchema.safeParse({ ...f.opportunity, state: "ASSESSABLE", assessmentId: null }).success).toBe(true);
    expect(OpportunitySchema.safeParse({ ...f.opportunity, state: "ASSESSABLE", companyId: null }).success).toBe(false);
  });
  it("requires both resolved company and assessment for model rejection", () => {
    expect(OpportunitySchema.safeParse({ ...f.opportunity, state: "MODEL_REJECTED" }).success).toBe(true);
    expect(OpportunitySchema.safeParse({ ...f.opportunity, state: "MODEL_REJECTED", companyId: null }).success).toBe(false);
    expect(OpportunitySchema.safeParse({ ...f.opportunity, state: "MODEL_REJECTED", assessmentId: null }).success).toBe(false);
  });
  it.each([
    "PACKAGE_READY", "HUMAN_REVIEW", "REJECTED", "NEEDS_RESEARCH", "OUTREACH_READY", "CONTACTED",
    "REPLIED", "NO_REPLY", "OPTED_OUT", "POSITIVE_REPLY", "NEGATIVE_REPLY", "MEETING", "SALES_OPPORTUNITY", "CUSTOMER", "CLOSED",
  ])("requires company and assessment for %s", state => {
    const snapshot = { ...f.opportunity, state, marketProfileId: "LOCAL_CUSTOM" };
    expect(OpportunitySchema.safeParse(snapshot).success).toBe(true);
    expect(OpportunitySchema.safeParse({ ...snapshot, companyId: null }).success).toBe(false);
    expect(OpportunitySchema.safeParse({ ...snapshot, assessmentId: null }).success).toBe(false);
  });
  it("narrows required references in the inferred type", () => {
    const snapshot = OpportunitySchema.parse(f.opportunity);
    if (snapshot.state === "HUMAN_REVIEW") {
      expectTypeOf(snapshot.companyId).toEqualTypeOf<string>();
      expectTypeOf(snapshot.assessmentId).toEqualTypeOf<string>();
    }
  });
});

describe("intrinsic Job chronology", () => {
  const before = "2026-10-04T09:00:00Z";
  const later = "2026-10-04T11:00:00Z";
  const lease = { owner: "worker-1", token: "lease-1", expiresAt: later };
  it.each([
    { state: "RUNNING", lease, startedAt: before, heartbeatAt: f.timestamp },
    { state: "RUNNING", lease, startedAt: f.timestamp, heartbeatAt: before },
    { state: "RUNNING", lease, startedAt: f.timestamp, heartbeatAt: later },
    { state: "LEASED", lease: { ...lease, expiresAt: before } },
    { state: "LEASED", lease: { ...lease, expiresAt: f.timestamp }, updatedAt: later },
    { state: "RUNNING", lease: { ...lease, expiresAt: before }, startedAt: f.timestamp, heartbeatAt: f.timestamp },
    { state: "RETRY_WAIT", nextAttemptAt: before, error: f.capabilityError },
    { state: "RETRY_WAIT", nextAttemptAt: f.timestamp, updatedAt: later, error: f.capabilityError },
    { state: "COMPLETED", completedAt: before, resultIds: [] },
    { state: "COMPLETED", completedAt: later, resultIds: [] },
    { state: "PARTIAL", completedAt: before, resultIds: ["opportunity-1"], errors: [f.capabilityError] },
    { state: "FAILED", completedAt: before, error: f.capabilityError },
    { state: "CANCELLED", cancelledAt: before, reason: "User request" },
    { state: "CANCELLED", cancelledAt: later, reason: "User request" },
  ])("rejects inconsistent snapshot %j", state => {
    expect(JobSchema.safeParse({ ...f.job, ...state }).success).toBe(false);
  });
  it("retains expired leases and overdue retries without wall-clock validation", () => {
    const old = { ...f.job, createdAt: "2020-01-01T10:00:00Z", updatedAt: "2020-01-01T11:00:00Z", attempt: 1 };
    const expiredLease = { ...lease, expiresAt: "2020-01-01T12:00:00Z" };
    expect(JobSchema.safeParse({ ...old, state: "LEASED", lease: expiredLease }).success).toBe(true);
    expect(JobSchema.safeParse({ ...old, state: "RUNNING", lease: expiredLease, startedAt: old.createdAt, heartbeatAt: "2020-01-01T11:00:00Z" }).success).toBe(true);
    expect(JobSchema.safeParse({ ...old, state: "RETRY_WAIT", nextAttemptAt: "2020-01-01T12:00:00Z", error: f.capabilityError }).success).toBe(true);
  });
  it("allows lease and retry deadlines equal to the update timestamp", () => {
    expect(JobSchema.safeParse({ ...f.job, state: "LEASED", lease: { ...lease, expiresAt: f.job.updatedAt } }).success).toBe(true);
    expect(JobSchema.safeParse({ ...f.job, state: "RETRY_WAIT", nextAttemptAt: f.job.updatedAt, error: f.capabilityError }).success).toBe(true);
  });
});
