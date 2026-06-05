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

  const supabase = getServiceClient();

  // TODO: уточнить поля schema Glook — читаем из общей Supabase
  // Glook schema fields unknown — stub with best-guess field names
  const { data: scan, error } = await supabase
    .from("scans") // TODO: verify actual Glook table name
    .select("id, url, pain_points, business_context, created_at")
    .eq("id", scanId)
    .single();

  if (error || !scan) {
    logger.warn({ scanId, userId: user!.id }, "Glook scan not found");
    return NextResponse.json(err("Scan not found"), { status: 404 });
  }

  return NextResponse.json(ok({ scan }));
}
