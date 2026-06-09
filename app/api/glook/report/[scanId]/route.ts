import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getServiceClient } from "@/lib/supabase/client";
import { ok, err } from "@/lib/utils/response";
import { logger } from "@/lib/utils/logger";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const { user, response } = await requireUser();
  if (response) return response;

  const { scanId } = await params;

  // Service client used to read Glook scans; ownership enforced explicitly below.
  const supabase = getServiceClient();

  const { data: scan, error } = await supabase
    .from("scans")
    .select("id, url, status, results, created_at, user_id")
    .eq("id", scanId)
    .eq("user_id", user!.id)
    .single();

  if (error || !scan) {
    logger.warn({ scanId, userId: user!.id }, "Glook scan not found");
    return NextResponse.json(err("Scan not found"), { status: 404 });
  }

  if (scan.status !== "done") {
    return NextResponse.json(err("Scan not ready"), { status: 202 });
  }

  return NextResponse.json(ok({ scan }));
}
