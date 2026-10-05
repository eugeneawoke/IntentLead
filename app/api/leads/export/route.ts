import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { assertLegacyLeadRouteAllowed } from "@/lib/application/legacy-lead-policy";
import { ApplicationError } from "@/lib/application/errors";
import { err } from "@/lib/utils/response";
import { logger } from "@/lib/utils/logger";
import type { Lead } from "@/types/lead";

function escapeCsvCell(val: unknown): string {
  if (val == null) return '';
  const str = String(val);
  // Prevent formula injection (leading =, +, -, @, tab, carriage return)
  const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

function toCsv(leads: Lead[]): string {
  const headers = [
    "company_name", "company_domain", "contact_name", "contact_role",
    "email", "email_provider", "intent_score", "intent_type",
    "why_now", "opening_line", "status"
  ];
  const rows = leads.map(l =>
    headers.map(h => {
      const val = (l as unknown as Record<string, unknown>)[h];
      return escapeCsvCell(val);
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

export async function POST(req: NextRequest) {
  const { user, supabase, response } = await requireUser();
  if (response) return response;

  let body: { campaignId: string; format?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON"), { status: 400 });
  }

  if (!body.campaignId) {
    return NextResponse.json(err("campaignId is required"), { status: 400 });
  }

  try {
    await assertLegacyLeadRouteAllowed(body.campaignId, supabase);
  } catch (policyError) {
    if (policyError instanceof ApplicationError && policyError.code === "POLICY_DENIED") {
      return NextResponse.json({ success: false, code: policyError.code, error: policyError.message }, { status: policyError.status });
    }
    logger.error({ campaignId: body.campaignId, userId: user.id }, "Could not verify legacy export policy");
    return NextResponse.json(err("Could not verify lead export policy"), { status: 500 });
  }

  // RLS policy leads_workspace_read scopes results to user's workspaces automatically
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("campaign_id", body.campaignId)
    .eq("status", "verified")
    .order("intent_score", { ascending: false });

  if (error) {
    logger.error({ campaignId: body.campaignId, userId: user.id, error: error.message }, "Export failed");
    return NextResponse.json(err("Export failed"), { status: 500 });
  }

  const csv = toCsv((leads ?? []) as Lead[]);

  const safeCampaignId = body.campaignId.replace(/[^a-zA-Z0-9-]/g, '');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="leads-${safeCampaignId}.csv"`,
    },
  });
}
