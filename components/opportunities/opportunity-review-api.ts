import {
  OpportunityReviewDetailSchema,
  OpportunityReviewListSchema,
  OpportunityReviewResultSchema,
} from "@/lib/domain/schemas/opportunity-review";
import type {
  OpportunityReviewCommand,
  OpportunityReviewDetail,
  OpportunityReviewList,
  OpportunityReviewResult,
} from "@/types/opportunity-review";

export class OpportunityReviewApiError extends Error {
  constructor(readonly code: string) {
    super(code === "CONFLICT" ? "This Opportunity has already changed. Refresh to see its current status." : "Could not complete the request. Try again.");
    this.name = "OpportunityReviewApiError";
  }
}

async function readData<T>(response: Response, schema: { safeParse(value: unknown): { success: boolean; data?: T } }): Promise<T> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || payload === null || typeof payload !== "object" || !("data" in payload)) {
    const error = payload !== null && typeof payload === "object" && "error" in payload ? payload.error : null;
    const code = error !== null && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code : "REQUEST_FAILED";
    throw new OpportunityReviewApiError(code);
  }
  const parsed = schema.safeParse(payload.data);
  if (!parsed.success || parsed.data === undefined) throw new OpportunityReviewApiError("INVALID_RESPONSE");
  return parsed.data;
}

export async function loadOpportunityList(cursor?: string): Promise<OpportunityReviewList> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return readData(await fetch(`/api/opportunities${query}`, { cache: "no-store" }), OpportunityReviewListSchema);
}

export async function loadOpportunity(id: string): Promise<OpportunityReviewDetail> {
  return readData(await fetch(`/api/opportunities/${encodeURIComponent(id)}`, { cache: "no-store" }), OpportunityReviewDetailSchema);
}

export async function saveOpportunityReview(id: string, command: OpportunityReviewCommand): Promise<OpportunityReviewResult> {
  return readData(await fetch(`/api/opportunities/${encodeURIComponent(id)}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": command.idempotencyKey },
    body: JSON.stringify(command),
  }), OpportunityReviewResultSchema);
}
