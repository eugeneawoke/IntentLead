import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { createOpportunityReviewRepository } from "@/lib/application/opportunity-review-repository";
import { listOpportunitiesForReview } from "@/lib/application/opportunity-review";
import { reviewErrorResponse } from "@/lib/api/opportunity-review-response";

export async function GET(request: NextRequest) {
  const { user, supabase, response } = await requireUser();
  if (response) return response;
  try {
    const data = await listOpportunitiesForReview(
      user.id,
      request.nextUrl.searchParams,
      createOpportunityReviewRepository(supabase),
    );
    return NextResponse.json({ data });
  } catch (error) {
    return reviewErrorResponse(error);
  }
}
