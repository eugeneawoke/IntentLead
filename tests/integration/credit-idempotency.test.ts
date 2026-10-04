import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { asRole, bootstrapTask4Database, insertUsers, sql } from "./task4-db";

const owner = randomUUID();
const outsider = randomUUID();
const workspaceId = randomUUID();
const checkNames = ["evidence", "company", "buyer", "contact", "grounded_draft", "suppression", "market_workflow"] as const;

type Fixture = {
  opportunityId: string;
  marketId: string;
  evidenceId: string;
  companyId: string;
  buyerId: string;
  contactId: string;
  contactVerificationId: string;
  draftId: string;
  suppressionDecisionId: string;
};

let policyId: string;
let primary: Fixture;
let offerId: string;
let icpId: string;

const provenance = JSON.stringify({ sourceType: "WEB", sourceId: "task4-fixture", providerRunId: null, rawArtifactId: null });

async function createOpportunity(
  profileKey: "LOCAL_CUSTOM" | "EN_DISCOVERY_ONLY" = "LOCAL_CUSTOM",
  countryCode = "US",
  contactCountryCode = countryCode,
): Promise<Fixture> {
  const marketId = randomUUID();
  const briefId = randomUUID();
  const opportunityId = randomUUID();
  const evidenceId = randomUUID();
  const companyId = randomUUID();
  const assessmentId = randomUUID();
  const personId = randomUUID();
  const buyerId = randomUUID();
  const contactId = randomUUID();
  const contactVerificationId = randomUUID();
  const draftId = randomUUID();
  const suppressionDecisionId = randomUUID();
  const assisted = profileKey === "LOCAL_CUSTOM";
  const capabilities = assisted
    ? "ARRAY['SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_VERIFY','DRAFT_GENERATION','OUTREACH_READY','PACKAGE_VERIFIED']::text[]"
    : "ARRAY['SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW']::text[]";

  await sql(`BEGIN;
    INSERT INTO public.intentlead_market_profiles
      (id, workspace_id, version, profile_key, workflow, configuration, capabilities, disabled_capabilities)
    VALUES ('${marketId}', '${workspaceId}',
      (SELECT coalesce(max(version),0)+1 FROM public.intentlead_market_profiles WHERE workspace_id='${workspaceId}' AND profile_key='${profileKey}'),
      '${profileKey}', '${assisted ? "ASSISTED_OUTREACH" : "DISCOVERY_ONLY"}', '{}',
      ${capabilities}, ${assisted ? "'{}'::text[]" : "ARRAY['PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','OUTREACH_READY','OUTREACH_SEND','OUTCOME_RECORDING','PACKAGE_VERIFIED']::text[]"});
    INSERT INTO public.intentlead_discovery_briefs
      (id, workspace_id, offer_profile_id, icp_definition_id, market_profile_id, objective, criteria)
    VALUES ('${briefId}', '${workspaceId}', '${offerId}', '${icpId}', '${marketId}', 'Charge fixture', '{}');
    INSERT INTO public.intentlead_companies
      (id, workspace_id, canonical_name, domain, jurisdiction, confidence)
    VALUES ('${companyId}', '${workspaceId}', 'Acme ${opportunityId}', '${opportunityId}.example',
      '{"countryCode":"${countryCode}","subdivisionCode":null}', 0.95);
    INSERT INTO public.intentlead_evidence_items
      (id, workspace_id, evidence_type, captured_at, excerpt, structured_facts, verification_method, confidence, content_hash, provenance)
    VALUES ('${evidenceId}', '${workspaceId}', 'text', now(), 'Charge evidence',
      '{"companyName":"Acme","problem":{"category":"website","observedCondition":"Conversion friction"}}',
      'fixture', 0.9, md5('${evidenceId}')||md5('${evidenceId}'), '${provenance}');
    INSERT INTO public.intentlead_opportunities
      (id, workspace_id, discovery_brief_id, company_id, state, signal)
    VALUES ('${opportunityId}', '${workspaceId}', '${briefId}', '${companyId}', 'DISCOVERED',
      '{"family":"DETECTED_PROBLEM","subtype":"website"}');
    INSERT INTO public.intentlead_opportunity_evidence (workspace_id, opportunity_id, evidence_id)
    VALUES ('${workspaceId}', '${opportunityId}', '${evidenceId}');
    INSERT INTO public.intentlead_opportunity_assessments
      (id, workspace_id, opportunity_id, version, decision, signal, problem_type, problem_statement,
       evidence_strength, explicitness, urgency, freshness, commercial_impact, icp_fit, company_confidence,
       buyer_relevance, actionability, confidence, assessed_at)
    VALUES ('${assessmentId}', '${workspaceId}', '${opportunityId}', 1, 'QUALIFY',
      '{"family":"DETECTED_PROBLEM","subtype":"website"}', 'website', 'Conversion friction',
      .9,.8,.7,.9,.8,.9,.95,.9,.8,.9,now());
    INSERT INTO public.intentlead_assessment_evidence (workspace_id, assessment_id, opportunity_id, evidence_id)
    VALUES ('${workspaceId}', '${assessmentId}', '${opportunityId}', '${evidenceId}');
    UPDATE public.intentlead_opportunities SET state='PACKAGE_READY', current_assessment_id='${assessmentId}' WHERE id='${opportunityId}';
    INSERT INTO public.intentlead_people
      (id, workspace_id, company_id, full_name, role_title, jurisdiction, confidence, resolved_at)
    VALUES ('${personId}', '${workspaceId}', '${companyId}', 'Alex Buyer', 'VP Growth',
      '{"countryCode":"${countryCode}","subdivisionCode":null}', .9, now());
    INSERT INTO public.intentlead_buyer_candidates
      (id, workspace_id, opportunity_id, company_id, person_id, role_title, hypothesis, confidence, relevance)
    VALUES ('${buyerId}', '${workspaceId}', '${opportunityId}', '${companyId}', '${personId}', 'VP Growth',
      'Owns website conversion', .9, .9);
    INSERT INTO public.intentlead_buyer_candidate_evidence (workspace_id, buyer_candidate_id, evidence_id)
    VALUES ('${workspaceId}', '${buyerId}', '${evidenceId}');
    INSERT INTO public.intentlead_contact_points
      (id, workspace_id, person_id, company_id, channel, value, value_hash, jurisdiction, captured_at)
    VALUES ('${contactId}', '${workspaceId}', '${personId}', '${companyId}', 'email', 'alex@${opportunityId}.example',
      md5('alex@${opportunityId}.example')||md5('alex@${opportunityId}.example'),
      '{"countryCode":"${contactCountryCode}","subdivisionCode":null}', now());
    INSERT INTO public.intentlead_contact_point_evidence (workspace_id, contact_point_id, evidence_id)
    VALUES ('${workspaceId}', '${contactId}', '${evidenceId}');
    INSERT INTO public.intentlead_contact_verifications
      (id, workspace_id, contact_point_id, status, verification_method, confidence, checked_at, expires_at)
    VALUES ('${contactVerificationId}', '${workspaceId}', '${contactId}', 'VALID', 'fixture', .99, now(), now()+interval '30 days');
    INSERT INTO public.intentlead_contact_verification_evidence (workspace_id, contact_verification_id, evidence_id)
    VALUES ('${workspaceId}', '${contactVerificationId}', '${evidenceId}');
    INSERT INTO public.intentlead_outreach_drafts
      (id, workspace_id, opportunity_id, version, body, status)
    VALUES ('${draftId}', '${workspaceId}', '${opportunityId}', 1, 'Grounded fixture draft', 'GROUNDED');
    INSERT INTO public.intentlead_outreach_draft_claims
      (workspace_id, draft_id, claim_text, evidence_id)
    VALUES ('${workspaceId}', '${draftId}', 'Conversion friction observed', '${evidenceId}');
    INSERT INTO public.intentlead_suppression_decisions
      (id, workspace_id, opportunity_id, contact_point_id, decision, evaluated_at)
    VALUES ('${suppressionDecisionId}', '${workspaceId}', '${opportunityId}', '${contactId}', 'CLEAR', now());
    COMMIT;`);
  return { opportunityId, marketId, evidenceId, companyId, buyerId, contactId, contactVerificationId, draftId, suppressionDecisionId };
}

beforeAll(async () => {
  await bootstrapTask4Database();
  await insertUsers(owner, outsider);
  offerId = randomUUID();
  icpId = randomUUID();
  policyId = randomUUID();
  await sql(`
    INSERT INTO public.workspaces (id, owner_id, name, plan, credits_remaining)
      VALUES ('${workspaceId}', '${owner}', 'Task 4 credits', 'starter', 10);
    INSERT INTO public.intentlead_offer_profiles (id, workspace_id, name, definition)
      VALUES ('${offerId}', '${workspaceId}', 'Credits offer', '{}');
    INSERT INTO public.intentlead_icp_definitions (id, workspace_id, name, definition)
      VALUES ('${icpId}', '${workspaceId}', 'Credits ICP', '{}');
    INSERT INTO public.intentlead_verification_policies
      (id, workspace_id, version, market_profile_key, workflow, package_verified_allowed, jurisdictions,
       evidence_min_items, evidence_min_strength, evidence_max_age_days, company_min_confidence,
       buyer_min_confidence, buyer_min_relevance, contact_accepted_statuses, contact_max_age_days,
       grounded_draft_require_evidence, suppression_must_be_clear, market_required_capabilities)
    VALUES ('${policyId}', '${workspaceId}', 1, 'LOCAL_CUSTOM', 'ASSISTED_OUTREACH', true,
      '[{"countryCode":"US","subdivisionCode":null}]',
      1,.7,90,.8,.8,.8,ARRAY['VALID'],30,true,true,
      ARRAY['SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_VERIFY','DRAFT_GENERATION','OUTREACH_READY','PACKAGE_VERIFIED']);
  `);
  primary = await createOpportunity();
}, 30_000);

async function packageWithChecks(fixture: Fixture, status: "PASS" | "FAIL" = "PASS", count = 7): Promise<string> {
  const packageId = randomUUID();
  await sql(`INSERT INTO public.intentlead_verified_packages
    (id, workspace_id, opportunity_id, policy_id, policy_version, status, idempotency_key)
    VALUES ('${packageId}', '${workspaceId}', '${fixture.opportunityId}', '${policyId}', 1, 'PENDING', 'package-${packageId}')`);
  const references: Record<(typeof checkNames)[number], [string, string] | null> = {
    evidence: null,
    company: ["company_id", fixture.companyId],
    buyer: ["buyer_candidate_id", fixture.buyerId],
    contact: ["contact_verification_id", fixture.contactVerificationId],
    grounded_draft: ["outreach_draft_id", fixture.draftId],
    suppression: ["suppression_decision_id", fixture.suppressionDecisionId],
    market_workflow: ["market_profile_id", fixture.marketId],
  };
  for (const [index, name] of checkNames.slice(0, count).entries()) {
    const checkId = randomUUID();
    const reference = references[name];
    await sql(`INSERT INTO public.intentlead_package_check_results
      (id, workspace_id, package_id, check_name, status, reason${reference ? `, ${reference[0]}` : ""})
      VALUES ('${checkId}', '${workspaceId}', '${packageId}', '${name}', '${index === 0 ? status : "PASS"}', 'fixture'${reference ? `, '${reference[1]}'` : ""})`);
    if (name === "evidence") {
      await sql(`INSERT INTO public.intentlead_package_check_evidence (workspace_id, package_check_id, evidence_id)
        VALUES ('${workspaceId}', '${checkId}', '${fixture.evidenceId}')`);
    }
  }
  return packageId;
}

async function charge(packageId: string, key: string, userId = owner): Promise<string> {
  return sql(asRole("service_role", `SELECT public.intentlead_charge_verified_package('${packageId}', '${userId}', '${key}')`));
}

describe("verified package credit idempotency", () => {
  it("rejects a real but wrong-opportunity reference and cross-tenant typed references", async () => {
    const other = await createOpportunity();
    const forged = { ...primary, companyId: other.companyId };
    await expect(charge(await packageWithChecks(forged), `forged-${randomUUID()}`)).rejects.toThrow(/verification_reference_invalid:company/);

    const otherWorkspace = randomUUID();
    const otherCompany = randomUUID();
    await sql(`INSERT INTO public.workspaces (id, owner_id, name) VALUES ('${otherWorkspace}', '${owner}', 'Foreign tenant');
      INSERT INTO public.intentlead_companies (id, workspace_id, canonical_name, confidence)
      VALUES ('${otherCompany}', '${otherWorkspace}', 'Foreign company', .9)`);
    const packageId = randomUUID();
    await sql(`INSERT INTO public.intentlead_verified_packages
      (id, workspace_id, opportunity_id, policy_id, policy_version, status, idempotency_key)
      VALUES ('${packageId}', '${workspaceId}', '${primary.opportunityId}', '${policyId}', 1, 'PENDING', 'cross-${packageId}')`);
    await expect(sql(`INSERT INTO public.intentlead_package_check_results
      (workspace_id, package_id, check_name, status, reason, company_id)
      VALUES ('${workspaceId}', '${packageId}', 'company', 'PASS', 'cross tenant', '${otherCompany}')`)).rejects.toThrow(/foreign key/i);
  });

  it("derives discovery-only denial from the authoritative brief profile", async () => {
    const discovery = await createOpportunity("EN_DISCOVERY_ONLY");
    const packageId = await packageWithChecks(discovery);
    await expect(charge(packageId, `discovery-chain-${packageId}`)).rejects.toThrow(/package_verification_disabled/);
  });

  it("rejects a US-only policy for authoritative FR company context without charging", async () => {
    const french = await createOpportunity("LOCAL_CUSTOM", "FR");
    const initial = await sql(`SELECT credits_remaining FROM public.workspaces WHERE id='${workspaceId}'`);
    await expect(charge(await packageWithChecks(french), `jurisdiction-${randomUUID()}`))
      .rejects.toThrow(/verification_jurisdiction_denied/);
    expect(await sql(`SELECT credits_remaining FROM public.workspaces WHERE id='${workspaceId}'`)).toBe(initial);
  });

  it("rejects contact_jurisdiction_not_allowed when company is allowed without charging", async () => {
    const contactMismatch = await createOpportunity("LOCAL_CUSTOM", "US", "FR");
    const packageId = await packageWithChecks(contactMismatch);
    const initial = await sql(`SELECT credits_remaining FROM public.workspaces WHERE id='${workspaceId}'`);
    await expect(charge(packageId, `contact-jurisdiction-${randomUUID()}`))
      .rejects.toThrow(/verification_jurisdiction_denied:contact/);
    expect(await sql(`SELECT count(*) FROM public.intentlead_cost_events WHERE verified_package_id='${packageId}'`)).toBe("0");
    expect(await sql(`SELECT credits_remaining FROM public.workspaces WHERE id='${workspaceId}'`)).toBe(initial);
  });

  it("serializes concurrent charge and tombstone without deadlock or inconsistent charge", async () => {
    const fixture = await createOpportunity();
    const packageId = await packageWithChecks(fixture);
    const initial = await sql(`SELECT credits_remaining FROM public.workspaces WHERE id='${workspaceId}'`);
    await sql(`CREATE OR REPLACE FUNCTION public.intentlead_test_pause_tombstone()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF OLD.tombstoned_at IS NULL AND NEW.tombstoned_at IS NOT NULL THEN PERFORM pg_sleep(0.6); END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER intentlead_test_pause_tombstone BEFORE UPDATE ON public.intentlead_opportunities
      FOR EACH ROW EXECUTE FUNCTION public.intentlead_test_pause_tombstone()`);
    try {
      const tombstone = sql(asRole("service_role",
        `SELECT public.intentlead_tombstone_opportunity('${fixture.opportunityId}','${owner}','DEADLOCK_TEST')`));
      await new Promise(resolve => setTimeout(resolve, 150));
      const charging = charge(packageId, `deadlock-${packageId}`);
      const results = await Promise.allSettled([tombstone, charging]);
      const errors = results.filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map(result => String(result.reason));
      expect(errors.join("\n")).not.toMatch(/deadlock detected/i);
      expect(results[0].status).toBe("fulfilled");
      expect(await sql(`SELECT tombstoned_at IS NOT NULL FROM public.intentlead_opportunities WHERE id='${fixture.opportunityId}'`)).toBe("t");
      expect(await sql(`SELECT count(*) FROM public.intentlead_cost_events WHERE verified_package_id='${packageId}'`)).toBe("0");
      expect(await sql(`SELECT credits_remaining FROM public.workspaces WHERE id='${workspaceId}'`)).toBe(initial);
    } finally {
      await sql(`DROP TRIGGER IF EXISTS intentlead_test_pause_tombstone ON public.intentlead_opportunities;
        DROP FUNCTION IF EXISTS public.intentlead_test_pause_tombstone()`);
    }
  }, 20_000);

  it("preserves a contact verification shared by another live Opportunity package", async () => {
    const first = await createOpportunity();
    const second = await createOpportunity();
    await packageWithChecks(first);
    await packageWithChecks({ ...second, contactVerificationId: first.contactVerificationId });
    expect(await sql(asRole("service_role", `SELECT public.intentlead_tombstone_opportunity(
      '${first.opportunityId}','${owner}','SHARED_CONTACT_TEST'
    )`))).toContain("t");
    expect(await sql(`SELECT tombstoned_at IS NULL FROM public.intentlead_contact_verifications
      WHERE id='${first.contactVerificationId}'`)).toBe("t");
    expect(await sql(`SELECT value IS NOT NULL AND tombstoned_at IS NULL FROM public.intentlead_contact_points
      WHERE id='${first.contactId}'`)).toBe("t");
  });

  it("charges exactly one credit under concurrent retries", async () => {
    const packageId = await packageWithChecks(primary);
    const key = `charge-${packageId}`;
    const events = await Promise.all(Array.from({ length: 16 }, () => charge(packageId, key)));
    expect(new Set(events).size).toBe(1);
    expect(await sql(`SELECT credits_remaining FROM public.workspaces WHERE id='${workspaceId}'`)).toBe("9");
    expect(await sql(`SELECT count(*) FROM public.intentlead_cost_events WHERE verified_package_id='${packageId}' AND customer_credit_delta=-1`)).toBe("1");
    expect(await charge(packageId, key)).toBe(events[0]);
  }, 20_000);

  it("rejects missing, failed, foreign-owner, null-policy, and rejected packages without charge", async () => {
    const initial = await sql(`SELECT credits_remaining FROM public.workspaces WHERE id='${workspaceId}'`);
    await expect(charge(await packageWithChecks(primary, "PASS", 6), `missing-${randomUUID()}`)).rejects.toThrow(/verification_checks_incomplete/);
    await expect(charge(await packageWithChecks(primary, "FAIL"), `failed-${randomUUID()}`)).rejects.toThrow(/verification_checks_failed/);
    await expect(charge(await packageWithChecks(primary), `foreign-${randomUUID()}`, outsider)).rejects.toThrow(/forbidden/);
    await expect(sql(`INSERT INTO public.intentlead_verification_policies
      (workspace_id, version, market_profile_key, workflow, package_verified_allowed, jurisdictions,
       evidence_min_items,evidence_min_strength,evidence_max_age_days,company_min_confidence,buyer_min_confidence,buyer_min_relevance,
       contact_accepted_statuses,contact_max_age_days,grounded_draft_require_evidence,suppression_must_be_clear,market_required_capabilities)
      VALUES ('${workspaceId}', 2, 'LOCAL_CUSTOM', 'ASSISTED_OUTREACH', true, NULL, 1,.5,30,.5,.5,.5,
        ARRAY['VALID'],30,true,true,ARRAY['PACKAGE_VERIFIED','CONTACT_ENRICHMENT','EMAIL_VERIFY','DRAFT_GENERATION','OUTREACH_READY'])`)).rejects.toThrow(/not-null|null value/i);

    const rejected = await createOpportunity();
    await sql(`UPDATE public.intentlead_opportunities SET state='MODEL_REJECTED' WHERE id='${rejected.opportunityId}'`);
    await expect(charge(await packageWithChecks(rejected), `rejected-${randomUUID()}`)).rejects.toThrow(/package_not_chargeable/);
    expect(await sql(`SELECT credits_remaining FROM public.workspaces WHERE id='${workspaceId}'`)).toBe(initial);
  });

  it("tombstones the owned relational graph while preserving audit minima", async () => {
    const fixture = await createOpportunity();
    const packageId = await packageWithChecks(fixture);
    await sql(`INSERT INTO public.intentlead_human_reviews
      (workspace_id,opportunity_id,reviewer_id,decision,reason,note)
      VALUES ('${workspaceId}','${fixture.opportunityId}','${owner}','ACCEPTED','fixture','sensitive note');
      INSERT INTO public.intentlead_outcomes
      (workspace_id,opportunity_id,outcome_type,details,recorded_by,occurred_at)
      VALUES ('${workspaceId}','${fixture.opportunityId}','CONTACTED','{"sensitive":"value"}','${owner}',now())`);
    expect(await sql(asRole("service_role", `SELECT public.intentlead_tombstone_opportunity(
      '${fixture.opportunityId}','${owner}','FULL_GRAPH_TEST'
    )`))).toContain("t");
    expect(await sql(`SELECT problem_statement='[deleted]' AND tombstoned_at IS NOT NULL
      FROM public.intentlead_opportunity_assessments WHERE opportunity_id='${fixture.opportunityId}'`)).toBe("t");
    expect(await sql(`SELECT hypothesis='[deleted]' AND tombstoned_at IS NOT NULL
      FROM public.intentlead_buyer_candidates WHERE id='${fixture.buyerId}'`)).toBe("t");
    expect(await sql(`SELECT cp.value IS NULL AND cp.tombstoned_at IS NOT NULL AND cv.tombstoned_at IS NOT NULL FROM public.intentlead_contact_points cp
      JOIN public.intentlead_contact_verifications cv ON cv.contact_point_id=cp.id
      WHERE cv.id='${fixture.contactVerificationId}'`)).toBe("t");
    expect(await sql(`SELECT body='[deleted]' AND tombstoned_at IS NOT NULL FROM public.intentlead_outreach_drafts WHERE id='${fixture.draftId}'`)).toBe("t");
    expect(await sql(`SELECT count(*)=7 AND bool_and(reason='[redacted]' AND tombstoned_at IS NOT NULL)
      FROM public.intentlead_package_check_results WHERE package_id='${packageId}'`)).toBe("t");
    expect(await sql(`SELECT note IS NULL AND tombstoned_at IS NOT NULL FROM public.intentlead_human_reviews WHERE opportunity_id='${fixture.opportunityId}'`)).toBe("t");
    expect(await sql(`SELECT details='{}'::jsonb AND tombstoned_at IS NOT NULL FROM public.intentlead_outcomes WHERE opportunity_id='${fixture.opportunityId}'`)).toBe("t");
    expect(await sql(`SELECT count(*) FROM public.intentlead_deletion_tombstones WHERE resource_id='${fixture.opportunityId}'`)).toBe("1");
  });

  it("keeps charge internals server-only and exact package checks unique", async () => {
    const packageId = await packageWithChecks(primary);
    for (const role of ["anon", "authenticated"] as const) {
      await expect(sql(asRole(role, `SELECT public.intentlead_charge_verified_package('${packageId}', '${owner}', 'client')`, role === "authenticated" ? owner : undefined))).rejects.toThrow(/permission denied/);
    }
    await expect(sql(`INSERT INTO public.intentlead_package_check_results
      (workspace_id, package_id, check_name, status, reason)
      VALUES ('${workspaceId}', '${packageId}', 'evidence', 'PASS', 'duplicate')`)).rejects.toThrow(/duplicate|unique/i);
    expect(await sql(`SELECT prosecdef AND 'search_path=pg_catalog, public'=ANY(proconfig)
      FROM pg_proc WHERE proname='intentlead_charge_verified_package'`)).toBe("t");
  });
});
