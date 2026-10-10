import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { bootstrapLatestDatabase, asRole, sql } from "./task8-db";
import { insertUsers } from "./task4-db";

const owner = randomUUID();
const outsider = randomUUID();

const v1 = {
  schemaVersion: 1,
  offer: { name: "Legacy offer", summary: "Legacy summary", outcomes: [], exclusions: [] },
  icp: { name: "Legacy ICP", description: "Legacy companies", companyAttributes: [], exclusions: [] },
  objective: "Legacy objective",
  criteria: {
    jurisdictions: [], languages: ["en"], signalFamilies: ["EXPRESSED_INTENT"], exclusions: [],
    limits: { maxSourceItems: 25, maxOpportunities: 10 },
  },
};

const v2 = {
  schemaVersion: 2,
  offer: { name: "Approved offer", summary: "Workflow software", outcomes: ["Faster delivery"], exclusions: [] },
  icp: {
    name: "Approved ICP", description: "US agencies", targetBuyerDescription: null,
    companyAttributes: [], exclusions: [],
  },
  objective: "Find approved opportunities",
  criteria: {
    schemaVersion: 2,
    jurisdictions: [{ countryCode: "US", subdivisionCode: null }], marketIntent: ["United States"],
    languages: ["en"], signalFamilies: ["EXPRESSED_INTENT"], exclusions: ["gambling"],
    requestedConfirmedSignals: 30, limits: { maxSourceItems: 80, maxOpportunities: 15 },
    intakeApproval: {
      reviewFingerprint: "a".repeat(64), requestFingerprint: "b".repeat(64), humanApproved: true,
      prompt: { templateId: "intake-v1", version: "1", systemInstructionHash: "c".repeat(64), userContentRole: "UNTRUSTED_USER" },
      telemetry: {
        model: "fixture", modelVersion: "fixture-v1", inputTokens: 20, outputTokens: 30, latencyMs: 0,
        cost: { amount: 0, currency: "USD" }, limitations: ["SYNTHETIC_FIXTURE"],
      },
      marketMappings: [{ marketIntent: "United States", scope: "JURISDICTIONS", jurisdictions: [{ countryCode: "US", subdivisionCode: null }] }],
      languageMappings: [{ source: "USER_STATED", languageIntent: "English", language: "en" }],
      exclusionMappings: [{ exclusion: "gambling", destination: "DISCOVERY" }],
    },
  },
};

function literal(value: unknown): string {
  return JSON.stringify(value).replaceAll("'", "''");
}

async function createV1(userId: string, key: string, command: unknown): Promise<Record<string, unknown>> {
  const result = await sql(asRole("authenticated", `SELECT public.intentlead_create_discovery_brief(
    '${literal(command)}'::jsonb,'${key}'
  )`, userId));
  return JSON.parse(result) as Record<string, unknown>;
}

async function createApproved(
  userId: string,
  key: string,
  command: unknown,
  role: "authenticated" | "service_role" = "service_role",
): Promise<Record<string, unknown>> {
  const result = await sql(asRole(role, `SELECT public.intentlead_create_approved_discovery_brief(
    '${userId}','${literal(command)}'::jsonb,'${key}'
  )`, role === "authenticated" ? userId : undefined));
  return JSON.parse(result) as Record<string, unknown>;
}

beforeAll(async () => {
  await bootstrapLatestDatabase();
  const name = "202610100003_taskk2_approved_discovery_brief.sql";
  const migration = await readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
  await sql(migration, `intentlead-${name}`);
  await insertUsers(owner, outsider);
}, 30_000);

describe("Task K2 approved DiscoveryBrief persistence", () => {
  it("keeps V1 compatible and round-trips every V2-only field", async () => {
    const legacy = await createV1(owner, `taskk2-v1-${randomUUID()}`, v1);
    expect(await sql(`SELECT criteria->>'schemaVersion' IS NULL FROM public.intentlead_discovery_briefs WHERE id='${legacy.discoveryBriefId}'`)).toBe("t");

    const created = await createApproved(owner, `taskk2-v2-${randomUUID()}`, v2);
    const stored = JSON.parse(await sql(`SELECT jsonb_build_object(
      'offer',o.definition,'icp',i.definition,'criteria',b.criteria
    ) FROM public.intentlead_discovery_briefs b
    JOIN public.intentlead_offer_profiles o ON o.id=b.offer_profile_id AND o.workspace_id=b.workspace_id
    JOIN public.intentlead_icp_definitions i ON i.id=b.icp_definition_id AND i.workspace_id=b.workspace_id
    WHERE b.id='${created.discoveryBriefId}'`)) as Record<string, unknown>;
    expect(stored).toEqual({
      offer: { summary: v2.offer.summary, outcomes: v2.offer.outcomes, exclusions: v2.offer.exclusions },
      icp: {
        description: v2.icp.description, targetBuyerDescription: v2.icp.targetBuyerDescription,
        companyAttributes: v2.icp.companyAttributes, exclusions: v2.icp.exclusions,
      },
      criteria: v2.criteria,
    });
    expect(await sql(`SELECT count(*) FROM public.intentlead_jobs WHERE discovery_brief_id='${created.discoveryBriefId}'`)).toBe("0");
  });

  it("conflicts when a V2-only value changes under the same key", async () => {
    const key = `taskk2-conflict-${randomUUID()}`;
    await createApproved(owner, key, v2);
    const changed = { ...v2, criteria: { ...v2.criteria, requestedConfirmedSignals: 31 } };
    await expect(createApproved(owner, key, changed)).rejects.toThrow(/idempotency_conflict/);
  });

  it("rejects malformed or inconsistent nested approval mappings at the direct RPC boundary", async () => {
    const malformed = {
      ...v2,
      criteria: {
        ...v2.criteria,
        intakeApproval: { ...v2.criteria.intakeApproval, marketMappings: [{ unsafe: "object" }] },
      },
    };
    const inconsistent = {
      ...v2,
      criteria: {
        ...v2.criteria,
        intakeApproval: {
          ...v2.criteria.intakeApproval,
          marketMappings: [{
            marketIntent: "Canada", scope: "JURISDICTIONS",
            jurisdictions: [{ countryCode: "CA", subdivisionCode: null }],
          }],
        },
      },
    };
    await expect(createApproved(owner, `taskk2-invalid-${randomUUID()}`, malformed))
      .rejects.toThrow(/invalid_approved_discovery_command/);
    await expect(createApproved(owner, `taskk2-invalid-${randomUUID()}`, inconsistent))
      .rejects.toThrow(/invalid_approved_discovery_command/);
  });

  it("denies authenticated execution and keeps explicit service users tenant-isolated", async () => {
    await expect(createApproved(owner, `taskk2-denied-${randomUUID()}`, v2, "authenticated"))
      .rejects.toThrow(/permission denied/i);
    await expect(createV1(owner, `taskk2-old-v2-${randomUUID()}`, v2))
      .rejects.toThrow(/invalid_discovery_command/);
    const first = await createApproved(owner, `taskk2-owner-${randomUUID()}`, v2);
    const second = await createApproved(outsider, `taskk2-outsider-${randomUUID()}`, v2);
    expect(first.workspaceId).not.toBe(second.workspaceId);
    expect(await sql(asRole("authenticated", `SELECT count(*) FROM public.intentlead_discovery_briefs
      WHERE id='${first.discoveryBriefId}'`, outsider))).toBe("0");
  });
});
