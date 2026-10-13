import { createHash } from "node:crypto";
import {
  ConversationalIntakeReviewSchema,
  conversationalClarificationFields,
  requiredConversationalIntakeFields,
  StructureConversationalIntakeInputSchema,
  StructureDiscoveryIntakePortResultSchema,
} from "@/lib/domain/schemas/conversational-intake";
import type {
  ConversationalIntakeReview,
  StructureDiscoveryIntakePort,
} from "@/types/conversational-intake";
import { ApplicationError } from "./errors";

const CLARIFICATION_TEMPLATES = {
  offer: "What do you sell, and which business outcome does it create?",
  target_company: "Which kinds of companies should qualify for this discovery?",
  market: "Which market or geography should this discovery cover?",
  target_buyer: "Which buyer roles should be considered relevant?",
  language: "Which languages should the discovery cover?",
  exclusions: "Which exclusions should be applied?",
  target_count: "How many confirmed signals should this discovery target (20 to 500)?",
} as const;

function fingerprint(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function structureConversationalIntake(
  rawInput: unknown,
  port: StructureDiscoveryIntakePort,
): Promise<ConversationalIntakeReview> {
  const input = StructureConversationalIntakeInputSchema.safeParse(rawInput);
  if (!input.success) throw new ApplicationError("INVALID_INPUT", "Invalid conversational intake request");

  let rawPortResult: unknown;
  try {
    rawPortResult = await port.structure(input.data);
  } catch (error) {
    throw new ApplicationError("CAPABILITY_UNAVAILABLE", "Conversational intake is unavailable", { cause: error });
  }
  const portResult = StructureDiscoveryIntakePortResultSchema.safeParse(rawPortResult);
  if (!portResult.success) {
    throw new ApplicationError("INTERNAL_ERROR", "Conversational intake returned an invalid result");
  }

  const missing = requiredConversationalIntakeFields(portResult.data.intake);
  const clarificationFields = conversationalClarificationFields(portResult.data.intake);
  if (JSON.stringify(portResult.data.intake.missingRequiredFields) !== JSON.stringify(missing)) {
    throw new ApplicationError("INTERNAL_ERROR", "Conversational intake contradicted its missing fields");
  }
  const review = ConversationalIntakeReviewSchema.safeParse({
    schemaVersion: 1,
    state: clarificationFields.length ? "NEEDS_CLARIFICATION" : "READY_FOR_REVIEW",
    requestFingerprint: fingerprint(input.data),
    userTurns: input.data.userTurns,
    intake: { ...portResult.data.intake, missingRequiredFields: missing },
    fieldSupports: portResult.data.fieldSupports,
    clarificationQuestions: clarificationFields.map(field => ({ field, question: CLARIFICATION_TEMPLATES[field] })),
    telemetry: portResult.data.telemetry,
    prompt: portResult.data.prompt,
  });
  if (!review.success) {
    throw new ApplicationError("INTERNAL_ERROR", "Conversational intake contained unsupported or contradictory values");
  }
  return review.data;
}
