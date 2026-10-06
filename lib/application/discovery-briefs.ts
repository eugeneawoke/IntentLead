import { z } from "zod";
import type { ApplicationSupabaseClient } from "./context";
import { ApplicationError } from "./errors";
import type { DiscoveryBriefSummary } from "@/types/discovery-brief";
import { DiscoveryBriefSummarySchema, DiscoveryCriteriaSchema } from "@/lib/domain/schemas/market-profile";

const NonEmptyText = z.string().trim().min(1).max(500);

export const CreateDiscoveryBriefInputSchema = z.object({
  schemaVersion: z.literal(1),
  offer: z.object({
    name: z.string().trim().min(1).max(120),
    summary: NonEmptyText,
    outcomes: z.array(NonEmptyText).max(20).default([]),
    exclusions: z.array(NonEmptyText).max(20).default([]),
  }).strict(),
  icp: z.object({
    name: z.string().trim().min(1).max(120),
    description: NonEmptyText,
    companyAttributes: z.array(NonEmptyText).max(30).default([]),
    exclusions: z.array(NonEmptyText).max(20).default([]),
  }).strict(),
  objective: z.string().trim().min(1).max(500),
  criteria: DiscoveryCriteriaSchema,
}).strict();

export type CreateDiscoveryBriefInput = z.infer<typeof CreateDiscoveryBriefInputSchema>;

export interface CreatedDiscoveryBrief {
  discoveryBriefId: string;
  workspaceId: string;
  offerProfileId: string;
  icpDefinitionId: string;
  marketProfileId: string;
  created: boolean;
}

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ApplicationError("INTERNAL_ERROR", "DiscoveryBrief command returned an invalid result");
  }
  return value;
}

export async function createDiscoveryBrief(
  client: ApplicationSupabaseClient,
  rawInput: unknown,
  idempotencyKey: string,
): Promise<CreatedDiscoveryBrief> {
  const parsed = CreateDiscoveryBriefInputSchema.safeParse(rawInput);
  if (!parsed.success || !/^[A-Za-z0-9._:-]{12,128}$/.test(idempotencyKey)) {
    throw new ApplicationError("INVALID_INPUT", "Invalid DiscoveryBrief request");
  }
  const { data, error } = await client.rpc("intentlead_create_discovery_brief", {
    p_command: parsed.data,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("idempotency_conflict")) {
      throw new ApplicationError("CONFLICT", "Idempotency key was already used for a different request");
    }
    if (message.includes("authentication_required")) throw new ApplicationError("FORBIDDEN", "Authentication required");
    if (message.includes("invalid_discovery_command")) throw new ApplicationError("INVALID_INPUT", "Invalid DiscoveryBrief request");
    throw new ApplicationError("INTERNAL_ERROR", "Could not create DiscoveryBrief", { cause: error });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ApplicationError("INTERNAL_ERROR", "DiscoveryBrief command returned no result");
  }
  const row = data as Record<string, unknown>;
  return {
    discoveryBriefId: requiredString(row, "discoveryBriefId"),
    workspaceId: requiredString(row, "workspaceId"),
    offerProfileId: requiredString(row, "offerProfileId"),
    icpDefinitionId: requiredString(row, "icpDefinitionId"),
    marketProfileId: requiredString(row, "marketProfileId"),
    created: row.created === true,
  };
}

export async function listDiscoveryBriefs(client: ApplicationSupabaseClient): Promise<DiscoveryBriefSummary[]> {
  const { data, error } = await client.rpc("intentlead_list_discovery_briefs", {});
  if (error) throw new ApplicationError("INTERNAL_ERROR", "Could not list DiscoveryBriefs", { cause: error });
  if (!Array.isArray(data)) throw new ApplicationError("INTERNAL_ERROR", "DiscoveryBrief list is invalid");
  const parsed = z.array(DiscoveryBriefSummarySchema).safeParse(data);
  if (!parsed.success) throw new ApplicationError("INTERNAL_ERROR", "DiscoveryBrief list is invalid");
  return parsed.data;
}
