import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, CircleAlert } from "lucide-react";
import { CompareHeroButton } from "@/components/compare/CompareHeroButton";
import { CompareTableScroll } from "@/components/compare/CompareTableScroll";
import { Footer } from "@/components/layout/Footer";
import { competitors, competitorSlugs } from "@/lib/vs/competitors";

export const metadata: Metadata = {
  title: "Compare IntentLead — Opportunity Intelligence and GTM tools",
  description: "Compare IntentLead's evidence-backed Opportunity workflow with database, enrichment and outreach tools.",
};

function BrowserFrame({ children, tilt = "right", label }: { children: ReactNode; tilt?: "left" | "right"; label: string }) {
  return (
    <div data-browser-mockup="true" aria-label={label} className="w-full max-w-[440px] shrink-0 [perspective:1000px]">
      <div className="overflow-hidden rounded-2xl border shadow-2xl" style={{ background: "var(--surface)", borderColor: "rgba(255,255,255,.1)", transform: tilt === "right" ? "rotateY(-7deg) rotateX(2deg)" : "rotateY(7deg) rotateX(2deg)", transformOrigin: tilt === "right" ? "right center" : "left center" }}>
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ background: "var(--surface-2)", borderColor: "rgba(255,255,255,.06)" }}>
          {['#ff5f57','#febc2e','#28c840'].map((color) => <span key={color} className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />)}
          <div className="ml-2 flex h-6 flex-1 items-center rounded-md px-3 text-[10px]" style={{ background: "rgba(255,255,255,.05)", color: "var(--text-faint)" }}>app.intentlead.ai · illustrative review</div>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function EvidenceMockup() {
  return <BrowserFrame label="Illustrative evidence capture" tilt="right"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}><span className="rounded px-2 py-1" style={{ background: "rgba(107,164,255,.12)", color: "#6ba4ff" }}>Public source</span><span>Captured 2h ago</span></div><blockquote className="mt-4 border-l-2 pl-4 text-sm leading-6" style={{ borderColor: "#6ba4ff", color: "var(--text-muted)" }}>“We are comparing ways to reduce manual account research before the next sales cycle.”</blockquote><div className="mt-5 space-y-2">{["Source URL and timestamp retained","Observed condition separated from inference","Evidence available for human inspection"].map((item) => <div key={item} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}><Check size={14} style={{ color: "var(--accent)" }} />{item}</div>)}</div></BrowserFrame>;
}

function ResolutionMockup() {
  return <BrowserFrame label="Illustrative company and buyer resolution" tilt="left"><p className="text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Resolution workspace</p><h3 className="mt-2 text-base font-semibold">Acme Operations · illustrative</h3><div className="mt-4 space-y-3">{[{label:"Company",value:"Resolved from official domain",color:"#a3e635"},{label:"Commercial fit",value:"Review — evidence is relevant",color:"#f5c451"},{label:"Buyer role",value:"Operations leader · when verifiable",color:"#c084fc"},{label:"Business contact",value:"Only if source and relevance are verified",color:"#6ba4ff"}].map((item) => <div key={item.label} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}><div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color:item.color }}>{item.label}</div><div className="mt-1 text-xs" style={{ color:"var(--text-muted)" }}>{item.value}</div></div>)}</div></BrowserFrame>;
}

function ReviewMockup() {
  return <BrowserFrame label="Illustrative grounded brief and human review" tilt="right"><div className="flex items-center justify-between"><p className="text-xs font-semibold">Grounded Opportunity brief</p><span className="rounded-full px-2 py-1 text-[9px] font-bold uppercase" style={{ background:"rgba(245,196,81,.12)",color:"#f5c451" }}>Human review</span></div><div className="mt-4 space-y-3 text-xs leading-5"><div className="rounded-lg p-3" style={{ background:"var(--surface-2)",color:"var(--text-muted)" }}><strong style={{ color:"var(--text)" }}>Known:</strong> the company publicly described a manual research problem.</div><div className="rounded-lg p-3" style={{ background:"rgba(107,164,255,.07)",color:"var(--text-muted)" }}><strong style={{ color:"#6ba4ff" }}>Inference:</strong> the problem may make the approved offer relevant.</div><div className="rounded-lg p-3" style={{ background:"rgba(245,196,81,.07)",color:"var(--text-muted)" }}><strong style={{ color:"#f5c451" }}>Uncertain:</strong> no signal proves purchase readiness.</div></div><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-lg px-3 py-2 text-[11px] font-semibold" style={{ background:"var(--accent)",color:"var(--accent-fg)" }}>Accept for manual action</span><span className="rounded-lg border px-3 py-2 text-[11px]" style={{ borderColor:"var(--border)",color:"var(--text-muted)" }}>Needs research</span></div></BrowserFrame>;
}

const demonstrations = [
  { marker:"evidence-demo", eyebrow:"Step 01 · Evidence", title:"Catch a commercially relevant observation.", body:"IntentLead searches the authorized source portfolio for inspectable events, problems and expressed needs. A signal begins research; it never guarantees buying intent.", visual:<EvidenceMockup />, align:"left" },
  { marker:"resolution-demo", eyebrow:"Step 02 · Resolution", title:"Resolve the company before the buyer.", body:"Evidence is connected to an organization only when the facts support it. Buyer and business-contact verification happen later and only when reliable sources are available.", visual:<ResolutionMockup />, align:"right" },
  { marker:"review-demo", eyebrow:"Step 03 · Review", title:"Prepare a grounded brief, then stop.", body:"A brief or draft may use only claims supported by referenced evidence. The person reviews uncertainty and decides whether to copy, export or act manually. IntentLead does not send.", visual:<ReviewMockup />, align:"left" },
] as const;

export default function ComparePage() {
  return <main className="min-h-screen overflow-hidden" style={{ background:"var(--bg)",color:"var(--text)" }}>
    <section className="relative mx-auto max-w-5xl px-6 pb-24 pt-40 text-center"><div aria-hidden className="pointer-events-none absolute left-1/2 top-8 h-[460px] w-[900px] -translate-x-1/2" style={{ background:"radial-gradient(circle,rgba(163,230,53,.1),transparent 65%)" }}/><div className="relative"><p className="text-xs font-semibold uppercase tracking-[.18em]" style={{ color:"var(--accent)" }}>Opportunity Intelligence compared</p><h1 className="mx-auto mt-5 max-w-4xl text-4xl font-bold tracking-[-.05em] sm:text-6xl">Why teams start with evidence before choosing a GTM tool</h1><p className="mx-auto mt-6 max-w-2xl text-lg leading-8" style={{ color:"var(--text-muted)" }}>Database, enrichment and outreach products solve later layers. IntentLead starts with a defensible reason to inspect a company and ends at human review.</p><div className="mt-9"><CompareHeroButton /></div><p className="mt-4 text-xs" style={{ color:"var(--text-faint)" }}>Closed founder-managed Pilot Access · no automatic sending</p></div></section>

    <section data-compare-section="workflow" className="mx-auto max-w-6xl px-6 pb-28"><div className="mb-16 text-center"><span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest" style={{ background:"rgba(163,230,53,.09)",color:"var(--accent)" }}>How it works</span><h2 className="mt-5 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Three reviewable stages—not another list</h2></div><div className="space-y-28">{demonstrations.map((item) => <article key={item.marker} data-compare-section={item.marker} className={`flex flex-col items-center gap-12 lg:gap-20 ${item.align === "right" ? "lg:flex-row-reverse" : "lg:flex-row"}`}><div className="min-w-0 flex-1"><p className="text-[11px] font-bold uppercase tracking-[.16em]" style={{ color:"var(--accent)" }}>{item.eyebrow}</p><h3 className="mt-4 text-3xl font-semibold tracking-[-.035em]">{item.title}</h3><p className="mt-5 max-w-xl leading-8" style={{ color:"var(--text-muted)" }}>{item.body}</p></div><div className="flex flex-1 justify-center">{item.visual}</div></article>)}</div></section>

    <section data-compare-section="matrix" className="border-y px-6 py-24" style={{ borderColor:"var(--border)",background:"var(--surface)" }}><div className="mx-auto max-w-6xl"><p className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color:"var(--accent)" }}>Full capability comparison</p><h2 className="mt-4 text-3xl font-semibold tracking-[-.04em]">Compare the operating layer</h2><p className="mt-3 max-w-2xl text-sm leading-6" style={{ color:"var(--text-muted)" }}>Competitor presentation follows the June reference. Vendor capabilities and prices can change; verify current terms directly.</p><div className="mt-10"><CompareTableScroll /></div></div></section>

    <section data-compare-section="related" className="mx-auto max-w-6xl px-6 py-24"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color:"var(--accent)" }}>Detailed comparisons</p><h2 className="mt-4 text-3xl font-semibold tracking-[-.04em]">Choose the head-to-head view</h2></div><p className="max-w-md text-sm leading-6" style={{ color:"var(--text-muted)" }}>The useful question is where each product begins, what it can substantiate, and which actions remain under human control.</p></div><div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{competitorSlugs.map((slug) => {const item=competitors[slug];return <Link key={slug} href={`/compare/${slug}`} className="group rounded-2xl border p-6 no-underline transition-transform hover:-translate-y-1" style={{ borderColor:"var(--border)",background:"var(--surface)",color:"var(--text)" }}><p className="text-[10px] uppercase tracking-widest" style={{ color:"var(--text-faint)" }}>IntentLead vs</p><h3 className="mt-3 text-2xl font-semibold">{item.name}</h3><p className="mt-3 min-h-12 text-sm leading-6" style={{ color:"var(--text-muted)" }}>{item.tagline}</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold" style={{ color:"var(--accent)" }}>Full comparison <ArrowRight size={15}/></span></Link>})}</div></section>

    <section className="mx-auto max-w-4xl px-6 pb-24"><div className="rounded-3xl border p-9 text-center sm:p-14" style={{ borderColor:"rgba(163,230,53,.24)",background:"rgba(163,230,53,.04)" }}><CircleAlert className="mx-auto" style={{ color:"var(--accent)" }}/><h2 className="mt-5 text-3xl font-semibold tracking-[-.04em]">Start by discussing the discovery problem</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-7" style={{ color:"var(--text-muted)" }}>Pilot Access is closed and founder-managed. The first diagnostic run is free when the available source portfolio can responsibly support the brief.</p><div className="mt-7"><CompareHeroButton /></div></div></section>
    <Footer />
  </main>;
}
