import { readFile } from "node:fs/promises";
import { asRole, bootstrapTask5Database, sql } from "./task4-db";

const migrations = [
  ["202610050003_task7_self_prospecting.sql", "to_regclass('public.intentlead_job_candidate_results') IS NULL"],
  ["202610050004_task7_persistence_hardening.sql", "to_regprocedure('public.intentlead_task7_company_evidence_bound(jsonb)') IS NULL"],
  ["202610050005_task7_candidate_deletion_redaction.sql", "to_regprocedure('public.intentlead_redact_deleted_candidate_results()') IS NULL"],
  ["202610050006_task7_provider_run_deletion_scrub.sql", "to_regprocedure('public.intentlead_delete_discovery_brief_task7_v2(uuid,uuid,text)') IS NULL"],
  ["202610050007_task8_opportunity_review.sql", "to_regprocedure('public.intentlead_record_opportunity_review(uuid,text,text,text,text)') IS NULL"],
  ["202610050008_task8_least_privilege_rpc.sql", "to_regprocedure('public.intentlead_legacy_campaign_is_discovery_only(uuid)') IS NULL"],
  ["202610050009_task8_tombstone_replay_guard.sql", "to_regprocedure('public.intentlead_delete_discovery_brief_task8_v3(uuid,uuid,text)') IS NULL"],
  ["202610050010_task8_review_constraint_acl.sql", "EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.intentlead_assert_opportunity_has_evidence()') AND NOT prosecdef) OR EXISTS (SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.intentlead_validate_opportunity_snapshot()') AND NOT prosecdef)"],
  ["202610060011_task8_protocol_less_url_projection.sql", "to_regprocedure('public.intentlead_review_text_is_safe(text,integer)') IS NULL OR to_regprocedure('public.intentlead_build_opportunity_review_dto_unfiltered(uuid,boolean)') IS NULL OR to_regprocedure('public.intentlead_build_opportunity_review_dto(uuid,boolean)') IS NULL OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.intentlead_human_reviews'::regclass AND tgname='intentlead_human_review_safe_note' AND NOT tgisinternal)"],
  ["202610060012_task8_source_url_sanitization.sql", "to_regprocedure('public.intentlead_sanitize_review_source_url(text)') IS NULL OR to_regprocedure('public.intentlead_build_opportunity_review_dto(uuid,boolean)') IS NULL"],
  ["202610060013_task8_strict_source_url_allowlist.sql", "to_regprocedure('public.intentlead_review_source_url_path_is_safe(text)') IS NULL"],
  ["202610060014_task8_url_host_control_parity.sql", "to_regprocedure('public.intentlead_review_source_url_host_is_safe(text)') IS NULL"],
  ["202610060015_task8_dns_host_policy.sql", "to_regprocedure('public.intentlead_review_source_url_domain_is_allowed(text)') IS NULL"],
] as const;

function dollarQuoted(value: string): string {
  if (value.includes("$intentlead_migration$")) throw new Error("Unexpected migration delimiter collision");
  return `$intentlead_migration$${value}$intentlead_migration$`;
}

export async function bootstrapTask8Database(): Promise<void> {
  await bootstrapTask5Database();
  for (const [name, missingCondition] of migrations) {
    const contents = await readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
    await sql(`
      BEGIN;
      SELECT pg_advisory_xact_lock(7210080000);
      DO $task8_bootstrap$
      BEGIN
        IF ${missingCondition} THEN EXECUTE ${dollarQuoted(contents)}; END IF;
      END
      $task8_bootstrap$;
      COMMIT;
    `, "intentlead-task8-bootstrap");
  }
}

export { asRole, sql };
