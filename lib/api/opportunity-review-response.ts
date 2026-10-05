import { NextResponse } from "next/server";
import { ApplicationError } from "@/lib/application/errors";

export function reviewErrorResponse(error: unknown): NextResponse {
  const applicationError = error instanceof ApplicationError
    ? error
    : new ApplicationError("INTERNAL_ERROR", "Opportunity review request failed");
  return NextResponse.json({
    error: { code: applicationError.code, message: applicationError.message },
  }, { status: applicationError.status });
}
