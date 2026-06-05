import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getServiceClient } from "@/lib/supabase/client";
import { ok, err } from "@/lib/utils/response";
import { logger } from "@/lib/utils/logger";

export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { searchParams } = req.nextUrl;
  const campaignId = searchParams.get("campaignId");
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  if (!campaignId) {
    return NextResponse.json(err("campaignId is required"), { status: 400 });
  }

  const supabase = getServiceClient();

  // Verify campaign belongs to user
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user!.id)
    .single();

  if (!workspace) {
    return NextResponse.json(ok({ leads: [], total: 0 }));
  }

  let query = supabase
    .from("leads")
    .select("*, messages(*)", { count: "exact" })
    .eq("campaign_id", campaignId)
    .order("intent_score", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data: leads, error, count } = await query;

  if (error) {
    logger.error({ campaignId, userId: user!.id, error: error.message }, "Failed to fetch leads");
    return NextResponse.json(err("Failed to fetch leads"), { status: 500 });
  }

  return NextResponse.json(ok({ leads: leads ?? [], total: count ?? 0 }));
}
