"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import type { User } from "@supabase/supabase-js";

// ── Data ──────────────────────────────────────────────────────────────────────

const COMPETITORS = [
  { name: "Apollo.io",     slug: "apollo",    price: "$49/user" },
  { name: "Hunter.io",     slug: "hunter",    price: "$34/mo" },
  { name: "Clay",          slug: "clay",      price: "$167/mo" },
  { name: "Instantly.ai",  slug: "instantly", price: "$37/mo" },
  { name: "Lemlist",       slug: "lemlist",   price: "$55/mo" },
] as const;

type CellValue = "yes" | "no" | "limited" | "agency" | string;

type Row = {
  section?: string;
  feature: string;
  tooltip?: string;
  // [intentlead, apollo, hunter, clay, instantly, lemlist]
  values: [CellValue, CellValue, CellValue, CellValue, CellValue, CellValue];
};

const ROWS: Row[] = [
  // ── Verification ──
  {
    section: "Verification",
    feature: "4-level verification",
    tooltip: "Signal → Company → Contact → Email — all 4 must pass",
    values: ["yes", "no", "no", "limited", "no", "no"],
  },
  {
    feature: "Credit guarantee",
    tooltip: "Pay nothing if any verification level fails",
    values: ["yes", "no", "no", "no", "no", "no"],
  },
  {
    feature: "Email deliverability check",
    values: ["yes", "yes", "yes", "yes", "yes", "yes"],
  },
  {
    feature: "Company ID from intent signals",
    tooltip: "Identify company from Reddit/HN post author",
    values: ["yes", "no", "no", "limited", "no", "no"],
  },
  {
    feature: "Contact role verification",
    tooltip: "Confirm decision-maker title & seniority",
    values: ["yes", "no", "no", "no", "no", "no"],
  },

  // ── Signal Sources ──
  {
    section: "Signal Sources",
    feature: "Reddit intent signals",
    values: ["yes", "no", "no", "no", "no", "no"],
  },
  {
    feature: "Hacker News signals",
    values: ["yes", "no", "no", "no", "no", "no"],
  },
  {
    feature: "Real-time intent monitoring",
    values: ["yes", "no", "no", "limited", "no", "no"],
  },
  {
    feature: "Pre-built contact database",
    tooltip: "Large static database to search and filter",
    values: ["no", "yes", "yes", "yes", "no", "limited"],
  },

  // ── Outreach ──
  {
    section: "Outreach",
    feature: "AI-personalized email (from signal)",
    tooltip: "GPT-4o message grounded in the exact signal",
    values: ["yes", "limited", "no", "limited", "limited", "no"],
  },
  {
    feature: "Email sequences",
    values: ["no", "yes", "no", "no", "yes", "yes"],
  },
  {
    feature: "CSV export",
    values: ["yes", "yes", "yes", "yes", "yes", "yes"],
  },
  {
    feature: "API access",
    values: ["agency", "yes", "yes", "yes", "yes", "yes"],
  },

  // ── Pricing ──
  {
    section: "Pricing model",
    feature: "Pay only for verified leads",
    tooltip: "Credits deducted only when all 4 levels pass",
    values: ["yes", "no", "no", "no", "no", "no"],
  },
  {
    feature: "Free tier available",
    values: ["yes", "limited", "yes", "limited", "no", "no"],
  },
  {
    feature: "Starts at (per month)",
    values: ["$0", "$49", "$34", "$167", "$37", "$55"],
  },
];

// ── Cell ──────────────────────────────────────────────────────────────────────

function Cell({ value, isUs }: { value: CellValue; isUs: boolean }) {
  const isYes = value === "yes";
  const isNo = value === "no";
  const isLimited = value === "limited";
  const isAgency = value === "agency";

  return (
    <td
      style={{
        textAlign: "center",
        padding: "13px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: isUs ? "rgba(163,230,53,0.04)" : "transparent",
        verticalAlign: "middle",
        minWidth: 120,
      }}
    >
      {isYes && (
        <span
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 22, height: 22, borderRadius: "50%",
            background: "rgba(163,230,53,0.15)", color: "var(--accent)",
            fontSize: 12, fontWeight: 700,
          }}
        >
          ✓
        </span>
      )}
      {isNo && (
        <span
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 22, height: 22, borderRadius: "50%",
            background: "rgba(248,113,113,0.1)", color: "#F87171",
            fontSize: 12, fontWeight: 700,
          }}
        >
          ✕
        </span>
      )}
      {isLimited && (
        <span
          style={{
            display: "inline-block", fontSize: 10, fontWeight: 700,
            letterSpacing: "0.05em", color: "#F5C451",
            background: "rgba(245,196,81,0.12)", padding: "2px 7px",
            borderRadius: 20, textTransform: "uppercase",
          }}
        >
          Limited
        </span>
      )}
      {isAgency && (
        <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
          Agency
        </span>
      )}
      {!isYes && !isNo && !isLimited && !isAgency && (
        <span
          style={{
            fontSize: 12,
            color: isUs ? "var(--accent)" : "var(--text-muted)",
            fontWeight: isUs ? 600 : 400,
          }}
        >
          {value}
        </span>
      )}
    </td>
  );
}

// ── CTA Button (auth-aware) ───────────────────────────────────────────────────

function GetStartedButton() {
  const [user, setUser] = useState<User | null>(null);
  const { openModal } = useAuthModal();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    try {
      const supabase = getBrowserClient();
      supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setUser(s?.user ?? null));
      return () => subscription.unsubscribe();
    } catch {}
  }, []);

  if (user) {
    return (
      <Link
        href="/chat"
        style={{
          display: "inline-block", padding: "9px 18px",
          background: "var(--accent)", color: "var(--accent-fg)",
          borderRadius: 8, fontSize: 13, fontWeight: 700,
          textDecoration: "none", whiteSpace: "nowrap",
        }}
      >
        Open workspace
      </Link>
    );
  }

  return (
    <button
      onClick={() => openModal("signup")}
      style={{
        display: "inline-block", padding: "9px 18px",
        background: "var(--accent)", color: "var(--accent-fg)",
        borderRadius: 8, fontSize: 13, fontWeight: 700,
        border: "none", cursor: "pointer", whiteSpace: "nowrap",
        fontFamily: "inherit",
      }}
    >
      Get started
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CompareTableScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateFades() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateFades();
    el.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades);
    return () => {
      el.removeEventListener("scroll", updateFades);
      window.removeEventListener("resize", updateFades);
    };
  }, []);

  return (
    <div style={{ position: "relative" }}>
      {/* No left fade — sticky feature column handles left edge */}

      {/* Right fade — signals scrollability */}
      <div
        aria-hidden
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 64, zIndex: 4,
          background: "linear-gradient(to left, var(--bg) 30%, transparent)",
          pointerEvents: "none",
          opacity: canScrollRight ? 1 : 0,
          transition: "opacity 0.25s",
        }}
      />

      {/* Scrollable table */}
      <div
        ref={scrollRef}
        style={{
          overflowX: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <style>{`div::-webkit-scrollbar{display:none}`}</style>

        <table
          style={{
            width: "100%", borderCollapse: "collapse", fontSize: 13,
            minWidth: 900,
          }}
        >
          <thead>
            <tr>
              {/* Feature col — sticky left + top (intersection cell) */}
              <th
                style={{
                  textAlign: "left", padding: "0 16px 0 0", paddingBottom: 16,
                  color: "var(--text-faint)", fontWeight: 600, fontSize: 11,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  minWidth: 220, borderBottom: "1px solid var(--border)",
                  position: "sticky", left: 0, top: 70,
                  background: "var(--bg)", zIndex: 8,
                }}
              >
                Feature
              </th>

              {/* IntentLead AI */}
              <th
                style={{
                  textAlign: "center", padding: "0 10px 0", paddingBottom: 16,
                  minWidth: 140,
                  borderBottom: "2px solid rgba(163,230,53,0.7)",
                  background: "rgba(163,230,53,0.04)",
                  borderRadius: "8px 8px 0 0",
                  position: "sticky", top: 70, zIndex: 7,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", paddingBottom: 4 }}>
                  IntentLead AI
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 10 }}>$0 – $199/mo</div>
                <GetStartedButton />
              </th>

              {/* Competitors */}
              {COMPETITORS.map((c) => (
                <th
                  key={c.slug}
                  style={{
                    textAlign: "center", padding: "0 10px 0", paddingBottom: 16,
                    minWidth: 130, borderBottom: "1px solid var(--border)",
                    position: "sticky", top: 70, zIndex: 7,
                    background: "var(--bg)",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", paddingBottom: 4 }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 10 }}>from {c.price}</div>
                  <Link
                    href={`/compare/${c.slug}`}
                    style={{
                      display: "inline-block", padding: "8px 14px",
                      background: "var(--surface-2)", color: "var(--text-muted)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: 8, fontSize: 12, fontWeight: 600,
                      textDecoration: "none", whiteSpace: "nowrap",
                    }}
                  >
                    Full comparison
                  </Link>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {ROWS.map((row, rowIdx) => (
              <React.Fragment key={`${row.feature}-${rowIdx}`}>
                {row.section && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: "22px 0 8px",
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                        textTransform: "uppercase", color: "var(--text-faint)",
                        position: "sticky", left: 0,
                        background: "var(--bg)",
                      }}
                    >
                      {row.section}
                    </td>
                  </tr>
                )}
                <tr>
                  <td
                    style={{
                      padding: "13px 16px 13px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      verticalAlign: "middle",
                      position: "sticky", left: 0,
                      background: "var(--bg)", zIndex: 1,
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "var(--text)" }}>
                      {row.feature}
                    </span>
                    {row.tooltip && (
                      <span style={{
                        fontSize: 11, color: "var(--text-faint)",
                        display: "block", marginTop: 2, lineHeight: 1.4,
                      }}>
                        {row.tooltip}
                      </span>
                    )}
                  </td>
                  {row.values.map((v, i) => (
                    <Cell key={i} value={v} isUs={i === 0} />
                  ))}
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Scroll hint — only when table overflows */}
      {canScrollRight && (
        <div style={{
          textAlign: "right", paddingTop: 10,
          fontSize: 11, color: "var(--text-faint)",
          display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4,
        }}>
          <span>Scroll to compare</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
      )}
    </div>
  );
}
