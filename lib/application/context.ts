import { randomUUID } from "node:crypto";
import { MarketProfileSchema } from "@/lib/domain/schemas/market-profile";
import type { Capability } from "@/types/market-profile";
import type { MarketProfile } from "@/types/market-profile";
import { ApplicationError } from "./errors";

type QueryResult<T> = { data: T | null; error: { code?: string; message?: string } | null };
type FromQuery = { select(columns: string): Query };
type Query = {
  eq(column: string, value: unknown): Query;
  single(): PromiseLike<QueryResult<Record<string, unknown>>>;
  maybeSingle(): PromiseLike<QueryResult<Record<string, unknown>>>;
};

export interface ApplicationSupabaseClient {
  from(table: string): FromQuery;
  rpc(functionName: string, args: Record<string, unknown>): PromiseLike<QueryResult<unknown>>;
}

export interface ApplicationContext {
  authenticatedUserId: string;
  workspace: { id: string; role: "OWNER" };
  campaignId: string;
  discoveryBriefId: string;
  traceId: string;
  permissions: ReadonlySet<Capability>;
  budget: { currency: string; maxTotalCost: 0; maxProviderCalls: 0 };
  marketProfile: MarketProfile;
}

export interface CreateApplicationContextInput {
  authenticatedUserId: string;
  campaignId: string;
}

function requiredString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function failLookup(error: { code?: string; message?: string } | null, message: string): never {
  if (error && error.code !== "PGRST116") throw new ApplicationError("INTERNAL_ERROR", "Could not load campaign authority");
  throw new ApplicationError("NOT_FOUND", message);
}

function throwIfLookupFailed(error: { code?: string; message?: string } | null, message: string): void {
  if (error && error.code !== "PGRST116") throw new ApplicationError("INTERNAL_ERROR", message);
}

export async function createApplicationContext(
  input: CreateApplicationContextInput,
  supabase: ApplicationSupabaseClient,
): Promise<ApplicationContext> {
  if (!requiredString(input.authenticatedUserId) || !requiredString(input.campaignId)) {
    throw new ApplicationError("INVALID_INPUT", "Campaign identity is required");
  }

  const campaignResult = await supabase.from("campaigns")
    .select("id, workspace_id")
    .eq("id", input.campaignId)
    .single();
  if (campaignResult.error || !campaignResult.data) failLookup(campaignResult.error, "Campaign not found");
  const campaign = campaignResult.data;
  if (!requiredString(campaign.workspace_id)) failLookup(null, "Campaign not found");

  const workspaceResult = await supabase.from("workspaces")
    .select("id, owner_id")
    .eq("id", campaign.workspace_id)
    .single();
  if (workspaceResult.error || !workspaceResult.data) failLookup(workspaceResult.error, "Workspace not found");
  const workspace = workspaceResult.data;
  if (workspace.owner_id !== input.authenticatedUserId) {
    throw new ApplicationError("FORBIDDEN", "Campaign is not available to this owner");
  }

  const setupResult = await supabase.rpc("intentlead_discovery_setup_for_campaign", {
    p_campaign_id: input.campaignId,
  });
  throwIfLookupFailed(setupResult.error, "Could not load DiscoveryBrief setup");
  const setupRows = Array.isArray(setupResult.data) ? setupResult.data : [];
  if (setupResult.error || setupRows.length !== 1) {
    throw new ApplicationError("CONFLICT", "Discovery setup is incomplete: linked DiscoveryBrief is missing");
  }
  const row = setupRows[0] as Record<string, unknown>;
  if (!requiredString(row.discovery_brief_id) || !requiredString(row.workspace_id)
    || row.workspace_id !== campaign.workspace_id) {
    throw new ApplicationError("CONFLICT", "Discovery setup is incomplete: MarketProfile is missing");
  }
  if (!requiredString(row.profile_key)) {
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
    outreachPolicyId: config.outreachPolicyId ?? null,
    outreachChannels: config.outreachChannels ?? [],
    defaultCurrency: config.defaultCurrency,
    timezone: config.timezone,
    ...(row.profile_key === "LOCAL_CUSTOM" ? {
      category: config.category,
      geography: config.geography,
    } : {}),
  });
  if (!parsedProfile.success) {
    throw new ApplicationError("CONFLICT", "Discovery setup is incomplete: MarketProfile configuration is invalid");
  }
  if (parsedProfile.data.id !== "EN_DISCOVERY_ONLY" || parsedProfile.data.workflow !== "DISCOVERY_ONLY") {
    throw new ApplicationError("POLICY_DENIED", "Only EN_DISCOVERY_ONLY discovery is enabled for this milestone");
  }

  return {
    authenticatedUserId: input.authenticatedUserId,
    workspace: { id: String(campaign.workspace_id), role: "OWNER" },
    campaignId: input.campaignId,
    discoveryBriefId: row.discovery_brief_id as string,
    traceId: randomUUID(),
    permissions: new Set(parsedProfile.data.capabilities),
    budget: { currency: parsedProfile.data.defaultCurrency, maxTotalCost: 0, maxProviderCalls: 0 },
    marketProfile: parsedProfile.data,
  };
}
