import { tool } from "ai";
import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/client";
import { logger } from "@/lib/utils/logger";

export const extractIntakeTool = (userId: string, workspaceId: string) =>
  tool({
    description: "Extract and save the campaign intake parameters gathered from the conversation",
    parameters: z.object({
      what_selling: z.string().describe("What product or service the user sells"),
      icp: z.string().describe("Ideal customer profile: role, company size, industry"),
      pain: z.string().describe("The pain or problem the user's customers experience"),
      geo: z.string().optional().describe("Geographic focus"),
      keywords: z.array(z.string()).min(1).max(10).describe("3-5 search keywords for intent signals"),
      tone: z.string().optional().describe("Communication tone: professional, casual, direct, etc."),
    }),
    execute: async (params) => {
      const supabase = getServiceClient();
      const { data: campaign, error } = await supabase
        .from("campaigns")
        .upsert({
          workspace_id: workspaceId,
          entry_mode: "cold",
          what_selling: params.what_selling,
          icp: params.icp,
          pain: params.pain,
          geo: params.geo ?? null,
          keywords: params.keywords,
          tone: params.tone ?? null,
          status: "draft",
        })
        .select()
        .single();

      if (error) {
        logger.error({ userId, error: error.message }, "Failed to save campaign intake");
        return { success: false, error: "Failed to save campaign" };
      }

      logger.info({ userId, campaignId: campaign.id }, "Campaign intake saved");
      return { success: true, campaignId: campaign.id };
    },
  });
