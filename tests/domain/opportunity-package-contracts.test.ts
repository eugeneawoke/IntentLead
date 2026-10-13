import { describe, expect, it } from "vitest";
import { CapabilitySchema } from "../../lib/domain/schemas/common";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import {
  BuyerCandidateSchema,
  ContactPointSchema,
  ContactVerificationSchema,
  PersonSchema,
} from "../../lib/domain/schemas/person-contact";
import {
  ConversationBriefSchema,
  DraftSchema,
} from "../../lib/domain/schemas/conversation-package";
import { SuppressionEntrySchema } from "../../lib/domain/schemas/governance";

const timestamp = "2026-10-06T10:00:00.000Z";
const hash = "a".repeat(64);
const scoped = { schemaVersion: 1 as const, id: "record-1", workspaceId: "workspace-1" };
const evidenceIds = ["evidence-1"];
const opportunityId = "opportunity-1";

const person = {
  ...scoped,
  opportunityId,
  companyId: "company-1",
  fullName: "Alex Morgan",
  role: "Head of Operations",
  jurisdiction: { countryCode: "US", subdivisionCode: null },
  evidenceIds,
  confidence: 0.9,
  resolvedAt: timestamp,
};

const buyer = {
  ...scoped,
  opportunityId,
  companyId: "company-1",
  personId: person.id,
  role: "Head of Operations",
  hypothesis: "Owns the workflow described in the evidence.",
  evidenceIds,
  confidence: 0.86,
  relevance: 0.92,
  rank: 1,
  createdAt: timestamp,
};

const contact = {
  ...scoped,
  opportunityId,
  personId: person.id,
  companyId: "company-1",
  channel: "email" as const,
  scope: "PERSON" as const,
  state: "AVAILABLE" as const,
  value: "alex@example.com",
  valueHash: hash,
  source: {
    kind: "PUBLIC_WEB" as const,
    url: "https://example.com/team",
    providerRunId: null,
  },
  jurisdiction: { countryCode: "US", subdivisionCode: null },
  evidenceIds,
  capturedAt: timestamp,
  marketPolicyId: "contact-policy-1",
  resolutionConfidence: 0.91,
  suppressionEntryId: null,
};

const verification = {
  ...scoped,
  opportunityId,
  contactPointId: contact.id,
  status: "VALID" as const,
  method: "PUBLIC_SOURCE" as const,
  providerRunId: null,
  checkedAt: timestamp,
  expiresAt: "2026-11-06T10:00:00.000Z",
  confidence: 0.96,
  evidenceIds,
};

const materialClaim = {
  id: "claim-1",
  text: "The company is hiring operations specialists.",
  evidenceIds,
};

const body = "Noticed that your team is hiring operations specialists.";
const subject = "Operations workflow";
const draftClaims = [
  { ...materialClaim, text: subject, target: "SUBJECT" as const, startOffset: 0, endOffset: subject.length },
  { ...materialClaim, id: "claim-2", text: body, target: "BODY" as const, startOffset: 0, endOffset: body.length },
];

describe("Opportunity package v1 contracts", () => {
  it.each([
    ["Person", PersonSchema, person],
    ["BuyerCandidate", BuyerCandidateSchema, buyer],
    ["ContactPoint", ContactPointSchema, contact],
    ["ContactVerification", ContactVerificationSchema, verification],
    ["ConversationBrief", ConversationBriefSchema, {
      ...scoped,
      opportunityId,
      buyerCandidateId: buyer.id,
      contactPointId: contact.id,
      contactVerificationId: verification.id,
      problemSummary: "Manual operations are limiting growth.",
      relevanceSummary: "The offer automates that workflow.",
      recommendedAngle: "Lead with the observed hiring pressure.",
      lowFrictionCta: "Open to comparing the workflow for 15 minutes?",
      claims: [materialClaim],
      createdAt: timestamp,
    }],
    ["Draft", DraftSchema, {
      ...scoped,
      opportunityId,
      conversationBriefId: "brief-1",
      version: 1,
      channel: "EMAIL",
      deliveryMode: "COPY_EXPORT_ONLY",
      subject,
      body,
      claims: draftClaims,
      status: "GROUNDED",
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    ["SuppressionEntry", SuppressionEntrySchema, {
      ...scoped,
      identifierType: "EMAIL",
      identifierHash: hash,
      reason: "OPT_OUT",
      policyId: "contact-policy-1",
      source: "HUMAN",
      createdAt: timestamp,
      retainUntil: null,
    }],
  ] as const)("parses canonical %s", (_name, schema, value) => {
    expect(schema.parse(value)).toEqual(value);
    expect(schema.safeParse({ ...value, schemaVersion: 2 }).success).toBe(false);
    expect(schema.safeParse({ ...value, workspaceId: undefined }).success).toBe(false);
  });

  it("rejects invalid and provenance-free contact values", () => {
    expect(ContactPointSchema.safeParse({ ...contact, value: "not-an-email" }).success).toBe(false);
    expect(ContactPointSchema.safeParse({ ...contact, evidenceIds: [] }).success).toBe(false);
    expect(ContactPointSchema.safeParse({ ...contact, source: { ...contact.source, url: null } }).success).toBe(false);
    expect(ContactPointSchema.safeParse({ ...contact, valueHash: hash.toUpperCase() }).success).toBe(false);
    expect(ContactPointSchema.safeParse({ ...contact, scope: "COMPANY", personId: person.id }).success).toBe(false);
    expect(ContactPointSchema.safeParse({
      ...contact,
      state: "SUPPRESSED",
      value: "alex@example.com",
      suppressionEntryId: "suppression-1",
    }).success).toBe(false);
  });

  it("distinguishes found contacts from independently verified contacts", () => {
    expect(ContactPointSchema.safeParse(contact).success).toBe(true);
    expect(ContactVerificationSchema.safeParse({ ...verification, status: "FOUND" }).success).toBe(false);
    expect(ContactVerificationSchema.safeParse({ ...verification, method: "PROVIDER", providerRunId: null }).success).toBe(false);
    expect(ContactVerificationSchema.safeParse({ ...verification, expiresAt: null }).success).toBe(false);
    expect(ContactVerificationSchema.safeParse({ ...verification, checkedAt: "2999-01-01T00:00:00.000Z" }).success).toBe(false);
  });

  it("uses Unicode code-point offsets for grounded draft spans", () => {
    const unicodeBody = "Hi 👋";
    expect(DraftSchema.safeParse({
      ...scoped, opportunityId, conversationBriefId: "brief-1", version: 1,
      channel: "GENERIC_MESSAGE", deliveryMode: "COPY_EXPORT_ONLY", subject: null,
      body: unicodeBody,
      claims: [{ ...materialClaim, text: unicodeBody, target: "BODY", startOffset: 0, endOffset: 4 }],
      status: "GROUNDED", createdAt: timestamp, updatedAt: timestamp,
    }).success).toBe(true);
  });

  it("fails closed when a brief or draft has an unsupported material claim", () => {
    const unsupported = { ...materialClaim, evidenceIds: [] };
    expect(ConversationBriefSchema.safeParse({
      ...scoped,
      opportunityId,
      buyerCandidateId: buyer.id,
      contactPointId: contact.id,
      contactVerificationId: verification.id,
      problemSummary: "Problem",
      relevanceSummary: "Relevance",
      recommendedAngle: "Angle",
      lowFrictionCta: "CTA",
      claims: [unsupported],
      createdAt: timestamp,
    }).success).toBe(false);
    expect(DraftSchema.safeParse({
      ...scoped,
      opportunityId,
      conversationBriefId: "brief-1",
      version: 1,
      channel: "EMAIL",
      deliveryMode: "COPY_EXPORT_ONLY",
      subject: null,
      body: "Unsupported assertion",
      claims: [unsupported],
      status: "DRAFT",
      createdAt: timestamp,
      updatedAt: timestamp,
    }).success).toBe(false);
  });
});

describe("EN_DISCOVERY_ONLY capability boundary", () => {
  const researchCapabilities = [
    "SOURCE_SEARCH", "WEB_FETCH", "COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT",
    "PERSON_SEARCH", "EMAIL_FIND", "EMAIL_VERIFY", "DRAFT_GENERATION", "HUMAN_REVIEW", "COPY_EXPORT",
  ] as const;
  const transmissionCapabilities = [
    "MAILBOX_CONNECT", "MESSAGE_SEND", "SEQUENCE_RUN", "FOLLOW_UP", "DELIVERY_TRACKING",
  ] as const;

  it.each([...researchCapabilities, ...transmissionCapabilities])("recognizes capability %s", capability => {
    expect(CapabilitySchema.safeParse(capability).success).toBe(true);
  });

  it("permits contact research and drafting while explicitly denying transmission", () => {
    const profile = {
      ...scoped,
      id: "EN_DISCOVERY_ONLY",
      workflow: "DISCOVERY_ONLY",
      jurisdictions: [],
      regions: [],
      languages: ["en"],
      capabilities: [...researchCapabilities],
      disabledCapabilities: [...transmissionCapabilities],
      legalPolicyId: "research-policy-1",
      retentionPolicyId: "retention-1",
      defaultCurrency: "USD",
      timezone: "Europe/Minsk",
    };
    expect(MarketProfileSchema.safeParse(profile).success).toBe(true);
    expect(MarketProfileSchema.safeParse({
      ...profile,
      capabilities: [...researchCapabilities, "MESSAGE_SEND"],
      disabledCapabilities: transmissionCapabilities.filter(item => item !== "MESSAGE_SEND"),
    }).success).toBe(false);
  });
});
