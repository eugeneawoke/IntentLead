import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { createOpportunityReviewRepository } from "@/lib/application/opportunity-review-repository";
import { getOpportunityForReview } from "@/lib/application/opportunity-review";
import { reviewErrorResponse } from "@/lib/api/opportunity-review-response";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, supabase, response } = await requireUser();
  if (response) return response;
  try {
    const { id } = await context.params;
    const data = await getOpportunityForReview(user.id, id, createOpportunityReviewRepository(supabase));
    return NextResponse.json({ data });
  } catch (error) {
    return reviewErrorResponse(error);
  }
}
