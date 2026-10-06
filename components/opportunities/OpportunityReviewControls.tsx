"use client";

import { useRef, useState } from "react";
import type { OpportunityReviewCommand, OpportunityReviewDetail } from "@/types/opportunity-review";
import { OpportunityReviewApiError, saveOpportunityReview } from "./opportunity-review-api";

type ReviewReason = Exclude<OpportunityReviewCommand["reason"], "RELEVANT">;
type ReviewDecision = "REJECTED" | "NEEDS_RESEARCH";

const reasons: { value: ReviewReason; label: string }[] = [
  { value: "WRONG_COMPANY", label: "Wrong company" },
  { value: "WEAK_SIGNAL", label: "Weak signal" },
  { value: "NOT_RELEVANT", label: "Not relevant" },
  { value: "TOO_OLD", label: "Too old" },
  { value: "ALREADY_SOLVED", label: "Already solved" },
  { value: "DUPLICATE", label: "Duplicate" },
  { value: "POOR_OFFER_FIT", label: "Poor offer fit" },
  { value: "POOR_ICP_FIT", label: "Poor ICP fit" },
  { value: "LOW_COMMERCIAL_IMPACT", label: "Low commercial impact" },
  { value: "BAD_TIMING", label: "Bad timing" },
  { value: "UNSUPPORTED_INFERENCE", label: "Unsupported inference" },
  { value: "POLICY_CONCERN", label: "Policy concern" },
  { value: "OTHER", label: "Other" },
];

export default function OpportunityReviewControls({
  opportunity,
  onSaved,
}: {
  opportunity: OpportunityReviewDetail;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const commandKey = useRef<{ signature: string; key: string } | null>(null);
  const isReviewed = opportunity.latestReview !== null;
  const canAcceptEvidence = opportunity.evidenceStatus !== "MISSING" && opportunity.evidenceCount > 0;

  const submit = async (decision: "ACCEPTED" | ReviewDecision) => {
    setAttempted(true);
    setError(null);
    setStatus("");
    if (decision === "ACCEPTED" && !canAcceptEvidence) {
      setError("At least one active evidence item is required before accepting this finding.");
      return;
    }
    if (decision !== "ACCEPTED" && (!reason || (reason === "OTHER" && !note.trim()))) return;

    const base = decision === "ACCEPTED"
      ? { decision, reason: "RELEVANT" as const, note: null }
      : { decision, reason: reason as ReviewReason, note: reason === "OTHER" ? note.trim() : null };
    const signature = JSON.stringify(base);
    if (!commandKey.current || commandKey.current.signature !== signature) {
      commandKey.current = { signature, key: `review-${crypto.randomUUID()}` };
    }
    const command = { ...base, idempotencyKey: commandKey.current.key } as OpportunityReviewCommand;

    setBusy(true);
    setStatus("Saving review…");
    try {
      await saveOpportunityReview(opportunity.id, command);
      setStatus("Review saved. No contact or outreach action was enabled.");
      commandKey.current = null;
      onSaved();
    } catch (cause) {
      setStatus("");
      setError(cause instanceof OpportunityReviewApiError ? cause.message : "Could not save this review. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (isReviewed || opportunity.state !== "HUMAN_REVIEW") {
    return (
      <section aria-labelledby="review-status-title" className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h2 id="review-status-title" className="font-display text-lg font-semibold" style={{ color: "var(--text)" }}>Review status</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          {opportunity.latestReview
            ? `This Opportunity was reviewed as ${opportunity.latestReview.decision.toLowerCase().replaceAll("_", " ")}.`
            : `This Opportunity is ${opportunity.state.toLowerCase().replaceAll("_", " ")} and cannot receive another review.`}
        </p>
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>Human review does not enable contact, drafts, outreach, or credit changes.</p>
      </section>
    );
  }

  const reasonInvalid = attempted && !reason;
  const noteInvalid = attempted && reason === "OTHER" && !note.trim();
  return (
    <section aria-labelledby="review-actions-title" className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h2 id="review-actions-title" className="font-display text-lg font-semibold" style={{ color: "var(--text)" }}>Your review</h2>
      <p id="review-control-info" className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
        Accept records a human decision only. It does not identify a buyer or enable contact, drafts, outreach, outcomes, or billing.
      </p>
      {!canAcceptEvidence && (
        <p id="review-accept-evidence-help" className="mt-2 text-sm" style={{ color: "var(--warning)" }}>
          At least one active evidence item is required before accepting this finding. Reject or request more research instead.
        </p>
      )}
      <button type="button" onClick={() => void submit("ACCEPTED")} disabled={busy || !canAcceptEvidence} aria-describedby={!canAcceptEvidence ? "review-accept-evidence-help" : "review-control-info"} className="mt-4 min-h-11 rounded-lg px-4 text-sm font-semibold disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: "var(--accent)", color: "var(--bg)" }}>
        {busy && status === "Saving review…" ? "Saving…" : "Accept finding"}
      </button>

      <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border)" }}>
        <label htmlFor="review-reason" className="block text-sm font-medium" style={{ color: "var(--text)" }}>Reason for rejection or more research</label>
        <p id="review-reason-help" className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Choose a reason before using either action below.</p>
        <select
          id="review-reason"
          value={reason}
          onChange={event => { setReason(event.target.value); if (event.target.value !== "OTHER") setNote(""); }}
          aria-invalid={reasonInvalid}
          aria-describedby="review-reason-help review-error"
          className="mt-2 min-h-11 w-full rounded-lg border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ borderColor: reasonInvalid ? "var(--error)" : "var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
        >
          <option value="">Select a reason</option>
          {reasons.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {reason === "OTHER" && (
          <div className="mt-4">
            <label htmlFor="review-note" className="block text-sm font-medium" style={{ color: "var(--text)" }}>Brief note (do not include contact details)</label>
            <textarea
              id="review-note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={event => setNote(event.target.value)}
              aria-invalid={noteInvalid}
              aria-describedby="review-note-help review-error"
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ borderColor: noteInvalid ? "var(--error)" : "var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
            />
            <p id="review-note-help" className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Up to 500 characters. Email addresses, URLs, handles, and phone numbers are rejected.</p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => void submit("REJECTED")} disabled={busy} className="min-h-11 rounded-lg border px-4 text-sm font-medium disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface-2)" }}>Reject</button>
          <button type="button" onClick={() => void submit("NEEDS_RESEARCH")} disabled={busy} className="min-h-11 rounded-lg border px-4 text-sm font-medium disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface-2)" }}>Needs research</button>
        </div>
      </div>
      <p id="review-error" role="alert" className="mt-3 min-h-5 text-sm" style={{ color: "var(--error)" }}>{error ?? (reasonInvalid ? "Choose a reason to reject or request more research." : noteInvalid ? "Add a brief note when selecting Other." : "")}</p>
      <p className="sr-only" role="status" aria-live="polite">{status}</p>
    </section>
  );
}
