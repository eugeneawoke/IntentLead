import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { createOpportunityReviewRepository } from "@/lib/application/opportunity-review-repository";
import { submitOpportunityReview } from "@/lib/application/opportunity-review";
import { reviewErrorResponse } from "@/lib/api/opportunity-review-response";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, supabase, response } = await requireUser();
  if (response) return response;
  try {
    const { id } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Review request is invalid" } }, { status: 400 });
    }
    const data = await submitOpportunityReview(
      user.id,
      id,
      body,
      request.headers.get("Idempotency-Key"),
      createOpportunityReviewRepository(supabase),
    );
    return NextResponse.json({ data });
  } catch (error) {
    return reviewErrorResponse(error);
  }
}
