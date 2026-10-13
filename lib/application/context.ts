import { randomUUID } from "node:crypto";
import { MarketProfileSchema } from "@/lib/domain/schemas/market-profile";
import type { Capability, MarketProfile } from "@/types/market-profile";
import { ApplicationError } from "./errors";

type QueryResult<T> = { data: T | null; error: { code?: string; message?: string } | null };

export interface ApplicationSupabaseClient {
  rpc(functionName: string, args: Record<string, unknown>): PromiseLike<QueryResult<unknown>>;
}

export interface ApplicationContext {
  authenticatedUserId: string;
  workspace: { id: string; role: "OWNER" };
  discoveryBriefId: string;
  traceId: string;
  permissions: ReadonlySet<Capability>;
  budget: { currency: string; maxTotalCost: 0; maxProviderCalls: 0 };
  marketProfile: MarketProfile;
}

export interface CreateApplicationContextInput {
  authenticatedUserId: string;
  discoveryBriefId: string;
}

function requiredString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function createApplicationContext(
  input: CreateApplicationContextInput,
  supabase: ApplicationSupabaseClient,
): Promise<ApplicationContext> {
  if (!requiredString(input.authenticatedUserId) || !requiredString(input.discoveryBriefId)) {
    throw new ApplicationError("INVALID_INPUT", "DiscoveryBrief identity is required");
  }

  const setupResult = await supabase.rpc("intentlead_discovery_context", {
    p_discovery_brief_id: input.discoveryBriefId,
  });
  if (setupResult.error) {
    throw new ApplicationError("INTERNAL_ERROR", "Could not load DiscoveryBrief context");
  }
  const setupRows = Array.isArray(setupResult.data) ? setupResult.data : [];
  if (setupRows.length !== 1) throw new ApplicationError("NOT_FOUND", "DiscoveryBrief not found");

  const row = setupRows[0] as Record<string, unknown>;
  if (!requiredString(row.discovery_brief_id) || !requiredString(row.workspace_id)
    || row.discovery_brief_id !== input.discoveryBriefId || !requiredString(row.profile_key)) {
    throw new ApplicationError("CONFLICT", "Discovery setup is incomplete: MarketProfile is missing");
  }
  const config = row.configuration && typeof row.configuration === "object" && !Array.isArray(row.configuration)
    ? row.configuration as Record<string, unknown>
    : {};
  const parsedProfile = MarketProfileSchema.safeParse({
    schemaVersion: 1,
    id: row.profile_key,
    workspaceId: row.workspace_id,
    workflow: row.workflow,
    jurisdictions: config.jurisdictions ?? [],
    regions: config.regions ?? [],
    languages: config.languages,
    capabilities: row.capabilities,
    disabledCapabilities: row.disabled_capabilities,
    legalPolicyId: config.legalPolicyId,
    retentionPolicyId: config.retentionPolicyId,
    defaultCurrency: config.defaultCurrency,
    timezone: config.timezone,
    ...(row.profile_key === "LOCAL_CUSTOM" ? { category: config.category, geography: config.geography } : {}),
  });
  if (!parsedProfile.success) {
    throw new ApplicationError("CONFLICT", "Discovery setup is incomplete: MarketProfile configuration is invalid");
  }
  if (parsedProfile.data.id !== "EN_DISCOVERY_ONLY" || parsedProfile.data.workflow !== "DISCOVERY_ONLY") {
    throw new ApplicationError("POLICY_DENIED", "Only EN_DISCOVERY_ONLY discovery is enabled for this milestone");
  }

  return {
    authenticatedUserId: input.authenticatedUserId,
    workspace: { id: row.workspace_id, role: "OWNER" },
    discoveryBriefId: row.discovery_brief_id,
    traceId: randomUUID(),
    permissions: new Set(parsedProfile.data.capabilities),
    budget: { currency: parsedProfile.data.defaultCurrency, maxTotalCost: 0, maxProviderCalls: 0 },
    marketProfile: parsedProfile.data,
  };
}
