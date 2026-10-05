import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { asRole, bootstrapTask5Database, insertUsers, sql } from "./task4-db";

const owner = randomUUID();
const workspaceId = randomUUID();
const offerId = randomUUID();
const icpId = randomUUID();
const marketId = randomUUID();
const briefId = randomUUID();
const workerId = "task7-fixture-worker";
const allowed = ["SOURCE_SEARCH", "WEB_FETCH", "COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT", "HUMAN_REVIEW"];
const disabled = ["PEOPLE_SEARCH", "CONTACT_ENRICHMENT", "EMAIL_FIND", "EMAIL_VERIFY", "DRAFT_GENERATION", "OUTREACH_READY", "OUTREACH_SEND", "OUTCOME_RECORDING", "PACKAGE_VERIFIED"];
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

function sourceAndEvidence(input: { provider: string; runId: string; text: string; url: string }) {
  const sourceId = id();
  const evidenceId = id();
  const externalId = id();
  const provenance = { sourceType: input.provider === "hackernews" ? "SOCIAL" : "WEB", sourceId, providerRunId: input.runId, rawArtifactId: null };
  return {
    sourceId, evidenceId,
    source: { id: sourceId, provider: input.provider, externalId, sourceUrl: input.url, content: input.text,
      normalizedFacts: {}, provenance, contentHash: hash(sourceId), capturedAt: now, publishedAt: null },
    evidence: { id: evidenceId, sourceItemId: sourceId, type: "text", sourceUrl: input.url, capturedAt: now,
      excerpt: input.text, structuredFacts: {}, verificationMethod: "normalized_public_source_capture",
      confidence: 0.8, contentHash: hash(evidenceId), provenance },
  };
}

function candidateSlice(candidateKey: string, assessed: boolean) {
  const sourceRunId = id();
  const sourceText = "We need a better way to manage repeated manual vendor checks.";
  const primary = sourceAndEvidence({ provider: "hackernews", runId: sourceRunId, text: sourceText, url: "https://news.ycombinator.com/item?id=task7" });
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
    const companyObservation = sourceAndEvidence({ provider: "exa", runId: companyRunId, text: "Acme Example operations. Acme Example describes vendor operations.", url: "https://acme.example.com/about" });
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

async function installTask7Migration(): Promise<void> {
  await bootstrapTask5Database();
  if (await sql("SELECT to_regclass('public.intentlead_job_candidate_results') IS NOT NULL") === "t") return;
  const migration = await readFile(new URL("../../supabase/migrations/202610050003_task7_self_prospecting.sql", import.meta.url), "utf8");
  await sql(migration, "intentlead-task7-migration");
}

async function prepareJob(): Promise<{ jobId: string; token: string }> {
  await insertUsers(owner);
  await sql(`
    INSERT INTO public.workspaces(id,owner_id,name) VALUES ('${workspaceId}','${owner}','Task 7 persistence fixture');
    INSERT INTO public.intentlead_offer_profiles(id,workspace_id,name,definition) VALUES ('${offerId}','${workspaceId}','Fixture offer','{}');
    INSERT INTO public.intentlead_icp_definitions(id,workspace_id,name,definition) VALUES ('${icpId}','${workspaceId}','Fixture ICP','{}');
    INSERT INTO public.intentlead_market_profiles(id,workspace_id,profile_key,workflow,configuration,capabilities,disabled_capabilities)
      VALUES ('${marketId}','${workspaceId}','EN_DISCOVERY_ONLY','DISCOVERY_ONLY',
        '{"regions":[],"languages":["en"],"legalPolicyId":"legal-v1","retentionPolicyId":"retention-v1","outreachPolicyId":null,"outreachChannels":[],"defaultCurrency":"USD","timezone":"UTC"}',
        ARRAY[${allowed.map(quote).join(",")}],ARRAY[${disabled.map(quote).join(",")}]);
    INSERT INTO public.intentlead_discovery_briefs(id,workspace_id,offer_profile_id,icp_definition_id,market_profile_id,objective,criteria)
      VALUES ('${briefId}','${workspaceId}','${offerId}','${icpId}','${marketId}','Find evidence-backed opportunities','{}');
  `);
  await sql(asRole("service_role", `SELECT public.intentlead_enqueue_discovery_job('${briefId}','${owner}','task7-${briefId}','{}')`));
  const leased = JSON.parse(await sql(asRole("service_role", `SELECT row_to_json(j)::text FROM public.intentlead_lease_next_job('${workerId}',60) j LIMIT 1`))) as { id: string; lease_token: string };
  return { jobId: leased.id, token: leased.lease_token };
}

beforeAll(async () => {
  await installTask7Migration();
}, 120_000);

describe("Task 7 lease-bound PostgreSQL persistence", () => {
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
    await expect(sql(`SELECT count(*) FROM public.intentlead_job_candidate_results WHERE workspace_id='${workspaceId}'`)).resolves.toBe("2");
    await expect(sql(`SELECT count(*) FROM public.intentlead_provider_runs WHERE job_id='${jobId}'`)).resolves.toBe("4");
    await expect(sql(`SELECT count(*) FROM public.intentlead_source_items WHERE workspace_id='${workspaceId}'`)).resolves.toBe("3");
    await expect(sql(`SELECT count(*) FROM public.intentlead_evidence_items WHERE workspace_id='${workspaceId}'`)).resolves.toBe("3");
    await expect(sql(`SELECT count(*) FROM public.intentlead_opportunity_assessments WHERE workspace_id='${workspaceId}'`)).resolves.toBe("1");
    await expect(sql(`SELECT count(*) FROM public.intentlead_contact_points WHERE workspace_id='${workspaceId}'`)).resolves.toBe("0");
    await expect(sql(`SELECT count(*) FROM public.intentlead_outreach_drafts WHERE workspace_id='${workspaceId}'`)).resolves.toBe("0");
    await expect(sql(`SELECT count(*) FROM public.intentlead_cost_events WHERE workspace_id='${workspaceId}'`)).resolves.toBe("0");
    await expect(sql(`SELECT count(*) FROM public.leads l JOIN public.campaigns c ON c.id=l.campaign_id WHERE c.workspace_id='${workspaceId}'`)).resolves.toBe("0");
    const crossCandidate = candidateSlice("cross-candidate", false);
    (crossCandidate.opportunity as { evidenceIds: string[] }).evidenceIds = [(review.evidenceItems[0] as { id: string }).id];
    await expect(sql(asRole("service_role", `SELECT ${rpc(crossCandidate)}`))).rejects.toThrow();
    expect(await sql(`SELECT count(*) FROM public.intentlead_opportunities WHERE workspace_id='${workspaceId}'`)).toBe("2");
    expect(await sql(`SELECT count(*) FROM public.intentlead_job_candidate_results WHERE workspace_id='${workspaceId}'`)).toBe("2");
    expect(incompleteId).not.toBe(reviewId);
  });
});
