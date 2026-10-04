import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";

const execute = promisify(execFile);
let database: URL;
const owner = randomUUID();
const outsider = randomUUID();

// Requires an empty, disposable local database; never falls back to project credentials.
async function sql(statement: string, applicationName = "intentlead-integration"): Promise<string> {
  const { stdout } = await execute("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement], {
    env: {
      ...process.env, PGHOST: database.hostname, PGPORT: database.port || "5432",
      PGDATABASE: database.pathname.slice(1), PGUSER: decodeURIComponent(database.username),
      PGPASSWORD: decodeURIComponent(database.password), PGCONNECT_TIMEOUT: "3", PGAPPNAME: applicationName,
    },
  });
  return stdout.trim();
}

beforeAll(async () => {
  const connection = process.env.INTENTLEAD_TEST_DATABASE_URL;
  if (!connection) throw new Error("DB integration blocked: set INTENTLEAD_TEST_DATABASE_URL to an empty disposable local Postgres database named intentlead_test_*; mocks are not concurrency evidence.");
  database = new URL(connection);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) || !/^\/intentlead_test_[a-z0-9_]+$/.test(database.pathname)) {
    throw new Error("Refusing integration writes outside a disposable local intentlead_test_* database");
  }
  expect(await sql("SELECT to_regclass('public.workspaces') IS NULL")).toBe("t");
  await sql(`
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
  `);
  // Relevant existing baseline, before the additive Task 2 upgrade.
  for (const file of ["001_tables.sql", "002_rls.sql", "006_schema_v2.sql"]) {
    await sql(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
  // Model deployed default grants rather than obtaining false denial from absent ACLs.
  await sql("GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role");
  expect(await sql("SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'")).toBe("t");
  expect(await sql("SELECT has_table_privilege('authenticated', 'public.workspaces', 'UPDATE')")).toBe("t");
  // Include explicit column grants: revoking table-level UPDATE alone must not suffice.
  await sql("GRANT UPDATE (plan, chat_messages_today), INSERT (plan) ON public.workspaces TO authenticated");
  await sql(`INSERT INTO auth.users (id) VALUES ('${owner}'), ('${outsider}')`);
  await sql(await readFile(new URL("../../supabase/migrations/202610040000_atomic_chat_quota.sql", import.meta.url), "utf8"));
}, 20_000);

async function workspace(plan = "free", count = 0, reset = "now()") {
  const id = randomUUID();
  await sql(`INSERT INTO public.workspaces (id, owner_id, name, plan, chat_messages_today, chat_messages_reset_at)
    VALUES ('${id}', '${owner}', 'Integration fixture', '${plan}', ${count}, ${reset})`);
  return id;
}

async function reserve(id: string, user = owner) {
  return sql(`SET ROLE service_role; SELECT public.intentlead_consume_chat_quota('${id}', '${user}')`);
}

describe("real PostgreSQL chat quota", () => {
  it("admits exactly 20 of 32 concurrent free-plan requests without lost increments", async () => {
    const id = await workspace();
    const results = await Promise.all(Array.from({ length: 32 }, () => reserve(id)));
    expect(results.filter((result) => result === "t")).toHaveLength(20);
    expect(results.filter((result) => result === "f")).toHaveLength(12);
    expect(await sql(`SELECT chat_messages_today FROM workspaces WHERE id = '${id}'`)).toBe("20");
  }, 20_000);

  it("resets yesterday's exhausted counter once under concurrent requests", async () => {
    const id = await workspace("free", 20, "now() - interval '1 day'");
    const results = await Promise.all(Array.from({ length: 24 }, () => reserve(id)));
    expect(results.filter((result) => result === "t")).toHaveLength(20);
    expect(await sql(`SELECT chat_messages_today FROM workspaces WHERE id = '${id}'`)).toBe("20");
  }, 20_000);

  it("denies a foreign owner and a missing workspace without mutation", async () => {
    const id = await workspace();
    expect(await reserve(id, outsider)).toBe("f");
    expect(await reserve(randomUUID())).toBe("f");
    expect(await sql(`SELECT chat_messages_today FROM workspaces WHERE id = '${id}'`)).toBe("0");
  });

  it.each(["starter", "starter_ltd", "growth", "growth_ltd"])("derives the %s limit inside the database", async (plan) => {
    const limit = plan.startsWith("starter") ? 100 : 300;
    const id = await workspace(plan, limit - 1);
    expect(await reserve(id)).toBe("t");
    expect(await reserve(id)).toBe("f");
  });

  it("handles null reset and agency unlimited quota", async () => {
    expect(await reserve(await workspace("free", 20, "NULL"))).toBe("t");
    const id = await workspace("agency", 2147483647);
    expect(await reserve(id)).toBe("t");
    expect(await reserve(id)).toBe("t");
  });

  it.each(["anon", "authenticated"])("denies direct quota RPC execution by %s", async (role) => {
    const id = await workspace();
    await expect(sql(`SET ROLE ${role}; SELECT public.intentlead_consume_chat_quota('${id}', '${owner}')`)).rejects.toThrow(/permission denied/);
  });

  it.each([
    "plan = 'agency'", "credits_remaining = 999999", "free_converter_used = false",
    "chat_messages_today = 0", "chat_messages_reset_at = NULL", "owner_id = NULL",
    "id = gen_random_uuid()", "created_at = now()", "updated_at = now()",
  ])("denies authenticated owner protected-field change: %s", async (assignment) => {
    const id = await workspace();
    await expect(sql(`SET ROLE authenticated; SET request.jwt.claim.sub = '${owner}';
      UPDATE public.workspaces SET ${assignment} WHERE id = '${id}'`)).rejects.toThrow(/permission denied/);
  });

  it("preserves owner rename while denying another user's rename", async () => {
    const id = await workspace();
    expect(await sql(`SET ROLE authenticated; SET request.jwt.claim.sub = '${owner}';
      UPDATE public.workspaces SET name = 'Renamed workspace' WHERE id = '${id}' RETURNING name`)).toBe("Renamed workspace");
    expect(await sql(`SET ROLE authenticated; SET request.jwt.claim.sub = '${outsider}';
      UPDATE public.workspaces SET name = 'Foreign rename' WHERE id = '${id}' RETURNING name`)).toBe("");
    expect(await sql(`SELECT name FROM public.workspaces WHERE id = '${id}'`)).toBe("Renamed workspace");
    expect(await reserve(id)).toBe("t");
  });

  it("denies direct client insert/delete paths around the protected counters", async () => {
    const id = await workspace();
    await expect(sql(`SET ROLE authenticated; SET request.jwt.claim.sub = '${owner}';
      INSERT INTO public.workspaces (owner_id, name, plan) VALUES ('${owner}', 'Forged agency', 'agency')`)).rejects.toThrow(/permission denied/);
    await expect(sql(`SET ROLE authenticated; SET request.jwt.claim.sub = '${owner}';
      DELETE FROM public.workspaces WHERE id = '${id}'`)).rejects.toThrow(/permission denied/);
  });

  it("preserves service-role workspace creation used by authenticated API routes", async () => {
    expect(await sql(`SET ROLE service_role;
      INSERT INTO public.workspaces (owner_id, name) VALUES ('${owner}', 'Server-created workspace') RETURNING plan`)).toBe("free");
  });
});

describe("real PostgreSQL worker replay protection", () => {
  it("allows only one concurrent use across independent connections", async () => {
    const nonce = randomUUID();
    const timestamp = Number(await sql("SELECT floor(extract(epoch from clock_timestamp()))::bigint"));
    const claim = `SET ROLE service_role; SELECT public.intentlead_claim_worker_nonce('${nonce}', ${timestamp})`;
    const results = await Promise.all(Array.from({ length: 12 }, () => sql(claim)));
    expect(results.filter((result) => result === "t")).toHaveLength(1);
    expect(results.filter((result) => result === "f")).toHaveLength(11);
    // A later independent connection still sees the consumed nonce.
    expect(await sql(claim)).toBe("f");
  }, 20_000);

  it("denies expired and future timestamps, and null nonce", async () => {
    for (const offset of [-61, 61]) {
      expect(await sql(`SET ROLE service_role; SELECT public.intentlead_claim_worker_nonce('${randomUUID()}', floor(extract(epoch from clock_timestamp()))::bigint + ${offset})`)).toBe("f");
    }
    expect(await sql("SET ROLE service_role; SELECT public.intentlead_claim_worker_nonce(NULL, NULL)")).toBe("f");
  });

  it.each(["anon", "authenticated"])("denies replay RPC access by %s", async (role) => {
    await expect(sql(`SET ROLE ${role}; SELECT public.intentlead_claim_worker_nonce('${randomUUID()}', 1)`)).rejects.toThrow(/permission denied/);
  });

  it.each(["anon", "authenticated", "service_role"])("revokes inherited/default nonce table read/write grants from %s", async (role) => {
    expect(await sql(`SELECT has_table_privilege('${role}', 'public.intentlead_worker_nonces', 'SELECT')`)).toBe("f");
    await expect(sql(`SET ROLE ${role}; SELECT * FROM public.intentlead_worker_nonces`)).rejects.toThrow(/permission denied/);
    await expect(sql(`SET ROLE ${role}; INSERT INTO public.intentlead_worker_nonces VALUES ('${randomUUID()}', now())`)).rejects.toThrow(/permission denied/);
    await expect(sql(`SET ROLE ${role}; UPDATE public.intentlead_worker_nonces SET expires_at = now()`)).rejects.toThrow(/permission denied/);
    await expect(sql(`SET ROLE ${role}; DELETE FROM public.intentlead_worker_nonces`)).rejects.toThrow(/permission denied/);
    await expect(sql(`SET ROLE ${role}; TRUNCATE public.intentlead_worker_nonces`)).rejects.toThrow(/permission denied/);
  });

  it("denies a delayed replay after concurrent expiry cleanup removes the original nonce", async () => {
    const nonce = randomUUID();
    const blockerName = `intentlead-lock-${nonce}`;
    const delayedName = `intentlead-replay-${nonce}`;
    const lockKey = 61904127;
    // A test-only trigger lets us pause precisely after the RPC's initial time check.
    await sql(`CREATE FUNCTION public.intentlead_test_delay_nonce() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.nonce = '${nonce}' AND current_setting('application_name') = '${delayedName}' THEN
          PERFORM pg_advisory_xact_lock(${lockKey});
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER intentlead_test_delay_nonce BEFORE INSERT ON public.intentlead_worker_nonces
        FOR EACH ROW EXECUTE FUNCTION public.intentlead_test_delay_nonce()`);
    const blocker = sql(`BEGIN; SELECT pg_advisory_xact_lock(${lockKey}); SELECT pg_sleep(15); COMMIT`, blockerName).catch(() => "cancelled");
    let delayed: Promise<string> | undefined;
    async function waitForWaitEvent(name: string, event: string) {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        if (await sql(`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = '${name}' AND wait_event = '${event}')`) === "t") return;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error(`Expected ${name} to be blocked on ${event}`);
    }
    try {
      await waitForWaitEvent(blockerName, "PgSleep");
      const timestamp = Number(await sql("SELECT floor(extract(epoch from clock_timestamp()))::bigint - 57"));
      const claim = `SET ROLE service_role; SELECT public.intentlead_claim_worker_nonce('${nonce}', ${timestamp})`;
      expect(await sql(claim)).toBe("t");
      delayed = sql(claim, delayedName);
      await waitForWaitEvent(delayedName, "advisory");
      // Wait until this exact signature is expired, then let a different claim clean it up.
      await sql(`SELECT pg_sleep(greatest(0, ${timestamp + 61} - extract(epoch from clock_timestamp())) + 0.1)`);
      expect(await sql(`SET ROLE service_role; SELECT public.intentlead_claim_worker_nonce('${randomUUID()}', floor(extract(epoch from clock_timestamp()))::bigint)`)).toBe("t");
      expect(await sql(`SELECT count(*) FROM public.intentlead_worker_nonces WHERE nonce = '${nonce}'`)).toBe("0");
      await sql(`SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE application_name = '${blockerName}'`);
      await blocker;
      expect(await delayed).toBe("f");
      expect(await sql(claim)).toBe("f");
      // Another cleanup must not make that old signed request acceptable again.
      await sql(`SET ROLE service_role; SELECT public.intentlead_claim_worker_nonce('${randomUUID()}', floor(extract(epoch from clock_timestamp()))::bigint)`);
      expect(await sql(claim)).toBe("f");
    } finally {
      await sql(`SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE application_name = '${blockerName}'`);
      await blocker;
      if (delayed) await delayed.catch(() => undefined);
      await sql("DROP TRIGGER intentlead_test_delay_nonce ON public.intentlead_worker_nonces; DROP FUNCTION public.intentlead_test_delay_nonce()");
    }
  }, 25_000);

  it("enables RLS and fixes the security-definer search paths", async () => {
    expect(await sql("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.intentlead_worker_nonces'::regclass")).toBe("t");
    expect(await sql("SELECT count(*) FROM pg_proc WHERE proname IN ('intentlead_consume_chat_quota', 'intentlead_claim_worker_nonce') AND prosecdef AND 'search_path=pg_catalog, public'=ANY(proconfig)")).toBe("2");
  });
});
