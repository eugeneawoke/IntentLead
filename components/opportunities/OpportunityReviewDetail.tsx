"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { OpportunityReviewDetail as Detail } from "@/types/opportunity-review";
import { loadOpportunity, OpportunityReviewApiError } from "./opportunity-review-api";
import OpportunityReviewControls from "./OpportunityReviewControls";

function safeLink(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function EvidenceFacts({ item }: { item: Detail["evidence"][number] }) {
  const facts = item.facts;
  const location = facts.location
    ? [facts.location.locality, facts.location.subdivisionCode, facts.location.countryCode].filter(Boolean).join(", ")
    : null;
  const measurement = facts.measurement
    ? `${facts.measurement.metric.replaceAll("_", " ")}: ${facts.measurement.value} (${new Date(facts.measurement.observedAt).toLocaleDateString()})`
    : null;
  const entries = [
    ["Company", facts.companyName],
    ["Domain", facts.companyDomain],
    ["Employees", facts.employeeCount?.toLocaleString()],
    ["Technologies", facts.technologies?.join(", ")],
    ["Location", location],
    ["Observed problem category", facts.problemCategory?.replaceAll("_", " ")],
    ["Measurement", measurement],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0);

  return (
    <article className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{item.provider} source</h3>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{Math.round(item.confidence * 100)}% confidence</span>
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
        Captured <time dateTime={item.capturedAt}>{new Date(item.capturedAt).toLocaleString()}</time> · {item.verificationMethod.replaceAll("_", " ")}
      </p>
      {safeLink(item.sourceUrl) ? (
        <a className="mt-2 inline-block break-all text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" href={safeLink(item.sourceUrl)!} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
          Open public source <span className="sr-only">in a new tab</span>
        </a>
      ) : <p className="mt-2 text-sm" style={{ color: "var(--text-faint)" }}>Source link unavailable</p>}
      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Source facts</h4>
      {entries.length ? (
        <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {entries.map(([label, value]) => <div key={label}><dt className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</dt><dd className="break-words text-sm" style={{ color: "var(--text)" }}>{value}</dd></div>)}
        </dl>
      ) : <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>No normalized facts are available for this source.</p>}
    </article>
  );
}

export default function OpportunityReviewDetailPage({ basePath = "/workspace/opportunities" }: { basePath?: string }) {
  const { id } = useParams<{ id: string }>();
  const [opportunity, setOpportunity] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOpportunity(await loadOpportunity(id));
    } catch (cause) {
      setError(cause instanceof OpportunityReviewApiError ? cause.message : "Could not load this Opportunity. Try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={basePath} className="min-h-11 inline-flex items-center text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: "var(--text-muted)" }}>← All Opportunities</Link>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="min-h-11 rounded-lg border px-4 text-sm font-medium disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{loading ? "Loading Opportunity" : opportunity ? "Opportunity loaded" : ""}</p>
      {error ? (
        <section className="rounded-2xl border p-5" style={{ borderColor: "var(--error)", background: "var(--surface)" }}>
          <h1 className="font-display text-xl font-semibold" style={{ color: "var(--text)" }}>Could not load Opportunity</h1>
          <p role="alert" className="mt-2 text-sm" style={{ color: "var(--error)" }}>{error}</p>
          <button type="button" onClick={() => void refresh()} className="mt-4 min-h-11 rounded-lg border px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Try again</button>
        </section>
      ) : loading && !opportunity ? (
        <p role="status" className="rounded-2xl border p-6 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}>Loading Opportunity…</p>
      ) : opportunity ? (
        <>
          <header className="mb-6">
            <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Discovery-only · {opportunity.state.replaceAll("_", " ")}</p>
            <h1 className="mt-2 break-words font-display text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: "var(--text)" }}>{opportunity.company?.name ?? "Company details unavailable"}</h1>
            {opportunity.company?.domain && <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{opportunity.company.domain}</p>}
            <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-muted)" }}>Signal: {opportunity.signal.family.replaceAll("_", " ")} · {opportunity.signal.subtype.replaceAll("_", " ")}</p>
          </header>

          {opportunity.evidenceStatus !== "COMPLETE" && (
            <aside className="mb-5 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-muted)" }}>
              {opportunity.evidenceStatus === "MISSING" ? "No active evidence is available. Do not treat missing sources as proof." : "Some linked evidence is missing or was removed. Review only the sources still shown below."}
            </aside>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.85fr)]">
            <div className="space-y-5">
              <section aria-labelledby="source-evidence-heading">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 id="source-evidence-heading" className="font-display text-lg font-semibold" style={{ color: "var(--text)" }}>Evidence and source facts</h2>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{opportunity.evidenceCount} active</span>
                </div>
                {opportunity.evidence.length ? <div className="space-y-3">{opportunity.evidence.map(item => <EvidenceFacts key={item.id} item={item} />)}</div> : <p className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}>No active source items are available.</p>}
              </section>
              <section aria-labelledby="limitations-heading" className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <h2 id="limitations-heading" className="text-sm font-semibold" style={{ color: "var(--text)" }}>Limitations</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" style={{ color: "var(--text-muted)" }}>{opportunity.limitations.map(item => <li key={item}>{item}</li>)}</ul>
              </section>
            </div>

            <div className="space-y-5">
              <section aria-labelledby="assessment-heading" className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <h2 id="assessment-heading" className="font-display text-lg font-semibold" style={{ color: "var(--text)" }}>Model interpretation</h2>
                <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Separate from observed source facts; use your judgment.</p>
                {opportunity.assessment ? (
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2"><dt className="text-xs" style={{ color: "var(--text-muted)" }}>Assessment</dt><dd style={{ color: "var(--text)" }}>{opportunity.assessment.decision}</dd></div>
                    {([["Confidence", opportunity.assessment.confidence], ["Evidence strength", opportunity.assessment.evidenceStrength], ["Freshness", opportunity.assessment.freshness], ["Commercial impact", opportunity.assessment.commercialImpact], ["ICP fit", opportunity.assessment.icpFit], ["Actionability", opportunity.assessment.actionability]] as const).map(([label, value]) => <div key={label}><dt className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</dt><dd style={{ color: "var(--text)" }}>{Math.round(value * 100)}%</dd></div>)}
                  </dl>
                ) : <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>No current assessment is available.</p>}
              </section>
              <OpportunityReviewControls opportunity={opportunity} onSaved={() => { void refresh(); }} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
