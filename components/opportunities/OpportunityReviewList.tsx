"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { OpportunityReviewList } from "@/types/opportunity-review";
import { loadOpportunityList, OpportunityReviewApiError } from "./opportunity-review-api";

function statusLabel(state: string): string {
  if (state === "REJECTED") return "Rejected";
  if (state === "NEEDS_RESEARCH") return "Needs research";
  return "Awaiting review";
}

export default function OpportunityReviewListPage({ basePath = "/workspace/opportunities" }: { basePath?: string }) {
  const [data, setData] = useState<OpportunityReviewList | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadOpportunityList());
    } catch (cause) {
      const message = cause instanceof OpportunityReviewApiError ? cause.message : "Could not load Opportunities. Try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const loadMore = async () => {
    if (!data?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await loadOpportunityList(data.nextCursor);
      setData(current => current ? {
        items: [...current.items, ...next.items],
        hasMore: next.hasMore,
        nextCursor: next.nextCursor,
      } : next);
    } catch (cause) {
      setMoreError(cause instanceof OpportunityReviewApiError ? cause.message : "Could not load more results.");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-2xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            Opportunities
          </h1>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
            Review public evidence and company-level findings. A human review does not enable contact or outreach.
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="min-h-11 rounded-lg border px-4 text-sm font-medium disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <p className="sr-only" role="status" aria-live="polite">
        {loading ? "Loading Opportunities" : data ? `${data.items.length} Opportunities loaded` : ""}
      </p>
      {error ? (
        <section className="rounded-2xl border p-5" style={{ borderColor: "var(--error)", background: "var(--surface)" }}>
          <h2 className="font-display text-lg font-semibold" style={{ color: "var(--text)" }}>Could not load Opportunities</h2>
          <p role="alert" className="mt-2 text-sm" style={{ color: "var(--error)" }}>{error}</p>
          <button type="button" onClick={() => void refresh()} className="mt-4 min-h-11 rounded-lg border px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
            Try again
          </button>
        </section>
      ) : loading && !data ? (
        <p className="rounded-2xl border p-6 text-sm" role="status" style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}>
          Loading Opportunities…
        </p>
      ) : data?.items.length === 0 ? (
        <section className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="font-display text-lg font-semibold" style={{ color: "var(--text)" }}>No Opportunities to review</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>New discoveries will appear here when evidence is ready for human review.</p>
        </section>
      ) : (
        <section aria-label="Opportunity results" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data?.items.map(item => (
            <Link key={item.id} href={`${basePath}/${item.id}`} className="group block rounded-2xl border p-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ borderColor: "var(--border)", background: "var(--surface)", textDecoration: "none" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="font-display text-lg font-semibold group-hover:underline" style={{ color: "var(--text)" }}>
                  {item.company?.name ?? "Company details unavailable"}
                </h2>
                <span className="rounded-full border px-2.5 py-1 text-xs" style={{ borderColor: "var(--border)", color: item.state === "REJECTED" ? "var(--text-muted)" : "var(--accent)" }}>
                  {statusLabel(item.state)}
                </span>
              </div>
              {item.company?.domain && <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{item.company.domain}</p>}
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div><span className="block text-xs" style={{ color: "var(--text-faint)" }}>Signal</span><span style={{ color: "var(--text)" }}>{item.signal.subtype.replaceAll("_", " ")}</span></div>
                <div><span className="block text-xs" style={{ color: "var(--text-faint)" }}>Evidence</span><span style={{ color: "var(--text)" }}>{item.evidenceCount} active · {item.evidenceStatus.toLowerCase()}</span></div>
              </div>
              {item.assessment && (
                <p className="mt-4 border-t pt-3 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                  Model assessment: {item.assessment.decision.toLowerCase()} · human review remains separate
                </p>
              )}
              {item.latestReview && (
                <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>Reviewed: {item.latestReview.decision.toLowerCase()}</p>
              )}
            </Link>
          ))}
        </section>
      )}

      {data?.hasMore && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="min-h-11 rounded-lg border px-4 text-sm font-medium disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
          {moreError && <p role="alert" style={{ color: "var(--error)" }}>{moreError}</p>}
        </div>
      )}
    </div>
  );
}
