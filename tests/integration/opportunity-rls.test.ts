import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { asRole, bootstrapTask4Database, insertUsers, populatedBaseline, sql } from "./task4-db";

const owner = randomUUID();
const member = randomUUID();
const outsider = randomUUID();
const workspaceId = randomUUID();

beforeAll(async () => {
  await bootstrapTask4Database();
  await insertUsers(owner, member, outsider);
  await sql(`
    INSERT INTO public.workspaces (id, owner_id, name) VALUES ('${workspaceId}', '${owner}', 'Task 4 RLS');
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
      VALUES ('${workspaceId}', '${member}', 'member');
  `);
}, 30_000);

describe("Opportunity Core RLS and provenance", () => {
  it("upgrades a populated legacy schema without losing existing rows", async () => {
    expect(await sql(`SELECT company_name FROM public.leads WHERE id='${populatedBaseline.leadId}'`)).toBe("Existing legacy lead");
    expect(await sql(`SELECT to_regclass('public.intentlead_opportunities') IS NOT NULL`)).toBe("t");
  });

  it("allows owner configuration, member read, and denies member/outsider/anonymous mutation", async () => {
    const offerId = randomUUID();
    expect(await sql(asRole("authenticated", `
      INSERT INTO public.intentlead_offer_profiles
        (id, workspace_id, name, definition)
      VALUES ('${offerId}', '${workspaceId}', 'Audit offer', '{"outcome":"qualified opportunities"}')
      RETURNING id
    `, owner))).toContain(offerId);

    expect(await sql(asRole("authenticated", `SELECT count(*) FROM public.intentlead_offer_profiles WHERE id = '${offerId}'`, member))).toContain("1");
    expect(await sql(asRole("authenticated", `SELECT count(*) FROM public.intentlead_offer_profiles WHERE id = '${offerId}'`, outsider))).toContain("0");
    await expect(sql(asRole("anon", `SELECT count(*) FROM public.intentlead_offer_profiles WHERE id = '${offerId}'`))).rejects.toThrow(/permission denied/);
    await expect(sql(asRole("authenticated", `
      INSERT INTO public.intentlead_offer_profiles (workspace_id, name, definition)
      VALUES ('${workspaceId}', 'Member forged', '{}')
    `, member))).rejects.toThrow(/row-level security|permission denied/);
  });

  it("enforces immutable source identity, append-only evidence, and artifact linkage", async () => {
    const sourceId = randomUUID();
    const artifactId = randomUUID();
    const evidenceId = randomUUID();
    const sourceInsert = `
      INSERT INTO public.intentlead_source_items
        (id, workspace_id, provider, external_id, source_url, content, normalized_facts, provenance, content_hash, captured_at)
      VALUES ('${sourceId}', '${workspaceId}', 'fixture', 'source-${sourceId}', 'https://example.test/source',
        'Observed public text', '{"companyName":"Acme"}',
        '{"sourceType":"WEB","sourceId":"fixture","providerRunId":null,"rawArtifactId":null}', repeat('a',64), now())`;
    await sql(sourceInsert);
    await expect(sql(sourceInsert.replace(sourceId, randomUUID()))).rejects.toThrow(/unique|duplicate/i);

    await sql(`
      INSERT INTO public.intentlead_artifact_metadata
        (id, workspace_id, source_item_id, content_hash, storage_reference, media_type, size_bytes, retention_policy_id)
      VALUES ('${artifactId}', '${workspaceId}', '${sourceId}', repeat('b',64), 'fixture://artifact', 'text/plain', 12, 'retention-v1');
      INSERT INTO public.intentlead_evidence_items
        (id, workspace_id, source_item_id, artifact_id, evidence_type, source_url, captured_at, excerpt,
         structured_facts, verification_method, confidence, content_hash, provenance)
      VALUES ('${evidenceId}', '${workspaceId}', '${sourceId}', '${artifactId}', 'document', 'https://example.test/source',
        now(), 'Observed public text', '{}', 'fixture', 0.9, repeat('c',64),
        '{"sourceType":"WEB","sourceId":"fixture","providerRunId":null,"rawArtifactId":"${artifactId}"}')
    `);
    expect(await sql(asRole("authenticated", `SELECT artifact_id FROM public.intentlead_evidence_items WHERE id = '${evidenceId}'`, member))).toContain(artifactId);
    await expect(sql(asRole("authenticated", `UPDATE public.intentlead_evidence_items SET excerpt = 'tampered' WHERE id = '${evidenceId}'`, owner))).rejects.toThrow(/permission denied|append-only/);
    await expect(sql(asRole("authenticated", `DELETE FROM public.intentlead_evidence_items WHERE id = '${evidenceId}'`, owner))).rejects.toThrow(/permission denied|append-only/);
    await expect(sql(asRole("service_role", `DELETE FROM public.intentlead_evidence_items WHERE id = '${evidenceId}'`))).rejects.toThrow(/permission denied|append-only/);
    await expect(sql(asRole("service_role", `TRUNCATE public.intentlead_evidence_items`))).rejects.toThrow(/permission denied/);
  });

  it("rejects vendor-native facts, unknown provenance fields, and invalid lifecycle snapshots", async () => {
    await expect(sql(`INSERT INTO public.intentlead_evidence_items
      (workspace_id,evidence_type,captured_at,excerpt,structured_facts,verification_method,confidence,content_hash,provenance)
      VALUES ('${workspaceId}','text',now(),'Vendor payload','{"apolloPersonId":"native"}','fixture',.8,repeat('7',64),
        '{"sourceType":"WEB","sourceId":"fixture","providerRunId":null,"rawArtifactId":null}')`)).rejects.toThrow(/facts_v1_check/);
    await expect(sql(`INSERT INTO public.intentlead_evidence_items
      (workspace_id,evidence_type,captured_at,excerpt,structured_facts,verification_method,confidence,content_hash,provenance)
      VALUES ('${workspaceId}','text',now(),'Bad provenance','{}','fixture',.8,repeat('8',64),
        '{"sourceType":"WEB","sourceId":"fixture","providerRunId":null,"rawArtifactId":null,"vendor":"native"}')`)).rejects.toThrow(/provenance_v1_check/);
  });

  it("uses an owner-authorized tombstone path and preserves suppression", async () => {
    const briefId = randomUUID();
    const opportunityId = randomUUID();
    const evidenceId = randomUUID();
    const suppressionId = randomUUID();
    await sql(`
      INSERT INTO public.intentlead_market_profiles (id, workspace_id, profile_key, workflow, configuration)
        VALUES ('${randomUUID()}', '${workspaceId}', 'EN_DISCOVERY_ONLY', 'DISCOVERY_ONLY', '{}');
      INSERT INTO public.intentlead_offer_profiles (id, workspace_id, name, definition)
        VALUES ('${randomUUID()}', '${workspaceId}', 'Deletion offer', '{}');
      INSERT INTO public.intentlead_icp_definitions (id, workspace_id, name, definition)
        VALUES ('${randomUUID()}', '${workspaceId}', 'Deletion ICP', '{}')
    `);
    const refs = (await sql(`SELECT o.id || '|' || i.id || '|' || m.id FROM public.intentlead_offer_profiles o
      CROSS JOIN public.intentlead_icp_definitions i CROSS JOIN public.intentlead_market_profiles m
      WHERE o.workspace_id='${workspaceId}' AND i.workspace_id='${workspaceId}' AND m.workspace_id='${workspaceId}'
      ORDER BY o.created_at DESC, i.created_at DESC, m.created_at DESC LIMIT 1`)).split("|");
    await sql(`
      INSERT INTO public.intentlead_discovery_briefs
        (id, workspace_id, offer_profile_id, icp_definition_id, market_profile_id, objective, criteria)
      VALUES ('${briefId}', '${workspaceId}', '${refs[0]}', '${refs[1]}', '${refs[2]}', 'Deletion fixture', '{}');
      INSERT INTO public.intentlead_evidence_items
        (id, workspace_id, evidence_type, captured_at, excerpt, structured_facts, verification_method,
         confidence, content_hash, provenance)
      VALUES ('${evidenceId}', '${workspaceId}', 'text', now(), 'Sensitive excerpt', '{}', 'fixture', 0.8, repeat('d',64),
        '{"sourceType":"WEB","sourceId":"fixture","providerRunId":null,"rawArtifactId":null}');
      INSERT INTO public.intentlead_opportunities
        (id, workspace_id, discovery_brief_id, state, signal)
      VALUES ('${opportunityId}', '${workspaceId}', '${briefId}', 'DISCOVERED', '{"family":"DETECTED_PROBLEM","subtype":"website"}');
      INSERT INTO public.intentlead_opportunity_evidence (workspace_id, opportunity_id, evidence_id)
        VALUES ('${workspaceId}', '${opportunityId}', '${evidenceId}');
      INSERT INTO public.intentlead_suppression_entries
        (id, workspace_id, identifier_type, identifier_hash, reason, policy_id)
        VALUES ('${suppressionId}', '${workspaceId}', 'EMAIL', repeat('e',64), 'OPT_OUT', 'policy-v1')
    `);

    await expect(sql(`
      INSERT INTO public.intentlead_opportunities
        (workspace_id, discovery_brief_id, state, signal)
      VALUES ('${workspaceId}', '${briefId}', 'DISCOVERED', '{"family":"DETECTED_PROBLEM","subtype":"website"}')
    `)).rejects.toThrow(/opportunity_requires_evidence/);

    await expect(sql(asRole("service_role", `SELECT public.intentlead_tombstone_opportunity('${opportunityId}', '${outsider}', 'ERASURE_REQUEST')`))).rejects.toThrow(/forbidden/);
    expect(await sql(asRole("service_role", `SELECT public.intentlead_tombstone_opportunity('${opportunityId}', '${owner}', 'ERASURE_REQUEST')`))).toContain("t");
    expect(await sql(`SELECT tombstoned_at IS NOT NULL FROM public.intentlead_opportunities WHERE id='${opportunityId}'`)).toBe("t");
    expect(await sql(`SELECT excerpt IS NULL AND structured_facts='{}'::jsonb FROM public.intentlead_evidence_items WHERE id='${evidenceId}'`)).toBe("t");
    expect(await sql(`SELECT count(*) FROM public.intentlead_suppression_entries WHERE id='${suppressionId}'`)).toBe("1");
    expect(await sql(`SELECT count(*) FROM public.intentlead_deletion_tombstones WHERE resource_id='${opportunityId}'`)).toBe("1");
  });

  it("does not redact evidence shared with another live Opportunity", async () => {
    const first = randomUUID();
    const second = randomUUID();
    const evidence = randomUUID();
    const briefId = await sql(`SELECT id FROM public.intentlead_discovery_briefs WHERE workspace_id='${workspaceId}' LIMIT 1`);
    await sql(`
      INSERT INTO public.intentlead_evidence_items
        (id, workspace_id, evidence_type, captured_at, excerpt, structured_facts, verification_method, confidence, content_hash, provenance)
      VALUES ('${evidence}', '${workspaceId}', 'text', now(), 'Shared live evidence', '{}', 'fixture', 0.9, repeat('4',64),
        '{"sourceType":"WEB","sourceId":"fixture","providerRunId":null,"rawArtifactId":null}');
      INSERT INTO public.intentlead_opportunities (id, workspace_id, discovery_brief_id, state, signal)
        VALUES ('${first}', '${workspaceId}', '${briefId}', 'DISCOVERED', '{"family":"DETECTED_PROBLEM","subtype":"website"}'),
               ('${second}', '${workspaceId}', '${briefId}', 'DISCOVERED', '{"family":"DETECTED_PROBLEM","subtype":"website"}');
      INSERT INTO public.intentlead_opportunity_evidence (workspace_id, opportunity_id, evidence_id)
        VALUES ('${workspaceId}', '${first}', '${evidence}'), ('${workspaceId}', '${second}', '${evidence}')
    `);
    expect(await sql(asRole("service_role", `SELECT public.intentlead_tombstone_opportunity('${first}', '${owner}', 'SHARED_EVIDENCE_TEST')`))).toContain("t");
    expect(await sql(`SELECT excerpt FROM public.intentlead_evidence_items WHERE id='${evidence}'`)).toBe("Shared live evidence");
  });

  it("enables RLS everywhere and denies direct client mutation of internals", async () => {
    expect(Number(await sql(`SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace
      AND relname LIKE 'intentlead_%' AND relkind='r' AND NOT relrowsecurity`))).toBe(0);
    for (const table of ["intentlead_provider_runs", "intentlead_cost_events", "intentlead_verified_packages"]) {
      expect(await sql(`SELECT has_table_privilege('authenticated', 'public.${table}', 'INSERT')`)).toBe("f");
      expect(await sql(`SELECT has_table_privilege('authenticated', 'public.${table}', 'UPDATE')`)).toBe("f");
      expect(await sql(`SELECT has_table_privilege('authenticated', 'public.${table}', 'DELETE')`)).toBe("f");
    }
    for (const table of ["intentlead_source_items", "intentlead_evidence_items", "intentlead_opportunity_assessments", "intentlead_human_reviews", "intentlead_outcomes", "intentlead_suppression_entries"]) {
      expect(await sql(`SELECT has_table_privilege('service_role', 'public.${table}', 'INSERT')`)).toBe("f");
      expect(await sql(`SELECT has_table_privilege('service_role', 'public.${table}', 'DELETE')`)).toBe("f");
      expect(await sql(`SELECT has_table_privilege('service_role', 'public.${table}', 'TRUNCATE')`)).toBe("f");
      expect(await sql(`SELECT has_table_privilege('service_role', 'public.${table}', 'TRIGGER')`)).toBe("f");
    }
  });

  it("isolates sensitive contact, suppression, job and cost rows and authorizes only member reviews", async () => {
    const companyId = randomUUID();
    const personId = randomUUID();
    const contactId = randomUUID();
    const suppressionId = randomUUID();
    const evidenceId = randomUUID();
    const opportunityId = randomUUID();
    const briefId = await sql(`SELECT id FROM public.intentlead_discovery_briefs WHERE workspace_id='${workspaceId}' LIMIT 1`);
    await sql(`
      INSERT INTO public.intentlead_companies (id,workspace_id,canonical_name,confidence)
        VALUES ('${companyId}','${workspaceId}','RLS company',.9);
      INSERT INTO public.intentlead_people (id,workspace_id,company_id,full_name,confidence,resolved_at)
        VALUES ('${personId}','${workspaceId}','${companyId}','RLS person',.9,now());
      INSERT INTO public.intentlead_evidence_items
        (id,workspace_id,evidence_type,captured_at,excerpt,structured_facts,verification_method,confidence,content_hash,provenance)
        VALUES ('${evidenceId}','${workspaceId}','text',now(),'RLS evidence','{}','fixture',.9,repeat('9',64),
          '{"sourceType":"WEB","sourceId":"fixture","providerRunId":null,"rawArtifactId":null}');
      INSERT INTO public.intentlead_opportunities (id,workspace_id,discovery_brief_id,company_id,state,signal)
        VALUES ('${opportunityId}','${workspaceId}','${briefId}','${companyId}','DISCOVERED',
          '{"family":"DETECTED_PROBLEM","subtype":"website"}');
      INSERT INTO public.intentlead_opportunity_evidence (workspace_id,opportunity_id,evidence_id)
        VALUES ('${workspaceId}','${opportunityId}','${evidenceId}');
      INSERT INTO public.intentlead_contact_points
        (id,workspace_id,person_id,company_id,channel,value,value_hash,jurisdiction,captured_at)
        VALUES ('${contactId}','${workspaceId}','${personId}','${companyId}','email','rls@example.test',repeat('a',64),'{}',now());
      INSERT INTO public.intentlead_suppression_entries
        (id,workspace_id,identifier_type,identifier_hash,reason,policy_id)
        VALUES ('${suppressionId}','${workspaceId}','EMAIL',repeat('a',64),'POLICY','policy-v1');
      INSERT INTO public.intentlead_cost_events
        (workspace_id,event_type,amount,currency,idempotency_key,metadata)
        VALUES ('${workspaceId}','MODEL_COST',.01,'USD','rls-cost-${contactId}','{}');
    `);
    await expect(sql(`UPDATE public.intentlead_opportunities SET state='PACKAGE_READY' WHERE id='${opportunityId}'`))
      .rejects.toThrow(/assessed_opportunity_references_required/);
    const jobId = await sql(asRole("service_role", `SELECT public.intentlead_enqueue_discovery_job('${briefId}','${owner}','rls-job-${contactId}','{}')`));
    for (const table of ["intentlead_contact_points", "intentlead_suppression_entries", "intentlead_jobs", "intentlead_cost_events"]) {
      expect(await sql(asRole("authenticated", `SELECT count(*) FROM public.${table} WHERE workspace_id='${workspaceId}'`, member))).not.toBe("0");
      expect(await sql(asRole("authenticated", `SELECT count(*) FROM public.${table} WHERE workspace_id='${workspaceId}'`, outsider))).toBe("0");
    }
    expect(await sql(asRole("authenticated", `INSERT INTO public.intentlead_human_reviews
      (workspace_id,opportunity_id,reviewer_id,decision,reason)
      VALUES ('${workspaceId}','${opportunityId}','${member}','ACCEPTED','Member review') RETURNING reviewer_id`, member))).toContain(member);
    await expect(sql(asRole("authenticated", `INSERT INTO public.intentlead_human_reviews
      (workspace_id,opportunity_id,reviewer_id,decision,reason)
      VALUES ('${workspaceId}','${opportunityId}','${outsider}','ACCEPTED','Forged review')`, outsider))).rejects.toThrow(/row-level security/);
    await sql(asRole("service_role", `SELECT public.intentlead_cancel_job('${jobId}','${owner}')`));
  });
});
