import { createHash, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { insertUsers } from "./task4-db";
import { asRole, bootstrapLatestDatabase, sql } from "./task8-db";
import { candidateExternalStepKey } from "../../worker/workflows/self-prospecting-helpers";

const owner = randomUUID();
const workspaceId = randomUUID();
const offerId = randomUUID();
const icpId = randomUUID();
const marketId = randomUUID();
const briefId = randomUUID();
const workerId = "task7-fixture-worker";
const allowed = ["SOURCE_SEARCH", "WEB_FETCH", "COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT", "HUMAN_REVIEW"];
const disabled: string[] = [];
const now = "2026-10-05T12:00:00.000Z";

function quote(value: unknown): string {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function id(): string { return randomUUID(); }
function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }

function run(runId: string, provider: string, capability: string, source?: { providerSourceId: string; sourceUrl: string }) {
  return {
    id: runId, provider, providerVersion: "fixture-v1", capability, status: "SUCCEEDED",
    startedAt: now, finishedAt: now, latencyMs: 1, requestCount: 1, recordCount: 1,
    configuredCost: 0, reservedCost: 0, actualCost: 0, currency: provider === "openai" ? "USD" : null,
    provenance: source ? [{ ...source, capturedAt: now }] : [], limitations: [],
  };
}

function sourceAndEvidence(input: { provider: string; runId: string; text: string; url: string; externalId?: string; facts?: Record<string, unknown> }) {
  const sourceId = id();
  const evidenceId = id();
  const externalId = input.externalId ?? id();
  const provenance = { sourceType: input.provider === "hackernews" ? "SOCIAL" : "WEB", sourceId, providerRunId: input.runId, rawArtifactId: null };
  return {
    sourceId, evidenceId,
    source: { id: sourceId, provider: input.provider, externalId, sourceUrl: input.url, content: input.text,
      normalizedFacts: input.facts ?? {}, provenance, contentHash: hash(sourceId), capturedAt: now, publishedAt: null },
    evidence: { id: evidenceId, sourceItemId: sourceId, type: "text", sourceUrl: input.url, capturedAt: now,
      excerpt: input.text, structuredFacts: input.facts ?? {}, verificationMethod: "normalized_public_source_capture",
      confidence: 0.8, contentHash: hash(evidenceId), provenance },
  };
}

function candidateSlice(candidateKey: string, assessed: boolean, sourceExternalId?: string) {
  const sourceRunId = id();
  const sourceText = "Alex Doe, VP Growth: We need a better way to manage repeated manual vendor checks.";
  const primary = sourceAndEvidence({ provider: "hackernews", runId: sourceRunId, text: sourceText, url: "https://news.ycombinator.com/item?id=task7", externalId: sourceExternalId });
  const sourceItems = [primary.source];
  const evidenceItems = [primary.evidence];
  const runs = [run(sourceRunId, "hackernews", "SOURCE_SEARCH", { providerSourceId: primary.source.externalId, sourceUrl: primary.source.sourceUrl })];
  let company: Record<string, unknown> | null = null;
  let assessment: Record<string, unknown> | null = null;
  let opportunityEvidenceIds = [primary.evidenceId];
  let modelDecision: string | null = null;
  let groundedClaims: unknown = null;
  let state = "INSUFFICIENT_EVIDENCE";
  let assessmentId: string | null = null;
  if (assessed) {
    const companyRunId = id();
    const companyObservation = sourceAndEvidence({ provider: "exa", runId: companyRunId, text: "Acme Example operations. Acme Example describes vendor operations.", url: "https://acme.example.com/about", facts: { companyName: "Acme Example", companyDomain: "example.com" } });
    sourceItems.push(companyObservation.source);
    evidenceItems.push(companyObservation.evidence);
    opportunityEvidenceIds = [primary.evidenceId, companyObservation.evidenceId];
    runs.push(run(companyRunId, "exa", "COMPANY_RESOLUTION", { providerSourceId: companyObservation.source.externalId, sourceUrl: companyObservation.source.sourceUrl }));
    const modelRunId = id();
    runs.push(run(modelRunId, "openai", "OPPORTUNITY_ASSESSMENT"));
    const companyId = id();
    assessmentId = id();
    company = { id: companyId, canonicalName: "Acme Example", domain: "example.com", jurisdiction: null, confidence: 0.94 };
    modelDecision = "QUALIFY";
    groundedClaims = [{ text: sourceText, evidenceIds: [primary.evidenceId] }];
    assessment = {
      id: assessmentId, decision: "REVIEW", problemType: "operations", problemStatement: sourceText,
      evidenceStrength: 0.9, explicitness: 0.9, urgency: 0.7, freshness: 1, commercialImpact: 0.8,
      icpFit: 0.85, companyConfidence: 0.94, buyerRelevance: 0.65, actionability: 0.8, confidence: 0.88,
      evidenceIds: [primary.evidenceId], rejectionReasons: [], reviewReasons: ["POLICY_REVIEW_REQUIRED"],
      modelRunId, assessedAt: now,
    };
    state = "HUMAN_REVIEW";
  }
  return {
    schemaVersion: 1, candidateKey, modelDecision, policyReasons: assessed ? ["POLICY_REVIEW_REQUIRED"] : ["COMPANY_UNCERTAIN"],
    groundedClaims, providerRuns: runs, sourceItems, evidenceItems, company,
    opportunity: {
      id: id(), state, signal: { family: "EXPRESSED_INTENT", subtype: "solution_search" }, jurisdiction: null,
      evidenceIds: opportunityEvidenceIds, assessmentId, createdAt: now, updatedAt: now,
    },
    assessment,
  };
}

async function prepareJob(): Promise<{ jobId: string; token: string }> {
  await insertUsers(owner);
  await sql(`
    INSERT INTO public.workspaces(id,owner_id,name) VALUES ('${workspaceId}','${owner}','Task 7 persistence fixture');
    INSERT INTO public.intentlead_offer_profiles(id,workspace_id,name,definition) VALUES ('${offerId}','${workspaceId}','Fixture offer','{}');
    INSERT INTO public.intentlead_icp_definitions(id,workspace_id,name,definition) VALUES ('${icpId}','${workspaceId}','Fixture ICP','{}');
    INSERT INTO public.intentlead_market_profiles(id,workspace_id,profile_key,workflow,configuration,capabilities,disabled_capabilities)
      VALUES ('${marketId}','${workspaceId}','EN_DISCOVERY_ONLY','DISCOVERY_ONLY',
        '{"regions":[],"languages":["en"],"legalPolicyId":"legal-v1","retentionPolicyId":"retention-v1","defaultCurrency":"USD","timezone":"UTC"}',
        ARRAY[${allowed.map(quote).join(",")}]::text[],ARRAY[${disabled.map(quote).join(",")}]::text[]);
    INSERT INTO public.intentlead_discovery_briefs(id,workspace_id,offer_profile_id,icp_definition_id,market_profile_id,objective,criteria)
      VALUES ('${briefId}','${workspaceId}','${offerId}','${icpId}','${marketId}','Find evidence-backed opportunities','{}');
  `);
  const queuedJobId = await sql(asRole("service_role", `SELECT public.intentlead_enqueue_discovery_job('${briefId}','${owner}','task7-${briefId}','{}')`));
  await sql(`UPDATE public.intentlead_jobs SET created_at='1970-01-01T00:00:00Z', available_at='1970-01-01T00:00:00Z' WHERE id='${queuedJobId}'`);
  const leased = JSON.parse(await sql(asRole("service_role", `SELECT row_to_json(j)::text FROM public.intentlead_lease_next_job('${workerId}',60) j LIMIT 1`))) as { id: string; lease_token: string };
  if (leased.id !== queuedJobId) throw new Error("Task 7 integration failed to lease its own queued job");
  return { jobId: leased.id, token: leased.lease_token };
}

async function prepareAdditionalJob(label: string): Promise<{ jobId: string; token: string; workerId: string }> {
  const extraBriefId = id();
  const extraWorkerId = `${workerId}-${label}`;
  await sql(`INSERT INTO public.intentlead_discovery_briefs(id,workspace_id,offer_profile_id,icp_definition_id,market_profile_id,objective,criteria)
    VALUES ('${extraBriefId}','${workspaceId}','${offerId}','${icpId}','${marketId}','Find more opportunities','{}')`);
  const queuedJobId = await sql(asRole("service_role", `SELECT public.intentlead_enqueue_discovery_job('${extraBriefId}','${owner}','task7-${label}-${extraBriefId}','{}')`));
  await sql(`UPDATE public.intentlead_jobs SET created_at='1970-01-01T00:00:00Z', available_at='1970-01-01T00:00:00Z' WHERE id='${queuedJobId}'`);
  const leased = JSON.parse(await sql(asRole("service_role", `SELECT row_to_json(j)::text FROM public.intentlead_lease_next_job('${extraWorkerId}',60) j LIMIT 1`))) as { id: string; lease_token: string };
  if (leased.id !== queuedJobId) throw new Error(`Task 7 integration failed to lease its own ${label} job`);
  return { jobId: leased.id, token: leased.lease_token, workerId: extraWorkerId };
}

beforeAll(async () => {
  await bootstrapLatestDatabase();
}, 120_000);

describe("lease-bound self-prospecting persistence", () => {
  it("persists review and insufficient candidates idempotently without downstream records", async () => {
    const { jobId, token } = await prepareJob();
    const review = candidateSlice("review-candidate", true);
    const rpc = (slice: Record<string, unknown>) => `public.intentlead_persist_self_prospecting_candidate(
      '${jobId}','${workerId}','${token}'::uuid,'${String(slice.candidateKey)}',${quote(JSON.stringify(slice))}::jsonb)`;
    const reviewId = await sql(asRole("service_role", `SELECT ${rpc(review)}`));
    expect(reviewId).toBe((review.opportunity as { id: string }).id);
    expect(await sql(asRole("service_role", `SELECT ${rpc(review)}`))).toBe(reviewId);
    const incomplete = candidateSlice("insufficient-candidate", false);
    const incompleteId = await sql(asRole("service_role", `SELECT ${rpc(incomplete)}`));
    expect(await sql(`SELECT string_agg(state, ',' ORDER BY state) FROM public.intentlead_opportunities WHERE workspace_id='${workspaceId}'`))
      .toBe("HUMAN_REVIEW,INSUFFICIENT_EVIDENCE");
    await expect(sql(asRole("service_role", `SELECT has_function_privilege('authenticated','public.intentlead_persist_self_prospecting_candidate(uuid,text,uuid,text,jsonb)','EXECUTE')`))).resolves.toBe("f");
    await expect(sql(`SELECT to_regprocedure('public.intentlead_task7_claim_supported(text,jsonb,uuid[])') IS NULL`)).resolves.toBe("t");
    await expect(sql(`SELECT to_regprocedure('public.intentlead_claim_supported(text,jsonb,uuid[])') IS NOT NULL`)).resolves.toBe("t");
    await expect(sql(`SELECT count(*) FROM public.intentlead_job_candidate_results WHERE workspace_id='${workspaceId}'`)).resolves.toBe("2");
    await expect(sql(`SELECT count(*) FROM public.intentlead_provider_runs WHERE job_id='${jobId}'`)).resolves.toBe("4");
    await expect(sql(`SELECT count(*) FROM public.intentlead_source_items WHERE workspace_id='${workspaceId}'`)).resolves.toBe("3");
    await expect(sql(`SELECT count(*) FROM public.intentlead_evidence_items WHERE workspace_id='${workspaceId}'`)).resolves.toBe("3");
    await expect(sql(`SELECT count(*) FROM public.intentlead_opportunity_assessments WHERE workspace_id='${workspaceId}'`)).resolves.toBe("1");
    await expect(sql(`SELECT count(*) FROM public.intentlead_cost_events WHERE workspace_id='${workspaceId}'`)).resolves.toBe("0");
    await expect(sql(`SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace
      AND relname=ANY(ARRAY['intentlead_contact_points','intentlead_outreach_drafts','leads','campaigns'])`))
      .resolves.toBe("0");
    const crossCandidate = candidateSlice("cross-candidate", false);
    (crossCandidate.opportunity as { evidenceIds: string[] }).evidenceIds = [(review.evidenceItems[0] as { id: string }).id];
    await expect(sql(asRole("service_role", `SELECT ${rpc(crossCandidate)}`)))
      .rejects.toThrow(/candidate_evidence_cross_slice_reference/);

    const extraKey = { ...candidateSlice("extra-key", false), unexpected: true };
    await expect(sql(asRole("service_role", `SELECT ${rpc(extraKey)}`)))
      .rejects.toThrow(/invalid_candidate_shape/);

    const duplicateRun = candidateSlice("duplicate-provider-run", true);
    const duplicateRunId = duplicateRun.providerRuns[0]!.id;
    duplicateRun.providerRuns[1] = { ...duplicateRun.providerRuns[1], id: duplicateRunId };
    (duplicateRun.sourceItems[1] as { provenance: { providerRunId: string } }).provenance.providerRunId = duplicateRunId;
    (duplicateRun.evidenceItems[1] as { provenance: { providerRunId: string } }).provenance.providerRunId = duplicateRunId;
    await expect(sql(asRole("service_role", `SELECT ${rpc(duplicateRun)}`)))
      .rejects.toThrow(/duplicate_candidate_provider_run/);

    const runIdentityConflict = candidateSlice("provider-run-identity-conflict", true);
    runIdentityConflict.providerRuns[0] = {
      ...runIdentityConflict.providerRuns[0],
      id: review.providerRuns[0]!.id,
      providerVersion: "contradictory-version",
    };
    await expect(sql(asRole("service_role", `SELECT ${rpc(runIdentityConflict)}`)))
      .rejects.toThrow(/provider_run_identity_conflict/);

    const providerCapabilityMismatch = candidateSlice("provider-capability-mismatch", true);
    providerCapabilityMismatch.providerRuns[0] = {
      ...providerCapabilityMismatch.providerRuns[0], capability: "COMPANY_RESOLUTION",
    };
    await expect(sql(asRole("service_role", `SELECT ${rpc(providerCapabilityMismatch)}`)))
      .rejects.toThrow(/invalid_candidate_provider_run/);

    const failedAssessmentRun = candidateSlice("failed-assessment-run", true);
    failedAssessmentRun.providerRuns[2] = { ...failedAssessmentRun.providerRuns[2], status: "FAILED" };
    await expect(sql(asRole("service_role", `SELECT ${rpc(failedAssessmentRun)}`)))
      .rejects.toThrow(/candidate_assessment_run_missing/);

    const unsupportedClaim = candidateSlice("unsupported-claim", true);
    unsupportedClaim.groundedClaims = [{
      text: "Invented operational claim",
      evidenceIds: [(unsupportedClaim.evidenceItems[0] as { id: string }).id],
    }];
    await expect(sql(asRole("service_role", `SELECT ${rpc(unsupportedClaim)}`)))
      .rejects.toThrow(/unsupported_grounded_claim/);

    const unsupportedProblem = candidateSlice("unsupported-problem", true);
    (unsupportedProblem.assessment as Record<string, unknown>).problemStatement = "Invented problem statement";
    await expect(sql(asRole("service_role", `SELECT ${rpc(unsupportedProblem)}`)))
      .rejects.toThrow(/unsupported_problem_statement/);

    const contradictoryDecision = candidateSlice("contradictory-decision", true);
    contradictoryDecision.modelDecision = "REJECT";
    await expect(sql(asRole("service_role", `SELECT ${rpc(contradictoryDecision)}`)))
      .rejects.toThrow(/invalid_candidate_assessment/);

    const nonRejectBypass = candidateSlice("non-reject-bypass", true);
    (nonRejectBypass.opportunity as { state: string }).state = "MODEL_QUALIFIED";
    await expect(sql(asRole("service_role", `SELECT ${rpc(nonRejectBypass)}`)))
      .rejects.toThrow(/invalid_candidate_assessment/);

    const mismatchedSourceRun = candidateSlice("mismatched-source-run", true);
    (mismatchedSourceRun.sourceItems[0] as { provenance: { providerRunId: string } }).provenance.providerRunId =
      mismatchedSourceRun.providerRuns[1]!.id;
    await expect(sql(asRole("service_role", `SELECT ${rpc(mismatchedSourceRun)}`)))
      .rejects.toThrow(/invalid_candidate_source_provenance/);

    const forgedCompany = candidateSlice("arbitrary-company", true);
    forgedCompany.company = { ...(forgedCompany.company as Record<string, unknown>), canonicalName: "Attacker Incorporated", domain: "attacker.example" };
    await expect(sql(asRole("service_role", `SELECT ${rpc(forgedCompany)}`))).rejects.toThrow(/company.*evidence|company.*provenance/i);

    const domainConflict = candidateSlice("company-domain-conflict", true);
    domainConflict.company = {
      ...(domainConflict.company as Record<string, unknown>), canonicalName: "Different Example",
    };
    const companyEvidence = domainConflict.evidenceItems[1] as { excerpt: string; structuredFacts: Record<string, unknown> };
    companyEvidence.excerpt = "Different Example operations. Different Example describes vendor operations.";
    companyEvidence.structuredFacts = { companyName: "Different Example", companyDomain: "example.com" };
    const companySource = domainConflict.sourceItems[1] as { content: string; normalizedFacts: Record<string, unknown> };
    companySource.content = companyEvidence.excerpt;
    companySource.normalizedFacts = companyEvidence.structuredFacts;
    await expect(sql(asRole("service_role", `SELECT ${rpc(domainConflict)}`)))
      .rejects.toThrow(/company_domain_identity_conflict/);
    expect(await sql(`SELECT count(*) FROM public.intentlead_opportunities WHERE workspace_id='${workspaceId}'`)).toBe("2");
    expect(await sql(`SELECT count(*) FROM public.intentlead_job_candidate_results WHERE workspace_id='${workspaceId}'`)).toBe("2");
    expect(incompleteId).not.toBe(reviewId);

    const signals = ["hackernews:signal-one", "hackernews:signal-two"];
    const candidateSteps = signals.flatMap(candidateKey =>
      (["COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT"] as const).map(capability => ({
        candidateKey, capability, stepKey: candidateExternalStepKey(capability, candidateKey),
      })));
    expect(new Set(candidateSteps.map(step => step.stepKey)).size).toBe(4);
    for (const { capability, candidateKey, stepKey } of candidateSteps) {
      expect(candidateExternalStepKey(capability, candidateKey)).toBe(stepKey);
      const stepId = await sql(asRole("service_role", `SELECT public.intentlead_record_job_step_attempt(
        '${jobId}','${workerId}','${token}'::uuid,'${stepKey}',1,'STARTED','{}'::uuid[],NULL,NULL,'{}'::jsonb,'{}'::jsonb)`));
      expect(stepId).not.toBe("");
      expect(await sql(asRole("service_role", `SELECT public.intentlead_record_job_step_attempt(
        '${jobId}','${workerId}','${token}'::uuid,'${stepKey}',1,'COMPLETED','{}'::uuid[],NULL,NULL,'{}'::jsonb,'{}'::jsonb)`))).toContain(stepId);
    }
    expect(await sql(`SELECT count(DISTINCT step_key) FROM public.intentlead_job_step_attempts WHERE job_id='${jobId}'`)).toBe("4");
    expect(await sql(`SELECT count(*) FROM public.intentlead_job_step_attempts WHERE job_id='${jobId}' AND state='COMPLETED'`)).toBe("4");

    const sameExternalId = `repeated-${id()}`;
    const laterA = await prepareAdditionalJob("later-a");
    const laterB = await prepareAdditionalJob("later-b");
    const a = candidateSlice("later-a-candidate", true, sameExternalId);
    const b = candidateSlice("later-b-candidate", true, sameExternalId);
    const persistFor = (lease: typeof laterA, slice: Record<string, unknown>) => sql(asRole("service_role", `SELECT public.intentlead_persist_self_prospecting_candidate(
      '${lease.jobId}','${lease.workerId}','${lease.token}'::uuid,'${String(slice.candidateKey)}',${quote(JSON.stringify(slice))}::jsonb)`));
    await Promise.all([persistFor(laterA, a), persistFor(laterB, b)]);
    expect(await sql(`SELECT count(*) FROM public.intentlead_source_items WHERE workspace_id='${workspaceId}' AND provider='hackernews' AND external_id='${sameExternalId}'`)).toBe("2");
    expect(await sql(`SELECT count(*) FROM public.intentlead_companies WHERE workspace_id='${workspaceId}' AND lower(domain)='example.com'`)).toBe("1");
    for (const lease of [laterA, laterB]) {
      expect(await sql(asRole("service_role", `SELECT public.intentlead_complete_job(
        '${lease.jobId}','${lease.workerId}','${lease.token}'::uuid,'COMPLETED','{"fixtureOnly":true}'::jsonb,NULL)`))).toBe("t");
    }

    const sharedBriefId = id();
    const sharedOpportunityId = id();
    const sharedEvidenceId = (review.evidenceItems[0] as { id: string }).id;
    const sharedRunId = (review.providerRuns[0] as { id: string }).id;
    await sql(`
      INSERT INTO public.intentlead_discovery_briefs(id,workspace_id,offer_profile_id,icp_definition_id,market_profile_id,objective,criteria)
      VALUES ('${sharedBriefId}','${workspaceId}','${offerId}','${icpId}','${marketId}','Retain shared source evidence','{}');
      INSERT INTO public.intentlead_opportunities(id,workspace_id,discovery_brief_id,state,signal)
      VALUES ('${sharedOpportunityId}','${workspaceId}','${sharedBriefId}','INSUFFICIENT_EVIDENCE',${quote(JSON.stringify((review.opportunity as { signal: unknown }).signal))}::jsonb);
      INSERT INTO public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id)
      VALUES ('${workspaceId}','${sharedOpportunityId}','${sharedEvidenceId}');
    `);

    await sql(asRole("service_role", `SELECT public.intentlead_delete_discovery_brief('${briefId}','${owner}','task7-owner-deletion')`));
    expect(await sql(`SELECT count(*) FROM public.intentlead_job_candidate_results
      WHERE workspace_id='${workspaceId}' AND job_id='${jobId}' AND redacted_at IS NOT NULL AND grounded_claims='[]'::jsonb
        AND candidate_key LIKE 'deleted:%'`)).toBe("2");
    expect(await sql(`SELECT count(*) FROM public.intentlead_job_candidate_results
      WHERE workspace_id='${workspaceId}' AND job_id='${jobId}' AND grounded_claims::text ILIKE '%Alex Doe%'`)).toBe("0");
    expect(await sql(`SELECT count(*) FROM public.intentlead_source_items s JOIN public.intentlead_provider_runs r
      ON r.workspace_id=s.workspace_id AND r.id=s.provider_run_id
      WHERE r.job_id='${jobId}' AND r.id<>'${sharedRunId}'
        AND (s.content IS NOT NULL OR s.normalized_facts<>'{}'::jsonb OR s.tombstoned_at IS NULL)`)).toBe("0");
    expect(await sql(`SELECT count(*) FROM public.intentlead_evidence_items e JOIN public.intentlead_provider_runs r
      ON r.workspace_id=e.workspace_id AND r.id=e.provider_run_id
      WHERE r.job_id='${jobId}' AND r.id<>'${sharedRunId}'
        AND (e.excerpt IS NOT NULL OR e.structured_facts<>'{}'::jsonb OR e.tombstoned_at IS NULL)`)).toBe("0");
    expect(await sql(`SELECT problem_statement='[deleted]' AND tombstoned_at IS NOT NULL
      FROM public.intentlead_opportunity_assessments WHERE workspace_id='${workspaceId}' AND opportunity_id='${reviewId}'`)).toBe("t");
    expect(await sql(`SELECT count(*) FROM public.intentlead_provider_runs
      WHERE job_id='${jobId}' AND capability='SOURCE_SEARCH' AND provider='redacted' AND response_metadata='{}'::jsonb`)).toBe("1");
    expect(await sql(`SELECT count(*) FROM public.intentlead_provider_runs
      WHERE job_id='${jobId}' AND capability='COMPANY_RESOLUTION' AND provider='redacted' AND response_metadata='{}'::jsonb`)).toBe("1");
    expect(await sql(`SELECT count(*) FROM public.intentlead_provider_runs pr
      JOIN public.intentlead_source_items s ON s.workspace_id=pr.workspace_id AND s.provider_run_id=pr.id
      JOIN public.intentlead_evidence_items e ON e.workspace_id=s.workspace_id AND e.source_item_id=s.id
      JOIN public.intentlead_opportunity_evidence oe ON oe.workspace_id=e.workspace_id AND oe.evidence_id=e.id
      JOIN public.intentlead_opportunities o ON o.workspace_id=oe.workspace_id AND o.id=oe.opportunity_id
      WHERE pr.id='${sharedRunId}' AND oe.tombstoned_at IS NULL AND o.tombstoned_at IS NULL
        AND pr.provider='hackernews' AND pr.response_metadata ? 'limitations'`)).toBe("1");
  });
});
