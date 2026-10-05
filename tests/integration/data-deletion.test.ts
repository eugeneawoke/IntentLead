import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { asRole, bootstrapTask5Database, insertUsers, sql } from "./task4-db";

const owner = randomUUID();
const outsider = randomUUID();
const allowed = ["SOURCE_SEARCH", "WEB_FETCH", "COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT", "HUMAN_REVIEW"];
const disabled = ["PEOPLE_SEARCH", "CONTACT_ENRICHMENT", "EMAIL_FIND", "EMAIL_VERIFY", "DRAFT_GENERATION", "OUTREACH_READY", "OUTREACH_SEND", "OUTCOME_RECORDING", "PACKAGE_VERIFIED"];
const profileConfig = {
  regions: [], languages: ["en"], legalPolicyId: "legal-v1", retentionPolicyId: "retention-v1",
  outreachPolicyId: null, outreachChannels: [], defaultCurrency: "USD", timezone: "UTC",
};

async function fixture(prefix: string, workspaceId = randomUUID()) {
  const offerId = randomUUID();
  const icpId = randomUUID();
  const marketId = randomUUID();
  const campaignId = randomUUID();
  const briefId = randomUUID();
  await sql(`
    INSERT INTO public.workspaces(id,owner_id,name) VALUES ('${workspaceId}','${owner}','${prefix} workspace');
    INSERT INTO public.intentlead_offer_profiles(id,workspace_id,name,definition)
      VALUES ('${offerId}','${workspaceId}','${prefix} offer','{}');
    INSERT INTO public.intentlead_icp_definitions(id,workspace_id,name,definition)
      VALUES ('${icpId}','${workspaceId}','${prefix} ICP','{}');
    INSERT INTO public.intentlead_market_profiles(id,workspace_id,profile_key,workflow,configuration,capabilities,disabled_capabilities)
      VALUES ('${marketId}','${workspaceId}','EN_DISCOVERY_ONLY','DISCOVERY_ONLY','${JSON.stringify(profileConfig)}',
        ARRAY[${allowed.map(value => `'${value}'`).join(",")}],ARRAY[${disabled.map(value => `'${value}'`).join(",")}]);
    INSERT INTO public.campaigns(id,workspace_id,entry_mode,what_selling,icp,pain,status)
      VALUES ('${campaignId}','${workspaceId}','cold','offer','icp','pain','draft');
    INSERT INTO public.intentlead_discovery_briefs
      (id,workspace_id,offer_profile_id,icp_definition_id,market_profile_id,legacy_campaign_id,objective,criteria)
      VALUES ('${briefId}','${workspaceId}','${offerId}','${icpId}','${marketId}','${campaignId}','${prefix} research objective','{"private":"criteria"}');
  `);
  return { workspaceId, marketId, campaignId, briefId };
}

async function enqueue(briefId: string, userId = owner): Promise<string> {
  return sql(asRole("service_role", `SELECT public.intentlead_enqueue_discovery_job(
    '${briefId}','${userId}','delete-${briefId}','{}')`));
}

async function addOpportunity(input: {
  workspaceId: string;
  briefId: string;
  companyId: string;
  sourceId: string;
  evidenceId: string;
  providerRunId: string;
  jobId: string;
  suffix: string;
}) {
  const opportunityId = randomUUID();
  const assessmentId = randomUUID();
  const hashA = input.suffix.repeat(64).slice(0, 64);
  const hashB = (input.suffix === "a" ? "c" : "d").repeat(64);
  await sql(`
    INSERT INTO public.intentlead_provider_runs
      (id,workspace_id,job_id,capability,provider,provider_version,status,request_metadata,response_metadata)
      VALUES ('${input.providerRunId}','${input.workspaceId}','${input.jobId}','SOURCE_SEARCH','fixture-provider','v1','SUCCEEDED',
        '{"request":"private provider query"}','{"response":"private result"}');
    INSERT INTO public.intentlead_source_items
      (id,workspace_id,provider,external_id,provider_run_id,source_url,content,normalized_facts,provenance,content_hash,captured_at)
      VALUES ('${input.sourceId}','${input.workspaceId}','fixture-provider','external-${input.suffix}','${input.providerRunId}',
        'https://example.test/private-source','private source body','{"problem":{"category":"website","observedCondition":"Private Company issue"}}',
        '{"sourceType":"WEB","sourceId":"source-1","providerRunId":"${input.providerRunId}","rawArtifactId":null}',
        '${hashA}',now());
    INSERT INTO public.intentlead_evidence_items
      (id,workspace_id,source_item_id,provider_run_id,evidence_type,source_url,captured_at,excerpt,structured_facts,verification_method,confidence,content_hash,provenance)
      VALUES ('${input.evidenceId}','${input.workspaceId}','${input.sourceId}','${input.providerRunId}','text','https://example.test/private-source',now(),
        'private evidence text','{"problem":{"category":"website","observedCondition":"Private issue"}}','fixture',0.9,'${hashB}',
        '{"sourceType":"WEB","sourceId":"source-1","providerRunId":"${input.providerRunId}","rawArtifactId":null}');
    INSERT INTO public.intentlead_opportunities
      (id,workspace_id,discovery_brief_id,company_id,state,signal)
      VALUES ('${opportunityId}','${input.workspaceId}','${input.briefId}','${input.companyId}','ASSESSABLE',
        '{"family":"DETECTED_PROBLEM","subtype":"website"}');
    INSERT INTO public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id)
      VALUES ('${input.workspaceId}','${opportunityId}','${input.evidenceId}');
    INSERT INTO public.intentlead_opportunity_assessments
      (id,workspace_id,opportunity_id,version,decision,assessed_at,signal,problem_type,problem_statement,
       evidence_strength,explicitness,urgency,freshness,commercial_impact,icp_fit,company_confidence,
       buyer_relevance,actionability,confidence)
      VALUES ('${assessmentId}','${input.workspaceId}','${opportunityId}',1,'QUALIFY',now(),
        '{"family":"DETECTED_PROBLEM","subtype":"website"}','website','private interpretation',
        0.9,0.9,0.8,0.9,0.8,0.8,0.9,0.7,0.8,0.85);
    INSERT INTO public.intentlead_assessment_evidence(workspace_id,assessment_id,opportunity_id,evidence_id)
      VALUES ('${input.workspaceId}','${assessmentId}','${opportunityId}','${input.evidenceId}');
  `);
  return { opportunityId, assessmentId };
}

async function addBuyerCandidate(input: {
  workspaceId: string;
  companyId: string;
  opportunityId: string;
}) {
  const personId = randomUUID();
  const buyerId = randomUUID();
  await sql(`
    INSERT INTO public.intentlead_people
      (id,workspace_id,company_id,full_name,role_title,jurisdiction,confidence,resolved_at)
    VALUES ('${personId}','${input.workspaceId}','${input.companyId}','Private Buyer','VP of Growth',
      '{"countryCode":"US"}',0.9,now());
    INSERT INTO public.intentlead_buyer_candidates
      (id,workspace_id,opportunity_id,company_id,person_id,role_title,hypothesis,confidence,relevance)
    VALUES ('${buyerId}','${input.workspaceId}','${input.opportunityId}','${input.companyId}','${personId}',
      'VP of Growth','Private buyer hypothesis',0.8,0.7);
  `);
  return { personId, buyerId };
}

async function addLegacyGraph(campaignId: string, prefix: string) {
  const signalId = randomUUID();
  const leadId = randomUUID();
  const messageId = randomUUID();
  await sql(`
    INSERT INTO public.signals(id,campaign_id,source,source_url,author_handle,content,context)
    VALUES ('${signalId}','${campaignId}','reddit','https://example.test/${prefix}','author-${prefix}',
      'Private legacy signal ${prefix}','Private legacy context ${prefix}');
    INSERT INTO public.leads
      (id,campaign_id,signal_id,company_name,contact_name,email,why_now,opening_line,status)
    VALUES ('${leadId}','${campaignId}','${signalId}','Private legacy company','Private legacy person',
      '${prefix}@example.test','Private timing','Private opening','processing');
    INSERT INTO public.messages(id,lead_id,subject,body)
    VALUES ('${messageId}','${leadId}','Private subject ${prefix}','Private message body ${prefix}');
  `);
  return { signalId, leadId, messageId };
}

beforeAll(async () => {
  await bootstrapTask5Database();
  await insertUsers(owner, outsider);
}, 30_000);

describe("Task 5 relational data deletion", () => {
  it("owner-deletes idempotently, cancels and redacts job/provider/source/evidence/contact data, and retains suppression minimums", async () => {
    const data = await fixture("deletion-complete");
    const jobId = await enqueue(data.briefId);
    const companyId = randomUUID();
    const sourceId = randomUUID();
    const evidenceId = randomUUID();
    const providerRunId = randomUUID();
    const contactId = randomUUID();
    await sql(`
      INSERT INTO public.intentlead_companies(id,workspace_id,canonical_name,domain,confidence,created_at,updated_at)
      VALUES ('${companyId}','${data.workspaceId}','Private Company','private.example',0.9,now(),now());
    `);
    const { opportunityId } = await addOpportunity({ ...data, companyId, sourceId, evidenceId, providerRunId, jobId, suffix: "a" });
    const { personId, buyerId } = await addBuyerCandidate({
      workspaceId: data.workspaceId, companyId, opportunityId,
    });
    await addLegacyGraph(data.campaignId, "target-delete");
    await sql(`
      INSERT INTO public.intentlead_contact_points
        (id,workspace_id,company_id,channel,value,value_hash,jurisdiction,captured_at)
      VALUES ('${contactId}','${data.workspaceId}','${companyId}','email','private@example.test',repeat('e',64),
        '{"countryCode":"US"}',now());
      INSERT INTO public.intentlead_suppression_entries
        (workspace_id,identifier_type,identifier_hash,reason,policy_id)
      VALUES ('${data.workspaceId}','EMAIL',repeat('f',64),'OPT_OUT','policy-v1');
    `);

    const leaseText = await sql(asRole("service_role", `SELECT id || '|' || lease_token
      FROM public.intentlead_lease_next_job('delete-worker',30)`));
    const [leasedId, leaseToken] = leaseText.split("|");
    expect(leasedId).toBe(jobId);
    await sql(asRole("service_role", `SELECT public.intentlead_record_job_step_attempt(
      '${jobId}','delete-worker','${leaseToken}','private-step',1,'STARTED','{}'::uuid[],NULL,NULL,
      '{"private":"checkpoint"}','{"private":"cost scope"}')`));

    const call = () => sql(asRole("service_role", `SELECT public.intentlead_delete_discovery_brief(
      '${data.briefId}','${owner}','owner_requested')`));
    await expect(sql(asRole("anon", `SELECT public.intentlead_delete_discovery_brief(
      '${data.briefId}','${owner}','owner_requested')`))).rejects.toThrow(/permission denied/);
    await expect(sql(asRole("authenticated", `SELECT public.intentlead_delete_discovery_brief(
      '${data.briefId}','${owner}','owner_requested')`, owner))).rejects.toThrow(/permission denied/);
    expect(await call()).toBe("t");
    expect(await call()).toBe("t");
    expect(await sql(`SELECT state || '|' || payload::text || '|' || checkpoint::text || '|' || coalesce(result::text,'null') || '|' || coalesce(error::text,'null')
      FROM public.intentlead_jobs WHERE id='${jobId}'`)).toBe("CANCELLED|{}|{}|null|null");
    expect(await sql(`SELECT state || '|' || objective || '|' || criteria::text
      FROM public.intentlead_discovery_briefs WHERE id='${data.briefId}'`)).toBe("CANCELLED|[deleted]|{}");
    expect(await sql(`SELECT request_metadata::text || '|' || response_metadata::text || '|' || provider || '|' || cost_amount::text
      FROM public.intentlead_provider_runs WHERE id='${providerRunId}'`)).toBe("{}|{}|redacted|0");
    expect(await sql(`SELECT checkpoint::text || '|' || cost_scope::text || '|' || coalesce(retry_reason,'null')
      FROM public.intentlead_job_step_attempts WHERE job_id='${jobId}'`)).toBe("{}|{}|null");
    expect(await sql(`SELECT content IS NULL AND source_url IS NULL AND tombstoned_at IS NOT NULL
      FROM public.intentlead_source_items WHERE id='${sourceId}'`)).toBe("t");
    expect(await sql(`SELECT excerpt IS NULL AND source_url IS NULL AND structured_facts='{}'::jsonb AND tombstoned_at IS NOT NULL
      FROM public.intentlead_evidence_items WHERE id='${evidenceId}'`)).toBe("t");
    expect(await sql(`SELECT value IS NULL AND tombstoned_at IS NOT NULL FROM public.intentlead_contact_points WHERE id='${contactId}'`)).toBe("t");
    expect(await sql(`SELECT canonical_name='[deleted]' AND domain IS NULL AND tombstoned_at IS NOT NULL
      FROM public.intentlead_companies WHERE id='${companyId}'`)).toBe("t");
    expect(await sql(`SELECT tombstoned_at IS NOT NULL FROM public.intentlead_opportunities WHERE id='${opportunityId}'`)).toBe("t");
    expect(await sql(`SELECT role_title='[deleted]' AND hypothesis='[deleted]' AND tombstoned_at IS NOT NULL
      FROM public.intentlead_buyer_candidates WHERE id='${buyerId}'`)).toBe("t");
    expect(await sql(`SELECT full_name='[deleted]' AND role_title IS NULL AND tombstoned_at IS NOT NULL
      FROM public.intentlead_people WHERE id='${personId}'`)).toBe("t");
    expect(await sql(`SELECT count(*) FROM public.signals WHERE campaign_id='${data.campaignId}'`)).toBe("0");
    expect(await sql(`SELECT count(*) FROM public.leads WHERE campaign_id='${data.campaignId}'`)).toBe("0");
    expect(await sql(`SELECT count(*) FROM public.messages m JOIN public.leads l ON l.id=m.lead_id
      WHERE l.campaign_id='${data.campaignId}'`)).toBe("0");
    expect(await sql(`SELECT status='error' AND what_selling='[deleted]' AND icp='[deleted]' AND pain='[deleted]'
      AND geo IS NULL AND example_customers IS NULL AND cardinality(keywords)=0 AND tone IS NULL
      FROM public.campaigns WHERE id='${data.campaignId}' AND workspace_id='${data.workspaceId}'`)).toBe("t");
    expect(await sql(`SELECT count(*) FROM public.intentlead_suppression_entries WHERE workspace_id='${data.workspaceId}'`)).toBe("1");
    expect(await sql(`SELECT count(*) FROM public.intentlead_deletion_tombstones WHERE resource_type='OPPORTUNITY' AND resource_id='${opportunityId}'`)).toBe("1");
    expect(await sql(`SELECT count(*) FROM public.intentlead_artifact_metadata WHERE workspace_id='${data.workspaceId}'`)).toBe("0");
  }, 20_000);

  it("rejects cross-tenant deletion without disclosing ownership and preserves data shared by another live Opportunity", async () => {
    const data = await fixture("deletion-shared");
    const jobId = await enqueue(data.briefId);
    const otherBrief = randomUUID();
    const otherCampaign = randomUUID();
    await sql(`
      INSERT INTO public.campaigns(id,workspace_id,entry_mode,what_selling,icp,pain,status)
        VALUES ('${otherCampaign}','${data.workspaceId}','cold','offer','icp','pain','draft');
      INSERT INTO public.intentlead_discovery_briefs
        (id,workspace_id,offer_profile_id,icp_definition_id,market_profile_id,legacy_campaign_id,objective,criteria)
      SELECT '${otherBrief}',workspace_id,offer_profile_id,icp_definition_id,market_profile_id,'${otherCampaign}','Other live brief','{}'
      FROM public.intentlead_discovery_briefs WHERE id='${data.briefId}';
    `);

    const companyId = randomUUID();
    const sourceId = randomUUID();
    const evidenceId = randomUUID();
    const providerRunId = randomUUID();
    await sql(`INSERT INTO public.intentlead_companies(id,workspace_id,canonical_name,domain,confidence,created_at,updated_at)
      VALUES ('${companyId}','${data.workspaceId}','Private Company','shared.example',0.9,now(),now())`);
    const first = await addOpportunity({ ...data, companyId, sourceId, evidenceId, providerRunId, jobId, suffix: "b" });
    const secondOpportunityId = randomUUID();
    const secondAssessmentId = randomUUID();
    await sql(`
      INSERT INTO public.intentlead_opportunities(id,workspace_id,discovery_brief_id,company_id,state,signal)
      VALUES ('${secondOpportunityId}','${data.workspaceId}','${otherBrief}','${companyId}','ASSESSABLE',
        '{"family":"DETECTED_PROBLEM","subtype":"website"}');
      INSERT INTO public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id)
      VALUES ('${data.workspaceId}','${secondOpportunityId}','${evidenceId}');
      INSERT INTO public.intentlead_opportunity_assessments
        (id,workspace_id,opportunity_id,version,decision,assessed_at,signal,problem_type,problem_statement,
         evidence_strength,explicitness,urgency,freshness,commercial_impact,icp_fit,company_confidence,
         buyer_relevance,actionability,confidence)
      VALUES ('${secondAssessmentId}','${data.workspaceId}','${secondOpportunityId}',1,'QUALIFY',now(),
        '{"family":"DETECTED_PROBLEM","subtype":"website"}','website','shared interpretation',
        0.9,0.9,0.8,0.9,0.8,0.8,0.9,0.7,0.8,0.85);
      INSERT INTO public.intentlead_assessment_evidence(workspace_id,assessment_id,opportunity_id,evidence_id)
      VALUES ('${data.workspaceId}','${secondAssessmentId}','${secondOpportunityId}','${evidenceId}');
    `);
    const outsiderData = await fixture("deletion-outsider");
    await enqueue(outsiderData.briefId);
    await addLegacyGraph(data.campaignId, "target-shared");
    await addLegacyGraph(otherCampaign, "same-workspace-other");
    await addLegacyGraph(outsiderData.campaignId, "other-workspace");
    await expect(sql(asRole("service_role", `SELECT public.intentlead_delete_discovery_brief(
      '${data.briefId}','${outsider}','owner_requested')`))).rejects.toThrow(/forbidden/);

    await sql(asRole("service_role", `SELECT public.intentlead_delete_discovery_brief(
      '${data.briefId}','${owner}','owner_requested')`));
    expect(await sql(`SELECT content='private source body' AND tombstoned_at IS NULL FROM public.intentlead_source_items WHERE id='${sourceId}'`)).toBe("t");
    expect(await sql(`SELECT excerpt='private evidence text' AND tombstoned_at IS NULL FROM public.intentlead_evidence_items WHERE id='${evidenceId}'`)).toBe("t");
    expect(await sql(`SELECT canonical_name='Private Company' AND tombstoned_at IS NULL FROM public.intentlead_companies WHERE id='${companyId}'`)).toBe("t");
    expect(await sql(`SELECT tombstoned_at IS NOT NULL FROM public.intentlead_opportunities WHERE id='${first.opportunityId}'`)).toBe("t");
    expect(await sql(`SELECT state FROM public.intentlead_jobs WHERE id='${jobId}'`)).toBe("CANCELLED");
    expect(await sql(`SELECT count(*) FROM public.signals WHERE campaign_id='${data.campaignId}'`)).toBe("0");
    expect(await sql(`SELECT count(*) FROM public.leads WHERE campaign_id='${data.campaignId}'`)).toBe("0");
    expect(await sql(`SELECT count(*) FROM public.messages m JOIN public.leads l ON l.id=m.lead_id
      WHERE l.campaign_id='${data.campaignId}'`)).toBe("0");
    expect(await sql(`SELECT count(*) FROM public.signals WHERE campaign_id='${otherCampaign}'`)).toBe("1");
    expect(await sql(`SELECT count(*) FROM public.leads WHERE campaign_id='${otherCampaign}'`)).toBe("1");
    expect(await sql(`SELECT count(*) FROM public.messages m JOIN public.leads l ON l.id=m.lead_id
      WHERE l.campaign_id='${otherCampaign}'`)).toBe("1");
    expect(await sql(`SELECT c.what_selling='offer'
      AND EXISTS (SELECT 1 FROM public.signals s WHERE s.campaign_id=c.id AND s.content='Private legacy signal same-workspace-other')
      AND EXISTS (SELECT 1 FROM public.leads l WHERE l.campaign_id=c.id AND l.email='same-workspace-other@example.test')
      AND EXISTS (SELECT 1 FROM public.messages m JOIN public.leads l ON l.id=m.lead_id
        WHERE l.campaign_id=c.id AND m.body='Private message body same-workspace-other')
      FROM public.campaigns c WHERE c.id='${otherCampaign}'`)).toBe("t");
    expect(await sql(`SELECT count(*) FROM public.signals WHERE campaign_id='${outsiderData.campaignId}'`)).toBe("1");
    expect(await sql(`SELECT count(*) FROM public.leads WHERE campaign_id='${outsiderData.campaignId}'`)).toBe("1");
    expect(await sql(`SELECT count(*) FROM public.messages m JOIN public.leads l ON l.id=m.lead_id
      WHERE l.campaign_id='${outsiderData.campaignId}'`)).toBe("1");
    expect(await sql(`SELECT c.what_selling='offer'
      AND EXISTS (SELECT 1 FROM public.signals s WHERE s.campaign_id=c.id AND s.content='Private legacy signal other-workspace')
      AND EXISTS (SELECT 1 FROM public.leads l WHERE l.campaign_id=c.id AND l.email='other-workspace@example.test')
      AND EXISTS (SELECT 1 FROM public.messages m JOIN public.leads l ON l.id=m.lead_id
        WHERE l.campaign_id=c.id AND m.body='Private message body other-workspace')
      FROM public.campaigns c WHERE c.id='${outsiderData.campaignId}'`)).toBe("t");
  }, 20_000);
});
