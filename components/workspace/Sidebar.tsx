"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const active = pathname.startsWith("/workspace/opportunities");

  return (
    <aside
      className="flex w-full flex-shrink-0 flex-col border-b md:h-full md:w-[240px] md:border-b-0 md:border-r"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <Link href="/workspace/opportunities" className="flex min-h-11 items-center gap-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="IntentLead Opportunities">
          <Zap size={18} aria-hidden="true" style={{ color: "var(--accent)" }} />
          <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 15, fontFamily: "Geist, sans-serif" }}>
            IntentLead
          </span>
        </Link>
      </div>
      <nav aria-label="Workspace" className="px-3 py-2">
        <Link
          href="/workspace/opportunities"
          aria-current={active ? "page" : undefined}
          className="flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            background: active ? "var(--surface-2)" : "transparent",
            borderColor: active ? "var(--border)" : "transparent",
            color: active ? "var(--text)" : "var(--text-muted)",
            textDecoration: "none",
          }}
        >
          Opportunities
        </Link>
      </nav>
    </aside>
  );
}
