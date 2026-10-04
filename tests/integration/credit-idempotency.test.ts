import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { asRole, bootstrapTask4Database, insertUsers, sql } from "./task4-db";

const owner = randomUUID();
const outsider = randomUUID();
const workspaceId = randomUUID();
let opportunityId: string;
let policyId: string;

const checkNames = ["evidence", "company", "buyer", "contact", "grounded_draft", "suppression", "market_workflow"];

beforeAll(async () => {
  await bootstrapTask4Database();
  await insertUsers(owner, outsider);
  const offerId = randomUUID();
  const icpId = randomUUID();
  const marketId = randomUUID();
  const briefId = randomUUID();
  opportunityId = randomUUID();
  policyId = randomUUID();
  const evidenceId = randomUUID();
  await sql(`
    INSERT INTO public.workspaces (id, owner_id, name, plan, credits_remaining)
      VALUES ('${workspaceId}', '${owner}', 'Task 4 credits', 'starter', 10);
    INSERT INTO public.intentlead_offer_profiles (id, workspace_id, name, definition) VALUES ('${offerId}', '${workspaceId}', 'Credits offer', '{}');
    INSERT INTO public.intentlead_icp_definitions (id, workspace_id, name, definition) VALUES ('${icpId}', '${workspaceId}', 'Credits ICP', '{}');
    INSERT INTO public.intentlead_market_profiles (id, workspace_id, profile_key, workflow, configuration)
      VALUES ('${marketId}', '${workspaceId}', 'LOCAL_CUSTOM', 'ASSISTED_OUTREACH', '{}');
    INSERT INTO public.intentlead_discovery_briefs
      (id, workspace_id, offer_profile_id, icp_definition_id, market_profile_id, objective, criteria)
      VALUES ('${briefId}', '${workspaceId}', '${offerId}', '${icpId}', '${marketId}', 'Charge fixture', '{}');
    INSERT INTO public.intentlead_opportunities
      (id, workspace_id, discovery_brief_id, market_profile_key, state, signal)
      VALUES ('${opportunityId}', '${workspaceId}', '${briefId}', 'LOCAL_CUSTOM', 'PACKAGE_READY', '{"family":"DETECTED_PROBLEM"}');
    INSERT INTO public.intentlead_evidence_items
      (id, workspace_id, evidence_type, captured_at, excerpt, structured_facts, verification_method, confidence, content_hash, provenance)
      VALUES ('${evidenceId}', '${workspaceId}', 'text', now(), 'Charge evidence', '{}', 'fixture', 0.9, repeat('1',64), '{"sourceType":"WEB"}');
    INSERT INTO public.intentlead_opportunity_evidence (workspace_id, opportunity_id, evidence_id)
      VALUES ('${workspaceId}', '${opportunityId}', '${evidenceId}');
    INSERT INTO public.intentlead_verification_policies
      (id, workspace_id, version, market_profile_key, workflow, package_verified_allowed, checks)
      VALUES ('${policyId}', '${workspaceId}', 1, 'LOCAL_CUSTOM', 'ASSISTED_OUTREACH', true,
        '{"evidence":{},"company":{},"buyer":{},"contact":{},"grounded_draft":{},"suppression":{},"market_workflow":{}}')
  `);
}, 30_000);

async function packageWithChecks(status: "PASS" | "FAIL" = "PASS", count = 7, opportunity = opportunityId): Promise<string> {
  const packageId = randomUUID();
  await sql(`INSERT INTO public.intentlead_verified_packages
    (id, workspace_id, opportunity_id, policy_id, policy_version, market_profile_key, workflow, status, idempotency_key)
    VALUES ('${packageId}', '${workspaceId}', '${opportunity}', '${policyId}', 1, 'LOCAL_CUSTOM', 'ASSISTED_OUTREACH', 'PENDING', 'package-${packageId}')`);
  for (const [index, name] of checkNames.slice(0, count).entries()) {
    await sql(`INSERT INTO public.intentlead_package_check_results
      (workspace_id, package_id, check_name, status, reason, reference_ids)
      VALUES ('${workspaceId}', '${packageId}', '${name}', '${index === 0 ? status : "PASS"}', 'fixture', ARRAY['${randomUUID()}'::uuid])`);
  }
  return packageId;
}

async function charge(packageId: string, key: string, userId = owner): Promise<string> {
  return sql(asRole("service_role", `SELECT public.intentlead_charge_verified_package('${packageId}', '${userId}', '${key}')`));
}

describe("verified package credit idempotency", () => {
  it("charges exactly one credit under concurrent retries", async () => {
    const packageId = await packageWithChecks();
    const key = `charge-${packageId}`;
    const events = await Promise.all(Array.from({ length: 16 }, () => charge(packageId, key)));
    expect(new Set(events).size).toBe(1);
    expect(await sql(`SELECT credits_remaining FROM public.workspaces WHERE id='${workspaceId}'`)).toBe("9");
    expect(await sql(`SELECT count(*) FROM public.intentlead_cost_events WHERE verified_package_id='${packageId}' AND customer_credit_delta=-1`)).toBe("1");
    expect(await charge(packageId, key)).toBe(events[0]);
    expect(await sql(`SELECT credits_remaining FROM public.workspaces WHERE id='${workspaceId}'`)).toBe("9");
  }, 20_000);

  it("rejects missing, failed, duplicate, foreign-owner, and conflicting idempotency input without charge", async () => {
    const initial = await sql(`SELECT credits_remaining FROM public.workspaces WHERE id='${workspaceId}'`);
    await expect(charge(await packageWithChecks("PASS", 6), `missing-${randomUUID()}`)).rejects.toThrow(/verification_checks_incomplete/);
    await expect(charge(await packageWithChecks("FAIL"), `failed-${randomUUID()}`)).rejects.toThrow(/verification_checks_failed/);
    const foreignPackage = await packageWithChecks();
    await expect(charge(foreignPackage, `foreign-${randomUUID()}`, outsider)).rejects.toThrow(/forbidden/);
    const duplicatePackage = await packageWithChecks();
    await expect(sql(`INSERT INTO public.intentlead_package_check_results
      (workspace_id, package_id, check_name, status, reason, reference_ids)
      VALUES ('${workspaceId}', '${duplicatePackage}', 'evidence', 'PASS', 'duplicate', ARRAY['${randomUUID()}'::uuid])`)).rejects.toThrow(/duplicate|unique/i);
    expect(await sql(`SELECT credits_remaining FROM public.workspaces WHERE id='${workspaceId}'`)).toBe(initial);
  });

  it("never charges rejected or discovery-only packages", async () => {
    const rejectedOpportunity = randomUUID();
    const rejectedEvidence = randomUUID();
    const briefId = await sql(`SELECT discovery_brief_id FROM public.intentlead_opportunities WHERE id='${opportunityId}'`);
    await sql(`INSERT INTO public.intentlead_opportunities
      (id, workspace_id, discovery_brief_id, market_profile_key, state, signal)
      VALUES ('${rejectedOpportunity}', '${workspaceId}', '${briefId}', 'LOCAL_CUSTOM', 'MODEL_REJECTED', '{"family":"DETECTED_PROBLEM"}');
      INSERT INTO public.intentlead_evidence_items
        (id, workspace_id, evidence_type, captured_at, excerpt, structured_facts, verification_method, confidence, content_hash, provenance)
      VALUES ('${rejectedEvidence}', '${workspaceId}', 'text', now(), 'Rejected evidence', '{}', 'fixture', 0.7, repeat('2',64), '{"sourceType":"WEB"}');
      INSERT INTO public.intentlead_opportunity_evidence (workspace_id, opportunity_id, evidence_id)
        VALUES ('${workspaceId}', '${rejectedOpportunity}', '${rejectedEvidence}')`);
    await expect(charge(await packageWithChecks("PASS", 7, rejectedOpportunity), `rejected-${randomUUID()}`)).rejects.toThrow(/package_not_chargeable/);

    const discoveryPolicy = randomUUID();
    const discoveryPackage = randomUUID();
    await sql(`
      INSERT INTO public.intentlead_verification_policies
        (id, workspace_id, version, market_profile_key, workflow, package_verified_allowed, checks)
      VALUES ('${discoveryPolicy}', '${workspaceId}', 1, 'EN_DISCOVERY_ONLY', 'DISCOVERY_ONLY', false,
        '{"evidence":{},"company":{},"buyer":{},"contact":{},"grounded_draft":{},"suppression":{},"market_workflow":{}}');
      INSERT INTO public.intentlead_verified_packages
        (id, workspace_id, opportunity_id, policy_id, policy_version, market_profile_key, workflow, status, idempotency_key)
      VALUES ('${discoveryPackage}', '${workspaceId}', '${opportunityId}', '${discoveryPolicy}', 1,
        'EN_DISCOVERY_ONLY', 'DISCOVERY_ONLY', 'PENDING', 'package-${discoveryPackage}')
    `);
    for (const name of checkNames) {
      await sql(`INSERT INTO public.intentlead_package_check_results
        (workspace_id, package_id, check_name, status, reason, reference_ids)
        VALUES ('${workspaceId}', '${discoveryPackage}', '${name}', 'PASS', 'fixture', ARRAY['${randomUUID()}'::uuid])`);
    }
    await expect(charge(discoveryPackage, `discovery-${randomUUID()}`)).rejects.toThrow(/package_verification_disabled/);
  });

  it("keeps charge internals server-only and fixes the definer search path", async () => {
    const packageId = await packageWithChecks();
    for (const role of ["anon", "authenticated"] as const) {
      await expect(sql(asRole(role, `SELECT public.intentlead_charge_verified_package('${packageId}', '${owner}', 'client')`, role === "authenticated" ? owner : undefined))).rejects.toThrow(/permission denied/);
    }
    expect(await sql(`SELECT prosecdef AND 'search_path=pg_catalog, public'=ANY(proconfig)
      FROM pg_proc WHERE proname='intentlead_charge_verified_package'`)).toBe("t");
  });
});
