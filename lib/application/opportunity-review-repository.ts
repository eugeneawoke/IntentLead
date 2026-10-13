import type { SupabaseClient } from "@supabase/supabase-js";
import { ApplicationError } from "./errors";
import type { OpportunityReviewCursor, OpportunityReviewRepository } from "./opportunity-review";
import type { OpportunityReviewCommand } from "@/types/opportunity-review";

type DatabaseError = { code?: string; message?: string } | null;

function mappedError(error: DatabaseError, fallback: string): ApplicationError {
  const marker = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (/p0002|opportunity_not_found|opportunity_inaccessible/.test(marker)) {
    return new ApplicationError("NOT_FOUND", "Opportunity not found");
  }
  if (/42501|review_forbidden|membership_required|policy_denied/.test(marker)) {
    return new ApplicationError("POLICY_DENIED", "Opportunity review is not available");
  }
  if (/40001|idempotency_conflict|review_conflict|stale_opportunity/.test(marker)) {
    return new ApplicationError("CONFLICT", "Opportunity review conflicts with its current state");
  }
  if (/22023|invalid_review|invalid_page|invalid_cursor/.test(marker)) {
    return new ApplicationError("INVALID_INPUT", "Review request is invalid");
  }
  return new ApplicationError("INTERNAL_ERROR", fallback);
}

async function invoke<T>(result: PromiseLike<{ data: T | null; error: DatabaseError }>, fallback: string): Promise<T> {
  const { data, error } = await result;
  if (error) throw mappedError(error, fallback);
  if (data === null) throw new ApplicationError("INTERNAL_ERROR", fallback);
  return data;
}

export function createOpportunityReviewRepository(client: SupabaseClient): OpportunityReviewRepository {
  return {
    async list(input: { limit: number; after: OpportunityReviewCursor | null }) {
      return invoke(client.rpc("intentlead_list_opportunities_for_review", {
        p_limit: input.limit,
        p_after_created_at: input.after?.createdAt ?? null,
        p_after_id: input.after?.id ?? null,
      }), "Could not load Opportunities");
    },
    async get(opportunityId: string) {
      const { data, error } = await client.rpc("intentlead_get_opportunity_for_review", {
        p_opportunity_id: opportunityId,
      });
      if (error) throw mappedError(error, "Could not load Opportunity");
      return data;
    },
    async review(opportunityId: string, command: OpportunityReviewCommand) {
      return invoke(client.rpc("intentlead_record_opportunity_review", {
        p_opportunity_id: opportunityId,
        p_decision: command.decision,
        p_reason: command.reason,
        p_note: command.note,
        p_idempotency_key: command.idempotencyKey,
      }), "Could not save review");
    },
  };
}
