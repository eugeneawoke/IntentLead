import { readFile } from "node:fs/promises";
import { bootstrapLatestDatabase, sql } from "./task8-db";

async function migration(name: string): Promise<string> {
  return readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

export async function applyTaskIMigrations(): Promise<void> {
  for (const name of [
    "202610060019_opportunity_package.sql",
    "202610060020_opportunity_package_guards.sql",
  ]) {
    await sql(await migration(name), "intentlead-taski-migration");
  }
}

export async function bootstrapTaskIDatabase(): Promise<void> {
  await bootstrapLatestDatabase();
  await applyTaskIMigrations();
}
