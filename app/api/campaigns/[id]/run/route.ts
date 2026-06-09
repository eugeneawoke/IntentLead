import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getServiceClient } from "@/lib/supabase/client";
import { dispatchToWorker } from "@/lib/auth/dispatchToWorker";
import { checkRateLimit } from "@/lib/ratelimit";
import { ok, err } from "@/lib/utils/response";
import { logger } from "@/lib/utils/logger";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  if (!(await checkRateLimit(`run:${user.id}`, 5, 60_000))) {
    return NextResponse.json(err("Rate limit exceeded"), { status: 429 });
  }

  // RLS ensures user can only see their own campaigns — no explicit ownership check needed
  const { data: campaign, error: campaignErr } = await supabase
    .from("campaigns")
    .select("id, workspace_id, status")
    .eq("id", id)
    .single();

  if (campaignErr || !campaign) {
    return NextResponse.json(err("Campaign not found"), { status: 404 });
  }

  // Credits check uses service client for reliable workspace data
  const adminSupabase = getServiceClient();
  const { data: workspace } = await adminSupabase
    .from("workspaces")
    .select("id, credits_remaining, plan, free_converter_used")
    .eq("id", campaign.workspace_id)
    .single();

  if (!workspace) {
    return NextResponse.json(err("Workspace not found"), { status: 404 });
  }

  // Check credits
  const freeRunAllowed = workspace.plan === 'free' && !workspace.free_converter_used;
  if (workspace.credits_remaining <= 0 && !freeRunAllowed) {
    return NextResponse.json(err("Insufficient credits. Please upgrade your plan."), { status: 402 });
  }

  // Update campaign status to running
  await supabase
    .from("campaigns")
    .update({ status: "running" })
    .eq("id", id);

  // Fire and forget — do NOT await
  dispatchToWorker(id);

  logger.info({ campaignId: id, userId: user.id }, "Pipeline dispatched");

  return NextResponse.json(ok({ message: "Pipeline started" }), { status: 202 });
}
