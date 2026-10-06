import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SourceItemSchema, EvidenceItemSchema } from "../../lib/domain/schemas/evidence";
import { OpportunitySchema, OpportunityAssessmentSchema, SignalSchema } from "../../lib/domain/schemas/opportunity";
import { JobSchema, CapabilityErrorSchema } from "../../lib/domain/schemas/job";
import { CapabilitySchema } from "../../lib/domain/schemas/common";
import { MarketProfileSchema, DiscoveryBriefSchema } from "../../lib/domain/schemas/market-profile";
import { ReviewDecisionSchema } from "../../lib/domain/schemas/review-outcome";
import { ArtifactMetadataSchema } from "../../lib/domain/schemas/governance";
import * as f from "./contract-fixtures";

const scopedContracts: [string, z.ZodTypeAny, object][] = [
  ["SourceItem", SourceItemSchema, f.sourceItem], ["EvidenceItem", EvidenceItemSchema, f.evidence],
  ["OpportunityAssessment", OpportunityAssessmentSchema, f.assessment], ["Opportunity", OpportunitySchema, f.opportunity],
  ["Job", JobSchema, f.job], ["MarketProfile", MarketProfileSchema, f.marketProfile],
  ["DiscoveryBrief", DiscoveryBriefSchema, f.discoveryBrief], ["ReviewDecision", ReviewDecisionSchema, f.review],
  ["ArtifactMetadata", ArtifactMetadataSchema, f.artifact],
];

describe.each(scopedContracts)("%s contract", (_name, schema, value) => {
  it("parses its canonical version 1 shape", () => expect(schema.parse(value)).toEqual(value));
  it("requires a workspace", () => expect(schema.safeParse({ ...value, workspaceId: undefined }).success).toBe(false));
  it.each([0, 2, "1", undefined])("rejects unsupported schema version %s", schemaVersion => {
    expect(schema.safeParse({ ...value, schemaVersion }).success).toBe(false);
  });
  it("rejects vendor payload leakage", () => {
    expect(schema.safeParse({ ...value, apollo: { organization_id: "vendor-1" } }).success).toBe(false);
  });
});

describe("evidence, signal semantics and assessment", () => {
  it.each([[], undefined, [""], ["  "]])("requires non-empty evidence references (%j)", evidenceIds => {
    for (const [schema, value] of [[OpportunitySchema, f.opportunity], [OpportunityAssessmentSchema, f.assessment]] as const) {
      expect(schema.safeParse({ ...value, evidenceIds }).success).toBe(false);
    }
  });
  it.each([-0.1, 1.1, NaN, Infinity])("rejects confidence %s", confidence => {
    expect(EvidenceItemSchema.safeParse({ ...f.evidence, confidence }).success).toBe(false);
    expect(OpportunityAssessmentSchema.safeParse({ ...f.assessment, icpFit: confidence }).success).toBe(false);
  });
  it.each([0, 1])("accepts confidence boundary %s", confidence => {
    expect(EvidenceItemSchema.safeParse({ ...f.evidence, confidence }).success).toBe(true);
  });
  it.each(["yesterday", "2026-13-01T00:00:00Z", "2026-02-30T00:00:00Z", "2026-10-04", "2026-10-04T10:00:00", "2026-10-04T10:00:00+99:99"])("rejects malformed timestamp %s", capturedAt => {
    expect(EvidenceItemSchema.safeParse({ ...f.evidence, capturedAt }).success).toBe(false);
  });
  it("accepts valid ISO timestamps with an explicit offset", () => {
    expect(EvidenceItemSchema.safeParse({ ...f.evidence, capturedAt: "2026-10-04T10:00:00+03:00" }).success).toBe(true);
  });
  it("rejects nested vendor data and absent provenance", () => {
    expect(EvidenceItemSchema.safeParse({ ...f.evidence, provenance: { ...f.provenance, vendorResponse: {} } }).success).toBe(false);
    expect(SourceItemSchema.safeParse({ ...f.sourceItem, structuredFacts: { company: { apollo: {} } } }).success).toBe(false);
    expect(EvidenceItemSchema.safeParse({ ...f.evidence, provenance: undefined }).success).toBe(false);
  });
  it("preserves captured text and supports normalized fact maps", () => {
    const excerpt = "  Original text\n";
    expect(EvidenceItemSchema.parse({ ...f.evidence, excerpt }).excerpt).toBe(excerpt);
    const structuredFacts = { employeeCount: 12, companyName: "Example", companyDomain: "example.com" };
    expect(SourceItemSchema.parse({ ...f.sourceItem, content: null, structuredFacts }).structuredFacts).toEqual(structuredFacts);
  });
  it("preserves family-specific subtypes", () => {
    for (const signal of [f.signal, { family: "BUSINESS_EVENT", subtype: "hiring" }, { family: "DETECTED_PROBLEM", subtype: "market_presence" }, { family: "MARKET_OBSERVATION", subtype: "visibility_gap" }]) {
      expect(SignalSchema.safeParse(signal).success).toBe(true);
    }
    expect(SignalSchema.safeParse({ family: "EXPRESSED_INTENT", subtype: "website" }).success).toBe(false);
  });
  it("distinguishes rejection, uncertainty, model approval and human acceptance", () => {
    expect(OpportunityAssessmentSchema.safeParse({ ...f.assessment, decision: "REJECT", rejectionReasons: ["Wrong company"] }).success).toBe(true);
    expect(OpportunityAssessmentSchema.safeParse({ ...f.assessment, decision: "REJECT" }).success).toBe(false);
    expect(OpportunityAssessmentSchema.safeParse({ ...f.assessment, decision: "REVIEW", reviewReasons: ["Uncertain buyer"] }).success).toBe(true);
    expect(OpportunityAssessmentSchema.safeParse({ ...f.assessment, decision: "ACCEPTED" }).success).toBe(false);
    expect(ReviewDecisionSchema.safeParse({ ...f.review, decision: "QUALIFY" }).success).toBe(false);
  });
  it("rejects unknown lifecycle states and dimensions", () => {
    expect(OpportunitySchema.safeParse({ ...f.opportunity, state: "VERIFIED" }).success).toBe(false);
    expect(OpportunityAssessmentSchema.safeParse({ ...f.assessment, totalScore: 100 }).success).toBe(false);
  });
});

describe("market and identity boundaries", () => {
  it.each(["PEOPLE_SEARCH", "CONTACT_ENRICHMENT", "EMAIL_FIND", "OUTREACH_SEND", "PACKAGE_VERIFIED"])("legacy capability %s no longer exists", capability => {
    expect(CapabilitySchema.safeParse(capability).success).toBe(false);
  });
  it("allows only discovery workflow fields", () => {
    expect(MarketProfileSchema.safeParse({ ...f.marketProfile, workflow: "ASSISTED_OUTREACH" }).success).toBe(false);
    expect(MarketProfileSchema.safeParse({ ...f.marketProfile, outreachChannels: ["email"] }).success).toBe(false);
    expect(OpportunitySchema.safeParse({ ...f.opportunity, state: "OUTREACH_READY" }).success).toBe(false);
  });
  it("requires local geography/category and jurisdiction for regional discovery", () => {
    expect(MarketProfileSchema.safeParse({ ...f.marketProfile, id: "LOCAL_CUSTOM" }).success).toBe(false);
    const local = { ...f.marketProfile, id: "LOCAL_CUSTOM", jurisdictions: [f.jurisdiction], category: "Dentists", geography: "Boston" };
    expect(MarketProfileSchema.safeParse(local).success).toBe(true);
  });
  it("requires notes for the human OTHER reason", () => {
    expect(ReviewDecisionSchema.safeParse({ ...f.review, decision: "REJECTED", reason: "OTHER" }).success).toBe(false);
    expect(ReviewDecisionSchema.safeParse({ ...f.review, decision: "REJECTED", reason: "OTHER", note: "Outside scope" }).success).toBe(true);
  });
});

describe("durable jobs and structured capability errors", () => {
  const lease = { owner: "worker-1", token: "lease-1", expiresAt: "2026-10-04T11:00:00Z" };
  it("accepts all documented states with state-specific data", () => {
    for (const state of [
      f.job, { ...f.job, state: "LEASED", attempt: 1, lease },
      { ...f.job, state: "RUNNING", attempt: 1, lease, startedAt: f.timestamp, heartbeatAt: f.timestamp },
      { ...f.job, state: "RETRY_WAIT", attempt: 1, nextAttemptAt: f.timestamp, error: f.capabilityError },
      { ...f.job, state: "COMPLETED", completedAt: f.timestamp, resultIds: [] },
      { ...f.job, state: "PARTIAL", completedAt: f.timestamp, resultIds: ["opportunity-1"], errors: [f.capabilityError] },
      { ...f.job, state: "FAILED", completedAt: f.timestamp, error: f.capabilityError },
      { ...f.job, state: "CANCELLED", cancelledAt: f.timestamp, reason: "User request" },
    ]) expect(JobSchema.safeParse(state).success).toBe(true);
  });
  it("rejects illegal job shapes", () => {
    for (const state of [
      { ...f.job, state: "RUNNING" }, { ...f.job, state: "QUEUED", lease },
      { ...f.job, state: "FINISHED" }, { ...f.job, state: "FAILED" },
      { ...f.job, attempt: 4 },
      { ...f.job, state: "RETRY_WAIT", attempt: 3, nextAttemptAt: f.timestamp, error: f.capabilityError },
    ]) expect(JobSchema.safeParse(state).success).toBe(false);
  });
  it("uses stable errors without vendor bodies or impossible retries", () => {
    expect(CapabilityErrorSchema.parse(f.capabilityError)).toEqual(f.capabilityError);
    expect(CapabilityErrorSchema.safeParse({ ...f.capabilityError, code: "APOLLO_429" }).success).toBe(false);
    expect(CapabilityErrorSchema.safeParse({ ...f.capabilityError, code: "POLICY_DENIED" }).success).toBe(false);
    expect(CapabilityErrorSchema.safeParse({ ...f.capabilityError, response: { status: 429 } }).success).toBe(false);
    const permanent = { ...f.capabilityError, code: "POLICY_DENIED", retryable: false };
    expect(CapabilityErrorSchema.safeParse(permanent).success).toBe(true);
    expect(JobSchema.safeParse({ ...f.job, state: "RETRY_WAIT", nextAttemptAt: f.timestamp, error: permanent }).success).toBe(false);
  });
});

it("assessment never carries billing side effects", () => {
  expect(OpportunityAssessmentSchema.safeParse({ ...f.assessment, chargeCredits: true }).success).toBe(false);
});
