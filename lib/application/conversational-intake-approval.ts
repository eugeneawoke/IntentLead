import { createHash } from "node:crypto";
import { z } from "zod";
import {
  CreateDiscoveryBriefV2InputSchema,
  PrepareApprovedDiscoveryBriefInputSchema,
} from "@/lib/domain/schemas/discovery-brief-command";
import { ConversationalIntakeReviewSchema } from "@/lib/domain/schemas/conversational-intake";
import type { CreatedDiscoveryBrief, PreparedDiscoveryBrief } from "@/types/discovery-brief";
import type { ApplicationSupabaseClient } from "./context";
import { ApplicationError } from "./errors";

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function exact(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function fingerprintConversationalIntakeReview(rawReview: unknown): string {
  const review = ConversationalIntakeReviewSchema.safeParse(rawReview);
  if (!review.success) throw new ApplicationError("INVALID_INPUT", "Invalid conversational intake review");
  return sha256(review.data);
}

export function prepareApprovedDiscoveryBrief(rawInput: unknown): PreparedDiscoveryBrief {
  const input = PrepareApprovedDiscoveryBriefInputSchema.safeParse(rawInput);
  if (!input.success) throw new ApplicationError("INVALID_INPUT", "Invalid DiscoveryBrief approval");
  const { review } = input.data;
  if (review.state !== "READY_FOR_REVIEW") {
    throw new ApplicationError("INVALID_INPUT", "Conversational intake still requires clarification");
  }

  const reviewFingerprint = fingerprintConversationalIntakeReview(review);
  if (input.data.submittedReviewFingerprint !== reviewFingerprint) {
    throw new ApplicationError("INVALID_INPUT", "Conversational intake approval is stale");
  }

  const marketIntent = input.data.marketMappings.map(item => item.marketIntent);
  const statedLanguages = input.data.languageMappings.filter(item => item.source === "USER_STATED");
  const languageIntent = statedLanguages.map(item => item.languageIntent);
  const exclusionIntent = input.data.exclusionMappings.map(item => item.exclusion);
  if (!exact(marketIntent, review.intake.markets)
    || !exact(languageIntent, review.intake.languages)
    || !exact(exclusionIntent, review.intake.exclusions)) {
    throw new ApplicationError("INVALID_INPUT", "Every market, language and exclusion requires an exact mapping");
  }

  const mappedJurisdictions = input.data.marketMappings.flatMap(item => item.jurisdictions);
  const mappedLanguages = input.data.languageMappings.map(item => item.language);
  if (!exact(mappedJurisdictions, input.data.executionCriteria.jurisdictions)) {
    throw new ApplicationError("INVALID_INPUT", "Normalized jurisdictions contradict the market mapping");
  }
  if (!exact(mappedLanguages, input.data.executionCriteria.languages)
    || new Set(mappedLanguages).size !== mappedLanguages.length) {
    throw new ApplicationError("INVALID_INPUT", "Normalized languages contradict the language mapping");
  }
  if (review.intake.requestedConfirmedSignals !== null
    && review.intake.requestedConfirmedSignals !== input.data.executionCriteria.requestedConfirmedSignals) {
    throw new ApplicationError("INVALID_INPUT", "Requested confirmed signals contradict the approved intake");
  }

  const exclusions = (destination: "OFFER" | "ICP" | "DISCOVERY") => input.data.exclusionMappings
    .filter(item => item.destination === destination)
    .map(item => item.exclusion);
  const command = CreateDiscoveryBriefV2InputSchema.safeParse({
    schemaVersion: 2,
    offer: {
      name: input.data.names.offer,
      summary: review.intake.offerSummary,
      outcomes: review.intake.desiredOutcomes,
      exclusions: exclusions("OFFER"),
    },
    icp: {
      name: input.data.names.icp,
      description: review.intake.targetCompanyDescription,
      targetBuyerDescription: review.intake.targetBuyerDescription,
      companyAttributes: input.data.companyAttributes,
      exclusions: exclusions("ICP"),
    },
    objective: input.data.objective,
    criteria: {
      schemaVersion: 2,
      jurisdictions: input.data.executionCriteria.jurisdictions,
      marketIntent: review.intake.markets,
      languages: input.data.executionCriteria.languages,
      signalFamilies: input.data.executionCriteria.signalFamilies,
      exclusions: exclusions("DISCOVERY"),
      requestedConfirmedSignals: input.data.executionCriteria.requestedConfirmedSignals,
      limits: input.data.executionCriteria.limits,
      intakeApproval: {
        reviewFingerprint,
        requestFingerprint: review.requestFingerprint,
        humanApproved: true,
        prompt: review.prompt,
        telemetry: review.telemetry,
        marketMappings: input.data.marketMappings,
        languageMappings: input.data.languageMappings,
        exclusionMappings: input.data.exclusionMappings,
      },
    },
  });
  if (!command.success) throw new ApplicationError("INVALID_INPUT", "Approved intake cannot form a DiscoveryBrief");

  return { command: command.data, idempotencyKey: `intake-v2:${sha256(command.data)}` };
}

const UserIdSchema = z.string().uuid();

export async function createApprovedDiscoveryBrief(
  serviceClient: ApplicationSupabaseClient,
  authenticatedUserId: string,
  rawApproval: unknown,
): Promise<CreatedDiscoveryBrief> {
  const userId = UserIdSchema.safeParse(authenticatedUserId);
  if (!userId.success) throw new ApplicationError("INVALID_INPUT", "Authenticated user id is invalid");
  const prepared = prepareApprovedDiscoveryBrief(rawApproval);
  const { data, error } = await serviceClient.rpc("intentlead_create_approved_discovery_brief", {
    p_user_id: userId.data,
    p_command: prepared.command,
    p_idempotency_key: prepared.idempotencyKey,
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("idempotency_conflict")) {
      throw new ApplicationError("CONFLICT", "Idempotency key was already used for a different approval");
    }
    if (message.includes("invalid_approved_discovery_command")) {
      throw new ApplicationError("INVALID_INPUT", "Invalid approved DiscoveryBrief request");
    }
    if (message.includes("forbidden") || message.includes("permission denied")) {
      throw new ApplicationError("FORBIDDEN", "Approved creation is forbidden");
    }
    throw new ApplicationError("INTERNAL_ERROR", "Could not create approved DiscoveryBrief", { cause: error });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ApplicationError("INTERNAL_ERROR", "Approved DiscoveryBrief command returned no result");
  }
  const row = data as Record<string, unknown>;
  const required = (key: string) => {
    const value = row[key];
    if (typeof value !== "string" || value.length === 0) {
      throw new ApplicationError("INTERNAL_ERROR", "Approved DiscoveryBrief command returned an invalid result");
    }
    return value;
  };
  return {
    discoveryBriefId: required("discoveryBriefId"), workspaceId: required("workspaceId"),
    offerProfileId: required("offerProfileId"), icpDefinitionId: required("icpDefinitionId"),
    marketProfileId: required("marketProfileId"), created: row.created === true,
  };
}
