import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getServiceClient } from "@/lib/supabase/client";
import { err } from "@/lib/utils/response";
import { logger } from "@/lib/utils/logger";
import type { Lead } from "@/types/lead";

function toCsv(leads: Lead[]): string {
  const headers = [
    "company_name", "company_domain", "contact_name", "contact_role",
    "email", "email_provider", "intent_score", "intent_type",
    "why_now", "opening_line", "status"
  ];
  const rows = leads.map(l =>
    headers.map(h => {
      const val = (l as unknown as Record<string, unknown>)[h];
      return val == null ? "" : `"${String(val).replace(/"/g, '""')}"`;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
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

  const supabase = getServiceClient();

  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("campaign_id", body.campaignId)
    .eq("status", "verified")
    .order("intent_score", { ascending: false });

  if (error) {
    logger.error({ campaignId: body.campaignId, error: error.message }, "Export failed");
    return NextResponse.json(err("Export failed"), { status: 500 });
  }

  const csv = toCsv((leads ?? []) as Lead[]);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="leads-${body.campaignId}.csv"`,
    },
  });
}
