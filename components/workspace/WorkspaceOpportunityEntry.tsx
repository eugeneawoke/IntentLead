import Link from "next/link";
import { ArrowRight, Crosshair, Radar, ShieldCheck } from "lucide-react";

export default function WorkspaceOpportunityEntry() {
  return (
    <section className="workspace-page" aria-labelledby="workspace-entry-title">
      <div className="workspace-hero-panel max-w-5xl">
        <p className="workspace-eyebrow"><span className="workspace-live-dot" aria-hidden="true" /> EN discovery workspace</p>
        <h1
          id="workspace-entry-title"
          className="mt-5 max-w-3xl font-display text-3xl font-semibold tracking-[-0.035em] sm:text-5xl"
          style={{ color: "var(--text)" }}
        >
          Turn observable demand into reviewable Opportunities.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7" style={{ color: "var(--text-muted)" }}>
          Define the offer and market, inspect the evidence trail, then make the final call. The target package continues through buyer, verified contact and grounded draft—never automatic sending.
        </p>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/workspace/discovery" className="workspace-primary-action">Create discovery brief <ArrowRight size={16} aria-hidden="true" /></Link><Link href="/workspace/opportunities" className="workspace-secondary-action">Review Opportunities</Link></div>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            [Radar, "01", "Discover", "Search multiple source families around the offer and market."],
            [ShieldCheck, "02", "Verify", "Keep public evidence and interpretation visibly separate."],
            [Crosshair, "03", "Decide", "Accept, reject or request more research with clear reasons."],
          ].map(([Icon, number, title, copy]) => {
            const StepIcon = Icon as typeof Radar;
            return <article key={String(number)} className="workspace-step-card"><div className="flex items-center justify-between"><StepIcon size={18} aria-hidden="true" style={{ color: "var(--accent)" }} /><span className="workspace-mono">{String(number)}</span></div><h2 className="mt-5 text-sm font-semibold" style={{ color: "var(--text)" }}>{String(title)}</h2><p className="mt-2 text-xs leading-5" style={{ color: "var(--text-muted)" }}>{String(copy)}</p></article>;
          })}
        </div>
      </div>
    </section>
  );
}
