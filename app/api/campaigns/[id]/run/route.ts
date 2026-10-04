import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { dispatchToWorker } from "@/lib/auth/dispatchToWorker";
import { checkRateLimit } from "@/lib/ratelimit";
import { ok, err } from "@/lib/utils/response";
import { logger } from "@/lib/utils/logger";
import { createApplicationContext, type ApplicationSupabaseClient } from "@/lib/application/context";
import { ApplicationError } from "@/lib/application/errors";
import { startOpportunitySearch } from "@/lib/application/opportunities";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, supabase, response } = await requireUser();
  if (response) return response;

  const { id } = await params;

  if (!(await checkRateLimit(`run:${user.id}`, 5, 60_000))) {
    return NextResponse.json(err("Rate limit exceeded"), { status: 429 });
  }

  const requestKey = req.headers.get("idempotency-key")?.trim() || `campaign:${id}:discovery:v1`;
  try {
    const context = await createApplicationContext(
      { authenticatedUserId: user.id, campaignId: id },
      supabase as unknown as ApplicationSupabaseClient,
    );
    const accepted = await startOpportunitySearch(context, {
      schemaVersion: 1,
      campaignId: id,
      idempotencyKey: requestKey,
    });

    try {
      dispatchToWorker(accepted.jobId);
    } catch {
      logger.error({ jobId: accepted.jobId, wakeup: "failed", code: "WAKE_HINT_FAILED" }, "Worker wake hint failed");
    }

    logger.info({ jobId: accepted.jobId, userId: user.id }, "Durable discovery job accepted");
    return NextResponse.json(ok({ jobId: accepted.jobId, status: "queued" }), { status: 202 });
  } catch (error) {
    const appError = error instanceof ApplicationError
      ? error
      : new ApplicationError("INTERNAL_ERROR", "Could not accept discovery job", { cause: error });
    return NextResponse.json(err(appError.message), { status: appError.status });
  }
}
