import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getServiceClient } from "@/lib/supabase/client";
import { ok, err } from "@/lib/utils/response";
import { logger } from "@/lib/utils/logger";
import type { AnonSession } from "@/types/anonSession";

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  let body: { anonSession: AnonSession };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON"), { status: 400 });
  }

  const { anonSession } = body;
  if (!anonSession || typeof anonSession !== "object") {
    return NextResponse.json(err("anonSession required"), { status: 400 });
  }

  const supabase = getServiceClient();

  // Get or create workspace
  let { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user!.id)
    .single();

  if (!workspace) {
    const { data: newWs, error: wsErr } = await supabase
      .from("workspaces")
      .insert({ owner_id: user!.id, name: "My Workspace" })
      .select("id")
      .single();
    if (wsErr || !newWs) {
      logger.error({ userId: user!.id, wsErr }, "Failed to create workspace during anon transfer");
      return NextResponse.json(err("Failed to create workspace"), { status: 500 });
    }
    workspace = newWs;
  }

  // Create conversation
  const { data: conversation, error: convErr } = await supabase
    .from("conversations")
    .insert({ workspace_id: workspace.id })
    .select("id")
    .single();

  if (convErr || !conversation) {
    logger.error({ userId: user!.id, convErr }, "Failed to create conversation during anon transfer");
    return NextResponse.json(err("Failed to create conversation"), { status: 500 });
  }

  // Save messages
  if (anonSession.messages && anonSession.messages.length > 0) {
    const msgs = anonSession.messages.map((m) => ({
      conversation_id: conversation.id,
      role: m.role,
      content: m.content,
    }));
    await supabase.from("conversation_messages").insert(msgs);
  }

  // Create draft campaign if intake has content
  const intake = anonSession.intake ?? {};
  const hasMeaningfulIntake = intake.what_selling || intake.icp || intake.pain;
  let campaignId: string | null = null;

  if (hasMeaningfulIntake) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .insert({
        workspace_id: workspace.id,
        entry_mode: "cold",
        what_selling: intake.what_selling ?? "",
        icp: intake.icp ?? "",
        pain: intake.pain ?? "",
        geo: intake.geo ?? null,
        keywords: intake.keywords ?? [],
        tone: intake.tone ?? null,
        status: "draft",
      })
      .select("id")
      .single();

    if (campaign) {
      campaignId = campaign.id;
      await supabase
        .from("conversations")
        .update({ campaign_id: campaignId })
        .eq("id", conversation.id);
    }
  }

  return NextResponse.json(
    ok({ campaignId, conversationId: conversation.id, workspaceId: workspace.id })
  );
}
