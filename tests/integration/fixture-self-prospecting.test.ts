import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createSelfProspectingHandler } from "../../worker/workflows/self-prospecting";
import { createFixtureSelfProspectingDependencies } from "../../worker/workflows/fixture-runtime";
import type { LeasedJob } from "../../worker/jobs/repository";
import { asRole, bootstrapLatestDatabase, sql } from "./task8-db";
import { insertUsers } from "./task4-db";

const enabled = Boolean(process.env.INTENTLEAD_TEST_DATABASE_URL);
const owner = randomUUID();
const outsider = randomUUID();
const workerId = `fixture-worker-${randomUUID()}`;

const command = {
  schemaVersion: 1,
  offer: {
    name: "IntentLead Opportunity Intelligence",
    summary: "Evidence-backed company opportunity research",
    outcomes: ["Reduce manual company qualification"],
    exclusions: [],
  },
  icp: {
    name: "B2B growth teams",
    description: "Small B2B growth teams using evidence-driven prospecting",
    companyAttributes: ["B2B company"],
    exclusions: [],
  },
  objective: "Find a company with an observable need for better prospect research",
  criteria: {
    jurisdictions: [],
    languages: ["en"],
    signalFamilies: ["EXPRESSED_INTENT"],
    exclusions: [],
    limits: { maxSourceItems: 20, maxOpportunities: 5 },
  },
};

function quote(value: unknown): string {
  return JSON.stringify(value).replaceAll("'", "''");
}

function service(statement: string): string {
  return asRole("service_role", statement);
}

function execution() {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    async checkpoint() {},
    async runExternalOperation<TProvider, TResult>(
      _capability: string,
      select: () => TProvider,
      operation: (provider: TProvider, signal: AbortSignal) => Promise<TResult>,
    ) { return operation(select(), controller.signal); },
  };
}

function databaseClient() {
  return {
    async rpc(name: string, args: Record<string, unknown>) {
      try {
        const lease = `'${args.p_job_id}','${String(args.p_worker_id).replaceAll("'", "''")}','${args.p_lease_token}'`;
        if (name === "intentlead_get_self_prospecting_context") {
          const value = await sql(service(`SELECT public.intentlead_get_self_prospecting_context(${lease})`));
          return { data: JSON.parse(value), error: null };
        }
        if (name === "intentlead_get_self_prospecting_candidate") {
          const key = String(args.p_candidate_key).replaceAll("'", "''");
          const value = await sql(service(`SELECT coalesce(public.intentlead_get_self_prospecting_candidate(${lease},'${key}')::text,'null')`));
          return { data: JSON.parse(value), error: null };
        }
        if (name === "intentlead_persist_self_prospecting_candidate") {
          const key = String(args.p_candidate_key).replaceAll("'", "''");
          const slice = quote(args.p_slice);
          const value = await sql(service(`SELECT public.intentlead_persist_self_prospecting_candidate(${lease},'${key}','${slice}'::jsonb)`));
          return { data: value, error: null };
        }
        throw new Error(`unexpected RPC: ${name}`);
      } catch (cause) {
        return { data: null, error: { message: cause instanceof Error ? cause.message : "database RPC failed" } };
      }
    },
  };
}

async function createAndLease(): Promise<{ job: LeasedJob; briefId: string; workspaceId: string }> {
  const created = JSON.parse(await sql(asRole("authenticated", `SELECT public.intentlead_create_discovery_brief(
    '${quote(command)}'::jsonb,'fixture-create-${randomUUID()}'
  )`, owner))) as { discoveryBriefId: string; workspaceId: string };
  const jobId = await sql(service(`SELECT public.intentlead_enqueue_discovery_job(
    '${created.discoveryBriefId}','${owner}','fixture-run-${randomUUID()}','{}'
  )`));
  const leased = JSON.parse(await sql(service(`SELECT row_to_json(j) FROM public.intentlead_lease_next_job('${workerId}',300) j`))) as Record<string, unknown>;
  expect(leased.id).toBe(jobId);
  return {
    briefId: created.discoveryBriefId,
    workspaceId: created.workspaceId,
    job: {
      schemaVersion: 1,
      id: String(leased.id),
      workspaceId: String(leased.workspace_id),
      capability: "SOURCE_SEARCH",
      marketProfileId: "EN_DISCOVERY_ONLY",
      discoveryBriefId: String(leased.discovery_brief_id),
      idempotencyKey: String(leased.idempotency_key),
      traceId: String(leased.trace_id),
      attempt: Number(leased.attempt),
      maxAttempts: Number(leased.max_attempts),
      createdAt: String(leased.created_at),
      updatedAt: String(leased.updated_at),
      state: "LEASED",
      lease: {
        owner: String(leased.lease_owner),
        token: String(leased.lease_token),
        expiresAt: String(leased.lease_expires_at),
      },
    },
  };
}

describe.skipIf(!enabled)("Task D fixture self-prospecting in disposable PostgreSQL", () => {
  beforeAll(async () => {
    await bootstrapLatestDatabase();
    await insertUsers(owner, outsider);
  }, 60_000);

  it("persists one reviewable zero-cost Opportunity, replays idempotently, and permits human review", async () => {
    const { job, briefId, workspaceId } = await createAndLease();
    const handler = createSelfProspectingHandler(createFixtureSelfProspectingDependencies(databaseClient(), () => new Date("2026-10-06T08:00:00.000Z")));

    const first = await handler(job, execution());
    const replay = await handler(job, execution());
    expect(first.result.outcome).toBe("REVIEW_READY");
    expect(replay.result).toEqual(first.result);
    const opportunityId = (first.result.opportunityIds as string[])[0]!;

    expect(await sql(`SELECT count(*) FROM public.intentlead_opportunities WHERE id='${opportunityId}' AND workspace_id='${workspaceId}' AND state='HUMAN_REVIEW'`)).toBe("1");
    expect(await sql(`SELECT count(*) FROM public.intentlead_job_candidate_results WHERE job_id='${job.id}'`)).toBe("2");
    expect(await sql(`SELECT count(*) FROM public.intentlead_provider_runs WHERE job_id='${job.id}' AND cost_amount=0`)).toBe("4");
    expect(await sql(`SELECT count(*) FROM public.intentlead_provider_runs WHERE job_id='${job.id}' AND provider IN ('github','stackexchange')`)).toBe("2");
    expect(await sql(`SELECT count(*) FROM public.intentlead_source_items WHERE workspace_id='${workspaceId}'`)).toBe("4");
    expect(await sql(`SELECT count(*) FROM public.intentlead_evidence_items WHERE workspace_id='${workspaceId}'`)).toBe("4");
    expect(await sql(`SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace
      AND relname=ANY(ARRAY[
        'intentlead_people','intentlead_contact_points','intentlead_outreach_drafts',
        'messages','leads','campaigns'
      ])`)).toBe("0");
    expect(await sql(asRole("authenticated", `SELECT coalesce(public.intentlead_get_opportunity_for_review('${opportunityId}')::text,'null')`, outsider))).toBe("null");
    const detail = JSON.parse(await sql(asRole("authenticated", `SELECT public.intentlead_get_opportunity_for_review('${opportunityId}')`, owner))) as {
      assessment: { problemStatement: string; icpFit: number };
      evidence: Array<{ facts: { observedCondition?: string } }>;
      limitations: string[];
    };
    expect(detail.assessment.problemStatement).toContain("vendor review workflow");
    expect(detail.assessment.icpFit).toBe(0.4);
    expect(detail.evidence.some(item => item.facts.observedCondition?.includes("manual vendor checks"))).toBe(true);
    expect(detail.limitations).toEqual(expect.arrayContaining([
      "SYNTHETIC_CONTRACT_FIXTURE", "NO_NETWORK", "NOT_LIVE_PROVIDER_EVIDENCE",
    ]));

    const completed = await sql(service(`SELECT public.intentlead_complete_job(
      '${job.id}','${job.lease.owner}','${job.lease.token}','COMPLETED','${quote(first.result)}'::jsonb,NULL
    )`));
    expect(completed).toBe("t");
    expect(await sql(`SELECT state FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`)).toBe("COMPLETED");

    const reviewed = JSON.parse(await sql(asRole("authenticated", `SELECT public.intentlead_record_opportunity_review(
      '${opportunityId}','ACCEPTED','RELEVANT',NULL,'fixture-review-${randomUUID()}'
    )`, owner))) as { decision: string; replayed: boolean };
    expect(reviewed).toMatchObject({ decision: "ACCEPTED", replayed: false });
    expect(await sql(`SELECT count(*) FROM public.intentlead_human_reviews WHERE opportunity_id='${opportunityId}'`)).toBe("1");
  }, 30_000);

  it("accepts only the canonical signal taxonomy at the SQL boundary", async () => {
    expect(await sql(`SELECT public.intentlead_valid_signal('{"family":"BUSINESS_EVENT","subtype":"hiring"}')`)).toBe("t");
    expect(await sql(`SELECT public.intentlead_valid_signal('{"family":"MARKET_OBSERVATION","subtype":"visibility_gap"}')`)).toBe("t");
    expect(await sql(`SELECT public.intentlead_valid_signal('{"family":"TRIGGER_EVENT","subtype":"hiring"}')`)).toBe("f");
    expect(await sql(`SELECT public.intentlead_valid_signal('{"family":"VISIBILITY_FINDING","subtype":"ai_visibility"}')`)).toBe("f");
  });
});
