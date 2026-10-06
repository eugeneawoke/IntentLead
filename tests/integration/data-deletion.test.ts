import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { insertUsers } from "./task4-db";
import { asRole, bootstrapLatestDatabase, sql } from "./task8-db";

const enabled = Boolean(process.env.INTENTLEAD_TEST_DATABASE_URL);
const owner = randomUUID();
const outsider = randomUUID();

async function fixture(label: string) {
  const workspaceId = randomUUID();
  const offerId = randomUUID();
  const icpId = randomUUID();
  const marketId = randomUUID();
  const briefId = randomUUID();
  await sql(`
    INSERT INTO public.workspaces(id,owner_id,name) VALUES ('${workspaceId}','${owner}','${label} workspace');
    INSERT INTO public.intentlead_offer_profiles(id,workspace_id,name,definition)
      VALUES ('${offerId}','${workspaceId}','${label} offer','{"private":"offer"}');
    INSERT INTO public.intentlead_icp_definitions(id,workspace_id,name,definition)
      VALUES ('${icpId}','${workspaceId}','${label} ICP','{"private":"icp"}');
    INSERT INTO public.intentlead_market_profiles(
      id,workspace_id,profile_key,workflow,configuration,capabilities,disabled_capabilities
    ) VALUES (
      '${marketId}','${workspaceId}','EN_DISCOVERY_ONLY','DISCOVERY_ONLY','{"private":"market"}',
      ARRAY['SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW']::text[],
      ARRAY[]::text[]
    );
    INSERT INTO public.intentlead_discovery_briefs(
      id,workspace_id,offer_profile_id,icp_definition_id,market_profile_id,objective,criteria
    ) VALUES ('${briefId}','${workspaceId}','${offerId}','${icpId}','${marketId}','Private objective','{"private":"criteria"}');
  `);
  return { workspaceId, offerId, icpId, marketId, briefId };
}

async function addOpportunity(data: Awaited<ReturnType<typeof fixture>>, suffix: string) {
  const companyId = randomUUID();
  const sourceId = randomUUID();
  const evidenceId = randomUUID();
  const opportunityId = randomUUID();
  await sql(`
    INSERT INTO public.intentlead_companies(id,workspace_id,canonical_name,domain,confidence)
      VALUES ('${companyId}','${data.workspaceId}','Private Company ${suffix}','${suffix}.example',.9);
    INSERT INTO public.intentlead_source_items(
      id,workspace_id,provider,external_id,source_url,content,normalized_facts,provenance,content_hash,captured_at
    ) VALUES (
      '${sourceId}','${data.workspaceId}','fixture','${suffix}','https://example.test/${suffix}',
      'private source ${suffix}','{}','{"sourceType":"WEB","sourceId":"${sourceId}","providerRunId":null,"rawArtifactId":null}',
      repeat('a',64),now()
    );
    INSERT INTO public.intentlead_evidence_items(
      id,workspace_id,source_item_id,evidence_type,captured_at,excerpt,structured_facts,verification_method,
      confidence,content_hash,provenance
    ) VALUES (
      '${evidenceId}','${data.workspaceId}','${sourceId}','text',now(),'private evidence ${suffix}','{}','fixture',.9,
      repeat('b',64),'{"sourceType":"WEB","sourceId":"${sourceId}","providerRunId":null,"rawArtifactId":null}'
    );
    INSERT INTO public.intentlead_opportunities(id,workspace_id,discovery_brief_id,company_id,state,signal)
      VALUES ('${opportunityId}','${data.workspaceId}','${data.briefId}','${companyId}','DISCOVERED',
        '{"family":"DETECTED_PROBLEM","subtype":"operations"}');
    INSERT INTO public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id)
      VALUES ('${data.workspaceId}','${opportunityId}','${evidenceId}');
  `);
  return { companyId, sourceId, evidenceId, opportunityId };
}

describe.skipIf(!enabled)("Opportunity Core owner deletion", () => {
  beforeAll(async () => {
    await bootstrapLatestDatabase();
    await insertUsers(owner, outsider);
  }, 60_000);

  it("cancels work and redacts the native brief graph idempotently", async () => {
    const data = await fixture("delete");
    const row = await addOpportunity(data, "delete");
    const jobId = await sql(asRole("service_role", `SELECT public.intentlead_enqueue_discovery_job(
      '${data.briefId}','${owner}','delete-${randomUUID()}','{"private":"payload"}'
    )`));
    await expect(sql(asRole("service_role", `SELECT public.intentlead_delete_discovery_brief(
      '${data.briefId}','${outsider}','owner_requested'
    )`))).rejects.toThrow(/forbidden/);
    const call = () => sql(asRole("service_role", `SELECT public.intentlead_delete_discovery_brief(
      '${data.briefId}','${owner}','owner_requested'
    )`));
    expect(await call()).toBe("t");
    expect(await call()).toBe("t");
    expect(await sql(`SELECT state || '|' || payload::text || '|' || checkpoint::text
      FROM public.intentlead_jobs WHERE id='${jobId}'`)).toBe("CANCELLED|{}|{}");
    expect(await sql(`SELECT state || '|' || objective || '|' || criteria::text
      FROM public.intentlead_discovery_briefs WHERE id='${data.briefId}'`)).toBe("CANCELLED|[deleted]|{}");
    expect(await sql(`SELECT content IS NULL AND tombstoned_at IS NOT NULL
      FROM public.intentlead_source_items WHERE id='${row.sourceId}'`)).toBe("t");
    expect(await sql(`SELECT excerpt IS NULL AND tombstoned_at IS NOT NULL
      FROM public.intentlead_evidence_items WHERE id='${row.evidenceId}'`)).toBe("t");
    expect(await sql(`SELECT canonical_name='[deleted]' AND tombstoned_at IS NOT NULL
      FROM public.intentlead_companies WHERE id='${row.companyId}'`)).toBe("t");
    expect(await sql(`SELECT tombstoned_at IS NOT NULL AND state='ARCHIVED'
      FROM public.intentlead_opportunities WHERE id='${row.opportunityId}'`)).toBe("t");
    expect(await sql(`SELECT count(*) FROM public.intentlead_deletion_tombstones
      WHERE resource_type='OPPORTUNITY' AND resource_id='${row.opportunityId}'`)).toBe("1");
  });

  it("preserves source, evidence, and company data still referenced by a live Opportunity", async () => {
    const data = await fixture("shared");
    const row = await addOpportunity(data, "shared");
    const otherBrief = randomUUID();
    const otherOpportunity = randomUUID();
    await sql(`
      INSERT INTO public.intentlead_discovery_briefs(
        id,workspace_id,offer_profile_id,icp_definition_id,market_profile_id,objective,criteria
      ) VALUES ('${otherBrief}','${data.workspaceId}','${data.offerId}','${data.icpId}','${data.marketId}','Other brief','{}');
      INSERT INTO public.intentlead_opportunities(id,workspace_id,discovery_brief_id,company_id,state,signal)
      VALUES ('${otherOpportunity}','${data.workspaceId}','${otherBrief}','${row.companyId}','DISCOVERED',
        '{"family":"DETECTED_PROBLEM","subtype":"operations"}');
      INSERT INTO public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id)
      VALUES ('${data.workspaceId}','${otherOpportunity}','${row.evidenceId}');
    `);
    expect(await sql(asRole("service_role", `SELECT public.intentlead_delete_discovery_brief(
      '${data.briefId}','${owner}','owner_requested'
    )`))).toBe("t");
    expect(await sql(`SELECT content='private source shared' AND tombstoned_at IS NULL
      FROM public.intentlead_source_items WHERE id='${row.sourceId}'`)).toBe("t");
    expect(await sql(`SELECT excerpt='private evidence shared' AND tombstoned_at IS NULL
      FROM public.intentlead_evidence_items WHERE id='${row.evidenceId}'`)).toBe("t");
    expect(await sql(`SELECT canonical_name='Private Company shared' AND tombstoned_at IS NULL
      FROM public.intentlead_companies WHERE id='${row.companyId}'`)).toBe("t");
  });
});
