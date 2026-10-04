export const timestamp = "2026-10-04T10:00:00.000Z";
export const hash = "a".repeat(64);
export const jurisdiction = { countryCode: "US", subdivisionCode: null };
export const record = { schemaVersion: 1, id: "record-1", workspaceId: "workspace-1" };
export const provenance = {
  sourceType: "WEB", sourceId: "source-1", providerRunId: null, rawArtifactId: null,
};
export const signal = { family: "EXPRESSED_INTENT", subtype: "solution_search" };
export const sourceItem = {
  ...record, externalId: "external-1", sourceUrl: "https://example.com/post",
  capturedAt: timestamp, publishedAt: null, contentHash: hash,
  content: "We need a solution", structuredFacts: {}, provenance, jurisdiction,
};
export const evidence = {
  ...record, sourceItemId: "source-1", type: "text", sourceUrl: "https://example.com/post",
  capturedAt: timestamp, excerpt: "We need a solution", structuredFacts: {},
  verificationMethod: "source_capture", confidence: 0.9, contentHash: hash, provenance,
  jurisdiction,
};
export const assessment = {
  ...record, opportunityId: "opportunity-1", assessedAt: timestamp,
  modelRunId: "run-1", decision: "QUALIFY", signal, problemType: "operations",
  problemStatement: "The company describes manual work.", evidenceStrength: 0.9,
  explicitness: 0.8, urgency: 0.5, freshness: 1, commercialImpact: 0.7, icpFit: 0.8,
  companyConfidence: 0.9, buyerRelevance: 0.4, actionability: 0.6, confidence: 0.8,
  evidenceIds: ["evidence-1"], rejectionReasons: [],
};
export const opportunity = {
  ...record, discoveryBriefId: "brief-1", companyId: "company-1",
  marketProfileId: "EN_DISCOVERY_ONLY", jurisdiction, signal,
  state: "HUMAN_REVIEW", evidenceIds: ["evidence-1"], assessmentId: "assessment-1",
  createdAt: timestamp, updatedAt: timestamp,
};
export const restrictedCapabilities = [
  "PEOPLE_SEARCH", "CONTACT_ENRICHMENT", "EMAIL_FIND", "EMAIL_VERIFY",
  "DRAFT_GENERATION", "OUTREACH_READY", "OUTREACH_SEND", "OUTCOME_RECORDING", "PACKAGE_VERIFIED",
];
export const marketProfile = {
  ...record, id: "EN_DISCOVERY_ONLY", workflow: "DISCOVERY_ONLY", jurisdictions: [],
  regions: [], languages: ["en"], capabilities: ["SOURCE_SEARCH", "HUMAN_REVIEW"],
  disabledCapabilities: restrictedCapabilities, legalPolicyId: "research-policy-1",
  retentionPolicyId: "retention-1", outreachPolicyId: null, outreachChannels: [],
  defaultCurrency: "USD", timezone: "Europe/Minsk",
};
export const discoveryBrief = {
  ...record, offerProfileId: "offer-1", icpDefinitionId: "icp-1",
  marketProfileId: "EN_DISCOVERY_ONLY", objective: "Find observable operational pain",
  jurisdictions: [], languages: ["en"], signalFamilies: ["EXPRESSED_INTENT"],
  exclusions: ["Student projects"], limits: { maxSourceItems: 100, maxOpportunities: 20 },
  createdAt: timestamp,
};
export const person = {
  ...record, fullName: "Sample Person", companyId: "company-1", role: "Operations lead",
  jurisdiction, evidenceIds: ["evidence-1"], confidence: 0.9, resolvedAt: timestamp,
};
export const buyer = {
  ...record, opportunityId: "opportunity-1", companyId: "company-1", personId: null,
  role: "Operations lead", hypothesis: "This role may own the manual process.",
  evidenceIds: ["evidence-1"], confidence: 0.6, relevance: 0.8, createdAt: timestamp,
};
export const contact = {
  ...record, personId: "person-1", companyId: "company-1", channel: "email",
  value: "sample@example.com", jurisdiction, evidenceIds: ["evidence-1"],
  capturedAt: timestamp, latestVerificationId: null,
};
export const contactVerification = {
  ...record, contactPointId: "contact-1", status: "VALID", checkedAt: timestamp,
  expiresAt: "2026-11-04T10:00:00Z", verificationMethod: "mailbox_verification",
  confidence: 0.9, evidenceIds: ["evidence-1"],
};
export const review = {
  ...record, opportunityId: "opportunity-1", reviewerId: "user-1", reviewedAt: timestamp,
  decision: "ACCEPTED", reason: "RELEVANT", note: null,
};
export const outcome = {
  ...record, opportunityId: "opportunity-1", recordedBy: "user-1",
  occurredAt: timestamp, marketProfileId: "LOCAL_CUSTOM", type: "CONTACTED",
  contactPointId: "contact-1", channel: "email",
};
export const suppression = {
  ...record, identifierType: "EMAIL", identifierHash: hash, reason: "OPT_OUT",
  policyId: "suppression-1", createdAt: timestamp, retainUntil: null,
};
export const artifact = {
  ...record, sourceItemId: "source-1", contentHash: hash, storageReference: "objects/evidence-1",
  mediaType: "image/png", sizeBytes: 200, access: "WORKSPACE_PRIVATE",
  retentionPolicyId: "retention-1", createdAt: timestamp, expiresAt: null,
};
export const capabilityError = {
  schemaVersion: 1, code: "TIMEOUT", retryable: true, message: "Capability timed out",
  capability: "SOURCE_SEARCH", traceId: "trace-1", retryAfterMs: null,
};
export const job = {
  ...record, capability: "SOURCE_SEARCH", marketProfileId: "EN_DISCOVERY_ONLY",
  discoveryBriefId: "brief-1", idempotencyKey: "search-1", traceId: "trace-1",
  attempt: 0, maxAttempts: 3, createdAt: timestamp, updatedAt: timestamp, state: "QUEUED",
};
export const verificationPolicy = {
  ...record, version: 1, marketProfileId: "EN_DISCOVERY_ONLY", workflow: "DISCOVERY_ONLY",
  jurisdictions: [], packageVerifiedAllowed: false,
  checks: {
    evidence: { minItems: 1, minStrength: 0.8, maxAgeDays: 30 },
    company: { minConfidence: 0.9 }, buyer: { minConfidence: 0.7, minRelevance: 0.8 },
    contact: { acceptedStatuses: ["VALID"], maxAgeDays: 7 },
    groundedDraft: { requireEvidenceForEveryClaim: true },
    suppression: { mustBeClear: true },
    marketWorkflow: { requireEnabledCapabilities: ["PACKAGE_VERIFIED", "CONTACT_ENRICHMENT", "EMAIL_VERIFY", "DRAFT_GENERATION", "OUTREACH_READY"] },
  },
};
export const passedCheck = { status: "PASS", reason: "Requirement satisfied", referenceIds: ["record-1"] };
export const verificationResult = {
  ...record, policyId: "policy-1", policyVersion: 1, packageId: "package-1",
  opportunityId: "opportunity-1", marketProfileId: "LOCAL_CUSTOM", workflow: "ASSISTED_OUTREACH",
  evaluatedAt: timestamp, status: "PASSED",
  checks: {
    evidence: passedCheck, company: passedCheck, buyer: passedCheck, contact: passedCheck,
    groundedDraft: passedCheck, suppression: passedCheck, marketWorkflow: passedCheck,
  },
};
