import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { insertUsers } from "./task4-db";
import { asRole, bootstrapLatestDatabase, sql } from "./task8-db";

const enabled = Boolean(process.env.INTENTLEAD_TEST_DATABASE_URL);
const owner = randomUUID();
const member = randomUUID();
const outsider = randomUUID();
const workspaceId = randomUUID();
const offerId = randomUUID();
const icpId = randomUUID();
const marketId = randomUUID();
const briefId = randomUUID();

beforeAll(async () => {
  await bootstrapLatestDatabase();
  await insertUsers(owner, member, outsider);
  await sql(`
    INSERT INTO public.workspaces(id,owner_id,name) VALUES ('${workspaceId}','${owner}','Opportunity Core RLS');
    INSERT INTO public.workspace_members(workspace_id,user_id,role) VALUES ('${workspaceId}','${member}','member');
    INSERT INTO public.intentlead_offer_profiles(id,workspace_id,name,definition)
      VALUES ('${offerId}','${workspaceId}','RLS offer','{}');
    INSERT INTO public.intentlead_icp_definitions(id,workspace_id,name,definition)
      VALUES ('${icpId}','${workspaceId}','RLS ICP','{}');
    INSERT INTO public.intentlead_market_profiles(
      id,workspace_id,profile_key,workflow,configuration,capabilities,disabled_capabilities
    ) VALUES (
      '${marketId}','${workspaceId}','EN_DISCOVERY_ONLY','DISCOVERY_ONLY','{}',
      ARRAY['SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW']::text[],
      ARRAY[]::text[]
    );
    INSERT INTO public.intentlead_discovery_briefs(
      id,workspace_id,offer_profile_id,icp_definition_id,market_profile_id,objective,criteria
    ) VALUES ('${briefId}','${workspaceId}','${offerId}','${icpId}','${marketId}','RLS fixture','{}');
  `);
}, 60_000);

describe.skipIf(!enabled)("Opportunity Core RLS and provenance", () => {
  it("keeps every surviving IntentLead table under RLS and removes retired relations", async () => {
    expect(await sql(`SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace
      AND relkind='r' AND relname LIKE 'intentlead_%' AND NOT relrowsecurity`)).toBe("0");
    expect(await sql(`SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace
      AND relname=ANY(ARRAY[
        'campaigns','signals','leads','messages','intentlead_people','intentlead_contact_points',
        'intentlead_outreach_drafts','intentlead_verified_packages','intentlead_suppression_entries'
      ])`)).toBe("0");
  });

  it("exposes owner-scoped RPCs without direct table reads or tenant enumeration", async () => {
    expect(await sql(asRole("authenticated", `SELECT count(*) FROM public.intentlead_discovery_context('${briefId}')`, owner)))
      .toBe("1");
    expect(await sql(asRole("authenticated", `SELECT count(*) FROM public.intentlead_discovery_context('${briefId}')`, outsider)))
      .toBe("0");
    for (const role of ["anon", "authenticated"] as const) {
      expect(await sql(`SELECT has_table_privilege('${role}','public.intentlead_discovery_briefs','SELECT')`)).toBe("f");
      await expect(sql(asRole(role, `SELECT * FROM public.intentlead_discovery_briefs WHERE id='${briefId}'`,
        role === "authenticated" ? owner : undefined))).rejects.toThrow(/permission denied/);
    }
  });

  it("enforces immutable source identity, append-only evidence, and artifact linkage", async () => {
    const sourceId = randomUUID();
    const artifactId = randomUUID();
    const evidenceId = randomUUID();
    const sourceInsert = `INSERT INTO public.intentlead_source_items(
      id,workspace_id,provider,external_id,source_url,content,normalized_facts,provenance,content_hash,captured_at
    ) VALUES (
      '${sourceId}','${workspaceId}','fixture','source-${sourceId}','https://example.test/source',
      'Observed public text','{"companyName":"Acme"}',
      '{"sourceType":"WEB","sourceId":"fixture","providerRunId":null,"rawArtifactId":null}',repeat('a',64),now()
    )`;
    await sql(sourceInsert);
    await expect(sql(sourceInsert.replace(sourceId, randomUUID()))).rejects.toThrow(/unique|duplicate/i);
    await sql(`
      INSERT INTO public.intentlead_artifact_metadata(
        id,workspace_id,source_item_id,content_hash,storage_reference,media_type,size_bytes,retention_policy_id
      ) VALUES ('${artifactId}','${workspaceId}','${sourceId}',repeat('b',64),'fixture://artifact','text/plain',12,'retention-v1');
      INSERT INTO public.intentlead_evidence_items(
        id,workspace_id,source_item_id,artifact_id,evidence_type,source_url,captured_at,excerpt,
        structured_facts,verification_method,confidence,content_hash,provenance
      ) VALUES (
        '${evidenceId}','${workspaceId}','${sourceId}','${artifactId}','document','https://example.test/source',
        now(),'Observed public text','{}','fixture',.9,repeat('c',64),
        '{"sourceType":"WEB","sourceId":"fixture","providerRunId":null,"rawArtifactId":"${artifactId}"}'
      );
    `);
    await expect(sql(asRole("service_role", `DELETE FROM public.intentlead_evidence_items WHERE id='${evidenceId}'`)))
      .rejects.toThrow(/permission denied|append-only/);
    await expect(sql(asRole("service_role", "TRUNCATE public.intentlead_evidence_items")))
      .rejects.toThrow(/permission denied/);
  });

  it("rejects vendor-native facts and unknown provenance fields", async () => {
    await expect(sql(`INSERT INTO public.intentlead_evidence_items(
      workspace_id,evidence_type,captured_at,excerpt,structured_facts,verification_method,confidence,content_hash,provenance
    ) VALUES ('${workspaceId}','text',now(),'Vendor payload','{"apolloPersonId":"native"}','fixture',.8,
      repeat('7',64),'{"sourceType":"WEB","sourceId":"fixture","providerRunId":null,"rawArtifactId":null}')`))
      .rejects.toThrow(/facts_v1_check/);
    await expect(sql(`INSERT INTO public.intentlead_evidence_items(
      workspace_id,evidence_type,captured_at,excerpt,structured_facts,verification_method,confidence,content_hash,provenance
    ) VALUES ('${workspaceId}','text',now(),'Bad provenance','{}','fixture',.8,
      repeat('8',64),'{"sourceType":"WEB","sourceId":"fixture","providerRunId":null,"rawArtifactId":null,"vendor":"native"}')`))
      .rejects.toThrow(/provenance_v1_check/);
  });

  it("allows only the owner to tombstone and preserves shared live evidence", async () => {
    const first = randomUUID();
    const second = randomUUID();
    const evidence = randomUUID();
    await sql(`
      INSERT INTO public.intentlead_evidence_items(
        id,workspace_id,evidence_type,captured_at,excerpt,structured_facts,verification_method,confidence,content_hash,provenance
      ) VALUES ('${evidence}','${workspaceId}','text',now(),'Shared live evidence','{}','fixture',.9,repeat('4',64),
        '{"sourceType":"WEB","sourceId":"fixture","providerRunId":null,"rawArtifactId":null}');
      INSERT INTO public.intentlead_opportunities(id,workspace_id,discovery_brief_id,state,signal) VALUES
        ('${first}','${workspaceId}','${briefId}','DISCOVERED','{"family":"DETECTED_PROBLEM","subtype":"market_presence"}'),
        ('${second}','${workspaceId}','${briefId}','DISCOVERED','{"family":"DETECTED_PROBLEM","subtype":"market_presence"}');
      INSERT INTO public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id) VALUES
        ('${workspaceId}','${first}','${evidence}'),('${workspaceId}','${second}','${evidence}');
    `);
    await expect(sql(asRole("service_role", `SELECT public.intentlead_tombstone_opportunity(
      '${first}','${outsider}','ERASURE_REQUEST'
    )`))).rejects.toThrow(/forbidden/);
    expect(await sql(asRole("service_role", `SELECT public.intentlead_tombstone_opportunity(
      '${first}','${owner}','ERASURE_REQUEST'
    )`))).toBe("t");
    expect(await sql(`SELECT excerpt FROM public.intentlead_evidence_items WHERE id='${evidence}'`))
      .toBe("Shared live evidence");
    expect(await sql(`SELECT count(*) FROM public.intentlead_deletion_tombstones WHERE resource_id='${first}'`))
      .toBe("1");
  });

  it("denies direct client mutation of jobs, costs, reviews, and evidence", async () => {
    for (const table of [
      "intentlead_jobs","intentlead_cost_events","intentlead_human_reviews","intentlead_evidence_items",
    ]) {
      for (const privilege of ["INSERT", "UPDATE", "DELETE"] as const) {
        expect(await sql(`SELECT has_table_privilege('authenticated','public.${table}','${privilege}')`)).toBe("f");
      }
    }
  });
});
