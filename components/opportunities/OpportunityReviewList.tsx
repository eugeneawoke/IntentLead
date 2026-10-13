"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, CircleDot, RefreshCw, ShieldCheck } from "lucide-react";
import type { OpportunityReviewList } from "@/types/opportunity-review";
import { loadOpportunityList, OpportunityReviewApiError } from "./opportunity-review-api";

function statusLabel(state: string, latestDecision?: string): string {
  if (latestDecision === "ACCEPTED") return "Accepted";
  if (latestDecision === "REJECTED") return "Rejected";
  if (latestDecision === "NEEDS_RESEARCH") return "Needs research";
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
    <div className="workspace-page mx-auto w-full max-w-7xl">
      <header className="workspace-page-header mb-8">
        <div className="max-w-2xl">
          <p className="workspace-eyebrow"><span className="workspace-live-dot" aria-hidden="true" /> Human review queue</p>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.035em] sm:text-4xl" style={{ color: "var(--text)" }}>
            Opportunities
          </h1>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
            Inspect the signal, company resolution and public evidence before deciding whether the Opportunity should advance. Buyer, verified contact and grounded draft remain separate package stages; no sending action exists.
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="workspace-secondary-action">
          <RefreshCw size={15} aria-hidden="true" className={loading ? "animate-spin" : ""} /> {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {data && data.items.length > 0 && (
        <div className="workspace-summary-strip mb-5" aria-label="Current review page summary">
          <div><span>Loaded</span><strong>{data.items.length}</strong></div>
          <div><span>Awaiting review</span><strong>{data.items.filter(item => !item.latestReview).length}</strong></div>
          <div><span>Evidence complete</span><strong>{data.items.filter(item => item.evidenceStatus === "COMPLETE").length}</strong></div>
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {loading ? "Loading Opportunities" : data ? `${data.items.length} Opportunities loaded` : ""}
      </p>
      {error ? (
        <section className="workspace-error-panel">
          <h2 className="font-display text-lg font-semibold" style={{ color: "var(--text)" }}>Could not load Opportunities</h2>
          <p role="alert" className="mt-2 text-sm" style={{ color: "var(--error)" }}>{error}</p>
          <button type="button" onClick={() => void refresh()} className="workspace-secondary-action mt-4">
            Try again
          </button>
        </section>
      ) : loading && !data ? (
        <div className="grid gap-4 lg:grid-cols-2" role="status" aria-label="Loading Opportunities">{[0, 1, 2, 3].map(item => <div key={item} className="workspace-opportunity-card min-h-52"><span className="workspace-skeleton h-3 w-24" /><span className="workspace-skeleton mt-6 h-5 w-48" /><span className="workspace-skeleton mt-4 h-3 w-72 max-w-full" /></div>)}</div>
      ) : data?.items.length === 0 ? (
        <section className="workspace-empty-state">
          <CircleDot size={24} aria-hidden="true" style={{ color: "var(--text-faint)" }} />
          <h2 className="font-display text-lg font-semibold" style={{ color: "var(--text)" }}>No Opportunities to review</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>New discoveries will appear here when evidence is ready for human review.</p>
          <Link href="/workspace/discovery" className="workspace-secondary-action mt-5">Open discovery <ArrowRight size={15} aria-hidden="true" /></Link>
        </section>
      ) : (
        <section aria-label="Opportunity results" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data?.items.map((item, index) => (
            <Link key={item.id} href={`${basePath}/${item.id}`} className="workspace-opportunity-card group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3"><span className="workspace-card-index">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>Resolved company</p><h2 className="mt-1 break-words font-display text-lg font-semibold" style={{ color: "var(--text)" }}>{item.company?.name ?? "Company details unavailable"}</h2>{item.company?.domain && <p className="mt-1 break-all text-xs" style={{ color: "var(--text-muted)" }}>{item.company.domain}</p>}</div></div>
                <span className={`workspace-status-chip ${item.latestReview?.decision === "ACCEPTED" ? "is-positive" : item.state === "REJECTED" ? "is-muted" : ""}`}>
                  {statusLabel(item.state, item.latestReview?.decision)}
                </span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--border)" }}>
                <div className="workspace-card-metric"><CircleDot size={14} aria-hidden="true" /><span>Signal</span><strong>{item.signal.subtype.replaceAll("_", " ")}</strong></div>
                <div className="workspace-card-metric"><ShieldCheck size={14} aria-hidden="true" /><span>Evidence</span><strong>{item.evidenceCount} active · {item.evidenceStatus.toLowerCase()}</strong></div>
              </div>
              {item.assessment && (
                <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}><Building2 size={14} aria-hidden="true" /><span>Model assessment: {item.assessment.decision.toLowerCase()} · human review remains separate</span></div>
              )}
              <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}><span>{item.latestReview ? `Reviewed: ${item.latestReview.decision.toLowerCase()}` : "Open evidence before deciding"}</span><span className="inline-flex items-center gap-1 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--accent)" }}>Inspect <ArrowRight size={14} aria-hidden="true" /></span></div>
            </Link>
          ))}
        </section>
      )}

      {data?.hasMore && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="workspace-secondary-action">
            {loadingMore ? "Loading…" : "Load more"}
          </button>
          {moreError && <p role="alert" style={{ color: "var(--error)" }}>{moreError}</p>}
        </div>
      )}
    </div>
  );
}
