import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { bootstrapTask8Database, asRole, sql } from "./task8-db";
import { insertUsers } from "./task4-db";

const owner = randomUUID();
const outsider = randomUUID();

const command = {
  schemaVersion: 1,
  offer: { name: "Native offer", summary: "Evidence-backed opportunity research", outcomes: [], exclusions: [] },
  icp: { name: "Native ICP", description: "English-language B2B companies", companyAttributes: [], exclusions: [] },
  objective: "Find companies with observable commercial problems",
  criteria: {
    jurisdictions: [], languages: ["en"], signalFamilies: ["EXPRESSED_INTENT", "BUSINESS_EVENT"],
    exclusions: [], limits: { maxSourceItems: 25, maxOpportunities: 10 },
  },
};

function literal(value: unknown): string {
  return JSON.stringify(value).replaceAll("'", "''");
}

async function create(userId: string, key: string, value: unknown = command): Promise<Record<string, unknown>> {
  const result = await sql(asRole("authenticated", `SELECT public.intentlead_create_discovery_brief(
    '${literal(value)}'::jsonb,'${key}'
  )`, userId));
  return JSON.parse(result) as Record<string, unknown>;
}

beforeAll(async () => {
  await bootstrapTask8Database();
  await insertUsers(owner, outsider);
}, 30_000);

describe("native DiscoveryBrief authority", () => {
  it("atomically creates one native Offer, ICP, profile and brief under concurrent replay", async () => {
    const key = `native-create-${randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 8 }, () => create(owner, key)));
    const briefIds = new Set(results.map(result => result.discoveryBriefId));
    expect(briefIds.size).toBe(1);
    const briefId = String(results[0].discoveryBriefId);
    const workspaceId = String(results[0].workspaceId);
    expect(await sql(`SELECT count(*) FROM public.intentlead_discovery_briefs WHERE id='${briefId}' AND legacy_campaign_id IS NULL`)).toBe("1");
    expect(await sql(`SELECT count(*) FROM public.intentlead_offer_profiles WHERE workspace_id='${workspaceId}' AND name='Native offer'`)).toBe("1");
    expect(await sql(`SELECT count(*) FROM public.intentlead_icp_definitions WHERE workspace_id='${workspaceId}' AND name='Native ICP'`)).toBe("1");
    expect(await sql(`SELECT count(*) FROM public.campaigns WHERE workspace_id='${workspaceId}'`)).toBe("0");
    await expect(create(owner, key, { ...command, objective: "Different objective" })).rejects.toThrow(/idempotency_conflict/);
  }, 20_000);

  it("keeps context, list and enqueue non-disclosing across tenants", async () => {
    const result = await create(owner, `native-auth-${randomUUID()}`);
    const briefId = String(result.discoveryBriefId);
    expect(await sql(asRole("authenticated", `SELECT count(*) FROM public.intentlead_discovery_context('${briefId}')`, owner))).toBe("1");
    expect(await sql(asRole("authenticated", `SELECT count(*) FROM public.intentlead_discovery_context('${briefId}')`, outsider))).toBe("0");
    expect(Number(await sql(asRole("authenticated", "SELECT count(*) FROM public.intentlead_list_discovery_briefs()", owner)))).toBeGreaterThan(0);
    expect(await sql(asRole("authenticated", "SELECT count(*) FROM public.intentlead_list_discovery_briefs()", outsider))).toBe("0");
    await expect(sql(asRole("service_role", `SELECT public.intentlead_enqueue_discovery_job(
      '${briefId}','${outsider}','native-run-${randomUUID()}','{}'
    )`))).rejects.toThrow(/forbidden/);
    const jobId = await sql(asRole("service_role", `SELECT public.intentlead_enqueue_discovery_job(
      '${briefId}','${owner}','native-run-${randomUUID()}','{}'
    )`));
    expect(jobId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await sql(`SELECT state FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`)).toBe("QUEUED");
    await sql(asRole("service_role", `SELECT public.intentlead_cancel_job('${jobId}','${owner}')`));
  });

  it("rejects oversized or non-string payload arrays at the authenticated SQL boundary", async () => {
    const tooManyJurisdictions = {
      ...command,
      criteria: {
        ...command.criteria,
        jurisdictions: Array.from({ length: 31 }, () => ({ countryCode: "US", subdivisionCode: null })),
      },
    };
    await expect(create(owner, `native-invalid-${randomUUID()}`, tooManyJurisdictions))
      .rejects.toThrow(/invalid_discovery_command/);
    const invalidOutcome = {
      ...command,
      offer: { ...command.offer, outcomes: [{ unsafe: "object" }] },
    };
    await expect(create(owner, `native-invalid-${randomUUID()}`, invalidOutcome))
      .rejects.toThrow(/invalid_discovery_command/);
    const missingRequiredArray = {
      ...command,
      offer: { name: command.offer.name, summary: command.offer.summary, exclusions: [] },
    };
    await expect(create(owner, `native-invalid-${randomUUID()}`, missingRequiredArray))
      .rejects.toThrow(/invalid_discovery_command/);
    const invalidSubdivisionType = {
      ...command,
      criteria: {
        ...command.criteria,
        jurisdictions: [{ countryCode: "US", subdivisionCode: 12 }],
      },
    };
    await expect(create(owner, `native-invalid-${randomUUID()}`, invalidSubdivisionType))
      .rejects.toThrow(/invalid_discovery_command/);
    const missingSchemaVersion = { ...command, schemaVersion: undefined };
    await expect(create(owner, `native-invalid-${randomUUID()}`, missingSchemaVersion))
      .rejects.toThrow(/invalid_discovery_command/);
  });

  it("updates and deletes the native brief without mutating an unrelated legacy campaign", async () => {
    const result = await create(owner, `native-lifecycle-${randomUUID()}`);
    const briefId = String(result.discoveryBriefId);
    const workspaceId = String(result.workspaceId);
    const campaignId = randomUUID();
    await sql(`INSERT INTO public.campaigns(id,workspace_id,entry_mode,what_selling,icp,pain,status)
      VALUES ('${campaignId}','${workspaceId}','cold','legacy offer','legacy icp','legacy pain','draft')`);
    const jobId = await sql(asRole("service_role", `SELECT public.intentlead_enqueue_discovery_job(
      '${briefId}','${owner}','native-lifecycle-run-${randomUUID()}','{}'
    )`));
    const lease = await sql(asRole("service_role", `SELECT id || '|' || lease_token
      FROM public.intentlead_lease_next_job('native-lifecycle-worker',30)`));
    expect(lease.split("|")[0]).toBe(jobId);
    expect(await sql(asRole("service_role", `SELECT public.intentlead_complete_job(
      '${jobId}','native-lifecycle-worker','${lease.split("|")[1]}','COMPLETED','{"outcome":"fixture"}',NULL
    )`))).toBe("t");
    expect(await sql(`SELECT state FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`)).toBe("COMPLETED");
    expect(await sql(`SELECT status FROM public.campaigns WHERE id='${campaignId}'`)).toBe("draft");
    expect(await sql(asRole("service_role", `SELECT public.intentlead_delete_discovery_brief('${briefId}','${owner}','owner_requested')`))).toBe("t");
    expect(await sql(`SELECT state FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`)).toBe("CANCELLED");
    expect(await sql(`SELECT deleted_at IS NOT NULL FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`)).toBe("t");
    expect(await sql(asRole("authenticated", `SELECT count(*) FROM public.intentlead_discovery_context('${briefId}')`, owner))).toBe("0");
    expect(await sql(asRole("authenticated", `SELECT count(*) FROM public.intentlead_list_discovery_briefs() AS rows(value)
      WHERE value->>'id'='${briefId}'`, owner))).toBe("0");
    expect(await sql(`SELECT name LIKE 'deleted:%' AND definition='{}'::jsonb
      FROM public.intentlead_offer_profiles WHERE id='${result.offerProfileId}'`)).toBe("t");
    expect(await sql(`SELECT name LIKE 'deleted:%' AND definition='{}'::jsonb
      FROM public.intentlead_icp_definitions WHERE id='${result.icpDefinitionId}'`)).toBe("t");
    expect(await sql(`SELECT configuration#>'{jurisdictions}'='[]'::jsonb
      FROM public.intentlead_market_profiles WHERE id='${result.marketProfileId}'`)).toBe("t");
    expect(await sql(`SELECT status || '|' || what_selling FROM public.campaigns WHERE id='${campaignId}'`)).toBe("draft|legacy offer");
  });
});
