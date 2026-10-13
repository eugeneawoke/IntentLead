import { z } from "zod";
import { StructuredDiscoveryIntakeSchema } from "./model-provider";

const TurnIdSchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9._:-]+$/);
const TurnContentSchema = z.string().min(1).max(2_000).regex(/\S/, "Expected a non-blank user turn");

export const ConversationalUserTurnSchema = z.object({
  id: TurnIdSchema,
  content: TurnContentSchema,
}).strict();

export const ConversationalUserTurnsSchema = z.array(ConversationalUserTurnSchema).min(1).max(8)
  .superRefine((turns, ctx) => {
    if (new Set(turns.map(turn => turn.id)).size !== turns.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "User turn ids must be unique" });
    }
    if (turns.reduce((total, turn) => total + turn.content.length, 0) > 8_000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "User turn content exceeds the total bound" });
    }
  });

export const StructureConversationalIntakeInputSchema = z.object({
  schemaVersion: z.literal(1),
  userTurns: ConversationalUserTurnsSchema,
}).strict();

export const IntakeMaterialFieldSchema = z.enum([
  "offerSummary",
  "desiredOutcomes",
  "targetCompanyDescription",
  "targetBuyerDescription",
  "markets",
  "languages",
  "exclusions",
  "requestedConfirmedSignals",
  "assumptionsForReview",
  "ambiguitiesForClarification",
]);

export const IntakeFieldSupportSchema = z.object({
  field: IntakeMaterialFieldSchema,
  value: z.union([
    z.string().min(1).max(2_000).regex(/\S/, "Expected a non-blank supported value"),
    z.number().int().min(20).max(500),
  ]),
  turnId: TurnIdSchema,
  quote: z.string().min(1).max(2_000).regex(/\S/, "Expected a non-blank support quote"),
}).strict();

export const ModelRunTelemetrySchema = z.object({
  model: z.string().min(1).max(200).regex(/\S/),
  modelVersion: z.string().min(1).max(100).regex(/\S/),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  cost: z.object({
    amount: z.number().finite().nonnegative(),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }).strict(),
  limitations: z.array(z.string().min(1).max(500).regex(/\S/)).max(20),
}).strict();

export const IntakePromptMetadataSchema = z.object({
  templateId: z.string().min(1).max(100).regex(/\S/),
  version: z.string().min(1).max(100).regex(/\S/),
  systemInstructionHash: z.string().regex(/^[a-f0-9]{64}$/),
  userContentRole: z.literal("UNTRUSTED_USER"),
}).strict();

export const StructureDiscoveryIntakePortResultSchema = z.object({
  schemaVersion: z.literal(1),
  intake: StructuredDiscoveryIntakeSchema,
  fieldSupports: z.array(IntakeFieldSupportSchema).max(100),
  telemetry: ModelRunTelemetrySchema,
  prompt: IntakePromptMetadataSchema,
}).strict();

export const ConversationalIntakeStateSchema = z.enum(["NEEDS_CLARIFICATION", "READY_FOR_REVIEW"]);
export const ClarificationFieldSchema = z.enum([
  "offer", "target_company", "target_buyer", "market", "language", "exclusions", "target_count",
]);
export const ClarificationQuestionSchema = z.object({
  field: ClarificationFieldSchema,
  question: z.string().min(1).max(500).regex(/\S/),
}).strict();

export interface IntakeMaterialValue {
  field: z.infer<typeof IntakeMaterialFieldSchema>;
  value: string | number;
}

export function conversationalIntakeMaterialValues(
  intake: z.infer<typeof StructuredDiscoveryIntakeSchema>,
): IntakeMaterialValue[] {
  const values: IntakeMaterialValue[] = [];
  const add = (field: IntakeMaterialValue["field"], value: string | number | null) => {
    if (value !== null) values.push({ field, value });
  };
  add("offerSummary", intake.offerSummary);
  intake.desiredOutcomes.forEach(value => add("desiredOutcomes", value));
  add("targetCompanyDescription", intake.targetCompanyDescription);
  add("targetBuyerDescription", intake.targetBuyerDescription);
  intake.markets.forEach(value => add("markets", value));
  intake.languages.forEach(value => add("languages", value));
  intake.exclusions.forEach(value => add("exclusions", value));
  add("requestedConfirmedSignals", intake.requestedConfirmedSignals);
  intake.assumptionsForReview.forEach(value => add("assumptionsForReview", value));
  intake.ambiguitiesForClarification.forEach(value => add("ambiguitiesForClarification", value.description));
  return values;
}

export function requiredConversationalIntakeFields(
  intake: z.infer<typeof StructuredDiscoveryIntakeSchema>,
): Array<z.infer<typeof ClarificationFieldSchema>> {
  const missing: Array<z.infer<typeof ClarificationFieldSchema>> = [];
  if (intake.offerSummary === null) missing.push("offer");
  if (intake.targetCompanyDescription === null) missing.push("target_company");
  if (intake.markets.length === 0) missing.push("market");
  return missing;
}

export function conversationalClarificationFields(
  intake: z.infer<typeof StructuredDiscoveryIntakeSchema>,
): Array<z.infer<typeof ClarificationFieldSchema>> {
  return [
    ...requiredConversationalIntakeFields(intake),
    ...intake.ambiguitiesForClarification.map(item => item.field),
  ].filter((field, index, fields) => fields.indexOf(field) === index).slice(0, 3);
}

function supportKey(field: string, value: string | number): string {
  return `${field}\u0000${typeof value}\u0000${String(value)}`;
}

function quoteSupportsValue(quote: string, value: string | number): boolean {
  const normalizedQuote = quote.toLocaleLowerCase();
  const normalizedValue = String(value).toLocaleLowerCase();
  const escaped = normalizedValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(normalizedQuote);
}

export const ConversationalIntakeReviewSchema = z.object({
  schemaVersion: z.literal(1),
  state: ConversationalIntakeStateSchema,
  requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  userTurns: ConversationalUserTurnsSchema,
  intake: StructuredDiscoveryIntakeSchema,
  fieldSupports: z.array(IntakeFieldSupportSchema).max(100),
  clarificationQuestions: z.array(ClarificationQuestionSchema).max(3),
  telemetry: ModelRunTelemetrySchema,
  prompt: IntakePromptMetadataSchema,
}).strict().superRefine((review, ctx) => {
  const missing = requiredConversationalIntakeFields(review.intake);
  const clarificationFields = conversationalClarificationFields(review.intake);
  const expectedState = clarificationFields.length ? "NEEDS_CLARIFICATION" : "READY_FOR_REVIEW";
  if (review.state !== expectedState) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["state"], message: "Review state contradicts required fields" });
  }
  if (JSON.stringify(review.intake.missingRequiredFields) !== JSON.stringify(missing)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["intake", "missingRequiredFields"], message: "Missing fields are inconsistent" });
  }
  if (JSON.stringify(review.clarificationQuestions.map(item => item.field)) !== JSON.stringify(clarificationFields)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["clarificationQuestions"], message: "Clarifications do not match missing fields" });
  }

  const turns = new Map(review.userTurns.map(turn => [turn.id, turn.content]));
  const materials = conversationalIntakeMaterialValues(review.intake);
  const materialKeys = materials.map(item => supportKey(item.field, item.value));
  if (new Set(materialKeys).size !== materialKeys.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["intake"], message: "Material intake values must be unique per field" });
  }
  const supportKeys = review.fieldSupports.map(item => supportKey(item.field, item.value));
  if (new Set(supportKeys).size !== supportKeys.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fieldSupports"], message: "Field supports must be unique per material value" });
  }
  const expected = new Set(materialKeys);
  for (const [index, support] of review.fieldSupports.entries()) {
    if (!expected.has(supportKey(support.field, support.value))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fieldSupports", index], message: "Support contradicts the structured intake" });
    }
    if (!turns.get(support.turnId)?.includes(support.quote)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fieldSupports", index, "quote"], message: "Support quote is absent from its user turn" });
    }
    if (support.field !== "assumptionsForReview") {
      if (!quoteSupportsValue(support.quote, support.value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fieldSupports", index, "quote"], message: "Support quote does not substantiate its material value" });
      }
    }
  }
  if (supportKeys.length !== materialKeys.length || supportKeys.some(key => !expected.has(key))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fieldSupports"], message: "Every material value requires exact support" });
  }
});
