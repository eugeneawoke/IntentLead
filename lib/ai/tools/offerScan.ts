import { tool } from "ai";
import { z } from "zod";

export const offerScanTool = () =>
  tool({
    description: "Offer to scan the user's website for additional business context using Glook",
    parameters: z.object({
      website_url: z.string().url().describe("The website URL to scan"),
    }),
    execute: async ({ website_url }) => {
      // In MVP: return the Glook scan URL for the user to follow
      // Actual scan trigger happens via /api/scan (V2)
      return {
        success: true,
        message: `Great! To enhance your campaign with website context, visit: ${process.env.NEXT_PUBLIC_APP_URL}/api/scan?url=${encodeURIComponent(website_url)}`,
        scanUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/scan?url=${encodeURIComponent(website_url)}`,
      };
    },
  });
