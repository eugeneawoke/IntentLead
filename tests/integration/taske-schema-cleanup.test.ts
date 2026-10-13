import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { applyTaskEMigration, asRole, bootstrapTask8Database, sql } from "./task8-db";
import { insertUsers, populatedBaseline } from "./task4-db";

const enabled = Boolean(process.env.INTENTLEAD_TEST_DATABASE_URL);
const owner = randomUUID();
const outsider = randomUUID();
const legacyEnrichingOpportunity = randomUUID();
const legacyClosedOpportunity = randomUUID();

describe.skipIf(!enabled)("Task E legacy schema cleanup", () => {
  beforeAll(async () => {
    await bootstrapTask8Database(true);
    const command = {
      schemaVersion: 1,
      offer: { name: "Upgrade offer", summary: "Upgrade fixture", outcomes: [], exclusions: [] },
      icp: { name: "Upgrade ICP", description: "Upgrade fixture companies", companyAttributes: [], exclusions: [] },
      objective: "Exercise historical Opportunity state reconciliation",
      criteria: { jurisdictions: [], languages: ["en"], signalFamilies: ["EXPRESSED_INTENT"], exclusions: [], limits: { maxSourceItems: 5, maxOpportunities: 2 } },
    };
    const quoted = JSON.stringify(command).replaceAll("'", "''");
    const created = JSON.parse(await sql(asRole("authenticated", `SELECT public.intentlead_create_discovery_brief(
      '${quoted}'::jsonb,'taske-upgrade-states'
    )`, populatedBaseline.userId))) as { discoveryBriefId: string };
    await sql(`SET session_replication_role=replica;
      INSERT INTO public.intentlead_opportunities(
        id,workspace_id,discovery_brief_id,state,signal,tombstoned_at
      ) VALUES
        ('${legacyEnrichingOpportunity}','${populatedBaseline.workspaceId}','${created.discoveryBriefId}',
          'ENRICHING','{"family":"EXPRESSED_INTENT","subtype":"solution_search"}',now()),
        ('${legacyClosedOpportunity}','${populatedBaseline.workspaceId}','${created.discoveryBriefId}',
          'CLOSED','{"family":"EXPRESSED_INTENT","subtype":"solution_search"}',now());
      SET session_replication_role=origin;`);
    await applyTaskEMigration();
  }, 60_000);

  it("removes the retired schema graph while retaining worker nonce replay protection", async () => {
    expect(await sql(`SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace
      AND relname=ANY(ARRAY[
        'campaigns','signals','leads','messages','conversations','conversation_messages',
        'client_context_chunks','intentlead_people','intentlead_buyer_candidates',
        'intentlead_contact_points','intentlead_contact_verifications','intentlead_outreach_drafts',
        'intentlead_verified_packages','intentlead_package_check_results','intentlead_outcomes'
      ])`)).toBe("0");
    expect(await sql(`SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND (
        (table_name='intentlead_discovery_briefs' AND column_name='legacy_campaign_id') OR
        (table_name='workspaces' AND column_name=ANY(ARRAY[
          'plan','credits_remaining','free_converter_used','chat_messages_today','chat_messages_reset_at'
        ])) OR
        (table_name='intentlead_cost_events' AND column_name=ANY(ARRAY[
          'verified_package_id','customer_credit_delta'
        ]))
      )`)).toBe("0");
    expect(await sql(`SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace
      AND proname=ANY(ARRAY[
        'verify_lead_and_charge_credit','intentlead_charge_verified_package',
        'intentlead_consume_chat_quota','intentlead_discovery_setup_for_campaign',
        'intentlead_legacy_campaign_is_discovery_only',
        'intentlead_delete_discovery_brief_taskc_v4','intentlead_delete_discovery_brief_task8_v3',
        'intentlead_delete_discovery_brief_task7_v2','intentlead_delete_discovery_brief_task5_v1',
        'intentlead_persist_self_prospecting_candidate_task7_v1','intentlead_persist_discovery_slice'
      ])`)).toBe("0");
    expect(await sql(`SELECT to_regclass('public.intentlead_worker_nonces') IS NOT NULL
      AND to_regprocedure('public.intentlead_claim_worker_nonce(uuid,bigint)') IS NOT NULL`)).toBe("t");
    expect(await sql(`SELECT count(*) FROM public.workspaces WHERE id='${populatedBaseline.workspaceId}'`)).toBe("1");
    expect(await sql(`SELECT string_agg(state,',' ORDER BY state) FROM public.intentlead_opportunities
      WHERE id=ANY(ARRAY['${legacyEnrichingOpportunity}'::uuid,'${legacyClosedOpportunity}'::uuid])`))
      .toBe("ARCHIVED,EVIDENCE_PENDING");
  });

  it("enforces discovery-only workflow, capabilities, cost types and canonical states", async () => {
    const profileId = randomUUID();
    await sql(`INSERT INTO public.intentlead_market_profiles(
      id,workspace_id,version,profile_key,workflow,configuration,capabilities,disabled_capabilities
    ) VALUES (
      '${profileId}','${populatedBaseline.workspaceId}',2,'EN_DISCOVERY_ONLY','DISCOVERY_ONLY','{}',
      ARRAY['SOURCE_SEARCH']::text[],'{}'::text[]
    )`);
    await expect(sql(`INSERT INTO public.intentlead_cost_events(
      workspace_id,event_type,idempotency_key
    ) VALUES ('${populatedBaseline.workspaceId}','PACKAGE_VERIFIED','legacy-package')`))
      .rejects.toThrow(/intentlead_cost_events_event_type_check/);
    await expect(sql(`UPDATE public.intentlead_market_profiles SET workflow='ASSISTED_OUTREACH'
      WHERE id='${profileId}'`))
      .rejects.toThrow(/intentlead_market_profiles_workflow_check/);
    await expect(sql(`UPDATE public.intentlead_market_profiles
      SET capabilities=ARRAY['SOURCE_SEARCH','EMAIL_FIND']::text[] WHERE id='${profileId}'`))
      .rejects.toThrow(/intentlead_market_capabilities_known_check/);
    expect(await sql(`SELECT pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conrelid='public.intentlead_opportunities'::regclass
        AND conname='intentlead_opportunities_state_check'`)).not.toMatch(/OUTREACH_READY|CONTACTED|CLOSED/);
  });

  it("preserves RLS and core-only owner deletion", async () => {
    await insertUsers(owner, outsider);
    const command = {
      schemaVersion: 1,
      offer: { name: "Delete offer", summary: "Delete fixture", outcomes: [], exclusions: [] },
      icp: { name: "Delete ICP", description: "Delete fixture companies", companyAttributes: [], exclusions: [] },
      objective: "Delete this native brief",
      criteria: { jurisdictions: [], languages: ["en"], signalFamilies: ["EXPRESSED_INTENT"], exclusions: [], limits: { maxSourceItems: 5, maxOpportunities: 2 } },
    };
    const quoted = JSON.stringify(command).replaceAll("'", "''");
    const created = JSON.parse(await sql(asRole("authenticated", `SELECT public.intentlead_create_discovery_brief(
      '${quoted}'::jsonb,'taske-delete-${randomUUID()}'
    )`, owner))) as { discoveryBriefId: string };
    await expect(sql(asRole("anon", `SELECT * FROM public.intentlead_discovery_briefs
      WHERE id='${created.discoveryBriefId}'`))).rejects.toThrow(/permission denied/);
    expect(await sql(asRole("authenticated", `SELECT * FROM public.intentlead_discovery_context(
      '${created.discoveryBriefId}'
    )`, outsider))).toBe("");
    expect(await sql(asRole("service_role", `SELECT public.intentlead_delete_discovery_brief(
      '${created.discoveryBriefId}','${owner}','TASK_E_TEST'
    )`))).toContain("t");
    expect(await sql(`SELECT deleted_at IS NOT NULL AND objective='[deleted]'
      FROM public.intentlead_discovery_briefs WHERE id='${created.discoveryBriefId}'`)).toBe("t");
  });

  it("is safely re-applicable", async () => {
    await applyTaskEMigration();
    expect(await sql(`SELECT to_regclass('public.campaigns') IS NULL
      AND to_regprocedure('public.intentlead_claim_worker_nonce(uuid,bigint)') IS NOT NULL`)).toBe("t");
  }, 60_000);
});
