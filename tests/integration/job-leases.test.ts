import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { asRole, bootstrapTask4Database, insertUsers, sql } from "./task4-db";

const owner = randomUUID();
const outsider = randomUUID();
const workspaceId = randomUUID();
let offerId: string;
let icpId: string;
let marketId: string;

beforeAll(async () => {
  await bootstrapTask4Database();
  await insertUsers(owner, outsider);
  offerId = randomUUID();
  icpId = randomUUID();
  marketId = randomUUID();
  await sql(`
    INSERT INTO public.workspaces (id, owner_id, name) VALUES ('${workspaceId}', '${owner}', 'Task 4 jobs');
    INSERT INTO public.intentlead_offer_profiles (id, workspace_id, name, definition) VALUES ('${offerId}', '${workspaceId}', 'Jobs offer', '{}');
    INSERT INTO public.intentlead_icp_definitions (id, workspace_id, name, definition) VALUES ('${icpId}', '${workspaceId}', 'Jobs ICP', '{}');
    INSERT INTO public.intentlead_market_profiles (id, workspace_id, profile_key, workflow, configuration)
      VALUES ('${marketId}', '${workspaceId}', 'EN_DISCOVERY_ONLY', 'DISCOVERY_ONLY', '{}');
  `);
}, 30_000);

async function brief(campaignStatus?: "draft" | "done"): Promise<string> {
  const id = randomUUID();
  let campaignId = "NULL";
  if (campaignStatus) {
    const campaign = randomUUID();
    await sql(`INSERT INTO public.campaigns
      (id, workspace_id, entry_mode, what_selling, icp, pain, status)
      VALUES ('${campaign}', '${workspaceId}', 'cold', 'offer', 'icp', 'pain', '${campaignStatus}')`);
    campaignId = `'${campaign}'`;
  }
  await sql(`INSERT INTO public.intentlead_discovery_briefs
    (id, workspace_id, offer_profile_id, icp_definition_id, market_profile_id, legacy_campaign_id, objective, criteria)
    VALUES ('${id}', '${workspaceId}', '${offerId}', '${icpId}', '${marketId}', ${campaignId}, 'Find opportunities', '{}')`);
  return id;
}

async function enqueue(briefId: string, key: string, userId = owner): Promise<string> {
  return sql(asRole("service_role", `SELECT public.intentlead_enqueue_discovery_job('${briefId}', '${userId}', '${key}', '{}')`));
}

describe("durable job enqueue and leases", () => {
  it("rolls back job creation when the linked campaign transition fails", async () => {
    const briefId = await brief("done");
    await expect(enqueue(briefId, `rollback-${briefId}`)).rejects.toThrow(/campaign_transition_denied/);
    expect(await sql(`SELECT count(*) FROM public.intentlead_jobs WHERE discovery_brief_id='${briefId}'`)).toBe("0");
    expect(await sql(`SELECT state FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`)).toBe("DRAFT");
  });

  it("deduplicates concurrent enqueue and validates ownership", async () => {
    const briefId = await brief("draft");
    const key = `enqueue-${briefId}`;
    await expect(enqueue(briefId, key, outsider)).rejects.toThrow(/forbidden/);
    const ids = await Promise.all(Array.from({ length: 12 }, () => enqueue(briefId, key)));
    expect(new Set(ids).size).toBe(1);
    expect(await sql(`SELECT count(*) FROM public.intentlead_jobs WHERE discovery_brief_id='${briefId}'`)).toBe("1");
    expect(await sql(`SELECT state FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`)).toBe("QUEUED");
    expect(await sql(asRole("service_role", `SELECT public.intentlead_cancel_job('${ids[0]}', '${owner}')`))).toContain("t");
  }, 20_000);

  it("allows one competing worker, validates token, and makes completion retry harmless", async () => {
    const briefId = await brief();
    const jobId = await enqueue(briefId, `lease-${briefId}`);
    const lease = async (worker: string) => sql(asRole("service_role", `
      SELECT id || '|' || lease_token FROM public.intentlead_lease_next_job('${worker}', 30)
    `), `lease-${worker}`);
    const [first, second] = await Promise.all([lease("worker-a"), lease("worker-b")]);
    const winner = first || second;
    expect([first, second].filter(Boolean)).toHaveLength(1);
    const [leasedId, token] = winner.split("|");
    expect(leasedId).toBe(jobId);
    expect(await sql(asRole("service_role", `SELECT public.intentlead_heartbeat_job('${jobId}', 'wrong-worker', '${token}', 30)`))).toContain("f");
    expect(await sql(asRole("service_role", `SELECT public.intentlead_complete_job('${jobId}', 'worker-a', '${randomUUID()}', 'COMPLETED', '{}', NULL)`))).toContain("f");
    const worker = first ? "worker-a" : "worker-b";
    expect(await sql(asRole("service_role", `SELECT public.intentlead_heartbeat_job('${jobId}', '${worker}', '${token}', 30)`))).toContain("t");
    expect(await sql(asRole("service_role", `SELECT public.intentlead_record_job_step_attempt(
      '${jobId}', '${worker}', '${randomUUID()}', 'discover', 1, 'STARTED'
    )`))).toBe("");
    const stepId = await sql(asRole("service_role", `SELECT public.intentlead_record_job_step_attempt(
      '${jobId}', '${worker}', '${token}', 'discover', 1, 'STARTED'
    )`));
    expect(stepId).not.toBe("");
    expect(await sql(asRole("service_role", `SELECT public.intentlead_record_job_step_attempt(
      '${jobId}', '${worker}', '${token}', 'discover', 1, 'COMPLETED', '{}', 5000, NULL,
      '{"cursor":"done"}', '{"maxCost":0}'
    )`))).toContain(stepId);
    expect(await sql(`SELECT count(*) FROM public.intentlead_job_step_attempts WHERE job_id='${jobId}'`)).toBe("1");
    expect(await sql(asRole("service_role", `SELECT public.intentlead_complete_job('${jobId}', '${worker}', '${token}', 'COMPLETED', '{"opportunityIds":[]}', NULL)`))).toContain("t");
    expect(await sql(asRole("service_role", `SELECT public.intentlead_complete_job('${jobId}', '${worker}', '${token}', 'COMPLETED', '{"opportunityIds":[]}', NULL)`))).toContain("t");
    expect(await sql(asRole("service_role", `SELECT public.intentlead_complete_job('${jobId}', '${worker}', '${randomUUID()}', 'COMPLETED', '{}', NULL)`))).toContain("f");
  }, 20_000);

  it("takes over a stale lease and makes retry-wait jobs eligible only when due", async () => {
    const staleBrief = await brief();
    const staleJob = await enqueue(staleBrief, `stale-${staleBrief}`);
    const first = await sql(asRole("service_role", `SELECT lease_token FROM public.intentlead_lease_next_job('stale-worker', 5)`));
    await sql(`UPDATE public.intentlead_jobs SET lease_expires_at=now()-interval '1 second' WHERE id='${staleJob}'`);
    const takeover = await sql(asRole("service_role", `SELECT lease_token FROM public.intentlead_lease_next_job('recovery-worker', 30)`));
    expect(takeover).not.toBe(first);
    expect(await sql(`SELECT attempt FROM public.intentlead_jobs WHERE id='${staleJob}'`)).toBe("2");

    const retryBrief = await brief();
    const retryJob = await enqueue(retryBrief, `retry-${retryBrief}`);
    const token = await sql(asRole("service_role", `SELECT lease_token FROM public.intentlead_lease_next_job('retry-worker', 30)`));
    expect(await sql(asRole("service_role", `SELECT public.intentlead_retry_job('${retryJob}', 'retry-worker', '${token}', '{"code":"TIMEOUT"}', now()+interval '1 hour')`))).toContain("t");
    expect(await sql(asRole("service_role", `SELECT count(*) FROM public.intentlead_lease_next_job('too-early', 30) WHERE id='${retryJob}'`))).toContain("0");
    await sql(`UPDATE public.intentlead_jobs SET available_at=now()-interval '1 second' WHERE id='${retryJob}'`);
    expect(await sql(asRole("service_role", `SELECT count(*) FROM public.intentlead_lease_next_job('retry-worker-2', 30) WHERE id='${retryJob}'`))).toContain("1");
  }, 20_000);

  it("revokes public/client RPC execution and direct job mutation", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      await expect(sql(asRole(role, `SELECT public.intentlead_lease_next_job('client', 30)`, role === "authenticated" ? owner : undefined))).rejects.toThrow(/permission denied/);
      expect(await sql(`SELECT has_table_privilege('${role}', 'public.intentlead_jobs', 'INSERT')`)).toBe("f");
      expect(await sql(`SELECT has_table_privilege('${role}', 'public.intentlead_jobs', 'UPDATE')`)).toBe("f");
    }
    expect(await sql(`SELECT count(*) FROM pg_proc WHERE proname LIKE 'intentlead_%job%'
      AND prosecdef AND 'search_path=pg_catalog, public'=ANY(proconfig)`)).not.toBe("0");
  });
});
