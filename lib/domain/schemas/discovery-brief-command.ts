import { z } from "zod";
import { ConversationalIntakeReviewSchema } from "./conversational-intake";
import {
  DiscoveryCriteriaSchema,
  DiscoveryCriteriaV2Schema,
  IntakeExclusionMappingSchema,
  IntakeLanguageMappingSchema,
  IntakeMarketMappingSchema,
} from "./market-profile";

const NonEmptyText = z.string().trim().min(1).max(500);
const NameSchema = z.string().trim().min(1).max(120);

const OfferCreateSchema = z.object({
  name: NameSchema,
  summary: NonEmptyText,
  outcomes: z.array(NonEmptyText).max(20).default([]),
  exclusions: z.array(NonEmptyText).max(20).default([]),
}).strict();

const ICPCreateV1Schema = z.object({
  name: NameSchema,
  description: NonEmptyText,
  companyAttributes: z.array(NonEmptyText).max(30).default([]),
  exclusions: z.array(NonEmptyText).max(20).default([]),
}).strict();

const ICPCreateV2Schema = ICPCreateV1Schema.extend({
  targetBuyerDescription: NonEmptyText.nullable(),
}).strict();

export const CreateDiscoveryBriefInputSchema = z.object({
  schemaVersion: z.literal(1),
  offer: OfferCreateSchema,
  icp: ICPCreateV1Schema,
  objective: NonEmptyText,
  criteria: DiscoveryCriteriaSchema,
}).strict();

export const CreateDiscoveryBriefV2InputSchema = z.object({
  schemaVersion: z.literal(2),
  offer: OfferCreateSchema,
  icp: ICPCreateV2Schema,
  objective: NonEmptyText,
  criteria: DiscoveryCriteriaV2Schema,
}).strict();

export const CreateDiscoveryBriefCommandSchema = z.discriminatedUnion("schemaVersion", [
  CreateDiscoveryBriefInputSchema,
  CreateDiscoveryBriefV2InputSchema,
]);

export const PrepareApprovedDiscoveryBriefInputSchema = z.object({
  schemaVersion: z.literal(1),
  review: ConversationalIntakeReviewSchema,
  submittedReviewFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  humanApproved: z.literal(true),
  names: z.object({ offer: NameSchema, icp: NameSchema }).strict(),
  objective: NonEmptyText,
  companyAttributes: z.array(NonEmptyText).max(30),
  marketMappings: z.array(IntakeMarketMappingSchema).min(1).max(10),
  languageMappings: z.array(IntakeLanguageMappingSchema).max(10),
  exclusionMappings: z.array(IntakeExclusionMappingSchema).max(30),
  executionCriteria: z.object({
    jurisdictions: DiscoveryCriteriaV2Schema.shape.jurisdictions,
    languages: DiscoveryCriteriaV2Schema.shape.languages,
    signalFamilies: DiscoveryCriteriaV2Schema.shape.signalFamilies,
    requestedConfirmedSignals: DiscoveryCriteriaV2Schema.shape.requestedConfirmedSignals,
    limits: DiscoveryCriteriaV2Schema.shape.limits,
  }).strict(),
}).strict();
