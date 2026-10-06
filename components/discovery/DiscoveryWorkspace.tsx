"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DiscoveryBriefSummary } from "@/types/discovery-brief";
import type { CreateDiscoveryBriefInput } from "@/lib/application/discovery-briefs";
import {
  createDiscoveryBrief, DiscoveryApiError, loadDiscoveryBriefs, runDiscoveryBrief,
} from "./discovery-api";

const signalFamilies = [
  ["EXPRESSED_INTENT", "Expressed intent"],
  ["BUSINESS_EVENT", "Business events"],
  ["DETECTED_PROBLEM", "Detected commercial problems"],
  ["MARKET_OBSERVATION", "Market observations"],
] as const;

function lines(value: string): string[] {
  return value.split("\n").map(item => item.trim()).filter(Boolean);
}

function Field(props: { id: string; label: string; value: string; onChange(value: string): void; multiline?: boolean; hint?: string }) {
  const shared = {
    id: props.id,
    value: props.value,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => props.onChange(event.target.value),
    required: true,
    className: "mt-2 w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    style: { borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text)" },
  };
  return (
    <label htmlFor={props.id} className="block text-sm font-medium" style={{ color: "var(--text)" }}>
      {props.label}
      {props.multiline ? <textarea {...shared} rows={3} /> : <input {...shared} />}
      {props.hint && <span className="mt-1 block text-xs font-normal" style={{ color: "var(--text-muted)" }}>{props.hint}</span>}
    </label>
  );
}

export default function DiscoveryWorkspace({ basePath = "/workspace" }: { basePath?: string }) {
  const [briefs, setBriefs] = useState<DiscoveryBriefSummary[]>([]);
  const [offerName, setOfferName] = useState("IntentLead Opportunity Intelligence");
  const [offerSummary, setOfferSummary] = useState("Find evidence-backed companies with a concrete reason to consider Opportunity Intelligence.");
  const [outcomes, setOutcomes] = useState("Higher-quality prospect research\nLess manual company qualification");
  const [icpName, setIcpName] = useState("B2B growth teams");
  const [icpDescription, setIcpDescription] = useState("Small B2B growth teams and outbound agencies that need fewer, better-qualified company opportunities.");
  const [companyAttributes, setCompanyAttributes] = useState("B2B company\nEvidence-driven prospecting workflow");
  const [objective, setObjective] = useState("Find companies showing a current, evidence-backed need for better prospect research and qualification.");
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>(["EXPRESSED_INTENT"]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setBriefs(await loadDiscoveryBriefs()); }
    catch (cause) { setError(cause instanceof DiscoveryApiError ? cause.message : "Could not load discovery briefs."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (selectedFamilies.length === 0) {
      setError("Select at least one signal family.");
      return;
    }
    setBusy("create");
    setError(null);
    setStatus("");
    const command: CreateDiscoveryBriefInput = {
      schemaVersion: 1,
      offer: { name: offerName.trim(), summary: offerSummary.trim(), outcomes: lines(outcomes), exclusions: [] },
      icp: { name: icpName.trim(), description: icpDescription.trim(), companyAttributes: lines(companyAttributes), exclusions: [] },
      objective: objective.trim(),
      criteria: {
        jurisdictions: [], languages: ["en"],
        signalFamilies: selectedFamilies as CreateDiscoveryBriefInput["criteria"]["signalFamilies"],
        exclusions: [], limits: { maxSourceItems: 20, maxOpportunities: 5 },
      },
    };
    try {
      const created = await createDiscoveryBrief(command);
      setStatus(created.created ? "Discovery brief created." : "Existing discovery brief restored.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof DiscoveryApiError ? cause.message : "Could not create the discovery brief.");
    } finally { setBusy(null); }
  };

  const start = async (brief: DiscoveryBriefSummary) => {
    setBusy(brief.id);
    setError(null);
    setStatus("");
    try {
      await runDiscoveryBrief(brief.id);
      setStatus(`Discovery queued for “${brief.objective}”. Synthetic contract evidence only; network cost remains $0.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof DiscoveryApiError ? cause.message : "Could not start discovery.");
    } finally { setBusy(null); }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <header className="mb-7 max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>EN discovery only · synthetic fixture · $0 network spend</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: "var(--text)" }}>Create a discovery brief</h1>
        <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
          Describe the offer, ideal company and commercial question. IntentLead will produce evidence-backed company Opportunities for human review. It will not audit websites, find people, draft messages or send anything.
        </p>
      </header>

      <form onSubmit={event => void submit(event)} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }} aria-labelledby="offer-heading">
          <h2 id="offer-heading" className="font-display text-lg font-semibold" style={{ color: "var(--text)" }}>Offer and business context</h2>
          <Field id="offer-name" label="Offer name" value={offerName} onChange={setOfferName} />
          <Field id="offer-summary" label="What the offer helps a business achieve" value={offerSummary} onChange={setOfferSummary} multiline hint="Business outcome only — no technical website or SEO audit." />
          <Field id="offer-outcomes" label="Expected outcomes" value={outcomes} onChange={setOutcomes} multiline hint="One outcome per line." />
        </section>
        <section className="space-y-4 rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }} aria-labelledby="icp-heading">
          <h2 id="icp-heading" className="font-display text-lg font-semibold" style={{ color: "var(--text)" }}>Ideal company profile</h2>
          <Field id="icp-name" label="ICP name" value={icpName} onChange={setIcpName} />
          <Field id="icp-description" label="Which businesses should fit" value={icpDescription} onChange={setIcpDescription} multiline />
          <Field id="company-attributes" label="Useful company attributes" value={companyAttributes} onChange={setCompanyAttributes} multiline hint="One attribute per line. Do not enter personal contact details." />
        </section>
        <section className="space-y-4 rounded-2xl border p-5 lg:col-span-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }} aria-labelledby="objective-heading">
          <h2 id="objective-heading" className="font-display text-lg font-semibold" style={{ color: "var(--text)" }}>Discovery objective</h2>
          <Field id="objective" label="What should IntentLead discover?" value={objective} onChange={setObjective} multiline />
          <fieldset>
            <legend className="text-sm font-medium" style={{ color: "var(--text)" }}>Evidence families</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {signalFamilies.map(([value, label]) => <label key={value} className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}><input type="checkbox" checked={selectedFamilies.includes(value)} onChange={event => setSelectedFamilies(current => event.target.checked ? [...current, value] : current.filter(item => item !== value))} />{label}</label>)}
            </div>
          </fieldset>
          <button type="submit" disabled={busy !== null} className="min-h-11 rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>{busy === "create" ? "Creating…" : "Create discovery brief"}</button>
        </section>
      </form>

      <p className="mt-4 min-h-5 text-sm" role="alert" style={{ color: "var(--error)" }}>{error}</p>
      <p className="min-h-5 text-sm" role="status" aria-live="polite" style={{ color: "var(--text-muted)" }}>{status}</p>

      <section className="mt-8" aria-labelledby="briefs-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="briefs-heading" className="font-display text-xl font-semibold" style={{ color: "var(--text)" }}>Discovery briefs</h2><button type="button" onClick={() => void refresh()} disabled={loading} className="min-h-11 rounded-lg border px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ borderColor: "var(--border)", color: "var(--text)" }}>Refresh</button></div>
        {loading ? <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>Loading discovery briefs…</p> : briefs.length === 0 ? <p className="mt-4 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>No discovery briefs yet.</p> : <div className="mt-4 space-y-3">{briefs.map(brief => <article key={brief.id} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}><div className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-3xl"><p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{brief.state.replaceAll("_", " ")}</p><h3 className="mt-1 font-medium" style={{ color: "var(--text)" }}>{brief.objective}</h3><p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{brief.offer.name} · {brief.icp.name}</p></div><div className="flex flex-wrap gap-2">{brief.state === "DRAFT" && <button type="button" onClick={() => void start(brief)} disabled={busy !== null} className="min-h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-60" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>{busy === brief.id ? "Queueing…" : "Run zero-spend fixture"}</button>}<Link href={`${basePath}/opportunities`} className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--text)", textDecoration: "none" }}>Review Opportunities</Link></div></div></article>)}</div>}
      </section>
    </div>
  );
}
