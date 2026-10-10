import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { checkStrictRateLimit } from "@/lib/security/strict-rate-limit";
import { getServiceClient } from "@/lib/supabase/client";
import type { ApplicationSupabaseClient } from "@/lib/application/context";
import { approveConversationalIntake } from "@/lib/application/conversational-intake-approval-api";
import { ApplicationError } from "@/lib/application/errors";
import { err, ok } from "@/lib/utils/response";

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!(await checkStrictRateLimit(`conversational-intake-approve:${user.id}`, 10, 60_000))) {
    return NextResponse.json(err("Rate limit exceeded"), { status: 429 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json(err("Invalid JSON"), { status: 400 }); }
  try {
    const discoveryBrief = await approveConversationalIntake(
      getServiceClient() as unknown as ApplicationSupabaseClient,
      user.id,
      body,
      process.env.INTENTLEAD_REVIEW_RECEIPT_SECRET ?? "",
    );
    return NextResponse.json(ok({ discoveryBrief }), { status: discoveryBrief.created ? 201 : 200 });
  } catch (error) {
    const appError = error instanceof ApplicationError
      ? error
      : new ApplicationError("INTERNAL_ERROR", "Could not approve conversational intake");
    return NextResponse.json(err(appError.message), { status: appError.status });
  }
}
