"use client";

import { usePathname, useRouter } from "next/navigation";
import { Plus, Zap } from "lucide-react";
import Link from "next/link";

interface Campaign {
  id: string;
  what_selling: string;
  status: "draft" | "running" | "done" | "error";
}

const STATUS_COLORS: Record<Campaign["status"], string> = {
  draft: "var(--text-faint)",
  running: "var(--pending)",
  done: "var(--verified)",
  error: "var(--error)",
};

const PLAN_MAX: Record<string, number> = {
  free: 10,
  starter: 30,
  growth: 100,
  agency: 300,
};

export default function Sidebar({
  campaigns = [],
  credits = 0,
  plan = "free",
}: {
  campaigns?: Campaign[];
  credits?: number;
  plan?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const max = PLAN_MAX[plan] ?? 10;
  const pct = Math.min(100, (credits / max) * 100);

  return (
    <aside
      className="flex flex-col h-full flex-shrink-0"
      style={{
        width: 240,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2 px-5 py-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Link href="/" className="flex items-center gap-2">
          <Zap size={18} style={{ color: "var(--accent)" }} />
          <span
            style={{
              color: "var(--text)",
              fontWeight: 600,
              fontSize: 15,
              fontFamily: "Geist, sans-serif",
            }}
          >
            IntentLead
          </span>
        </Link>
      </div>

      {/* Campaigns */}
      <div className="flex-1 overflow-y-auto px-3 pt-4">
        <div className="flex items-center justify-between px-2 mb-2">
          <span
            className="text-xs font-medium uppercase tracking-widest"
            style={{ color: "var(--text-faint)" }}
          >
            Campaigns
          </span>
          <button
            onClick={() => router.push("/chat")}
            className="flex items-center justify-center rounded-md transition-colors"
            title="New campaign"
            style={{
              width: 24,
              height: 24,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            <Plus size={13} />
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <p style={{ color: "var(--text-faint)", fontSize: 13 }}>
              No campaigns yet
            </p>
            <button
              onClick={() => router.push("/chat")}
              className="mt-3 text-xs underline"
              style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
            >
              Start your first →
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {campaigns.map((c) => {
              const active = pathname === `/workspace/${c.id}`;
              return (
                <Link
                  key={c.id}
                  href={`/workspace/${c.id}`}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors"
                  style={{
                    background: active ? "var(--surface-2)" : "transparent",
                    color: active ? "var(--text)" : "var(--text-muted)",
                    border: active
                      ? "1px solid var(--border)"
                      : "1px solid transparent",
                    textDecoration: "none",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: STATUS_COLORS[c.status],
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.what_selling || "Untitled"}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-3 pt-3 pb-4"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {/* Credits */}
        <div
          className="px-3 py-3 rounded-xl mb-2"
          style={{ background: "var(--surface-2)" }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Credits
            </span>
            <span
              className="text-xs font-semibold"
              style={{ color: "var(--accent)" }}
            >
              {credits} left
            </span>
          </div>
          <div
            className="h-1 rounded-full"
            style={{ background: "var(--border)" }}
          >
            <div
              className="h-1 rounded-full transition-all"
              style={{ width: `${pct}%`, background: "var(--accent)" }}
            />
          </div>
          <div
            className="text-xs mt-1.5 capitalize"
            style={{ color: "var(--text-faint)" }}
          >
            {plan} plan
          </div>
        </div>

      </div>
    </aside>
  );
}
