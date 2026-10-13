import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execute = promisify(execFile);

let database: URL | undefined;

export const populatedBaseline = {
  userId: "00000000-0000-4000-8000-000000000401",
  workspaceId: "00000000-0000-4000-8000-000000000402",
  campaignId: "00000000-0000-4000-8000-000000000403",
  signalId: "00000000-0000-4000-8000-000000000404",
  leadId: "00000000-0000-4000-8000-000000000405",
} as const;

function connection(): URL {
  if (database) return database;
  const value = process.env.INTENTLEAD_TEST_DATABASE_URL;
  if (!value) {
    throw new Error(
      "DB integration blocked: set INTENTLEAD_TEST_DATABASE_URL to an empty disposable local Postgres database named intentlead_test_*",
    );
  }
  database = new URL(value);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)
    || !/^\/intentlead_test_[a-z0-9_]+$/.test(database.pathname)
  ) {
    throw new Error("Refusing integration writes outside a disposable local intentlead_test_* database");
  }
  return database;
}

export async function sql(statement: string, applicationName = "intentlead-task4-integration"): Promise<string> {
  const target = connection();
  const { stdout } = await execute(
    "psql",
    ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement],
    {
      env: {
        ...process.env,
        PGHOST: target.hostname,
        PGPORT: target.port || "5432",
        PGDATABASE: target.pathname.slice(1),
        PGUSER: decodeURIComponent(target.username),
        PGPASSWORD: decodeURIComponent(target.password),
        PGCONNECT_TIMEOUT: "3",
        PGAPPNAME: applicationName,
      },
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  return stdout.trim();
}

function quotedMigration(sqlText: string): string {
  if (sqlText.includes("$intentlead_file$")) throw new Error("Unexpected migration delimiter collision");
  return `$intentlead_file$${sqlText}$intentlead_file$`;
}

async function migration(name: string): Promise<string> {
  return readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

function applyUnlessExists(regclass: string, sqlText: string): string {
  return `
    DO $intentlead_bootstrap$
    BEGIN
      IF to_regclass('${regclass}') IS NULL THEN
        EXECUTE ${quotedMigration(sqlText)};
      END IF;
    END
    $intentlead_bootstrap$;
  `;
}

export async function bootstrapTask4Database(populateLegacyBaseline = true): Promise<void> {
  connection();
  const baseline = await Promise.all([
    migration("001_tables.sql"),
    migration("002_rls.sql"),
    migration("006_schema_v2.sql"),
    migration("202610040000_atomic_chat_quota.sql"),
  ]);
  const task4 = process.env.INTENTLEAD_TASK4_SKIP_MIGRATIONS === "1"
    ? []
    : await Promise.all([
      migration("202610040001_opportunity_core.sql"),
      migration("202610040002_durable_jobs.sql"),
    ]);

  await sql(`
    BEGIN;
    SELECT pg_advisory_xact_lock(7210044001);
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ${applyUnlessExists("public.workspaces", baseline[0])}
    ${applyUnlessExists("public.intentlead_worker_nonces", `${baseline[1]}\n${baseline[2]}\nGRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;\n${baseline[3]}`)}
    DO $intentlead_populated_upgrade$
    BEGIN
      IF ${populateLegacyBaseline ? "true" : "false"}
        AND to_regclass('public.intentlead_offer_profiles') IS NULL THEN
        CREATE TABLE IF NOT EXISTS public.glook_acl_sentinel (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          payload text NOT NULL
        );
        GRANT ALL ON TABLE public.glook_acl_sentinel TO service_role;
        INSERT INTO auth.users (id) VALUES ('${populatedBaseline.userId}') ON CONFLICT DO NOTHING;
        INSERT INTO public.workspaces (id, owner_id, name)
          VALUES ('${populatedBaseline.workspaceId}', '${populatedBaseline.userId}', 'Pre-Task4 populated workspace')
          ON CONFLICT DO NOTHING;
        INSERT INTO public.campaigns
          (id, workspace_id, entry_mode, what_selling, icp, pain, status)
          VALUES ('${populatedBaseline.campaignId}', '${populatedBaseline.workspaceId}', 'cold',
            'Legacy offer', 'Legacy ICP', 'Legacy pain', 'draft')
          ON CONFLICT DO NOTHING;
        INSERT INTO public.signals
          (id, campaign_id, source, source_url, author_handle, content)
          VALUES ('${populatedBaseline.signalId}', '${populatedBaseline.campaignId}', 'reddit',
            'https://example.test/pre-task4', 'fixture', 'Existing legacy signal')
          ON CONFLICT DO NOTHING;
        INSERT INTO public.leads
          (id, campaign_id, signal_id, company_name, status)
          VALUES ('${populatedBaseline.leadId}', '${populatedBaseline.campaignId}',
            '${populatedBaseline.signalId}', 'Existing legacy lead', 'processing')
          ON CONFLICT DO NOTHING;
      END IF;
    END
    $intentlead_populated_upgrade$;
    ${task4.length === 0 ? "" : applyUnlessExists("public.intentlead_offer_profiles", task4[0])}
    ${task4.length === 0 ? "" : applyUnlessExists("public.intentlead_jobs", task4[1])}
    COMMIT;
  `);
}

export async function bootstrapTask5Database(populateLegacyBaseline = true): Promise<void> {
  await bootstrapTask4Database(populateLegacyBaseline);
  const task5Migration = await migration("202610050000_task5_data_lifecycle.sql");
  const task5TerminalMigration = await migration("202610050001_task5_terminal_state_sync.sql");
  const task5TerminalAclMigration = await migration("202610050002_task5_terminal_sync_acl.sql");
  await sql(`
    BEGIN;
    SELECT pg_advisory_xact_lock(7210050000);
    DO $intentlead_task5_upgrade$
    BEGIN
      IF to_regprocedure('public.intentlead_delete_discovery_brief(uuid,uuid,text)') IS NULL THEN
        EXECUTE ${quotedMigration(task5Migration)};
      END IF;
    END
    $intentlead_task5_upgrade$;
    DO $intentlead_task5_terminal_upgrade$
    BEGIN
      IF to_regprocedure('public.intentlead_delete_discovery_brief_task5_v1(uuid,uuid,text)') IS NULL THEN
        EXECUTE ${quotedMigration(task5TerminalMigration)};
      END IF;
    END
    $intentlead_task5_terminal_upgrade$;
    DO $intentlead_task5_sync_acl$
    BEGIN
      EXECUTE ${quotedMigration(task5TerminalAclMigration)};
    END
    $intentlead_task5_sync_acl$;
    COMMIT;
  `, "intentlead-task5-bootstrap");
}

export async function insertUsers(...ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await sql(`INSERT INTO auth.users (id) VALUES ${ids.map((id) => `('${id}')`).join(",")}
    ON CONFLICT (id) DO NOTHING`);
}

export function asRole(role: "anon" | "authenticated" | "service_role", statement: string, userId?: string): string {
  const claim = userId ? `SET LOCAL request.jwt.claim.sub = '${userId}';` : "";
  return `BEGIN; SET LOCAL ROLE ${role}; ${claim} ${statement}; COMMIT`;
}
