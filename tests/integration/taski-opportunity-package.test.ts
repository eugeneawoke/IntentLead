import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { asRole, insertUsers, sql } from "./task4-db";
import { bootstrapLatestDatabase } from "./task8-db";
import { applyTaskIMigrations } from "./taski-db";

const enabled = Boolean(process.env.INTENTLEAD_TEST_DATABASE_URL);
const owner = randomUUID(), outsider = randomUUID();
const company = randomUUID(), evidence = randomUUID(), opportunity = randomUUID();
const person = randomUUID(), buyer = randomUUID(), contact = randomUUID(), verification = randomUUID();
const brief = randomUUID(), briefClaim = randomUUID(), draft = randomUUID();
const draftSubjectClaim = randomUUID(), draftBodyClaim = randomUUID();
let workspace = "", discoveryBrief = "";

function quotedJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("'", "''");
}

async function createBrief(userId: string, name: string) {
  const command = {
    schemaVersion: 1,
    offer: { name: name + " offer", summary: "Automate a costly operations workflow", outcomes: [], exclusions: [] },
    icp: { name: name + " ICP", description: "Companies with observable operations pressure", companyAttributes: [], exclusions: [] },
    objective: "Find evidence-backed operational opportunities",
    criteria: {
      jurisdictions: [], languages: ["en"], signalFamilies: ["BUSINESS_EVENT"], exclusions: [],
      limits: { maxSourceItems: 100, maxOpportunities: 20 },
    },
  };
  const statement = "SELECT public.intentlead_create_discovery_brief('" + quotedJson(command)
    + "'::jsonb,'taski-" + name + "-" + randomUUID() + "')";
  return JSON.parse(await sql(asRole("authenticated", statement, userId))) as {
    discoveryBriefId: string; workspaceId: string;
  };
}

function packageSeedSql(): string {
  return [
    "BEGIN",
    "INSERT INTO public.intentlead_companies(id,workspace_id,canonical_name,domain,confidence) VALUES('" + company + "','" + workspace + "','Evidence Company','evidence.example',.95)",
    "INSERT INTO public.intentlead_evidence_items(id,workspace_id,evidence_type,source_url,captured_at,excerpt,structured_facts,verification_method,confidence,content_hash,provenance) VALUES('" + evidence + "','" + workspace + "','text','https://evidence.example/jobs',now(),'Hiring operations specialists','{}','public_source_capture',.95,repeat('a',64),'{\"sourceType\":\"WEB\",\"sourceId\":\"jobs-page\",\"providerRunId\":null,\"rawArtifactId\":null}')",
    "INSERT INTO public.intentlead_opportunities(id,workspace_id,discovery_brief_id,company_id,state,signal) VALUES('" + opportunity + "','" + workspace + "','" + discoveryBrief + "','" + company + "','DISCOVERED','{\"family\":\"BUSINESS_EVENT\",\"subtype\":\"hiring\"}')",
    "INSERT INTO public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id) VALUES('" + workspace + "','" + opportunity + "','" + evidence + "')",
    "COMMIT",
    "BEGIN",
    "INSERT INTO public.intentlead_people(id,workspace_id,opportunity_id,company_id,full_name,role_title,jurisdiction,confidence,idempotency_key,resolved_at) VALUES('" + person + "','" + workspace + "','" + opportunity + "','" + company + "','Alex Morgan','Head of Operations','{\"countryCode\":\"US\",\"subdivisionCode\":null}',.9,'person-alex-001',now())",
    "INSERT INTO public.intentlead_person_evidence VALUES('" + workspace + "','" + person + "','" + opportunity + "','" + evidence + "',now())",
    "INSERT INTO public.intentlead_buyer_candidates(id,workspace_id,opportunity_id,company_id,person_id,role_title,hypothesis,confidence,relevance,rank,idempotency_key) VALUES('" + buyer + "','" + workspace + "','" + opportunity + "','" + company + "','" + person + "','Head of Operations','Owns the observed workflow',.9,.95,1,'buyer-alex-001')",
    "INSERT INTO public.intentlead_buyer_candidate_evidence VALUES('" + workspace + "','" + buyer + "','" + opportunity + "','" + evidence + "',now())",
    "INSERT INTO public.intentlead_contact_points(id,workspace_id,opportunity_id,person_id,company_id,channel,scope,value,value_hash,source_kind,source_url,jurisdiction,market_policy_id,resolution_confidence,idempotency_key,captured_at) VALUES('" + contact + "','" + workspace + "','" + opportunity + "','" + person + "','" + company + "','email','PERSON','alex@evidence.example',public.intentlead_contact_value_hash('email','alex@evidence.example'),'PUBLIC_WEB','https://evidence.example/team','{\"countryCode\":\"US\",\"subdivisionCode\":null}','contact-policy-1',.91,'contact-alex-001',now())",
    "INSERT INTO public.intentlead_contact_point_evidence VALUES('" + workspace + "','" + contact + "','" + opportunity + "','" + evidence + "',now())",
    "INSERT INTO public.intentlead_contact_verifications(id,workspace_id,opportunity_id,contact_point_id,status,method,confidence,checked_at,expires_at,idempotency_key) VALUES('" + verification + "','" + workspace + "','" + opportunity + "','" + contact + "','VALID','PUBLIC_SOURCE',.96,now(),now()+interval '30 days','verify-alex-001')",
    "INSERT INTO public.intentlead_contact_verification_evidence VALUES('" + workspace + "','" + verification + "','" + opportunity + "','" + evidence + "',now())",
    "INSERT INTO public.intentlead_conversation_briefs(id,workspace_id,opportunity_id,buyer_candidate_id,contact_point_id,contact_verification_id,problem_summary,relevance_summary,recommended_angle,low_friction_cta,idempotency_key) VALUES('" + brief + "','" + workspace + "','" + opportunity + "','" + buyer + "','" + contact + "','" + verification + "','Hiring shows operations pressure','The offer addresses that workflow','Lead with the observed hiring need','Open to a 15 minute comparison?','brief-alex-001')",
    "INSERT INTO public.intentlead_conversation_brief_claims(id,workspace_id,brief_id,opportunity_id,claim_text) VALUES('" + briefClaim + "','" + workspace + "','" + brief + "','" + opportunity + "','The company is hiring operations specialists')",
    "INSERT INTO public.intentlead_conversation_brief_claim_evidence VALUES('" + workspace + "','" + briefClaim + "','" + opportunity + "','" + evidence + "',now())",
    "INSERT INTO public.intentlead_drafts(id,workspace_id,opportunity_id,conversation_brief_id,version,channel,subject,body,status,idempotency_key) VALUES('" + draft + "','" + workspace + "','" + opportunity + "','" + brief + "',1,'EMAIL','Operations workflow','Noticed your operations hiring.','GROUNDED','draft-alex-001')",
    "INSERT INTO public.intentlead_draft_claims(id,workspace_id,draft_id,opportunity_id,target,start_offset,end_offset,claim_text) VALUES('" + draftSubjectClaim + "','" + workspace + "','" + draft + "','" + opportunity + "','SUBJECT',0,19,'Operations workflow')",
    "INSERT INTO public.intentlead_draft_claim_evidence VALUES('" + workspace + "','" + draftSubjectClaim + "','" + opportunity + "','" + evidence + "',now())",
    "INSERT INTO public.intentlead_draft_claims(id,workspace_id,draft_id,opportunity_id,target,start_offset,end_offset,claim_text) VALUES('" + draftBodyClaim + "','" + workspace + "','" + draft + "','" + opportunity + "','BODY',0,31,'Noticed your operations hiring.')",
    "INSERT INTO public.intentlead_draft_claim_evidence VALUES('" + workspace + "','" + draftBodyClaim + "','" + opportunity + "','" + evidence + "',now())",
    "COMMIT",
  ].join(";\n") + ";";
}

describe.skipIf(!enabled)("Task I Opportunity package storage", () => {
  beforeAll(async () => {
    await bootstrapLatestDatabase();
    await insertUsers(owner, outsider);
    const created = await createBrief(owner, "owner");
    workspace = created.workspaceId;
    discoveryBrief = created.discoveryBriefId;
    await applyTaskIMigrations();
    await sql(packageSeedSql());
  }, 60_000);

  it("persists an idempotent, evidence-grounded copy-only package", async () => {
    expect(await sql("SELECT count(DISTINCT d.id) FROM public.intentlead_drafts d JOIN public.intentlead_draft_claims c ON c.draft_id=d.id JOIN public.intentlead_draft_claim_evidence e ON e.claim_id=c.id WHERE d.id='" + draft + "' AND d.delivery_mode='COPY_EXPORT_ONLY'")).toBe("1");
    expect(await sql("SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname=ANY(ARRAY['messages','mailboxes','sequences','follow_ups','delivery_events','intentlead_outreach_drafts'])")).toBe("0");
    await expect(sql("INSERT INTO public.intentlead_people(workspace_id,opportunity_id,company_id,full_name,confidence,idempotency_key,resolved_at) VALUES('" + workspace + "','" + opportunity + "','" + company + "','Duplicate',.8,'person-alex-001',now())"))
      .rejects.toThrow(/duplicate key value[\s\S]*intentlead_people_workspace_id_opportunity_id_idempotency_k_key/);
  });

  it("keeps EN_DISCOVERY_ONLY contact-ready and rejects transmission", async () => {
    expect(await sql("SELECT capabilities @> ARRAY['PERSON_SEARCH','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','COPY_EXPORT']::text[] AND disabled_capabilities @> ARRAY['MAILBOX_CONNECT','MESSAGE_SEND','SEQUENCE_RUN','FOLLOW_UP','DELIVERY_TRACKING']::text[] FROM public.intentlead_market_profiles m JOIN public.intentlead_discovery_briefs b ON b.market_profile_id=m.id WHERE b.id='" + discoveryBrief + "'")).toBe("t");
    await expect(sql("UPDATE public.intentlead_market_profiles SET capabilities=capabilities||ARRAY['MESSAGE_SEND']::text[] WHERE id=(SELECT market_profile_id FROM public.intentlead_discovery_briefs WHERE id='" + discoveryBrief + "')"))
      .rejects.toThrow(/transmission_capability_denied/);
  });

  it("rejects invalid contacts, cross-tenant references and unsupported claims", async () => {
    await expect(sql("INSERT INTO public.intentlead_contact_points(workspace_id,opportunity_id,company_id,channel,scope,value,value_hash,source_kind,source_url,jurisdiction,market_policy_id,resolution_confidence,idempotency_key,captured_at) VALUES('" + workspace + "','" + opportunity + "','" + company + "','email','COMPANY','invalid',public.intentlead_contact_value_hash('email','invalid'),'PUBLIC_WEB','https://evidence.example/team','{}','contact-policy-1',.5,'invalid-contact-001',now())"))
      .rejects.toThrow(/invalid_contact_value/);
    await expect(sql("INSERT INTO public.intentlead_contact_verifications(workspace_id,opportunity_id,contact_point_id,status,method,confidence,checked_at,expires_at,idempotency_key) VALUES('" + workspace + "','" + opportunity + "','" + contact + "','VALID','SYNTAX_ONLY',1,now(),now()+interval '30 days','syntax-only-valid-001')"))
      .rejects.toThrow(/intentlead_contact_verifications_check/);
    await expect(sql("INSERT INTO public.intentlead_contact_verifications(workspace_id,opportunity_id,contact_point_id,status,method,confidence,checked_at,expires_at,idempotency_key) VALUES('" + workspace + "','" + opportunity + "','" + contact + "','VALID','PUBLIC_SOURCE',1,now()+interval '1 day',now()+interval '30 days','future-valid-001')"))
      .rejects.toThrow(/contact_verification_in_future/);
    await expect(sql("INSERT INTO public.intentlead_suppression_entries(workspace_id,identifier_type,identifier_hash,reason,policy_id,source) VALUES('" + workspace + "','EMAIL',upper(public.intentlead_contact_value_hash('email','upper@example.com')),'POLICY','policy-upper','POLICY')"))
      .rejects.toThrow(/intentlead_suppression_entries_identifier_hash_check/);
    const roleOnlyBuyer = randomUUID();
    await sql([
      "BEGIN",
      "INSERT INTO public.intentlead_buyer_candidates(id,workspace_id,opportunity_id,company_id,role_title,hypothesis,confidence,relevance,rank,idempotency_key) VALUES('" + roleOnlyBuyer + "','" + workspace + "','" + opportunity + "','" + company + "','Operations leader','Role-only hypothesis',.6,.7,2,'buyer-role-only-001')",
      "INSERT INTO public.intentlead_buyer_candidate_evidence VALUES('" + workspace + "','" + roleOnlyBuyer + "','" + opportunity + "','" + evidence + "',now())",
      "COMMIT",
    ].join(";\n") + ";");
    await expect(sql("INSERT INTO public.intentlead_conversation_briefs(workspace_id,opportunity_id,buyer_candidate_id,contact_point_id,contact_verification_id,problem_summary,relevance_summary,recommended_angle,low_friction_cta,idempotency_key) VALUES('" + workspace + "','" + opportunity + "','" + roleOnlyBuyer + "','" + contact + "','" + verification + "','Problem','Relevance','Angle','CTA','brief-person-mismatch')"))
      .rejects.toThrow(/conversation_brief_requires_current_verified_contact/);
    await expect(sql("UPDATE public.intentlead_buyer_candidates SET person_id=NULL WHERE id='" + buyer + "'"))
      .rejects.toThrow(/referenced_buyer_binding_is_immutable/);
    await expect(sql("UPDATE public.intentlead_contact_points SET scope='COMPANY',person_id=NULL WHERE id='" + contact + "'"))
      .rejects.toThrow(/referenced_contact_binding_is_immutable/);
    await expect(sql("UPDATE public.intentlead_contact_verifications SET expires_at=expires_at+interval '1 day' WHERE id='" + verification + "'"))
      .rejects.toThrow(/referenced_verification_binding_is_immutable/);
    const other = await createBrief(outsider, "outsider");
    await expect(sql("INSERT INTO public.intentlead_people(workspace_id,opportunity_id,company_id,full_name,confidence,idempotency_key,resolved_at) VALUES('" + other.workspaceId + "','" + opportunity + "','" + company + "','Cross Tenant',.8,'cross-tenant-001',now())"))
      .rejects.toThrow(/package_company_mismatch|foreign key/);
    const unsupportedBrief = randomUUID(), unsupportedClaim = randomUUID();
    const unsupported = [
      "BEGIN",
      "INSERT INTO public.intentlead_conversation_briefs(id,workspace_id,opportunity_id,buyer_candidate_id,contact_point_id,contact_verification_id,problem_summary,relevance_summary,recommended_angle,low_friction_cta,idempotency_key) VALUES('" + unsupportedBrief + "','" + workspace + "','" + opportunity + "','" + buyer + "','" + contact + "','" + verification + "','Problem','Relevance','Angle','CTA','brief-no-evidence')",
      "INSERT INTO public.intentlead_conversation_brief_claims(id,workspace_id,brief_id,opportunity_id,claim_text) VALUES('" + unsupportedClaim + "','" + workspace + "','" + unsupportedBrief + "','" + opportunity + "','Unsupported material claim')",
      "COMMIT",
    ].join(";\n") + ";";
    await expect(sql(unsupported)).rejects.toThrow(/package_record_requires_evidence/);
  });

  it("keeps package tables under RLS and denies direct authenticated reads", async () => {
    expect(await sql("SELECT count(*) FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND c.relname LIKE 'intentlead_%' AND NOT c.relrowsecurity")).toBe("0");
    await expect(sql(asRole("authenticated", "SELECT count(*) FROM public.intentlead_contact_points", outsider)))
      .rejects.toThrow(/permission denied/);
  });

  it("applies suppression and redacts package data while retaining the suppression hash", async () => {
    const suppression = randomUUID();
    await sql("INSERT INTO public.intentlead_suppression_entries(id,workspace_id,identifier_type,identifier_hash,reason,policy_id,source) VALUES('" + suppression + "','" + workspace + "','EMAIL',public.intentlead_contact_value_hash('email','alex@evidence.example'),'OPT_OUT','policy-1','HUMAN')");
    expect(await sql("SELECT state||':'||(value IS NULL)::text||':'||(suppression_entry_id='" + suppression + "')::text FROM public.intentlead_contact_points WHERE id='" + contact + "'")).toBe("SUPPRESSED:true:true");
    expect(await sql("SELECT (tombstoned_at IS NOT NULL)::text FROM public.intentlead_conversation_briefs WHERE id='" + brief + "'")).toBe("true");
    expect(await sql("SELECT (tombstoned_at IS NOT NULL)::text FROM public.intentlead_drafts WHERE id='" + draft + "'")).toBe("true");
    const mismatchedSuppression = randomUUID();
    await sql("INSERT INTO public.intentlead_suppression_entries(id,workspace_id,identifier_type,identifier_hash,reason,policy_id,source) VALUES('" + mismatchedSuppression + "','" + workspace + "','EMAIL',public.intentlead_contact_value_hash('email','other@evidence.example'),'POLICY','policy-2','POLICY')");
    await expect(sql("UPDATE public.intentlead_contact_points SET suppression_entry_id='" + mismatchedSuppression + "' WHERE id='" + contact + "'"))
      .rejects.toThrow(/contact_suppression_mismatch/);
    await sql("SET session_replication_role='replica'; UPDATE public.intentlead_contact_verifications SET checked_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE id='" + verification + "'; SET session_replication_role='origin'");
    await sql("UPDATE public.intentlead_opportunities SET tombstoned_at=now() WHERE id='" + opportunity + "'");
    expect(await sql("SELECT full_name||':'||(tombstoned_at IS NOT NULL)::text FROM public.intentlead_people WHERE id='" + person + "'")).toBe("[deleted]:true");
    expect(await sql("SELECT state||':'||(value IS NULL)::text||':'||(suppression_entry_id IS NULL)::text FROM public.intentlead_contact_points WHERE id='" + contact + "'")).toBe("DELETED:true:true");
    expect(await sql("SELECT body||':'||(tombstoned_at IS NOT NULL)::text FROM public.intentlead_drafts WHERE id='" + draft + "'")).toBe("[deleted]:true");
    expect(await sql("SELECT count(*) FROM public.intentlead_suppression_entries WHERE id='" + suppression + "'")).toBe("1");
  });
});
