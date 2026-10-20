"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import type { CompetitorFeature } from "@/lib/vs/competitors";

function FeatureValue({ value }: { value: CompetitorFeature["intentlead"] }) {
  if (value === true) return <span className="inline-flex items-center gap-2"><Check size={16} style={{ color: "var(--accent)" }} />Yes</span>;
  if (value === false) return <span className="inline-flex items-center gap-2"><X size={16} style={{ color: "#f87171" }} />No</span>;
  return <span>{value}</span>;
}

export function CompareDetailTable({ name, features }: { name: string; features: CompetitorFeature[] }) {
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (headerRef.current) headerRef.current.scrollLeft = body.scrollLeft;
    setAtStart(body.scrollLeft < 8);
    setAtEnd(body.scrollLeft >= body.scrollWidth - body.clientWidth - 8);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [sync]);

  const columns = <colgroup><col style={{ width: 300, minWidth: 300 }} /><col style={{ width: 230, minWidth: 230 }} /><col style={{ width: 230, minWidth: 230 }} /></colgroup>;

  return <div className="relative mt-9">
    <div data-compare-sticky="true" className="sticky top-[70px] z-20 overflow-hidden border-b" style={{ background:"var(--bg)",borderColor:"var(--border)" }}>
      <div ref={headerRef} data-compare-header-scroll className="overflow-hidden">
        <table aria-hidden="true" className="min-w-[760px] table-fixed border-collapse text-sm">{columns}<thead><tr><th className="sticky left-0 z-[1] p-4 text-left text-[11px] uppercase tracking-widest" style={{ background:"var(--bg)",color:"var(--text-faint)" }}>Capability</th><th className="border-b-2 p-4 text-left" style={{ borderColor:"var(--accent)",background:"rgba(163,230,53,.05)",color:"var(--accent)" }}>IntentLead</th><th className="p-4 text-left" style={{ color:"var(--text-muted)" }}>{name}</th></tr></thead></table>
      </div>
    </div>
    {!atStart && (
      <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-12" style={{ background:"linear-gradient(to right,var(--bg),transparent)" }}/>
    )}
    {!atEnd && (
      <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-14" style={{ background:"linear-gradient(to left,var(--bg),transparent)" }}/>
    )}
    <div ref={bodyRef} data-compare-body-scroll data-compare-sticky="true" onScroll={sync} role="region" aria-label={`IntentLead and ${name} comparison`} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-[var(--accent)]">
      <table className="min-w-[760px] table-fixed border-collapse text-sm">{columns}<thead className="sr-only"><tr><th scope="col">Capability</th><th scope="col">IntentLead</th><th scope="col">{name}</th></tr></thead><tbody>{features.map((feature) => <tr key={feature.label}><th scope="row" className="sticky left-0 z-[1] border-b p-4 text-left font-medium" style={{ background:"var(--bg)",borderColor:"rgba(255,255,255,.05)" }}>{feature.label}</th><td className="border-b p-4" style={{ borderColor:"rgba(255,255,255,.05)",background:"rgba(163,230,53,.04)",color:"var(--text-muted)" }}><FeatureValue value={feature.intentlead}/></td><td className="border-b p-4" style={{ borderColor:"rgba(255,255,255,.05)",color:"var(--text-muted)" }}><FeatureValue value={feature.competitor}/></td></tr>)}</tbody></table>
    </div>
    {!atEnd && <p className="mt-2 text-right text-[11px]" style={{ color:"var(--text-faint)" }}>Scroll to compare →</p>}
  </div>;
}
