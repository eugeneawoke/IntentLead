import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { checkRateLimit } from "@/lib/ratelimit";
import { createApplicationContext, type ApplicationSupabaseClient } from "@/lib/application/context";
import { deleteDiscoveryBrief } from "@/lib/application/data-lifecycle";
import { ApplicationError } from "@/lib/application/errors";
import { ok, err } from "@/lib/utils/response";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, supabase, response } = await requireUser();
  if (response) return response;
  const { id } = await params;
  if (!(await checkRateLimit(`delete-discovery-brief:${user.id}`, 5, 60_000))) {
    return NextResponse.json(err("Rate limit exceeded"), { status: 429 });
  }
  try {
    const context = await createApplicationContext(
      { authenticatedUserId: user.id, discoveryBriefId: id },
      supabase as unknown as ApplicationSupabaseClient,
    );
    await deleteDiscoveryBrief(context, { schemaVersion: 1, discoveryBriefId: id });
    return NextResponse.json(ok({ deleted: true }));
  } catch (error) {
    const appError = error instanceof ApplicationError ? error : new ApplicationError("INTERNAL_ERROR", "Could not delete DiscoveryBrief");
    return NextResponse.json(err(appError.message), { status: appError.status });
  }
}
