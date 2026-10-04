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
async function sql(statement: string): Promise<string> {
  const { stdout } = await execute("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement], {
    env: {
      ...process.env, PGHOST: database.hostname, PGPORT: database.port || "5432",
      PGDATABASE: database.pathname.slice(1), PGUSER: decodeURIComponent(database.username),
      PGPASSWORD: decodeURIComponent(database.password), PGCONNECT_TIMEOUT: "3",
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
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  `);
  // Relevant existing baseline, before the additive Task 2 upgrade.
  for (const file of ["001_tables.sql", "002_rls.sql", "006_schema_v2.sql"]) {
    await sql(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
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

  it.each(["anon", "authenticated"])("denies replay RPC/table access by %s", async (role) => {
    await expect(sql(`SET ROLE ${role}; SELECT public.intentlead_claim_worker_nonce('${randomUUID()}', 1)`)).rejects.toThrow(/permission denied/);
    await expect(sql(`SET ROLE ${role}; SELECT * FROM public.intentlead_worker_nonces`)).rejects.toThrow(/permission denied/);
    await expect(sql(`SET ROLE ${role}; DELETE FROM public.intentlead_worker_nonces`)).rejects.toThrow(/permission denied/);
  });

  it("enables RLS and fixes the security-definer search paths", async () => {
    expect(await sql("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.intentlead_worker_nonces'::regclass")).toBe("t");
    expect(await sql("SELECT count(*) FROM pg_proc WHERE proname IN ('intentlead_consume_chat_quota', 'intentlead_claim_worker_nonce') AND prosecdef AND 'search_path=pg_catalog, public'=ANY(proconfig)")).toBe("2");
  });
});
