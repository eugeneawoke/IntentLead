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

function observedCondition(opportunity: Detail): string | null {
  for (const item of opportunity.evidence) {
    const value = item.facts.problem?.observedCondition ?? item.facts.observedCondition;
    if (value) return value;
  }
  return null;
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
    ["Observed condition", facts.observedCondition],
    ["Observed problem category", facts.problemCategory?.replaceAll("_", " ")],
    ["Observed condition (fact)", facts.problem?.observedCondition],
    ["Measurement", measurement],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0);

  return (
    <article className="workspace-evidence-card">
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
      ) : <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Source link unavailable</p>}
      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Source facts</h4>
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

  const observed = opportunity ? observedCondition(opportunity) : null;

  return (
    <div className="workspace-page mx-auto w-full max-w-6xl" data-visual-language="signal-dark">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={basePath} className="min-h-11 inline-flex items-center text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: "var(--text-muted)" }}>← All Opportunities</Link>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="workspace-secondary-action">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">{loading ? "Loading Opportunity" : opportunity ? "Opportunity loaded" : ""}</p>
      {error ? (
        <section className="workspace-error-panel">
          <h1 className="font-display text-xl font-semibold" style={{ color: "var(--text)" }}>Could not load Opportunity</h1>
          <p role="alert" className="mt-2 text-sm" style={{ color: "var(--error)" }}>{error}</p>
          <button type="button" onClick={() => void refresh()} className="workspace-secondary-action mt-4">Try again</button>
        </section>
      ) : loading && !opportunity ? (
        <p role="status" className="workspace-empty-state text-sm" style={{ color: "var(--text-muted)" }}>Loading Opportunity…</p>
      ) : opportunity ? (
        <>
          <header className="workspace-detail-header">
            <p className="workspace-eyebrow"><span className="workspace-live-dot" aria-hidden="true" /> Discovery-only · {opportunity.state.replaceAll("_", " ")}</p>
            <h1 className="mt-4 break-words font-display text-3xl font-semibold tracking-[-0.035em] sm:text-4xl" style={{ color: "var(--text)" }}>{opportunity.company?.name ?? "Company details unavailable"}</h1>
            {opportunity.company?.domain && <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{opportunity.company.domain}</p>}
            <div className="workspace-detail-meta"><span>Signal · {opportunity.signal.family.replaceAll("_", " ")}</span><span>{opportunity.evidenceCount} active evidence</span><span>{opportunity.evidenceStatus.toLowerCase()}</span></div>
          </header>

          {opportunity.evidenceStatus !== "COMPLETE" && (
            <aside className="mb-5 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-muted)" }}>
              {opportunity.evidenceStatus === "MISSING" ? "No active evidence is available. Do not treat missing sources as proof." : "Some linked evidence is missing or was removed. Review only the sources still shown below."}
            </aside>
          )}

          <div className="workspace-detail-stack">
            <section data-opportunity-section="observed-condition" className="workspace-detail-section" aria-labelledby="observed-condition-heading">
              <p className="workspace-section-index">01 · Fact</p><h2 id="observed-condition-heading">Observed condition</h2>
              <p className="workspace-primary-fact">{observed ?? "No normalized observed condition is available."}</p>
              <p className="workspace-section-note">Shown from active source facts, not generated interpretation.</p>
            </section>

            <section data-opportunity-section="commercial-relevance" className="workspace-detail-section" aria-labelledby="commercial-relevance-heading">
              <p className="workspace-section-index">02 · Interpretation</p><h2 id="commercial-relevance-heading">Commercial relevance</h2>
              <dl className="workspace-definition-grid"><div><dt>Problem interpretation</dt><dd>{opportunity.assessment?.problemStatement ?? "No commercial interpretation is available."}</dd></div><div><dt>Commercial impact</dt><dd>{opportunity.assessment ? `${Math.round(opportunity.assessment.commercialImpact * 100)}% model score` : "Not assessed"}</dd></div></dl>
            </section>

            <section data-opportunity-section="evidence-provenance" aria-labelledby="source-evidence-heading">
              <div className="workspace-section-heading"><div><p className="workspace-section-index">03 · Sources</p><h2 id="source-evidence-heading">Evidence and source facts</h2></div><span>{opportunity.evidenceCount} active</span></div>
              {opportunity.evidence.length ? <div className="space-y-3">{opportunity.evidence.map(item => <EvidenceFacts key={item.id} item={item} />)}</div> : <p className="workspace-detail-section text-sm" style={{ color: "var(--text-muted)" }}>No active source items are available.</p>}
            </section>

            <section data-opportunity-section="company-resolution" className="workspace-detail-section" aria-labelledby="company-resolution-heading">
              <p className="workspace-section-index">04 · Resolution</p><h2 id="company-resolution-heading">Company resolution and uncertainty</h2>
              <dl className="workspace-definition-grid"><div><dt>Company</dt><dd>{opportunity.company?.name ?? "Unavailable"}</dd></div><div><dt>Domain</dt><dd className="break-all">{opportunity.company?.domain ?? "Unavailable"}</dd></div><div><dt>Resolution confidence</dt><dd>{opportunity.company ? `${Math.round(opportunity.company.confidence * 100)}%` : "Not available"}</dd></div></dl>
            </section>

            <section data-opportunity-section="assessment" className="workspace-detail-section" aria-labelledby="assessment-heading">
              <p className="workspace-section-index">05 · Model</p><h2 id="assessment-heading">Fit and assessment</h2>
              <p className="workspace-section-note">Separate from observed source facts; use your judgment.</p>
              {opportunity.assessment ? <dl className="workspace-score-grid">{([["Decision", opportunity.assessment.decision], ["Confidence", `${Math.round(opportunity.assessment.confidence * 100)}%`], ["Evidence strength", `${Math.round(opportunity.assessment.evidenceStrength * 100)}%`], ["Freshness", `${Math.round(opportunity.assessment.freshness * 100)}%`], ["Commercial impact", `${Math.round(opportunity.assessment.commercialImpact * 100)}%`], ["ICP fit", `${Math.round(opportunity.assessment.icpFit * 100)}%`], ["Actionability", `${Math.round(opportunity.assessment.actionability * 100)}%`]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>No current assessment is available.</p>}
            </section>

            <section data-opportunity-section="limitations" className="workspace-detail-section" aria-labelledby="limitations-heading">
              <p className="workspace-section-index">06 · Constraints</p><h2 id="limitations-heading">Confidence and limitations</h2>
              {opportunity.limitations.length ? <ul className="workspace-limitations">{opportunity.limitations.map(item => <li key={item}>{item}</li>)}</ul> : <p className="workspace-section-note">No limitations were returned. This does not imply certainty.</p>}
            </section>

            <section data-opportunity-section="buyer-contact" className="workspace-detail-section" aria-labelledby="buyer-contact-heading">
              <p className="workspace-section-index">07 · Package</p><h2 id="buyer-contact-heading">Buyer and contact evidence</h2>
              <p className="workspace-section-note">Buyer and verified contact are not available in this review payload.</p>
            </section>

            <section data-opportunity-section="grounded-draft" className="workspace-detail-section" aria-labelledby="grounded-draft-heading">
              <p className="workspace-section-index">08 · Grounding</p><h2 id="grounded-draft-heading">Grounded brief and draft</h2>
              <p className="workspace-section-note">No grounded brief or draft is available for this Opportunity.</p>
            </section>

            <div data-opportunity-section="human-review"><OpportunityReviewControls opportunity={opportunity} onSaved={() => { void refresh(); }} /></div>
          </div>
        </>
      ) : null}
    </div>
  );
}
