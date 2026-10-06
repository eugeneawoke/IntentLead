import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { asRole, bootstrapLatestDatabase, sql } from "./task8-db";
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
const opportunities = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const signal = JSON.stringify({ family: "DETECTED_PROBLEM", subtype: "market_presence" });
const reviewCapability = "ARRAY['SOURCE_SEARCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW']::text[]";
const deniedCapabilities = "ARRAY[]::text[]";

async function createFixture(): Promise<void> {
  await sql(`
    INSERT INTO public.workspaces (id,owner_id,name) VALUES ('${workspace}','${owner}','Task 8 review fixture');
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
    const observedCondition = index === 3 ? "Reach owner@example.test" : "Homepage returns an unavailable page";
    const problemStatement = index === 3
      ? "Contact owner@example.test"
      : "Fixture interpretation not shown in the review UI";
    await sql(`
      INSERT INTO public.intentlead_evidence_items
        (id,workspace_id,evidence_type,source_url,captured_at,excerpt,structured_facts,verification_method,confidence,content_hash,provenance,tombstoned_at)
      VALUES ('${evidence}','${workspace}','structured_fact','https://example.com/source-${index}',now(),
        'Fixture-only evidence excerpt ${index}',
        '{"companyName":"Fixture Company","companyDomain":"fixture.example","problem":{"category":"website","observedCondition":"${observedCondition}"}}',
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
        'WEBSITE','${problemStatement}',.9,.8,.7,1,.8,.85,.95,.8,.8,.88,
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
    await bootstrapLatestDatabase();
    await insertUsers(owner, member, outsider);
    await createFixture();
  }, 60_000);

  it("serves owner/member discovery DTOs, strict pagination, safe evidence and outsider non-enumeration", async () => {
    const ownerList = JSON.parse(await sql(asRole("authenticated", `SELECT public.intentlead_list_opportunities_for_review(1,NULL,NULL)`, owner))) as { rows: unknown[]; hasMore: boolean };
    expect(ownerList.rows).toHaveLength(1);
    expect(ownerList.hasMore).toBe(true);
    const memberDetail = await sql(asRole("authenticated", `SELECT public.intentlead_get_opportunity_for_review('${opportunities[0]}')`, member));
    expect(memberDetail).toContain("Fixture Company");
    expect(memberDetail).toContain("Homepage returns an unavailable page");
    expect(memberDetail).toContain("Fixture interpretation not shown");
    expect(memberDetail).toContain("Fixture-only evidence excerpt");
    expect(memberDetail).not.toContain("contactEmail");
    const missingEvidence = JSON.parse(await sql(asRole("authenticated", `SELECT public.intentlead_get_opportunity_for_review('${opportunities[2]}')`, member))) as { evidenceStatus: string; evidence: unknown[] };
    expect(missingEvidence.evidenceStatus).toBe("MISSING");
    expect(missingEvidence.evidence).toEqual([]);
    expect(await sql(asRole("authenticated", `SELECT public.intentlead_list_opportunities_for_review(50,NULL,NULL)`, outsider))).toContain('"rows": []');
    expect(await sql(asRole("authenticated", `SELECT coalesce(public.intentlead_get_opportunity_for_review('${opportunities[0]}')::text,'null')`, outsider))).toBe("null");
  });

  it("revokes direct IntentLead Data API reads and removes retired schema boundaries", async () => {
    expect(await sql(`SELECT count(*) FROM information_schema.tables t
      WHERE t.table_schema='public' AND t.table_name LIKE 'intentlead_%'
        AND has_table_privilege('authenticated',format('%I.%I',t.table_schema,t.table_name),'SELECT')`)).toBe("0");
    expect(await sql(`SELECT has_table_privilege('service_role','public.intentlead_jobs','SELECT')`)).toBe("t");
    expect(await sql(`SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace
      AND relname=ANY(ARRAY['leads','intentlead_people','intentlead_contact_points'])`)).toBe("0");
    expect(await sql(`SELECT to_regprocedure('public.intentlead_discovery_setup_for_campaign(uuid)') IS NULL`)).toBe("t");
  });

  it("omits unsafe person-like evidence and assessment text from the strict review projection", async () => {
    const projected = await sql(asRole("authenticated", `SELECT public.intentlead_get_opportunity_for_review('${opportunities[3]}')`, member));
    expect(projected).not.toContain("owner@example.test");
    expect(projected).toContain('"problemStatement": null');
  });

  it("filters protocol-less domain paths in SQL facts, interpretation, and source URL", async () => {
    const factText = "Profile references: jane.example.com/in/jane, linkedin.com/in/x, example.co.uk/path.";
    const interpretation = "Possible profile: jane.example.com/in/jane; linkedin.com/in/x; example.co.uk/path.";
    const projectedOpportunity = randomUUID();
    const projectedEvidence = randomUUID();
    const projectedAssessment = randomUUID();
    await sql(`
      INSERT INTO public.intentlead_evidence_items
        (id,workspace_id,evidence_type,source_url,captured_at,excerpt,structured_facts,verification_method,confidence,content_hash,provenance)
      VALUES ('${projectedEvidence}','${workspace}','structured_fact','jane.example.com/in/jane',now(),
        'Fixture-only evidence excerpt','{"companyName":"Fixture Company","companyDomain":"fixture.example","problem":{"category":"website","observedCondition":"${factText}"}}',
        'fixture_public_source_capture',.9,repeat('9',64),
        '{"sourceType":"WEB","sourceId":"${randomUUID()}","providerRunId":null,"rawArtifactId":null}');
      INSERT INTO public.intentlead_opportunities
        (id,workspace_id,discovery_brief_id,company_id,state,signal)
      VALUES ('${projectedOpportunity}','${workspace}','${brief}','${company}','DISCOVERED','${signal}'::jsonb);
      INSERT INTO public.intentlead_opportunity_evidence (workspace_id,opportunity_id,evidence_id)
        VALUES ('${workspace}','${projectedOpportunity}','${projectedEvidence}');
      INSERT INTO public.intentlead_opportunity_assessments
        (id,workspace_id,opportunity_id,version,decision,signal,problem_type,problem_statement,
         evidence_strength,explicitness,urgency,freshness,commercial_impact,icp_fit,company_confidence,
         buyer_relevance,actionability,confidence,review_reasons,assessed_at)
      VALUES ('${projectedAssessment}','${workspace}','${projectedOpportunity}',1,'REVIEW','${signal}'::jsonb,
        'WEBSITE','${interpretation}',.9,.8,.7,1,.8,.85,.95,.8,.8,.88,ARRAY['POLICY_REVIEW_REQUIRED'],now());
      INSERT INTO public.intentlead_assessment_evidence (workspace_id,assessment_id,opportunity_id,evidence_id)
        VALUES ('${workspace}','${projectedAssessment}','${projectedOpportunity}','${projectedEvidence}');
      UPDATE public.intentlead_opportunities SET current_assessment_id='${projectedAssessment}',state='HUMAN_REVIEW'
        WHERE id='${projectedOpportunity}' AND workspace_id='${workspace}';
    `);

    const projected = await sql(asRole("authenticated", `SELECT public.intentlead_get_opportunity_for_review('${projectedOpportunity}')`, member));

    for (const unsafe of ["jane.example.com/in/jane", "linkedin.com/in/x", "example.co.uk/path"]) {
      expect(projected).not.toContain(unsafe);
    }
    expect(projected).toContain('"problemStatement": null');
    expect(projected).toContain('"sourceUrl": null');
  });
  it("sanitizes source URLs in the direct authenticated detail RPC", async () => {
    const project = async (sourceUrl: string) => {
      const evidenceId = randomUUID(), sourceId = randomUUID(), hash = randomUUID().replaceAll("-", "").repeat(2);
      await sql(`INSERT INTO public.intentlead_evidence_items (id,workspace_id,evidence_type,source_url,captured_at,excerpt,structured_facts,verification_method,confidence,content_hash,provenance)
        VALUES ('${evidenceId}','${workspace}','structured_fact','${sourceUrl.replaceAll("'", "''")}',now(),'Fixture URL evidence','{"companyName":"Fixture Company","companyDomain":"fixture.example","problem":{"category":"website","observedCondition":"Homepage unavailable"}}','fixture_public_source_capture',.9,'${hash}','{"sourceType":"WEB","sourceId":"${sourceId}","providerRunId":null,"rawArtifactId":null}');
        INSERT INTO public.intentlead_opportunity_evidence (workspace_id,opportunity_id,evidence_id) VALUES ('${workspace}','${opportunities[0]}','${evidenceId}');`);
      const raw = await sql(asRole("authenticated", `SELECT public.intentlead_get_opportunity_for_review('${opportunities[0]}')`, member)); const dto = JSON.parse(raw) as { evidence: Array<{ id: string; sourceUrl: string | null }> };
      return { sourceUrl: dto.evidence.find(entry => entry.id === evidenceId)?.sourceUrl ?? null, raw };
    };
    const cases = [
      ["https://example.com/用户@example.com", null], ["https://example.com/posts/user@example.com", null], ["https://example.com/in/jane%2Edoe", null], ["https://user@example.com/posts/abc-123", null], ["https://example.com:8443/path", null], ["https://example.com:443/path", null], ["https://xn--a.example/path", null], ["https://xn--bcher-kva.de/path", null],
      ["https://example.com/posts/abc-123?token=secret%40example.com#private", "https://example.com/posts/abc-123"], ["https://example.com:99999/posts/abc-123", null], ["https://999.999.999.999/posts/abc-123", null], ["https://example.com/posts\\abc-123", null],
      ["https://news.ycombinator.com/item?id=12345678", "https://news.ycombinator.com/item?id=12345678"], ["https://news.ycombinator.com/item?id=12345678&token=secret", "https://news.ycombinator.com/item"],
      ["HTTPS://EXAMPLE.COM/posts/abc-123", "https://example.com/posts/abc-123"], ["https://EXAMPLE.COM", "https://example.com/"], ["HTTPS://EXAMPLE.COM/posts/", "https://example.com/posts/"],
      ["https://0x7f.0.0.1/x", null], ["https://0x7f.1/x", null], ["https://0177.0.0.1/x", null],
      ["https://2130706433/x", null], ["https://127.1/x", null], ["https://123.example.com/path", "https://123.example.com/path"],
      ["\thttps://example.com/posts/abc-123", null], ["https://example.com/posts/abc-123\r\n", null], [" https://example.com/posts/abc-123 ", null],
    ] as const;
    for (const [sourceUrl, expected] of cases) {
      const projected = await project(sourceUrl);
      expect(projected.sourceUrl).toBe(expected); if (sourceUrl.includes("token=")) expect(projected.raw).not.toMatch(/token=secret|alice%40|#/);
    }
    expect(await sql(`SELECT count(*)=5 FROM pg_proc p WHERE p.oid IN ('public.intentlead_review_source_url_path_is_safe(text)'::regprocedure,'public.intentlead_review_source_url_host_is_safe(text)'::regprocedure,'public.intentlead_review_source_url_domain_is_allowed(text)'::regprocedure,'public.intentlead_sanitize_review_source_url(text)'::regprocedure,'public.intentlead_build_opportunity_review_dto(uuid,boolean)'::regprocedure) AND 'search_path=pg_catalog, public'=ANY(p.proconfig) AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE') AND NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('service_role',p.oid,'EXECUTE')`)).toBe("t");
    expect(await sql(`SELECT has_function_privilege('authenticated','public.intentlead_get_opportunity_for_review(uuid)','EXECUTE')`)).toBe("t"); expect((await project("HTTPS://EXAMPLE.COM/research?campaign=private#section")).sourceUrl).toBe("https://example.com/research");
    expect(await sql(asRole("authenticated", `SELECT coalesce(public.intentlead_get_opportunity_for_review('${opportunities[0]}')::text,'null')`, outsider))).toBe("null");
  });
  it.each([
    "jane.example.com/in/jane",
    "linkedin.com/in/x",
    "example.co.uk/path",
  ])("rejects protocol-less domain paths in direct SQL review notes: %s", async note => {
    await expect(sql(rpc(member, opportunities[3], "NEEDS_RESEARCH", "OTHER", `task8-url-note-${randomUUID()}`, note)))
      .rejects.toThrow(/invalid_review_note/);
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
    expect(await sql(`SELECT state FROM public.intentlead_opportunities WHERE id='${opportunities[0]}'`)).toBe("ACCEPTED");
    const acceptedDetail = JSON.parse(await sql(asRole("authenticated", `SELECT public.intentlead_get_opportunity_for_review('${opportunities[0]}')`, member))) as { id: string; state: string };
    expect(acceptedDetail).toMatchObject({ id: opportunities[0], state: "ACCEPTED" });
    const acceptedList = JSON.parse(await sql(asRole("authenticated", `SELECT public.intentlead_list_opportunities_for_review(50,NULL,NULL)`, member))) as { rows: Array<{ id: string; state: string }> };
    expect(acceptedList.rows).toContainEqual(expect.objectContaining({ id: opportunities[0], state: "ACCEPTED" }));
    expect(Number(await sql(`SELECT count(*) FROM public.intentlead_human_reviews WHERE opportunity_id='${opportunities[0]}' AND tombstoned_at IS NULL`))).toBe(1);
    const before = JSON.parse(results[0]);
    const replay = JSON.parse(await sql(rpc(member, opportunities[0], "ACCEPTED", "RELEVANT", key)));
    expect(replay).toMatchObject({ replayed: true, reviewedAt: before.reviewedAt, state: "ACCEPTED" });
    await expect(sql(rpc(member, opportunities[0], "ACCEPTED", "RELEVANT", key, "changed note"))).rejects.toThrow(/idempotency_conflict/);
    await expect(sql(rpc(member, opportunities[0], "REJECTED", "WEAK_SIGNAL", "second-decision-0001"))).rejects.toThrow(/stale_opportunity/);
  });
  it("fails closed when acceptance has no active evidence", async () => {
    await expect(sql(rpc(member, opportunities[2], "ACCEPTED", "RELEVANT", "task8-no-evidence-01")))
      .rejects.toThrow(/review_conflict/);
  });
  it("records reject/research deterministically without creating provider cost events", async () => {
    const before = await sql(`SELECT count(*) FROM public.intentlead_cost_events WHERE workspace_id='${workspace}'`);
    const rejected = JSON.parse(await sql(rpc(member, opportunities[1], "REJECTED", "POOR_ICP_FIT", "task8-reject-key-001")));
    const research = JSON.parse(await sql(rpc(owner, opportunities[2], "NEEDS_RESEARCH", "OTHER", "task8-research-key-01", "Need another source")));
    expect(rejected.state).toBe("REJECTED");
    expect(research.state).toBe("NEEDS_RESEARCH");
    const after = await sql(`SELECT count(*) FROM public.intentlead_cost_events WHERE workspace_id='${workspace}'`);
    expect(after).toEqual(before);
  });

  it("redacts note fingerprints on owner deletion, hides the tombstone from members, and blocks old-key replay", async () => {
    const key = "task8-delete-note-001";
    await sql(rpc(member, opportunities[3], "NEEDS_RESEARCH", "OTHER", key, "A note that must be erased"));
    await sql(asRole("service_role", `SELECT public.intentlead_delete_discovery_brief('${brief}','${owner}','task8-review-delete')`));

    const stored = JSON.parse(await sql(`SELECT jsonb_build_object(
      'note',note,'fingerprint',request_fingerprint,'key',idempotency_key,'tombstoned',tombstoned_at IS NOT NULL
    ) FROM public.intentlead_human_reviews WHERE workspace_id='${workspace}' AND idempotency_key='${key}'`)) as Record<string, unknown>;
    expect(stored).toEqual({ note: null, fingerprint: "[redacted]", key, tombstoned: true });
    expect(await sql(asRole("authenticated", `SELECT coalesce(public.intentlead_get_opportunity_for_review('${opportunities[3]}')::text,'null')`, member))).toBe("null");
    await expect(sql(asRole("authenticated", `SELECT note,request_fingerprint FROM public.intentlead_human_reviews WHERE idempotency_key='${key}'`, member)))
      .rejects.toThrow(/permission denied/);
    await expect(sql(rpc(member, opportunities[3], "NEEDS_RESEARCH", "OTHER", key, "A note that must be erased")))
      .rejects.toThrow(/opportunity_not_found/);
    expect(Number(await sql(`SELECT count(*) FROM public.intentlead_human_reviews WHERE workspace_id='${workspace}' AND idempotency_key='${key}'`))).toBe(1);
  });
});
