import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createSupabaseJobRepository, type JobDatabaseClient } from "@/worker/jobs/repository";
import { createJobWorker } from "@/worker/jobs/worker";
import { asRole, bootstrapTask4Database, insertUsers, sql } from "./task4-db";

const owner = randomUUID();
const workspaceId = randomUUID();
const offerId = randomUUID();
const icpId = randomUUID();
const marketId = randomUUID();

const config = {
  regions: [], languages: ["en"], legalPolicyId: "legal-v1", retentionPolicyId: "retention-v1",
  outreachPolicyId: null, outreachChannels: [], defaultCurrency: "USD", timezone: "UTC",
};
const capabilities = ["SOURCE_SEARCH", "WEB_FETCH", "COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT", "HUMAN_REVIEW"];
const disabled = ["PEOPLE_SEARCH", "CONTACT_ENRICHMENT", "EMAIL_FIND", "EMAIL_VERIFY", "DRAFT_GENERATION", "OUTREACH_READY", "OUTREACH_SEND", "OUTCOME_RECORDING", "PACKAGE_VERIFIED"];

function quote(value: unknown): string {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parse<T>(value: string): T | null {
  return value ? JSON.parse(value) as T : null;
}

function psqlJobClient(): JobDatabaseClient {
  const fromAllowed = new Set(["intentlead_discovery_briefs", "intentlead_market_profiles", "intentlead_jobs"]);
  return {
    async rpc(name: string, args: Record<string, unknown>) {
      try {
        let statement: string;
        switch (name) {
          case "intentlead_lease_next_job":
            statement = `SELECT to_jsonb(j)::text FROM public.intentlead_lease_next_job(${quote(args.p_worker_id)}, ${Number(args.p_lease_seconds)}) j LIMIT 1`;
            return { data: parse(await sql(asRole("service_role", statement), "task5-repository-lease")), error: null };
          case "intentlead_heartbeat_job":
            statement = `SELECT public.intentlead_heartbeat_job(${quote(args.p_job_id)}::uuid, ${quote(args.p_worker_id)}, ${quote(args.p_lease_token)}::uuid, ${Number(args.p_lease_seconds)})`;
            return { data: (await sql(asRole("service_role", statement))) === "t", error: null };
          case "intentlead_checkpoint_job":
            statement = `SELECT public.intentlead_checkpoint_job(${quote(args.p_job_id)}::uuid, ${quote(args.p_worker_id)}, ${quote(args.p_lease_token)}::uuid, ${quote(JSON.stringify(args.p_checkpoint))}::jsonb)`;
            return { data: (await sql(asRole("service_role", statement))) === "t", error: null };
          case "intentlead_record_job_step_attempt":
            statement = `SELECT public.intentlead_record_job_step_attempt(
              ${quote(args.p_job_id)}::uuid, ${quote(args.p_worker_id)}, ${quote(args.p_lease_token)}::uuid,
              ${quote(args.p_step_key)}, ${Number(args.p_step_attempt)}, ${quote(args.p_state)}, '{}'::uuid[],
              NULL, ${args.p_retry_reason == null ? "NULL" : quote(args.p_retry_reason)},
              ${quote(JSON.stringify(args.p_checkpoint))}::jsonb, '{}'::jsonb)`;
            return { data: await sql(asRole("service_role", statement)), error: null };
          case "intentlead_retry_job":
            statement = `SELECT public.intentlead_retry_job(
              ${quote(args.p_job_id)}::uuid, ${quote(args.p_worker_id)}, ${quote(args.p_lease_token)}::uuid,
              ${quote(JSON.stringify(args.p_error))}::jsonb, ${quote(args.p_available_at)}::timestamptz)`;
            return { data: (await sql(asRole("service_role", statement))) === "t", error: null };
          case "intentlead_complete_job":
            statement = `SELECT public.intentlead_complete_job(
              ${quote(args.p_job_id)}::uuid, ${quote(args.p_worker_id)}, ${quote(args.p_lease_token)}::uuid,
              ${quote(args.p_terminal_state)}, ${args.p_result == null ? "NULL" : `${quote(JSON.stringify(args.p_result))}::jsonb`},
              ${args.p_error == null ? "NULL" : `${quote(JSON.stringify(args.p_error))}::jsonb`})`;
            return { data: (await sql(asRole("service_role", statement))) === "t", error: null };
          default:
            throw new Error(`Unexpected RPC ${name}`);
        }
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : String(error) } };
      }
    },
    from(table: string) {
      if (!fromAllowed.has(table)) throw new Error(`Unexpected table ${table}`);
      let columns = "*";
      const filters: Array<[string, unknown]> = [];
      const query = {
        select(value: string) { columns = value; return query; },
        eq(column: string, value: unknown) { filters.push([column, value]); return query; },
        async maybeSingle() {
          const projection = columns.split(",").map(column => column.trim()).join(", ");
          const where = filters.map(([column, value]) => `${column} ${value === null ? "IS NULL" : `= ${quote(value)}`}`).join(" AND ");
          const value = await sql(asRole("service_role", `SELECT row_to_json(q)::text FROM (
            SELECT ${projection} FROM public.${table} WHERE ${where} LIMIT 1
          ) q`), "task5-repository-read");
          return { data: parse<Record<string, unknown>>(value), error: null };
        },
      };
      return query;
    },
  } as unknown as JobDatabaseClient;
}

async function makeBrief(key: string): Promise<{ briefId: string; campaignId: string }> {
  const briefId = randomUUID();
  const campaignId = randomUUID();
  await sql(`
    INSERT INTO public.campaigns (id,workspace_id,entry_mode,what_selling,icp,pain,status)
    VALUES ('${campaignId}','${workspaceId}','cold','offer','icp','pain','draft');
    INSERT INTO public.intentlead_discovery_briefs
      (id,workspace_id,offer_profile_id,icp_definition_id,market_profile_id,legacy_campaign_id,objective,criteria)
    VALUES ('${briefId}','${workspaceId}','${offerId}','${icpId}','${marketId}','${campaignId}','Find opportunities','{}');
    SELECT public.intentlead_enqueue_discovery_job('${briefId}','${owner}','${key}','{}');
  `);
  return { briefId, campaignId };
}

async function waitFor(assertion: () => void): Promise<void> {
  const until = Date.now() + 5_000;
  while (Date.now() < until) {
    try { assertion(); return; } catch { await new Promise(resolve => setTimeout(resolve, 10)); }
  }
  assertion();
}

beforeAll(async () => {
  await bootstrapTask4Database();
  await insertUsers(owner);
  await sql(`
    INSERT INTO public.workspaces(id,owner_id,name) VALUES ('${workspaceId}','${owner}','Task 5 recovery');
    INSERT INTO public.intentlead_offer_profiles(id,workspace_id,name,definition)
      VALUES ('${offerId}','${workspaceId}','Task 5 offer','{}');
    INSERT INTO public.intentlead_icp_definitions(id,workspace_id,name,definition)
      VALUES ('${icpId}','${workspaceId}','Task 5 ICP','{}');
    INSERT INTO public.intentlead_market_profiles(id,workspace_id,profile_key,workflow,configuration,capabilities,disabled_capabilities)
      VALUES ('${marketId}','${workspaceId}','EN_DISCOVERY_ONLY','DISCOVERY_ONLY','${JSON.stringify(config)}',
        ARRAY[${capabilities.map(quote).join(",")}],ARRAY[${disabled.map(quote).join(",")}]);
  `);
}, 30_000);

describe("Task 5 real PostgreSQL job recovery", () => {
  it("recovers a crashed worker lease and enforces exact heartbeat/checkpoint/completion tokens", async () => {
    const { briefId } = await makeBrief(`recovery-${randomUUID()}`);
    const jobId = await sql(`SELECT id FROM public.intentlead_jobs WHERE discovery_brief_id='${briefId}'`);
    const repository = createSupabaseJobRepository(psqlJobClient());
    const first = await repository.leaseNextJob("crashed-worker", 5);
    expect(first?.id).toBe(jobId);
    if (!first) throw new Error("Expected a leased job");

    const lease = { jobId: first.id, workerId: first.lease.owner, leaseToken: first.lease.token };
    expect(await repository.heartbeat(lease, 5)).toBe(true);
    expect(await repository.checkpoint(lease, { step: "fixture-checkpoint" })).toBe(true);
    expect(await repository.recordStepAttempt({
      ...lease, stepKey: "fixture-discovery", attempt: 1, state: "STARTED", checkpoint: { cursor: "fixture" },
    })).not.toBeNull();
    expect(await repository.complete({ ...lease, leaseToken: randomUUID() }, "COMPLETED", {}, null)).toBe(false);

    await sql("SELECT pg_sleep(5.1)");
    const takeover = await repository.leaseNextJob("recovery-worker", 30);
    expect(takeover?.id).toBe(jobId);
    expect(takeover?.attempt).toBe(2);
    expect(takeover?.lease.token).not.toBe(first.lease.token);
    if (!takeover) throw new Error("Expected takeover lease");
    expect(await repository.complete({ jobId, workerId: "recovery-worker", leaseToken: takeover.lease.token }, "COMPLETED", { opportunityIds: [] }, null)).toBe(true);
    expect(await sql(`SELECT state FROM public.intentlead_jobs WHERE id='${jobId}'`)).toBe("COMPLETED");
  }, 20_000);

  it("observes relational cancellation during an injected call and starts no later operation", async () => {
    const { briefId } = await makeBrief(`cancel-${randomUUID()}`);
    const jobId = await sql(`SELECT id FROM public.intentlead_jobs WHERE discovery_brief_id='${briefId}'`);
    const repository = createSupabaseJobRepository(psqlJobClient());
    let cancellationChecks = 0;
    const isCancelled = repository.isCancelled.bind(repository);
    repository.isCancelled = async (id) => {
      cancellationChecks += 1;
      return isCancelled(id);
    };
    let started = false;
    let releaseStarted!: () => void;
    const startedPromise = new Promise<void>(resolve => { releaseStarted = resolve; });
    let aborted = false;
    let laterStepStarted = false;
    const worker = createJobWorker({
      repository, workerId: "cancel-aware-worker", minPollIntervalMs: 10, maxPollIntervalMs: 20,
      cancellationCheckIntervalMs: 100, heartbeatIntervalMs: 1_000,
      handler: async (job, execution) => {
        await execution.runExternalOperation("SOURCE_SEARCH", () => "fixture-only", async (_provider, signal) => {
          started = true;
          releaseStarted();
          return new Promise<never>((_resolve, reject) => signal.addEventListener("abort", () => {
            aborted = true;
            reject(signal.reason);
          }, { once: true }));
        });
        laterStepStarted = true;
        return { state: "COMPLETED", result: {} };
      },
    });
    worker.start();
    await startedPromise;
    expect(started).toBe(true);
    await sql(asRole("service_role", `SELECT public.intentlead_cancel_job('${jobId}','${owner}')`));
    expect(await repository.isCancelled(jobId)).toBe(true);
    expect(await sql(`SELECT state FROM public.intentlead_jobs WHERE id='${jobId}'`)).toBe("CANCELLED");
    await waitFor(() => expect(cancellationChecks).toBeGreaterThan(2));
    await waitFor(() => expect(aborted).toBe(true));
    await worker.shutdown();

    expect(laterStepStarted).toBe(false);
    expect(await sql(`SELECT state FROM public.intentlead_jobs WHERE id='${jobId}'`)).toBe("CANCELLED");
    expect(await sql(`SELECT lease_token IS NULL AND payload='{}'::jsonb FROM public.intentlead_jobs WHERE id='${jobId}'`)).toBe("t");
  }, 20_000);
});
