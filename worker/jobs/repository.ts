import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { CapabilityErrorSchema } from "../../lib/domain/schemas/job";
import type { CapabilityError, Job } from "../../types/job";
import type { MarketProfile } from "../../types/market-profile";
import { getServiceClient } from "../../lib/supabase/client";

type DbResult<T> = { data: T | null; error: { message?: string } | null };
type FromQuery = { select(columns: string): Query };
type Query = {
  eq(column: string, value: unknown): Query;
  maybeSingle(): Promise<DbResult<Record<string, unknown>>>;
};

export interface JobDatabaseClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<DbResult<unknown>>;
  from(table: string): FromQuery;
}

export interface LeasedJob {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  capability: Job["capability"];
  marketProfileId: MarketProfile["id"];
  discoveryBriefId: string | null;
  idempotencyKey: string;
  traceId: string;
  attempt: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  state: "LEASED";
  lease: { owner: string; token: string; expiresAt: string };
}

export interface LeaseIdentity {
  jobId: string;
  workerId: string;
  leaseToken: string;
}

export interface JobRepository {
  leaseNextJob(workerId: string, leaseSeconds?: number): Promise<LeasedJob | null>;
  getMarketProfile(job: LeasedJob): Promise<MarketProfile>;
  isCancelled(jobId: string): Promise<boolean>;
  heartbeat(lease: LeaseIdentity, leaseSeconds?: number): Promise<boolean>;
  checkpoint(lease: LeaseIdentity, checkpoint: Record<string, unknown>): Promise<boolean>;
  recordStepAttempt(input: LeaseIdentity & {
    stepKey: string;
    attempt: number;
    state: "STARTED" | "COMPLETED" | "RETRYABLE_FAILED" | "PERMANENT_FAILED" | "CANCELLED";
    retryReason?: string | null;
    checkpoint?: Record<string, unknown>;
  }): Promise<string | null>;
  retry(lease: LeaseIdentity, error: Extract<CapabilityError, { retryable: true }>, availableAt: string): Promise<boolean>;
  complete(
    lease: LeaseIdentity,
    state: "COMPLETED" | "PARTIAL" | "FAILED",
    result: Record<string, unknown> | null,
    error: CapabilityError | null,
  ): Promise<boolean>;
}

function firstRow(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return value.length > 0 && typeof value[0] === "object" ? value[0] as Record<string, unknown> : null;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function required(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`invalid durable job field: ${key}`);
  return value;
}

function mapLease(value: unknown): LeasedJob | null {
  const row = firstRow(value);
  if (!row) return null;
  const profileKey = required(row, "market_profile_key");
  if (!["EN_DISCOVERY_ONLY", "CIS_RU", "LOCAL_CUSTOM"].includes(profileKey)) throw new Error("invalid market profile key");
  const state = required(row, "state");
  if (state !== "LEASED" && state !== "RUNNING") throw new Error("lease RPC returned a non-leased job");
  return {
    schemaVersion: 1,
    id: required(row, "id"),
    workspaceId: required(row, "workspace_id"),
    capability: required(row, "capability") as Job["capability"],
    marketProfileId: profileKey as MarketProfile["id"],
    discoveryBriefId: typeof row.discovery_brief_id === "string" ? row.discovery_brief_id : null,
    idempotencyKey: required(row, "idempotency_key"),
    traceId: required(row, "trace_id"),
    attempt: Number(row.attempt),
    maxAttempts: Number(row.max_attempts),
    createdAt: required(row, "created_at"),
    updatedAt: required(row, "updated_at"),
    state: "LEASED",
    lease: {
      owner: required(row, "lease_owner"),
      token: required(row, "lease_token"),
      expiresAt: required(row, "lease_expires_at"),
    },
  };
}

function throwRpcError(error: { message?: string } | null): void {
  if (error) throw new Error(error.message || "durable job database operation failed");
}

function parseProfile(row: Record<string, unknown>): MarketProfile {
  const config = row.configuration && typeof row.configuration === "object" && !Array.isArray(row.configuration)
    ? row.configuration as Record<string, unknown>
    : {};
  const parsed = MarketProfileSchema.safeParse({
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
    ...(row.profile_key === "LOCAL_CUSTOM" ? { category: config.category, geography: config.geography } : {}),
  });
  if (!parsed.success) throw new Error("stored MarketProfile configuration is invalid");
  return parsed.data;
}

export function createSupabaseJobRepository(
  client: JobDatabaseClient = getServiceClient() as unknown as JobDatabaseClient,
): JobRepository {
  async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const result = await client.rpc(name, args);
    throwRpcError(result.error);
    return result.data as T;
  }

  return {
    async leaseNextJob(workerId, leaseSeconds = 60) {
      const row = await rpc<unknown>("intentlead_lease_next_job", {
        p_worker_id: workerId,
        p_lease_seconds: leaseSeconds,
      });
      return mapLease(row);
    },

    async getMarketProfile(job) {
      if (!job.discoveryBriefId) throw new Error("leased job has no linked DiscoveryBrief");
      const briefResult = await client.from("intentlead_discovery_briefs")
        .select("market_profile_id")
        .eq("id", job.discoveryBriefId)
        .eq("workspace_id", job.workspaceId)
        .maybeSingle();
      throwRpcError(briefResult.error);
      if (!briefResult.data || typeof briefResult.data.market_profile_id !== "string") {
        throw new Error("leased job DiscoveryBrief is unavailable");
      }
      const profileResult = await client.from("intentlead_market_profiles")
        .select("id, workspace_id, profile_key, workflow, configuration, capabilities, disabled_capabilities")
        .eq("id", briefResult.data.market_profile_id)
        .eq("workspace_id", job.workspaceId)
        .maybeSingle();
      throwRpcError(profileResult.error);
      if (!profileResult.data || profileResult.data.profile_key !== job.marketProfileId) {
        throw new Error("leased job MarketProfile does not match its stored profile");
      }
      return parseProfile(profileResult.data);
    },

    async isCancelled(jobId) {
      const result = await client.from("intentlead_jobs")
        .select("state, cancellation_requested_at")
        .eq("id", jobId)
        .maybeSingle();
      throwRpcError(result.error);
      return !result.data || result.data.state === "CANCELLED" || result.data.cancellation_requested_at != null;
    },

    async heartbeat(lease, leaseSeconds = 60) {
      return Boolean(await rpc("intentlead_heartbeat_job", {
        p_job_id: lease.jobId,
        p_worker_id: lease.workerId,
        p_lease_token: lease.leaseToken,
        p_lease_seconds: leaseSeconds,
      }));
    },

    async checkpoint(lease, checkpoint) {
      return Boolean(await rpc("intentlead_checkpoint_job", {
        p_job_id: lease.jobId,
        p_worker_id: lease.workerId,
        p_lease_token: lease.leaseToken,
        p_checkpoint: checkpoint,
      }));
    },

    async recordStepAttempt(input) {
      const stepId = await rpc<unknown>("intentlead_record_job_step_attempt", {
        p_job_id: input.jobId,
        p_worker_id: input.workerId,
        p_lease_token: input.leaseToken,
        p_step_key: input.stepKey,
        p_step_attempt: input.attempt,
        p_state: input.state,
        p_provider_run_ids: [],
        p_timeout_ms: null,
        p_retry_reason: input.retryReason ?? null,
        p_checkpoint: input.checkpoint ?? {},
        p_cost_scope: {},
      });
      return typeof stepId === "string" ? stepId : null;
    },

    async retry(lease, error, availableAt) {
      const parsed = CapabilityErrorSchema.safeParse(error);
      if (!parsed.success || !parsed.data.retryable) return false;
      return Boolean(await rpc("intentlead_retry_job", {
        p_job_id: lease.jobId,
        p_worker_id: lease.workerId,
        p_lease_token: lease.leaseToken,
        p_error: parsed.data,
        p_available_at: availableAt,
      }));
    },

    async complete(lease, state, result, error) {
      if (error && !CapabilityErrorSchema.safeParse(error).success) return false;
      return Boolean(await rpc("intentlead_complete_job", {
        p_job_id: lease.jobId,
        p_worker_id: lease.workerId,
        p_lease_token: lease.leaseToken,
        p_terminal_state: state,
        p_result: result,
        p_error: error,
      }));
    },
  };
}
