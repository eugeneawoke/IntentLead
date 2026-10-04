// Temporary read-only adapter for the Glook scans table; ADR-002 replaces this with a versioned contract.
export interface GlookBusinessContext {
  detectedService: string | null;
  targetAudience: string | null;
  businessProfile: string | null;
  icpHint?: string | null;
  monetizationModel?: string | null;
}

export interface GlookScanResults {
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

export interface OwnedGlookInput {
  scanId: string;
  userId: string;
}
