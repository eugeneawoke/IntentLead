import { tool } from "ai";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/client";
import { logger } from "@/lib/utils/logger";

export const extractIntakeTool = (userId: string, workspaceId: string) =>
  tool({
    description: "Extract and save the campaign intake parameters gathered from the conversation. Call once when you have enough information.",
    parameters: z.object({
      what_selling: z.string().describe("What product or service the user sells"),
      icp: z.string().describe("Ideal customer profile: role, company size, industry"),
      pain: z.string().describe("The pain or problem the user's customers experience"),
      geo: z.string().optional().describe("Geographic focus"),
      keywords: z.array(z.string()).min(1).max(10).describe("3-5 search keywords for intent signals"),
      tone: z.string().optional().describe("Communication tone: professional, casual, direct, etc."),
      campaign_id: z.string().optional().describe("Existing campaign ID to update (omit to create new)"),
    }),
    execute: async (params) => {
      const supabase = getServiceClient();

      const payload = {
        workspace_id: workspaceId,
        entry_mode: "cold" as const,
        what_selling: params.what_selling,
        icp: params.icp,
        pain: params.pain,
        geo: params.geo ?? null,
        keywords: params.keywords,
        tone: params.tone ?? null,
        status: "draft" as const,
      };

      let campaignId: string;

      if (params.campaign_id) {
        // Update existing campaign
        const { data: updated, error } = await supabase
          .from("campaigns")
          .update(payload)
          .eq("id", params.campaign_id)
          .eq("workspace_id", workspaceId)  // ensure ownership
          .select("id")
          .single();

        if (error || !updated) {
          logger.error({ userId, campaignId: params.campaign_id, error: error?.message }, "Failed to update campaign intake");
          return { success: false, error: "Failed to update campaign" };
        }
        campaignId = updated.id;
      } else {
        // Insert new campaign
        const { data: created, error } = await supabase
          .from("campaigns")
          .insert(payload)
          .select("id")
          .single();

        if (error || !created) {
          logger.error({ userId, error: error?.message }, "Failed to create campaign intake");
          return { success: false, error: "Failed to create campaign" };
        }
        campaignId = created.id;
      }

      logger.info({ userId, campaignId }, "Campaign intake saved");
      return { success: true, campaignId };
    },
  });
