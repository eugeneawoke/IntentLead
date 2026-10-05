import { readFile } from "node:fs/promises";
import { asRole, bootstrapTask5Database, sql } from "./task4-db";

const migrations = [
  ["202610050003_task7_self_prospecting.sql", "to_regclass('public.intentlead_job_candidate_results') IS NULL"],
  ["202610050004_task7_persistence_hardening.sql", "to_regprocedure('public.intentlead_task7_company_evidence_bound(jsonb)') IS NULL"],
  ["202610050005_task7_candidate_deletion_redaction.sql", "to_regprocedure('public.intentlead_redact_deleted_candidate_results()') IS NULL"],
  ["202610050006_task7_provider_run_deletion_scrub.sql", "to_regprocedure('public.intentlead_delete_discovery_brief_task7_v2(uuid,uuid,text)') IS NULL"],
  ["202610050007_task8_opportunity_review.sql", "to_regprocedure('public.intentlead_record_opportunity_review(uuid,text,text,text,text)') IS NULL"],
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
