import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/client";
import { ApplicationError } from "./errors";
import type { ApplicationContext } from "./context";

export const StartOpportunitySearchInputSchema = z.object({
  schemaVersion: z.literal(1),
  discoveryBriefId: z.string().trim().min(1).max(100),
  idempotencyKey: z.string().trim().min(1).max(200).regex(/^[\w.:-]+$/),
}).strict();

export type StartOpportunitySearchInput = z.infer<typeof StartOpportunitySearchInputSchema>;

export interface EnqueueDiscoveryJobInput {
  discoveryBriefId: string;
  userId: string;
  idempotencyKey: string;
  payload: Record<string, never>;
}

export interface StartOpportunitySearchDependencies {
  enqueueDiscoveryJob(input: EnqueueDiscoveryJobInput): Promise<string>;
}

async function enqueueThroughRpc(input: EnqueueDiscoveryJobInput): Promise<string> {
  const client = getServiceClient();
  const { data, error } = await client.rpc("intentlead_enqueue_discovery_job", {
    p_discovery_brief_id: input.discoveryBriefId,
    p_user_id: input.userId,
    p_idempotency_key: input.idempotencyKey,
    p_payload: input.payload,
  });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("enqueue returned no job id");
  return data;
}

function mapEnqueueError(error: unknown): ApplicationError {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("idempotency_conflict")) return new ApplicationError("CONFLICT", "Idempotency key was already used for a different request");
  if (message.includes("brief_transition_denied")) {
    return new ApplicationError("CONFLICT", "DiscoveryBrief is not ready to run");
  }
  if (message.includes("forbidden")) return new ApplicationError("NOT_FOUND", "DiscoveryBrief not found");
  if (message.includes("invalid_enqueue_input")) return new ApplicationError("INVALID_INPUT", "Invalid discovery request");
  return new ApplicationError("INTERNAL_ERROR", "Could not accept discovery job", { cause: error });
}

export async function startOpportunitySearch(
  context: ApplicationContext,
  rawInput: unknown,
  dependencies: StartOpportunitySearchDependencies = { enqueueDiscoveryJob: enqueueThroughRpc },
): Promise<{ jobId: string }> {
  if (context.marketProfile.id !== "EN_DISCOVERY_ONLY" || context.marketProfile.workflow !== "DISCOVERY_ONLY") {
    throw new ApplicationError("POLICY_DENIED", "Only EN_DISCOVERY_ONLY discovery is enabled for this milestone");
  }
  const parsed = StartOpportunitySearchInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new ApplicationError("INVALID_INPUT", "Invalid discovery request");
  if (parsed.data.discoveryBriefId !== context.discoveryBriefId) {
    throw new ApplicationError("NOT_FOUND", "DiscoveryBrief not found");
  }
  if (!context.permissions.has("SOURCE_SEARCH") || !context.marketProfile.capabilities.includes("SOURCE_SEARCH")) {
    throw new ApplicationError("POLICY_DENIED", "MarketProfile does not permit source discovery");
  }
  try {
    const jobId = await dependencies.enqueueDiscoveryJob({
      discoveryBriefId: context.discoveryBriefId,
      userId: context.authenticatedUserId,
      idempotencyKey: parsed.data.idempotencyKey,
      payload: {},
    });
    return { jobId };
  } catch (error) {
    throw mapEnqueueError(error);
  }
}
