import { beforeAll, describe, expect, it } from "vitest";
import { applyTaskEMigration, bootstrapTask8Database, sql } from "./task8-db";

const enabled = Boolean(process.env.INTENTLEAD_TEST_DATABASE_URL);

describe.skipIf(!enabled)("Task E clean database migration", () => {
  beforeAll(async () => {
    await bootstrapTask8Database(false);
    await applyTaskEMigration();
  }, 60_000);

  it("applies without legacy fixture rows and leaves every surviving tenant table under RLS", async () => {
    expect(await sql(`SELECT count(*) FROM public.workspaces`)).toBe("0");
    expect(await sql(`SELECT count(*) FROM pg_class c
      WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
        AND c.relname LIKE 'intentlead_%' AND NOT c.relrowsecurity`)).toBe("0");
    expect(await sql(`SELECT count(*) FROM pg_class
      WHERE relnamespace='public'::regnamespace
        AND relname IN ('campaigns','signals','leads','messages')`)).toBe("0");
  });
});
