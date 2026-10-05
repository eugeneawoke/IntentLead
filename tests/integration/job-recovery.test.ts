import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createSupabaseJobRepository, type JobDatabaseClient } from "@/worker/jobs/repository";
import { createJobWorker } from "@/worker/jobs/worker";
import { asRole, bootstrapTask5Database, insertUsers, sql } from "./task4-db";

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

async function waitFor(assertion: () => void | Promise<void>): Promise<void> {
  const until = Date.now() + 5_000;
  while (Date.now() < until) {
    try { await assertion(); return; } catch { await new Promise(resolve => setTimeout(resolve, 10)); }
  }
  await assertion();
}

beforeAll(async () => {
  await bootstrapTask5Database();
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
  it("keeps terminal-state synchronization private from service_role", async () => {
    expect(await sql(`SELECT has_function_privilege(
      'service_role', 'public.intentlead_sync_job_terminal_state(uuid,uuid,text)', 'EXECUTE'
    )`)).toBe("f");
  });

  it("does not let service_role directly mutate linked terminal state", async () => {
    const briefId = randomUUID();
    const campaignId = randomUUID();
    await sql(`
      INSERT INTO public.campaigns (id,workspace_id,entry_mode,what_selling,icp,pain,status)
      VALUES ('${campaignId}','${workspaceId}','cold','offer','icp','pain','running');
      INSERT INTO public.intentlead_discovery_briefs
        (id,workspace_id,offer_profile_id,icp_definition_id,market_profile_id,legacy_campaign_id,objective,criteria,state)
      VALUES ('${briefId}','${workspaceId}','${offerId}','${icpId}','${marketId}','${campaignId}',
        'Find opportunities','{}','QUEUED');
    `);
    expect(await sql(`SELECT state FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`)).toBe("QUEUED");
    expect(await sql(`SELECT status FROM public.campaigns WHERE id='${campaignId}'`)).toBe("running");

    await expect(sql(asRole("service_role", `SELECT public.intentlead_sync_job_terminal_state(
      '${workspaceId}', '${briefId}', 'COMPLETED'
    )`))).rejects.toThrow(/permission denied/i);

    expect(await sql(`SELECT state FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`)).toBe("QUEUED");
    expect(await sql(`SELECT status FROM public.campaigns WHERE id='${campaignId}'`)).toBe("running");
  });

  it("recovers a crashed worker lease and enforces exact heartbeat/checkpoint/completion tokens", async () => {
    const { briefId, campaignId } = await makeBrief(`recovery-${randomUUID()}`);
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
    const completedLease = { jobId, workerId: "recovery-worker", leaseToken: takeover.lease.token };
    expect(await repository.complete(completedLease, "COMPLETED", { opportunityIds: [] }, null)).toBe(true);
    expect(await repository.complete(completedLease, "COMPLETED", { opportunityIds: [] }, null)).toBe(true);
    expect(await sql(`SELECT state FROM public.intentlead_jobs WHERE id='${jobId}'`)).toBe("COMPLETED");
    expect(await sql(`SELECT state FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`)).toBe("COMPLETED");
    expect(await sql(`SELECT status FROM public.campaigns WHERE id='${campaignId}'`)).toBe("done");
  }, 20_000);

  it("maps permanent job failure to FAILED brief and error campaign state", async () => {
    const { briefId, campaignId } = await makeBrief(`failure-${randomUUID()}`);
    const jobId = await sql(`SELECT id FROM public.intentlead_jobs WHERE discovery_brief_id='${briefId}'`);
    const repository = createSupabaseJobRepository(psqlJobClient());
    const job = await repository.leaseNextJob("permanent-failure-worker", 30);
    expect(job?.id).toBe(jobId);
    if (!job) throw new Error("Expected a leased job");
    const lease = { jobId, workerId: job.lease.owner, leaseToken: job.lease.token };
    const error = {
      schemaVersion: 1 as const, code: "POLICY_DENIED" as const,
      message: "Fixture permanent failure", capability: "SOURCE_SEARCH" as const,
      traceId: job.traceId, retryable: false as const, retryAfterMs: null,
    };

    expect(await repository.complete(lease, "FAILED", null, error)).toBe(true);
    expect(await repository.complete(lease, "FAILED", null, error)).toBe(true);
    expect(await sql(`SELECT state FROM public.intentlead_jobs WHERE id='${jobId}'`)).toBe("FAILED");
    expect(await sql(`SELECT state FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`)).toBe("FAILED");
    expect(await sql(`SELECT status FROM public.campaigns WHERE id='${campaignId}'`)).toBe("error");
  }, 20_000);

  it("maps partial completion to COMPLETED brief and done campaign state", async () => {
    const { briefId, campaignId } = await makeBrief(`partial-${randomUUID()}`);
    const jobId = await sql(`SELECT id FROM public.intentlead_jobs WHERE discovery_brief_id='${briefId}'`);
    const repository = createSupabaseJobRepository(psqlJobClient());
    const job = await repository.leaseNextJob("partial-worker", 30);
    expect(job?.id).toBe(jobId);
    if (!job) throw new Error("Expected a leased job");
    const error = {
      schemaVersion: 1 as const, code: "DEPENDENCY_UNAVAILABLE" as const,
      message: "Fixture partial result", capability: "SOURCE_SEARCH" as const,
      traceId: job.traceId, retryable: true as const, retryAfterMs: null,
    };

    expect(await repository.complete({
      jobId, workerId: job.lease.owner, leaseToken: job.lease.token,
    }, "PARTIAL", { partial: true }, error)).toBe(true);
    expect(await sql(`SELECT state FROM public.intentlead_jobs WHERE id='${jobId}'`)).toBe("PARTIAL");
    expect(await sql(`SELECT state FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`)).toBe("COMPLETED");
    expect(await sql(`SELECT status FROM public.campaigns WHERE id='${campaignId}'`)).toBe("done");
  }, 20_000);

  it("dead-letters an expired final attempt and synchronizes linked brief/campaign", async () => {
    const { briefId, campaignId } = await makeBrief(`final-attempt-${randomUUID()}`);
    const jobId = await sql(`SELECT id FROM public.intentlead_jobs WHERE discovery_brief_id='${briefId}'`);
    await sql(`UPDATE public.intentlead_jobs SET attempt=max_attempts-1 WHERE id='${jobId}'`);
    const repository = createSupabaseJobRepository(psqlJobClient());
    const finalLease = await repository.leaseNextJob("crashed-final-attempt-worker", 5);
    expect(finalLease?.id).toBe(jobId);
    expect(finalLease?.attempt).toBe(finalLease?.maxAttempts);

    await sql("SELECT pg_sleep(5.1)");
    expect(await repository.leaseNextJob("recovery-after-final-attempt", 30)).toBeNull();
    expect(await sql(`SELECT state FROM public.intentlead_jobs WHERE id='${jobId}'`)).toBe("FAILED");
    expect(await sql(`SELECT error->>'message' FROM public.intentlead_jobs WHERE id='${jobId}'`))
      .toBe("Lease expired after retry budget exhausted");
    expect(await sql(`SELECT state FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`)).toBe("FAILED");
    expect(await sql(`SELECT status FROM public.campaigns WHERE id='${campaignId}'`)).toBe("error");
  }, 20_000);

  it("observes relational cancellation during an injected call and starts no later operation", async () => {
    const { briefId, campaignId } = await makeBrief(`cancel-${randomUUID()}`);
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
    expect(await sql(`SELECT state FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`)).toBe("CANCELLED");
    expect(await sql(`SELECT status FROM public.campaigns WHERE id='${campaignId}'`)).toBe("error");
    await waitFor(() => expect(cancellationChecks).toBeGreaterThan(2));
    await waitFor(() => expect(aborted).toBe(true));
    await worker.shutdown();

    expect(laterStepStarted).toBe(false);
    expect(await sql(`SELECT state FROM public.intentlead_jobs WHERE id='${jobId}'`)).toBe("CANCELLED");
    expect(await sql(`SELECT lease_token IS NULL AND payload='{}'::jsonb FROM public.intentlead_jobs WHERE id='${jobId}'`)).toBe("t");
  }, 20_000);

  it("does not let completion regress a brief while owner deletion holds its workspace lock", async () => {
    const { briefId, campaignId } = await makeBrief(`delete-race-${randomUUID()}`);
    const jobId = await sql(`SELECT id FROM public.intentlead_jobs WHERE discovery_brief_id='${briefId}'`);
    const repository = createSupabaseJobRepository(psqlJobClient());
    const job = await repository.leaseNextJob("delete-race-worker", 30);
    expect(job?.id).toBe(jobId);
    if (!job) throw new Error("Expected a leased job");
    const lease = { jobId, workerId: job.lease.owner, leaseToken: job.lease.token };
    const deletion = sql(asRole("service_role", `
      SELECT pg_advisory_xact_lock(hashtextextended('intentlead-workspace:' || '${workspaceId}'::text, 0));
      SELECT pg_sleep(0.5);
      SELECT public.intentlead_delete_discovery_brief('${briefId}','${owner}','race-test');
    `));
    await waitFor(async () => {
      const locks = await sql(`SELECT count(*) FROM pg_locks
        WHERE locktype='advisory' AND granted AND pid <> pg_backend_pid()`);
      expect(Number(locks)).toBeGreaterThan(0);
    });

    expect(await repository.complete(lease, "COMPLETED", { late: true }, null)).toBe(false);
    await deletion;

    expect(await sql(`SELECT state FROM public.intentlead_jobs WHERE id='${jobId}'`)).toBe("CANCELLED");
    expect(await sql(`SELECT state FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`)).toBe("CANCELLED");
    expect(await sql(`SELECT status FROM public.campaigns WHERE id='${campaignId}'`)).toBe("error");
  }, 20_000);
});
