import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { asRole, bootstrapLatestDatabase, sql } from "./task8-db";

const enabled = Boolean(process.env.INTENTLEAD_TEST_DATABASE_URL);

describe.skipIf(!enabled)("real PostgreSQL worker replay protection", () => {
  beforeAll(async () => {
    await bootstrapLatestDatabase();
  }, 60_000);

  it("allows only one concurrent use across independent connections", async () => {
    const nonce = randomUUID();
    const timestamp = Number(await sql("SELECT floor(extract(epoch from clock_timestamp()))::bigint"));
    const claim = asRole("service_role", `SELECT public.intentlead_claim_worker_nonce('${nonce}', ${timestamp})`);
    const results = await Promise.all(Array.from({ length: 12 }, () => sql(claim)));
    expect(results.filter(result => result === "t")).toHaveLength(1);
    expect(results.filter(result => result === "f")).toHaveLength(11);
    expect(await sql(claim)).toBe("f");
  }, 20_000);

  it("denies expired, future, and null claims", async () => {
    for (const offset of [-61, 61]) {
      expect(await sql(asRole("service_role", `SELECT public.intentlead_claim_worker_nonce(
        '${randomUUID()}', floor(extract(epoch from clock_timestamp()))::bigint + ${offset}
      )`))).toBe("f");
    }
    expect(await sql(asRole("service_role", "SELECT public.intentlead_claim_worker_nonce(NULL, NULL)"))).toBe("f");
  });

  it.each(["anon", "authenticated"] as const)("denies replay RPC access by %s", async role => {
    await expect(sql(asRole(role, `SELECT public.intentlead_claim_worker_nonce('${randomUUID()}', 1)`)))
      .rejects.toThrow(/permission denied/);
  });

  it.each(["anon", "authenticated", "service_role"] as const)(
    "revokes direct nonce-table access from %s",
    async role => {
      expect(await sql(`SELECT has_table_privilege('${role}', 'public.intentlead_worker_nonces', 'SELECT')`)).toBe("f");
      await expect(sql(asRole(role, "SELECT * FROM public.intentlead_worker_nonces"))).rejects.toThrow(/permission denied/);
      await expect(sql(asRole(role, `INSERT INTO public.intentlead_worker_nonces VALUES ('${randomUUID()}', now())`)))
        .rejects.toThrow(/permission denied/);
      await expect(sql(asRole(role, "UPDATE public.intentlead_worker_nonces SET expires_at=now()")))
        .rejects.toThrow(/permission denied/);
      await expect(sql(asRole(role, "DELETE FROM public.intentlead_worker_nonces")))
        .rejects.toThrow(/permission denied/);
      await expect(sql(asRole(role, "TRUNCATE public.intentlead_worker_nonces")))
        .rejects.toThrow(/permission denied/);
    },
  );

  it("denies a delayed replay even after expiry cleanup removes the original row", async () => {
    const nonce = randomUUID();
    const blockerName = `intentlead-lock-${nonce}`;
    const delayedName = `intentlead-replay-${nonce}`;
    const lockKey = 61904127;
    await sql(`CREATE FUNCTION public.intentlead_test_delay_nonce() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.nonce='${nonce}' AND current_setting('application_name')='${delayedName}' THEN
          PERFORM pg_advisory_xact_lock(${lockKey});
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER intentlead_test_delay_nonce BEFORE INSERT ON public.intentlead_worker_nonces
        FOR EACH ROW EXECUTE FUNCTION public.intentlead_test_delay_nonce()`);
    const blocker = sql(`BEGIN; SELECT pg_advisory_xact_lock(${lockKey}); SELECT pg_sleep(15); COMMIT`, blockerName)
      .catch(() => "cancelled");
    let delayed: Promise<string> | undefined;
    async function waitForWaitEvent(name: string, event: string) {
      const deadline = Date.now() + 3_000;
      while (Date.now() < deadline) {
        if (await sql(`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity WHERE application_name='${name}' AND wait_event='${event}'
        )`) === "t") return;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw new Error(`Expected ${name} to be blocked on ${event}`);
    }
    try {
      await waitForWaitEvent(blockerName, "PgSleep");
      const timestamp = Number(await sql("SELECT floor(extract(epoch from clock_timestamp()))::bigint - 57"));
      const claim = asRole("service_role", `SELECT public.intentlead_claim_worker_nonce('${nonce}', ${timestamp})`);
      expect(await sql(claim)).toBe("t");
      delayed = sql(claim, delayedName);
      await waitForWaitEvent(delayedName, "advisory");
      await sql(`SELECT pg_sleep(greatest(0, ${timestamp + 61} - extract(epoch from clock_timestamp())) + 0.1)`);
      expect(await sql(asRole("service_role", `SELECT public.intentlead_claim_worker_nonce(
        '${randomUUID()}', floor(extract(epoch from clock_timestamp()))::bigint
      )`))).toBe("t");
      expect(await sql(`SELECT count(*) FROM public.intentlead_worker_nonces WHERE nonce='${nonce}'`)).toBe("0");
      await sql(`SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE application_name='${blockerName}'`);
      await blocker;
      expect(await delayed).toBe("f");
      expect(await sql(claim)).toBe("f");
      await sql(asRole("service_role", `SELECT public.intentlead_claim_worker_nonce(
        '${randomUUID()}', floor(extract(epoch from clock_timestamp()))::bigint
      )`));
      expect(await sql(claim)).toBe("f");
    } finally {
      await sql(`SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE application_name='${blockerName}'`);
      await blocker;
      if (delayed) await delayed.catch(() => undefined);
      await sql("DROP TRIGGER intentlead_test_delay_nonce ON public.intentlead_worker_nonces; DROP FUNCTION public.intentlead_test_delay_nonce()");
    }
  }, 25_000);

  it("keeps nonce storage behind an RLS-protected, fixed-search-path RPC", async () => {
    expect(await sql("SELECT relrowsecurity FROM pg_class WHERE oid='public.intentlead_worker_nonces'::regclass")).toBe("t");
    expect(await sql(`SELECT prosecdef AND 'search_path=pg_catalog, public'=ANY(proconfig)
      FROM pg_proc WHERE oid='public.intentlead_claim_worker_nonce(uuid,bigint)'::regprocedure`)).toBe("t");
  });
});
