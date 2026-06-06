import { getServiceClient } from "@/lib/supabase/client";
import { logger } from "@/lib/utils/logger";

// Glook `scans` table schema (shared Supabase, read-only from IntentLead)
// results is JSONB containing ScanResult — businessContext lives inside it
interface GlookBusinessContext {
  detectedService: string | null;
  targetAudience: string | null;
  businessProfile: string | null;
  icpHint?: string | null;
  monetizationModel?: string | null;
}

interface GlookScanResults {
  businessContext?: GlookBusinessContext | null;
  aiSummary?: string | null;
  topPriorities?: string[] | null;
}

export interface GlookScanContext {
  scanId: string;
  url: string;
  detectedService: string | null;
  targetAudience: string | null;
  businessProfile: string | null;
  aiSummary: string | null;
  topPriorities: string[];
}

export async function getGlookContext(scanId: string): Promise<GlookScanContext | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("scans")
    .select("id, url, results")
    .eq("id", scanId)
    .single();

  if (error || !data) {
    logger.warn({ scanId }, "Glook scan not found");
    return null;
  }

  const results = data.results as GlookScanResults | null;
  const biz = results?.businessContext ?? null;

  return {
    scanId: data.id,
    url: data.url,
    detectedService: biz?.detectedService ?? null,
    targetAudience: biz?.targetAudience ?? null,
    businessProfile: biz?.businessProfile ?? null,
    aiSummary: results?.aiSummary ?? null,
    topPriorities: results?.topPriorities ?? [],
  };
}

export function buildWarmContext(scan: GlookScanContext): string {
  const parts: string[] = [];
  if (scan.url) parts.push(`Website: ${scan.url}`);
  if (scan.detectedService) parts.push(`What they sell: ${scan.detectedService}`);
  if (scan.targetAudience) parts.push(`Target audience: ${scan.targetAudience}`);
  if (scan.businessProfile) parts.push(`Business context: ${scan.businessProfile}`);
  if (scan.aiSummary) parts.push(`Site overview: ${scan.aiSummary}`);
  if (scan.topPriorities?.length) {
    parts.push(`Key improvement areas: ${scan.topPriorities.slice(0, 3).join(", ")}`);
  }
  return parts.join("\n");
}
