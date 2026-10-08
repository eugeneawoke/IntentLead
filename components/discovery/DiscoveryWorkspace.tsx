"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Check, FlaskConical, Radar, RefreshCw, Sparkles } from "lucide-react";
import type { DiscoveryBriefSummary } from "@/types/discovery-brief";
import { LANDING_DISCOVERY_DRAFT_KEY, type LandingDiscoveryDraft } from "@/types/landing";
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

const marketOptions: Array<{ value: LandingDiscoveryDraft["market"]; label: string }> = [
  { value: "GLOBAL_EN", label: "Global / English pilot" },
  { value: "CIS", label: "CIS · planned" },
  { value: "LOCAL_CUSTOM", label: "Local business · planned" },
];

function lines(value: string): string[] {
  return value.split("\n").map(item => item.trim()).filter(Boolean);
}

function Field(props: { id: string; label: string; value: string; onChange(value: string): void; multiline?: boolean; hint?: string }) {
  const shared = {
    id: props.id,
    value: props.value,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => props.onChange(event.target.value),
    required: true,
    className: "workspace-input mt-2 w-full rounded-xl border px-3.5 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
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
  const [market, setMarket] = useState<LandingDiscoveryDraft["market"]>("GLOBAL_EN");
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
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LANDING_DISCOVERY_DRAFT_KEY);
      if (!raw) return;
      const candidate = JSON.parse(raw) as Partial<LandingDiscoveryDraft>;
      if (candidate.schemaVersion !== 1 || typeof candidate.offerSummary !== "string") return;
      if (!candidate.offerSummary.trim()) return;
      setOfferSummary(candidate.offerSummary.trim());
      if (candidate.market && marketOptions.some(option => option.value === candidate.market)) setMarket(candidate.market);
      setObjective(`Find at least 20 confirmed, evidence-backed commercial signals for this offer in the ${candidate.market ?? "selected"} market.`);
      sessionStorage.removeItem(LANDING_DISCOVERY_DRAFT_KEY);
      setStatus("Your landing-page offer was restored. Review the brief before creating it.");
    } catch {
      sessionStorage.removeItem(LANDING_DISCOVERY_DRAFT_KEY);
    }
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (selectedFamilies.length === 0) {
      setError("Select at least one signal family.");
      return;
    }
    if (market !== "GLOBAL_EN") {
      setError("This market profile is preserved in the product plan but is not executable in the current controlled pilot yet.");
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
        exclusions: [], limits: { maxSourceItems: 100, maxOpportunities: 20 },
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
    <div className="workspace-page mx-auto w-full max-w-7xl">
      <header className="workspace-page-header mb-8">
        <div className="max-w-3xl">
          <p className="workspace-eyebrow"><span className="workspace-live-dot" aria-hidden="true" /> EN discovery · controlled fixture</p>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.035em] sm:text-4xl" style={{ color: "var(--text)" }}>Create a discovery brief</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: "var(--text-muted)" }}>
          Describe the offer, ideal company and commercial question. The target workflow produces evidence-backed Opportunities with a relevant buyer, verified contact and grounded draft for human review. IntentLead never sends messages.
          </p>
        </div>
        <div className="workspace-runtime-badge" aria-label="Current runtime boundary">
          <FlaskConical size={16} aria-hidden="true" />
          <span><strong>{market === "GLOBAL_EN" ? "Current pilot" : "Planned profile"}</strong><small>{market === "GLOBAL_EN" ? "Global English fixture · $0 network" : "Saved honestly · not executable yet"}</small></span>
        </div>
      </header>

      <form onSubmit={event => void submit(event)} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="workspace-form-card space-y-4" aria-labelledby="offer-heading">
          <div className="workspace-card-heading"><span className="workspace-card-icon" aria-hidden="true"><Sparkles size={17} /></span><div><p>Step 01</p><h2 id="offer-heading">Offer and business context</h2></div></div>
          <Field id="offer-name" label="Offer name" value={offerName} onChange={setOfferName} />
          <Field id="offer-summary" label="What the offer helps a business achieve" value={offerSummary} onChange={setOfferSummary} multiline hint="Business outcome only — no technical website or SEO audit." />
          <Field id="offer-outcomes" label="Expected outcomes" value={outcomes} onChange={setOutcomes} multiline hint="One outcome per line." />
        </section>
        <section className="workspace-form-card space-y-4" aria-labelledby="icp-heading">
          <div className="workspace-card-heading"><span className="workspace-card-icon" aria-hidden="true"><Building2 size={17} /></span><div><p>Step 02</p><h2 id="icp-heading">Ideal company profile</h2></div></div>
          <Field id="icp-name" label="ICP name" value={icpName} onChange={setIcpName} />
          <Field id="icp-description" label="Which businesses should fit" value={icpDescription} onChange={setIcpDescription} multiline />
          <Field id="company-attributes" label="Useful company attributes" value={companyAttributes} onChange={setCompanyAttributes} multiline hint="One attribute per line. IntentLead resolves contacts only after a company qualifies." />
        </section>
        <section className="workspace-form-card space-y-4 lg:col-span-2" aria-labelledby="objective-heading">
          <div className="workspace-card-heading"><span className="workspace-card-icon" aria-hidden="true"><Radar size={17} /></span><div><p>Step 03</p><h2 id="objective-heading">Discovery objective</h2></div></div>
          <label htmlFor="market-profile" className="block text-sm font-medium" style={{ color: "var(--text)" }}>Market profile
            <select id="market-profile" className="workspace-input mt-2 w-full rounded-xl border px-3.5 py-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text)" }} value={market} onChange={event => setMarket(event.target.value as LandingDiscoveryDraft["market"])}>
              {marketOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {market !== "GLOBAL_EN" && <span className="mt-1 block text-xs font-normal" style={{ color: "var(--pending)" }}>This profile is planned for Task N and cannot silently fall back to English discovery.</span>}
          </label>
          <Field id="objective" label="What should IntentLead discover?" value={objective} onChange={setObjective} multiline />
          <fieldset>
            <legend className="text-sm font-medium" style={{ color: "var(--text)" }}>Evidence families</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {signalFamilies.map(([value, label]) => { const checked = selectedFamilies.includes(value); return <label key={value} className={`workspace-check-option ${checked ? "is-checked" : ""}`}><input className="sr-only" type="checkbox" checked={checked} onChange={event => setSelectedFamilies(current => event.target.checked ? [...current, value] : current.filter(item => item !== value))} /><span className="workspace-check-box" aria-hidden="true">{checked && <Check size={13} />}</span>{label}</label>; })}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5" style={{ borderColor: "var(--border)" }}>
            <p className="max-w-xl text-xs leading-5" style={{ color: "var(--text-faint)" }}>A full product run targets at least 20 confirmed signals. This controlled runtime validates the contract without external provider calls.</p>
            <button type="submit" disabled={busy !== null || market !== "GLOBAL_EN"} className="workspace-primary-action">{busy === "create" ? "Creating…" : <>Create discovery brief <ArrowRight size={16} aria-hidden="true" /></>}</button>
          </div>
        </section>
      </form>

      <p className="mt-4 min-h-5 text-sm" role="alert" style={{ color: "var(--error)" }}>{error}</p>
      <p className="min-h-5 text-sm" role="status" aria-live="polite" style={{ color: "var(--text-muted)" }}>{status}</p>

      <section className="mt-10" aria-labelledby="briefs-heading">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="workspace-eyebrow">Saved work</p><h2 id="briefs-heading" className="mt-2 font-display text-2xl font-semibold" style={{ color: "var(--text)" }}>Discovery briefs</h2></div><button type="button" onClick={() => void refresh()} disabled={loading} className="workspace-secondary-action"><RefreshCw size={15} aria-hidden="true" className={loading ? "animate-spin" : ""} /> {loading ? "Refreshing…" : "Refresh"}</button></div>
        {loading ? <div className="workspace-empty-state mt-4" role="status"><span className="workspace-skeleton h-4 w-44" /><span className="workspace-skeleton mt-3 h-3 w-72 max-w-full" /></div> : briefs.length === 0 ? <div className="workspace-empty-state mt-4"><Radar size={22} aria-hidden="true" style={{ color: "var(--text-faint)" }} /><p className="mt-3 text-sm font-medium" style={{ color: "var(--text)" }}>No discovery briefs yet</p><p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Complete the brief above to start a controlled run.</p></div> : <div className="mt-4 space-y-3">{briefs.map((brief, index) => <article key={brief.id} className="workspace-brief-row"><div className="workspace-mono shrink-0">{String(index + 1).padStart(2, "0")}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="workspace-state-chip">{brief.state.replaceAll("_", " ")}</span><span className="text-xs" style={{ color: "var(--text-faint)" }}>{brief.offer.name} · {brief.icp.name}</span></div><h3 className="mt-2 break-words text-sm font-medium leading-6" style={{ color: "var(--text)" }}>{brief.objective}</h3></div><div className="flex flex-wrap gap-2">{brief.state === "DRAFT" && <button type="button" onClick={() => void start(brief)} disabled={busy !== null} className="workspace-primary-action">{busy === brief.id ? "Queueing…" : "Run fixture"}</button>}<Link href={`${basePath}/opportunities`} className="workspace-secondary-action">Review <ArrowRight size={15} aria-hidden="true" /></Link></div></article>)}</div>}
      </section>
    </div>
  );
}
