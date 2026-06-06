import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getServiceClient } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/ratelimit";
import { ok, err } from "@/lib/utils/response";
import { logger } from "@/lib/utils/logger";
import type { CreateCampaignInput } from "@/types/campaign";

export async function GET(_req: NextRequest) {
  const { user, supabase, response } = await requireUser();
  if (response) return response;

  // RLS policy campaigns_workspace_crud scopes to user's workspaces automatically
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    logger.error({ userId: user.id, error: error.message }, "Failed to list campaigns");
    return NextResponse.json(err("Failed to fetch campaigns"), { status: 500 });
  }

  return NextResponse.json(ok({ campaigns: campaigns ?? [] }));
}

export async function POST(req: NextRequest) {
  const { user, supabase, response } = await requireUser();
  if (response) return response;

  if (!checkRateLimit(`campaigns:${user.id}`, 20, 60_000)) {
    return NextResponse.json(err("Rate limit exceeded"), { status: 429 });
  }

  let body: CreateCampaignInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON"), { status: 400 });
  }

  // Workspace lookup/creation requires service client (user may not have workspace yet)
  const adminSupabase = getServiceClient();
  let workspaceId: string;
  const { data: existingWs } = await adminSupabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (existingWs) {
    workspaceId = existingWs.id;
  } else {
    // Create default workspace on first campaign
    const { data: newWs, error: wsErr } = await adminSupabase
      .from("workspaces")
      .insert({ owner_id: user.id, name: "My Workspace" })
      .select()
      .single();
    if (wsErr || !newWs) {
      return NextResponse.json(err("Failed to create workspace"), { status: 500 });
    }
    workspaceId = newWs.id;
  }

  // Campaign insert via session client — RLS CHECK policy enforces workspace ownership
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      workspace_id: workspaceId,
      entry_mode: body.entry_mode ?? "cold",
      what_selling: body.what_selling,
      icp: body.icp,
      pain: body.pain,
      geo: body.geo ?? null,
      keywords: body.keywords ?? [],
      tone: body.tone ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error({ userId: user.id, error: error.message }, "Failed to create campaign");
    return NextResponse.json(err("Failed to create campaign"), { status: 500 });
  }

  return NextResponse.json(ok({ campaign }), { status: 201 });
}
