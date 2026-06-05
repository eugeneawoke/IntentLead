import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { fetchSignals } from "./signals";
import { classifySignal } from "./classify";
import { identifyCompany } from "./company";
import { verifyContact } from "./contact";
import { findEmail } from "./email";
import { generateMessage } from "./message";
import type { Campaign } from "../../types/campaign";
import type { Signal } from "../../types/signal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>;

function getSupabase(): DB {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function log(level: string, meta: Record<string, unknown>, msg: string) {
  process.stdout.write(JSON.stringify({ level, ts: new Date().toISOString(), msg, ...meta }) + "\n");
}

export async function runPipeline(campaignId: string): Promise<void> {
  const supabase = getSupabase();

  // Load campaign
  const { data: campaign, error: campaignErr } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (campaignErr || !campaign) {
    log("error", { campaignId }, "Campaign not found");
    return;
  }

  log("info", { campaignId, keywords: campaign.keywords }, "Pipeline started");

  try {
    // Step 1: Fetch signals
    const signals = await fetchSignals(campaign as Campaign);
    log("info", { campaignId, count: signals.length }, "Signals fetched");

    if (!signals.length) {
      await supabase.from("campaigns").update({ status: "done" }).eq("id", campaignId);
      log("info", { campaignId }, "No signals found");
      return;
    }

    // Save signals to DB (dedup via UNIQUE constraint)
    for (const signal of signals) {
      await supabase
        .from("signals")
        .upsert(signal, { onConflict: "campaign_id,source_url", ignoreDuplicates: true });
    }

    // Reload signals with IDs assigned by DB
    const { data: savedSignals } = await supabase
      .from("signals")
      .select("*")
      .eq("campaign_id", campaignId);

    if (!savedSignals?.length) {
      await supabase.from("campaigns").update({ status: "done" }).eq("id", campaignId);
      log("info", { campaignId }, "No signals after save");
      return;
    }

    // Step 2: Process each signal as a lead (isolated — failure of one doesn't stop others)
    let verified = 0, rejected = 0;
    for (const signal of savedSignals as Signal[]) {
      try {
        const wasVerified = await processLead(campaignId, campaign as Campaign, signal, supabase);
        if (wasVerified) verified++;
        else rejected++;
      } catch (err) {
        rejected++;
        log("warn", { campaignId, signalId: signal.id, err: String(err) }, "Lead processing failed");
      }
    }

    await supabase.from("campaigns").update({ status: "done" }).eq("id", campaignId);
    log("info", { campaignId, verified, rejected }, "Pipeline complete");
  } catch (err) {
    await supabase.from("campaigns").update({ status: "error" }).eq("id", campaignId);
    log("error", { campaignId, err: String(err) }, "Pipeline error");
  }
}

async function processLead(
  campaignId: string,
  campaign: Campaign,
  signal: Signal,
  supabase: DB
): Promise<boolean> {
  // Create lead record
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .insert({ campaign_id: campaignId, signal_id: signal.id, status: "processing" })
    .select()
    .single();

  if (leadErr || !lead) throw new Error(`Failed to create lead: ${leadErr?.message}`);

  const leadId = lead.id as string;

  // L1: Classify intent
  const l1 = await classifySignal(signal.content, signal.context);
  if (l1.score < 80) {
    await supabase.from("leads").update({
      status: "rejected",
      reject_reason: "low_intent",
      intent_score: l1.score,
      intent_type: l1.intentType,
    }).eq("id", leadId);
    log("info", { leadId, score: l1.score }, "L1 rejected");
    return false;
  }

  await supabase.from("leads").update({
    verify_signal: true,
    intent_score: l1.score,
    intent_type: l1.intentType,
  }).eq("id", leadId);

  // L2: Identify company
  const l2 = await identifyCompany(signal.author_handle, signal.content);
  if (!l2.companyName || !l2.companyDomain) {
    await supabase.from("leads").update({
      status: "rejected",
      reject_reason: "no_company",
    }).eq("id", leadId);
    log("info", { leadId }, "L2 rejected");
    return false;
  }

  await supabase.from("leads").update({
    verify_company: true,
    company_name: l2.companyName,
    company_domain: l2.companyDomain,
  }).eq("id", leadId);

  // L3: Verify contact role
  const l3 = await verifyContact(l2.companyDomain, signal.author_handle);
  if (!l3.isDecisionMaker) {
    await supabase.from("leads").update({
      status: "rejected",
      reject_reason: "not_decision_maker",
      contact_name: l3.contactName,
      contact_role: l3.contactRole,
    }).eq("id", leadId);
    log("info", { leadId }, "L3 rejected");
    return false;
  }

  await supabase.from("leads").update({
    verify_contact: true,
    contact_name: l3.contactName,
    contact_role: l3.contactRole,
    contact_linkedin: l3.linkedinUrl,
  }).eq("id", leadId);

  // L4: Find email
  const l4 = await findEmail(l3.contactName!, l2.companyDomain);
  if (!l4.email) {
    await supabase.from("leads").update({
      status: "rejected",
      reject_reason: "no_email",
    }).eq("id", leadId);
    log("info", { leadId }, "L4 rejected");
    return false;
  }

  await supabase.from("leads").update({
    verify_email: true,
    email: l4.email,
    email_provider: l4.provider,
  }).eq("id", leadId);

  // All 4 levels green — charge credit atomically via RPC
  const { error: rpcErr } = await supabase.rpc("verify_lead_and_charge_credit", {
    p_lead_id: leadId,
    p_workspace_id: campaign.workspace_id,
  });

  if (rpcErr) {
    log("error", { leadId, err: rpcErr.message }, "Credit RPC failed");
    // Lead stays processing (not verified) — credit not charged
    return false;
  }

  // Generate message (failure does NOT block the verified lead)
  try {
    const { subject, body } = await generateMessage(lead as { id: string; company_name: string | null; contact_name: string | null; contact_role: string | null; email: string | null }, signal, campaign);
    await supabase.from("messages").insert({
      lead_id: leadId,
      subject,
      body,
      generation_failed: false,
    });
  } catch (msgErr) {
    await supabase.from("messages").insert({
      lead_id: leadId,
      body: "",
      generation_failed: true,
    });
    log("error", { leadId, err: String(msgErr) }, "Message generation failed");
  }

  log("info", { leadId }, "Lead verified");
  return true;
}
