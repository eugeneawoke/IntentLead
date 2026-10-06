import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { checkRateLimit } from "@/lib/ratelimit";
import { createDiscoveryBrief, listDiscoveryBriefs } from "@/lib/application/discovery-briefs";
import { ApplicationError } from "@/lib/application/errors";
import type { ApplicationSupabaseClient } from "@/lib/application/context";
import { ok, err } from "@/lib/utils/response";

export async function GET() {
  const { supabase, response } = await requireUser();
  if (response) return response;
  try {
    const discoveryBriefs = await listDiscoveryBriefs(supabase as unknown as ApplicationSupabaseClient);
    return NextResponse.json(ok({ discoveryBriefs }));
  } catch (error) {
    const appError = error instanceof ApplicationError ? error : new ApplicationError("INTERNAL_ERROR", "Could not list DiscoveryBriefs");
    return NextResponse.json(err(appError.message), { status: appError.status });
  }
}

export async function POST(req: NextRequest) {
  const { user, supabase, response } = await requireUser();
  if (response) return response;
  if (!(await checkRateLimit(`discovery-briefs:${user.id}`, 20, 60_000))) {
    return NextResponse.json(err("Rate limit exceeded"), { status: 429 });
  }
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json(err("Invalid JSON"), { status: 400 }); }
  const idempotencyKey = req.headers.get("idempotency-key")?.trim() ?? "";
  try {
    const discoveryBrief = await createDiscoveryBrief(
      supabase as unknown as ApplicationSupabaseClient,
      body,
      idempotencyKey,
    );
    return NextResponse.json(ok({ discoveryBrief }), { status: discoveryBrief.created ? 201 : 200 });
  } catch (error) {
    const appError = error instanceof ApplicationError ? error : new ApplicationError("INTERNAL_ERROR", "Could not create DiscoveryBrief");
    return NextResponse.json(err(appError.message), { status: appError.status });
  }
}
