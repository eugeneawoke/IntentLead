import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/client";
import type { ApplicationContext } from "./context";
import { ApplicationError } from "./errors";

export const DeleteDiscoveryBriefInputSchema = z.object({
  schemaVersion: z.literal(1),
  discoveryBriefId: z.string().trim().min(1).max(100),
}).strict();

export interface DeleteDiscoveryBriefDependencies {
  deleteBrief(input: { discoveryBriefId: string; userId: string; reason: string }): Promise<boolean>;
}

async function deleteThroughRpc(input: { discoveryBriefId: string; userId: string; reason: string }): Promise<boolean> {
  const { data, error } = await getServiceClient().rpc("intentlead_delete_discovery_brief", {
    p_discovery_brief_id: input.discoveryBriefId,
    p_user_id: input.userId,
    p_reason: input.reason,
  });
  if (error) throw error;
  return data === true;
}

export async function deleteDiscoveryBrief(
  context: ApplicationContext,
  rawInput: unknown,
  dependencies: DeleteDiscoveryBriefDependencies = { deleteBrief: deleteThroughRpc },
): Promise<{ deleted: true }> {
  const parsed = DeleteDiscoveryBriefInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new ApplicationError("INVALID_INPUT", "Invalid deletion request");
  if (parsed.data.discoveryBriefId !== context.discoveryBriefId) {
    throw new ApplicationError("NOT_FOUND", "DiscoveryBrief not found");
  }
  if (context.workspace.role !== "OWNER") throw new ApplicationError("FORBIDDEN", "Only the workspace owner may delete discovery data");
  try {
    const accepted = await dependencies.deleteBrief({
      discoveryBriefId: context.discoveryBriefId,
      userId: context.authenticatedUserId,
      reason: "owner_requested",
    });
    if (!accepted) throw new ApplicationError("CONFLICT", "Discovery data could not be deleted");
    return { deleted: true };
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("forbidden")) throw new ApplicationError("NOT_FOUND", "DiscoveryBrief not found");
    if (message.includes("invalid_deletion_reason")) throw new ApplicationError("INVALID_INPUT", "Invalid deletion reason");
    throw new ApplicationError("INTERNAL_ERROR", "Could not delete discovery data", { cause: error });
  }
}
