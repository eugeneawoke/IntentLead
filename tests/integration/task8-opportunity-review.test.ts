import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { asRole, bootstrapTask8Database, sql } from "./task8-db";
import { insertUsers } from "./task4-db";

const enabled = Boolean(process.env.INTENTLEAD_TEST_DATABASE_URL);
const owner = randomUUID();
const member = randomUUID();
const outsider = randomUUID();
const workspace = randomUUID();
const profile = randomUUID();
const brief = randomUUID();
const offer = randomUUID();
const icp = randomUUID();
const company = randomUUID();
const opportunities = [randomUUID(), randomUUID(), randomUUID()];
const signal = JSON.stringify({ family: "DETECTED_PROBLEM", subtype: "website" });
const reviewCapability = "ARRAY['SOURCE_SEARCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW']::text[]";
const deniedCapabilities = "ARRAY['PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','OUTREACH_READY','OUTREACH_SEND','OUTCOME_RECORDING','PACKAGE_VERIFIED']::text[]";

async function createFixture(): Promise<void> {
  await sql(`
    INSERT INTO public.workspaces (id,owner_id,name,credits_remaining) VALUES ('${workspace}','${owner}','Task 8 review fixture',10);
    INSERT INTO public.workspace_members (workspace_id,user_id,role) VALUES ('${workspace}','${member}','member');
    INSERT INTO public.intentlead_market_profiles
      (id,workspace_id,profile_key,workflow,configuration,capabilities,disabled_capabilities)
      VALUES ('${profile}','${workspace}','EN_DISCOVERY_ONLY','DISCOVERY_ONLY','{}',${reviewCapability},${deniedCapabilities});
    INSERT INTO public.intentlead_offer_profiles (id,workspace_id,name,definition)
      VALUES ('${offer}','${workspace}','Fixture offer','{}');
    INSERT INTO public.intentlead_icp_definitions (id,workspace_id,name,definition)
      VALUES ('${icp}','${workspace}','Fixture ICP','{}');
    INSERT INTO public.intentlead_discovery_briefs
      (id,workspace_id,offer_profile_id,icp_definition_id,market_profile_id,objective,criteria)
      VALUES ('${brief}','${workspace}','${offer}','${icp}','${profile}','Fixture discovery','{}');
    INSERT INTO public.intentlead_companies (id,workspace_id,canonical_name,domain,confidence)
      VALUES ('${company}','${workspace}','Fixture Company','fixture.example',.95);
  `);

  for (const [index, opportunity] of opportunities.entries()) {
    const evidence = randomUUID();
    const assessment = randomUUID();
    await sql(`
      INSERT INTO public.intentlead_evidence_items
        (id,workspace_id,evidence_type,source_url,captured_at,excerpt,structured_facts,verification_method,confidence,content_hash,provenance,tombstoned_at)
      VALUES ('${evidence}','${workspace}','structured_fact','https://example.com/source-${index}',now(),
        'Fixture-only evidence excerpt ${index}',
        '{"companyName":"Fixture Company","companyDomain":"fixture.example","problem":{"category":"website","observedCondition":"Homepage returns an unavailable page"}}',
        'fixture_public_source_capture',.9,repeat('${index + 1}',64),
        '{"sourceType":"WEB","sourceId":"${randomUUID()}","providerRunId":null,"rawArtifactId":null}',
        ${index === 2 ? "now()" : "NULL"});
      INSERT INTO public.intentlead_opportunities
        (id,workspace_id,discovery_brief_id,company_id,state,signal)
      VALUES ('${opportunity}','${workspace}','${brief}','${company}','DISCOVERED','${signal}'::jsonb);
      INSERT INTO public.intentlead_opportunity_evidence (workspace_id,opportunity_id,evidence_id)
        VALUES ('${workspace}','${opportunity}','${evidence}');
      INSERT INTO public.intentlead_opportunity_assessments
        (id,workspace_id,opportunity_id,version,decision,signal,problem_type,problem_statement,
         evidence_strength,explicitness,urgency,freshness,commercial_impact,icp_fit,company_confidence,
         buyer_relevance,actionability,confidence,review_reasons,assessed_at)
      VALUES ('${assessment}','${workspace}','${opportunity}',1,'REVIEW','${signal}'::jsonb,
        'WEBSITE','Fixture interpretation not shown in the review UI',.9,.8,.7,1,.8,.85,.95,.8,.8,.88,
        ARRAY['POLICY_REVIEW_REQUIRED'],now());
      INSERT INTO public.intentlead_assessment_evidence (workspace_id,assessment_id,opportunity_id,evidence_id)
        VALUES ('${workspace}','${assessment}','${opportunity}','${evidence}');
      UPDATE public.intentlead_opportunities SET state='HUMAN_REVIEW',current_assessment_id='${assessment}'
        WHERE id='${opportunity}' AND workspace_id='${workspace}';
    `);
  }
}

function rpc(userId: string, id: string, decision: string, reason: string, key: string, note: string | null = null): string {
  const noteSql = note === null ? "NULL" : `'${note.replaceAll("'", "''")}'`;
  return asRole("authenticated", `SELECT public.intentlead_record_opportunity_review('${id}','${decision}','${reason}',${noteSql},'${key}')`, userId);
}

describe.skipIf(!enabled)("Task 8 disposable PostgreSQL review boundary", () => {
  beforeAll(async () => {
    await bootstrapTask8Database();
    await insertUsers(owner, member, outsider);
    await createFixture();
  }, 60_000);

  it("serves owner/member discovery DTOs, strict pagination, safe evidence and outsider non-enumeration", async () => {
    const ownerList = JSON.parse(await sql(asRole("authenticated", `SELECT public.intentlead_list_opportunities_for_review(1,NULL,NULL)`, owner))) as { rows: unknown[]; hasMore: boolean };
    expect(ownerList.rows).toHaveLength(1);
    expect(ownerList.hasMore).toBe(true);
    const memberDetail = await sql(asRole("authenticated", `SELECT public.intentlead_get_opportunity_for_review('${opportunities[0]}')`, member));
    expect(memberDetail).toContain("Fixture Company");
    expect(memberDetail).not.toContain("Fixture-only evidence excerpt");
    expect(memberDetail).not.toContain("Fixture interpretation not shown");
    expect(memberDetail).not.toContain("contactEmail");
    const missingEvidence = JSON.parse(await sql(asRole("authenticated", `SELECT public.intentlead_get_opportunity_for_review('${opportunities[2]}')`, member))) as { evidenceStatus: string; evidence: unknown[] };
    expect(missingEvidence.evidenceStatus).toBe("MISSING");
    expect(missingEvidence.evidence).toEqual([]);
    expect(await sql(asRole("authenticated", `SELECT public.intentlead_list_opportunities_for_review(50,NULL,NULL)`, outsider))).toContain('"rows": []');
    expect(await sql(asRole("authenticated", `SELECT coalesce(public.intentlead_get_opportunity_for_review('${opportunities[0]}')::text,'null')`, outsider))).toBe("null");
  });

  it("limits direct review insertion and RPC execution to authenticated members", async () => {
    expect(await sql(`SELECT has_table_privilege('authenticated','public.intentlead_human_reviews','INSERT')`)).toBe("f");
    expect(await sql(`SELECT has_function_privilege('service_role','public.intentlead_record_opportunity_review(uuid,text,text,text,text)','EXECUTE')`)).toBe("f");
    await expect(sql(asRole("authenticated", `INSERT INTO public.intentlead_human_reviews
      (workspace_id,opportunity_id,reviewer_id,decision,reason) VALUES ('${workspace}','${opportunities[0]}','${member}','ACCEPTED','RELEVANT')`, member)))
      .rejects.toThrow(/permission denied|row-level security/);
    await expect(sql(rpc(outsider, opportunities[0], "ACCEPTED", "RELEVANT", "outsider-key-0001")))
      .rejects.toThrow(/opportunity_not_found/);
    await expect(sql(asRole("authenticated", `SELECT public.intentlead_record_opportunity_review('${opportunities[0]}','ACCEPTED','RELEVANT',NULL,'anonymous-key-0001')`)))
      .rejects.toThrow(/authentication_required/);
  });

  it("serializes concurrent exact replays once and rejects changed or stale decisions", async () => {
    const key = "task8-concurrent-0001";
    const results = await Promise.all([
      sql(rpc(member, opportunities[0], "ACCEPTED", "RELEVANT", key)),
      sql(rpc(member, opportunities[0], "ACCEPTED", "RELEVANT", key)),
    ]);
    const replayed = results.map(value => JSON.parse(value).replayed).sort();
    expect(replayed).toEqual([false, true]);
    expect(await sql(`SELECT state FROM public.intentlead_opportunities WHERE id='${opportunities[0]}'`)).toBe("HUMAN_REVIEW");
    expect(Number(await sql(`SELECT count(*) FROM public.intentlead_human_reviews WHERE opportunity_id='${opportunities[0]}' AND tombstoned_at IS NULL`))).toBe(1);
    const before = JSON.parse(results[0]);
    const replay = JSON.parse(await sql(rpc(member, opportunities[0], "ACCEPTED", "RELEVANT", key)));
    expect(replay).toMatchObject({ replayed: true, reviewedAt: before.reviewedAt, state: "HUMAN_REVIEW" });
    await expect(sql(rpc(member, opportunities[0], "ACCEPTED", "RELEVANT", key, "changed note"))).rejects.toThrow(/idempotency_conflict/);
    await expect(sql(rpc(member, opportunities[0], "REJECTED", "WEAK_SIGNAL", "second-decision-0001"))).rejects.toThrow(/stale_opportunity/);
  });

  it("records reject/research deterministically and leaves all downstream and credit rows unchanged", async () => {
    const before = JSON.parse(await sql(`SELECT jsonb_build_object(
      'credits',(SELECT credits_remaining FROM public.workspaces WHERE id='${workspace}'),
      'contacts',(SELECT count(*) FROM public.intentlead_contact_points WHERE workspace_id='${workspace}'),
      'drafts',(SELECT count(*) FROM public.intentlead_outreach_drafts WHERE workspace_id='${workspace}'),
      'outcomes',(SELECT count(*) FROM public.intentlead_outcomes WHERE workspace_id='${workspace}'),
      'packages',(SELECT count(*) FROM public.intentlead_verified_packages WHERE workspace_id='${workspace}'),
      'costEvents',(SELECT count(*) FROM public.intentlead_cost_events WHERE workspace_id='${workspace}')
    )`));
    const rejected = JSON.parse(await sql(rpc(member, opportunities[1], "REJECTED", "WEAK_SIGNAL", "task8-reject-key-001")));
    const research = JSON.parse(await sql(rpc(owner, opportunities[2], "NEEDS_RESEARCH", "OTHER", "task8-research-key-01", "Need another source")));
    expect(rejected.state).toBe("REJECTED");
    expect(research.state).toBe("NEEDS_RESEARCH");
    const after = JSON.parse(await sql(`SELECT jsonb_build_object(
      'credits',(SELECT credits_remaining FROM public.workspaces WHERE id='${workspace}'),
      'contacts',(SELECT count(*) FROM public.intentlead_contact_points WHERE workspace_id='${workspace}'),
      'drafts',(SELECT count(*) FROM public.intentlead_outreach_drafts WHERE workspace_id='${workspace}'),
      'outcomes',(SELECT count(*) FROM public.intentlead_outcomes WHERE workspace_id='${workspace}'),
      'packages',(SELECT count(*) FROM public.intentlead_verified_packages WHERE workspace_id='${workspace}'),
      'costEvents',(SELECT count(*) FROM public.intentlead_cost_events WHERE workspace_id='${workspace}')
    )`));
    expect(after).toEqual(before);
  });
});
