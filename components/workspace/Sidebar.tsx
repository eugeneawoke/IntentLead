"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Crosshair, Radar, Zap } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const opportunitiesActive = pathname.includes("/opportunities");
  const discoveryActive = pathname.endsWith("/workspace") || pathname.includes("/discovery");

  return (
    <aside
      className="workspace-sidebar flex w-full flex-shrink-0 flex-col border-b md:h-full md:w-[264px] md:border-b-0 md:border-r"
    >
      <div className="workspace-brand flex items-center justify-between gap-3 px-4 py-3 md:px-5 md:py-5">
        <Link href="/workspace/discovery" className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="IntentLead workspace">
          <span className="workspace-brand-mark" aria-hidden="true"><Zap size={17} /></span>
          <span>
            <span className="block text-sm font-semibold tracking-tight" style={{ color: "var(--text)" }}>IntentLead</span>
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] md:block" style={{ color: "var(--text-faint)" }}>Opportunity intelligence</span>
          </span>
        </Link>
        <Link href="/" className="workspace-icon-link md:hidden" aria-label="Open public site"><ArrowUpRight size={17} aria-hidden="true" /></Link>
      </div>
      <nav aria-label="Workspace" className="flex gap-2 overflow-x-auto px-3 py-2 md:block md:px-3 md:py-4">
        <Link
          href="/workspace/discovery"
          aria-current={discoveryActive ? "page" : undefined}
          className={`workspace-nav-link ${discoveryActive ? "is-active" : ""}`}
        >
          <Radar size={17} aria-hidden="true" />
          <span>Discovery</span>
        </Link>
        <Link
          href="/workspace/opportunities"
          aria-current={opportunitiesActive ? "page" : undefined}
          className={`workspace-nav-link ${opportunitiesActive ? "is-active" : ""}`}
        >
          <Crosshair size={17} aria-hidden="true" />
          <span>Opportunities</span>
        </Link>
      </nav>
      <div className="mt-auto hidden px-4 pb-5 md:block">
        <div className="workspace-boundary-card">
          <span className="workspace-live-dot" aria-hidden="true" />
          <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>Human-controlled</p>
          <p className="mt-1 text-[11px] leading-5" style={{ color: "var(--text-faint)" }}>Research, verify, review and copy. Sending is not part of IntentLead.</p>
        </div>
        <Link href="/" className="mt-3 flex min-h-11 items-center justify-between rounded-lg px-3 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
          Public site <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
