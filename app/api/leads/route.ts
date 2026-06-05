import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { ok, err } from "@/lib/utils/response";
import { logger } from "@/lib/utils/logger";

export async function GET(req: NextRequest) {
  const { user, supabase, response } = await requireUser();
  if (response) return response;

  const { searchParams } = req.nextUrl;
  const campaignId = searchParams.get("campaignId");
  const status = searchParams.get("status");
  const limitRaw = parseInt(searchParams.get("limit") ?? "50", 10);
  const offsetRaw = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = isNaN(limitRaw) || limitRaw < 1 ? 50 : Math.min(limitRaw, 100);
  const offset = isNaN(offsetRaw) || offsetRaw < 0 ? 0 : offsetRaw;

  if (!campaignId) {
    return NextResponse.json(err("campaignId is required"), { status: 400 });
  }

  // RLS policy leads_workspace_read scopes results to user's workspaces automatically
  let query = supabase
    .from("leads")
    .select("*, messages(*)", { count: "exact" })
    .eq("campaign_id", campaignId)
    .order("intent_score", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data: leads, error, count } = await query;

  if (error) {
    logger.error({ campaignId, userId: user.id, error: error.message }, "Failed to fetch leads");
    return NextResponse.json(err("Failed to fetch leads"), { status: 500 });
  }

  return NextResponse.json(ok({ leads: leads ?? [], total: count ?? 0 }));
}
