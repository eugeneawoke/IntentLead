import { getServiceClient } from "@/lib/supabase/client";
import { logger } from "@/lib/utils/logger";

export interface GlookScanContext {
  scanId: string;
  url: string;
  pain_points: string | null;
  business_context: string | null;
}

export async function getGlookContext(scanId: string): Promise<GlookScanContext | null> {
  const supabase = getServiceClient();
  // TODO: verify Glook table name and field names in shared Supabase
  const { data, error } = await supabase
    .from("scans")
    .select("id, url, pain_points, business_context")
    .eq("id", scanId)
    .single();

  if (error || !data) {
    logger.warn({ scanId }, "Glook scan not found");
    return null;
  }

  return {
    scanId: data.id,
    url: data.url,
    pain_points: data.pain_points,
    business_context: data.business_context,
  };
}

export function buildWarmContext(scan: GlookScanContext): string {
  const parts: string[] = [];
  if (scan.url) parts.push(`Website: ${scan.url}`);
  if (scan.business_context) parts.push(`Business context: ${scan.business_context}`);
  if (scan.pain_points) parts.push(`Identified pain points: ${scan.pain_points}`);
  return parts.join("\n");
}
