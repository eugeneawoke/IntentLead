"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { competitors, competitorSlugs } from "@/lib/vs/competitors";

const rows = [
  ["Evidence-backed Opportunity discovery", "yes", "varies", "configured", "no", "no", "no"],
  ["Inspectable why-now evidence", "yes", "varies", "varies", "no", "no", "no"],
  ["Company resolution", "yes", "yes", "configured", "domain-led", "no", "database-led"],
  ["Buyer/contact verification", "when available", "database-led", "provider-led", "email-led", "add-on", "database-led"],
  ["Grounded brief or draft", "yes", "AI-assisted", "workflow-defined", "no", "campaign copy", "personalization"],
  ["Automatic sending", "no", "yes", "integrations", "campaign tools", "yes", "yes"],
] as const;

function Mark({ value, us = false }: { value: string; us?: boolean }) {
  if (value === "yes") return <span aria-label="Yes" className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={{ background: "rgba(163,230,53,.15)", color: "var(--accent)" }}>✓</span>;
  if (value === "no") return <span aria-label="No" className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={{ background: "rgba(248,113,113,.1)", color: "#f87171" }}>×</span>;
  return <span className="text-xs" style={{ color: us ? "var(--accent)" : "var(--text-muted)" }}>{value}</span>;
}

export function CompareTableScroll() {
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

  const widths = [250, 160, 145, 145, 145, 145, 145];
  const colgroup = widths.map((width, index) => <col key={index} style={{ width, minWidth: width }} />);

  return (
    <div className="relative">
      <div className="sticky top-[70px] z-20 border-b" data-compare-sticky="true" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
        <div ref={headerRef} data-compare-header-scroll className="overflow-hidden">
          <table aria-hidden="true" className="w-full table-fixed border-collapse text-sm">
            <colgroup>{colgroup}</colgroup>
            <thead><tr>
              <th className="sticky left-0 z-[1] p-3 text-left text-[11px] uppercase tracking-widest" style={{ background: "var(--bg)", color: "var(--text-faint)" }}>Capability</th>
              <th className="border-b-2 p-3 text-center" style={{ borderColor: "var(--accent)", background: "rgba(163,230,53,.05)", color: "var(--accent)" }}>IntentLead</th>
              {competitorSlugs.map((slug) => <th key={slug} className="p-3 text-center"><span className="text-xs" style={{ color: "var(--text-muted)" }}>{competitors[slug].name}</span></th>)}
            </tr></thead>
          </table>
        </div>
      </div>
      {!atStart && <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-12" style={{ background: "linear-gradient(to right,var(--bg),transparent)" }} />}
      {!atEnd && <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-16" style={{ background: "linear-gradient(to left,var(--bg),transparent)" }} />}
      <div ref={bodyRef} data-compare-body-scroll onScroll={sync} role="region" aria-label="IntentLead competitor comparison" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-[var(--accent)]">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>{colgroup}</colgroup>
          <thead className="sr-only"><tr><th scope="col">Capability</th><th scope="col">IntentLead</th>{competitorSlugs.map((slug) => <th key={slug} scope="col">{competitors[slug].name}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row[0]}>
            <th scope="row" className="sticky left-0 z-[1] border-b p-4 text-left text-sm font-medium" style={{ background: "var(--bg)", borderColor: "rgba(255,255,255,.04)", color: "var(--text)" }}>{row[0]}</th>
            {row.slice(1).map((value, index) => <td key={`${row[0]}-${index}`} className="border-b p-4 text-center" style={{ borderColor: "rgba(255,255,255,.04)", background: index === 0 ? "rgba(163,230,53,.04)" : "transparent" }}><Mark value={value} us={index === 0} /></td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {!atEnd && <p className="mt-2 text-right text-[11px]" style={{ color: "var(--text-faint)" }}>Scroll to compare →</p>}
    </div>
  );
}
