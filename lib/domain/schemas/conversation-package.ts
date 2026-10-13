import { z } from "zod";
import {
  EvidenceIdsSchema,
  IdSchema,
  NonEmptyStringSchema,
  ScopedRecordShape,
  TimestampSchema,
} from "./common";

export const GroundedClaimSchema = z.object({
  id: IdSchema,
  text: NonEmptyStringSchema,
  evidenceIds: EvidenceIdsSchema,
}).strict();

export const GroundedDraftClaimSchema = GroundedClaimSchema.extend({
  target: z.enum(["SUBJECT", "BODY"]),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
}).strict().refine(claim => claim.endOffset > claim.startOffset, "Claim span must be non-empty");

export const ConversationBriefSchema = z.object({
  ...ScopedRecordShape,
  opportunityId: IdSchema,
  buyerCandidateId: IdSchema,
  contactPointId: IdSchema,
  contactVerificationId: IdSchema,
  problemSummary: NonEmptyStringSchema,
  relevanceSummary: NonEmptyStringSchema,
  recommendedAngle: NonEmptyStringSchema,
  lowFrictionCta: NonEmptyStringSchema,
  claims: z.array(GroundedClaimSchema).nonempty(),
  createdAt: TimestampSchema,
}).strict();

export const DraftSchema = z.object({
  ...ScopedRecordShape,
  opportunityId: IdSchema,
  conversationBriefId: IdSchema,
  version: z.number().int().positive(),
  channel: z.enum(["EMAIL", "LINKEDIN_DM", "GENERIC_MESSAGE"]),
  deliveryMode: z.literal("COPY_EXPORT_ONLY"),
  subject: NonEmptyStringSchema.nullable(),
  body: NonEmptyStringSchema,
  claims: z.array(GroundedDraftClaimSchema).nonempty(),
  status: z.enum(["DRAFT", "GROUNDED"]),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict().superRefine((draft, ctx) => {
  if (Date.parse(draft.updatedAt) < Date.parse(draft.createdAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["updatedAt"], message: "Draft update precedes creation" });
  }
  for (const [target, text] of [["BODY", draft.body], ["SUBJECT", draft.subject]] as const) {
    const claims = draft.claims.filter(claim => claim.target === target).sort((left, right) => left.startOffset - right.startOffset);
    if (text === null) {
      if (claims.length > 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["claims"], message: `${target} claims require target text` });
      continue;
    }
    let offset = 0;
    const textPoints = Array.from(text);
    for (const claim of claims) {
      if (claim.startOffset !== offset || claim.endOffset > textPoints.length
        || textPoints.slice(claim.startOffset, claim.endOffset).join("") !== claim.text) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["claims"], message: `${target} must be fully covered by exact grounded claim spans` });
        break;
      }
      offset = claim.endOffset;
    }
    if (offset !== textPoints.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["claims"], message: `${target} contains ungrounded text` });
    }
  }
});
