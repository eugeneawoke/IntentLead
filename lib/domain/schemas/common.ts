import { z } from "zod";

// Validation must not rewrite captured content whose hash/provenance is already stored.
export const NonEmptyStringSchema = z.string().min(1).regex(/\S/, "Expected non-blank text");
export const IdSchema = NonEmptyStringSchema;
export const TimestampSchema = z.string().datetime({ offset: true })
  .refine(value => Number.isFinite(Date.parse(value)), "Invalid timestamp or UTC offset");
export const ConfidenceSchema = z.number().finite().min(0).max(1);
export const ContentHashSchema = z.string().regex(/^[a-f0-9]{64}$/i);
export const EvidenceIdsSchema = z.array(IdSchema).nonempty();
export const HttpUrlSchema = z.string().url().refine(value => /^https?:\/\//i.test(value), "Expected an HTTP(S) URL");
export const JurisdictionSchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  subdivisionCode: NonEmptyStringSchema.nullable(),
}).strict();

// Parsing scope is not authorization: application services derive workspace membership.
export const ScopedRecordShape = {
  schemaVersion: z.literal(1), id: IdSchema, workspaceId: IdSchema,
};

export const MarketProfileIdSchema = z.enum(["EN_DISCOVERY_ONLY", "CIS_RU", "LOCAL_CUSTOM"]);
export const WorkflowSchema = z.enum(["DISCOVERY_ONLY", "ASSISTED_OUTREACH"]);
export const ChannelSchema = z.enum(["email", "profile", "phone"]);
export const CapabilitySchema = z.enum([
  "SOURCE_SEARCH", "WEB_FETCH", "COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT", "HUMAN_REVIEW",
  "PEOPLE_SEARCH", "CONTACT_ENRICHMENT", "EMAIL_FIND", "EMAIL_VERIFY", "DRAFT_GENERATION",
  "OUTREACH_READY", "OUTREACH_SEND", "OUTCOME_RECORDING", "PACKAGE_VERIFIED",
]);
export const DiscoveryCapabilitySchema = CapabilitySchema.extract([
  "SOURCE_SEARCH", "WEB_FETCH", "COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT", "HUMAN_REVIEW",
]);
export const RestrictedCapabilitySchema = CapabilitySchema.exclude(DiscoveryCapabilitySchema.options);
export const SignalFamilySchema = z.enum([
  "EXPRESSED_INTENT", "TRIGGER_EVENT", "DETECTED_PROBLEM", "VISIBILITY_FINDING",
]);
