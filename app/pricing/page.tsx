import React, { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import LandingComposer from "@/components/landing/LandingComposer";
import BackgroundBoxes from "@/components/ui/background-boxes";
import PricingCards from "@/components/pricing/PricingCards";

export const metadata: Metadata = {
  title: "Pricing — IntentLead AI",
  description:
    "Simple credit-based pricing. Pay only for leads that pass all 4 verification levels. Start free — 10 verified leads, no card required.",
};

// ── Comparison table data ─────────────────────────────────────────────────────

type Row = {
  feature: string;
  tooltip?: string;
  free: boolean | string;
  starter: boolean | string;
  growth: boolean | string;
  agency: boolean | string;
  section?: string;
};

const COMPARISON: Row[] = [
  // Leads & Verification
  {
    section: "Leads & Verification",
    feature: "Verified leads",
    free: "10 (one-time)", starter: "30/mo", growth: "100/mo", agency: "300/mo",
  },
  { feature: "4-level verification", free: true, starter: true, growth: true, agency: true },
  { feature: "Credit guarantee", tooltip: "No charge if any verification level fails", free: true, starter: true, growth: true, agency: true },
  { feature: "Personalized email message", free: true, starter: true, growth: true, agency: true },
  // Outreach
  {
    section: "Outreach",
    feature: "CSV export",
    free: false, starter: true, growth: true, agency: true,
  },
  { feature: "Priority pipeline", free: false, starter: false, growth: true, agency: true },
  { feature: "API access", free: false, starter: false, growth: false, agency: true },
  // AI Modes
  {
    section: "AI Modes",
    feature: "Plan mode",
    free: "20 msg/day", starter: "100 msg/day", growth: "300 msg/day", agency: "Unlimited",
  },
  {
    feature: "Strategy mode",
    free: "20 msg/day", starter: "100 msg/day", growth: "300 msg/day", agency: "Unlimited",
  },
  // Team
  {
    section: "Team",
    feature: "Team members",
    free: "1", starter: "1", growth: "3", agency: "10",
  },
];

// ── FAQ data ──────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "What counts as a 'credit'?",
    a: "One credit = one verified lead. A lead is verified only when all 4 levels pass: signal intent, company identification, contact role, and email deliverability. If any level fails, no credit is charged.",
  },
  {
    q: "Do rejected leads cost anything?",
    a: "No. A rejected lead means our system couldn't verify the company, find the right contact, or confirm a valid email. You pay nothing for rejections — that's the guarantee.",
  },
  {
    q: "What is the earlybird offer?",
    a: "First 100 users get price-locked rates forever. Starter gets 100 leads/month for the first 3 months (then 30/mo at the same $39 price). Growth is price-locked at $89/mo regardless of future increases.",
  },
  {
    q: "What happens when I use all my free leads?",
    a: "Your 10 free leads are a one-time allocation — they don't reset monthly. When they're used, you'll see an upgrade prompt. You keep access to all your verified leads and generated emails forever.",
  },
  {
    q: "Can I use Plan and Strategy modes without credits?",
    a: "Yes. Plan (outreach sequence builder) and Strategy (ICP & messaging refinement) are AI-only chat modes. They don't run the lead pipeline and don't consume credits.",
  },
  {
    q: "How are payments handled?",
    a: "Payments are processed by PayPro Global (Merchant of Record). They handle taxes, VAT, and billing compliance. We never see your card details.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel anytime — your plan stays active until the end of the billing period. No penalties, no questions.",
  },
  {
    q: "What signal sources do you use?",
    a: "Reddit, Hacker News, GitHub, Stack Overflow, and more. Sources depend on your business type and ICP.",
  },
];

// ── Compare table — ClickUp-style ─────────────────────────────────────────────

const PLAN_HEADERS = [
  { name: "Free",    price: "$0",   period: "",    highlight: false },
  { name: "Starter", price: "$39",  period: "/mo", highlight: false },
  { name: "Growth",  price: "$89",  period: "/mo", highlight: true  },
  { name: "Agency",  price: "$199", period: "/mo", highlight: false },
] as const;

const KEYS = ["free", "starter", "growth", "agency"] as const;

function Cell({ value, highlight }: { value: boolean | string; highlight: boolean }) {
  const isTrue = value === true;
  const isFalse = value === false;

  return (
    <td
      style={{
        textAlign: "center",
        padding: "12px 8px",
        background: highlight ? "rgba(163,230,53,0.04)" : "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {isTrue && (
        <span
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 22, height: 22, borderRadius: "50%",
            background: "rgba(163,230,53,0.15)",
            color: "var(--accent)", fontSize: 13, fontWeight: 700,
          }}
        >
          ✓
        </span>
      )}
      {isFalse && (
        <span style={{ color: "var(--text-faint)", fontSize: 18, lineHeight: 1 }}>—</span>
      )}
      {!isTrue && !isFalse && (
        <span
          style={{
            fontSize: 12, color: highlight ? "var(--accent)" : "var(--text-muted)",
            fontWeight: highlight ? 600 : 400,
          }}
        >
          {value}
        </span>
      )}
    </td>
  );
}

function CompareTable() {
  return (
    <section style={{ marginBottom: 80 }}>
      <h2
        style={{
          fontSize: 24, fontWeight: 700, color: "var(--text)",
          margin: "0 0 4px",
          fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
        }}
      >
        Compare all features
      </h2>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 32px" }}>
        Everything included at every tier — credits only charged when all 4 levels pass.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {/* Feature col header */}
              <th
                style={{
                  textAlign: "left", padding: "0 12px 20px 0",
                  color: "var(--text-faint)", fontWeight: 500,
                  fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
                  minWidth: 200,
                }}
              >
                Feature
              </th>

              {PLAN_HEADERS.map((p) => (
                <th
                  key={p.name}
                  style={{
                    textAlign: "center", padding: "0 8px 20px",
                    minWidth: 110,
                    borderBottom: p.highlight
                      ? "2px solid rgba(163,230,53,0.6)"
                      : "1px solid var(--border)",
                    background: p.highlight ? "rgba(163,230,53,0.04)" : "transparent",
                    borderRadius: p.highlight ? "8px 8px 0 0" : 0,
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: p.highlight ? "var(--accent)" : "var(--text)", letterSpacing: "-0.02em", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
                    {p.price}
                    <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>{p.period}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {COMPARISON.map((row, i) => (
              <React.Fragment key={row.feature}>
                {row.section && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: "20px 0 8px",
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                        textTransform: "uppercase", color: "var(--text-faint)",
                      }}
                    >
                      {row.section}
                    </td>
                  </tr>
                )}
                <tr key={row.feature}>
                  <td
                    style={{
                      padding: "12px 12px 12px 0",
                      color: "var(--text-muted)",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <span>{row.feature}</span>
                    {row.tooltip && (
                      <span style={{ fontSize: 11, color: "var(--text-faint)", display: "block", marginTop: 2 }}>
                        {row.tooltip}
                      </span>
                    )}
                  </td>
                  {KEYS.map((k) => (
                    <Cell key={k} value={row[k]} highlight={k === "growth"} />
                  ))}
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Compare vs competitors CTA */}
      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link
          href="/compare"
          style={{
            fontSize: 13, color: "var(--text-muted)", textDecoration: "none",
            borderBottom: "1px solid var(--border)", paddingBottom: 2,
          }}
        >
          See how IntentLead compares to Apollo, Hunter, Clay →
        </Link>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

function FAQ() {
  return (
    <section style={{ maxWidth: 640, margin: "0 auto 80px" }}>
      <h2
        style={{
          fontSize: 24, fontWeight: 700, color: "var(--text)", margin: "0 0 28px",
          fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
        }}
      >
        Frequently asked questions
      </h2>
      <style>{`
        .faq-item { border-bottom: 1px solid var(--border); }
        .faq-item summary {
          list-style: none;
          display: flex; justify-content: space-between; align-items: center;
          padding: 18px 0; font-size: 15px; font-weight: 600;
          color: var(--text); cursor: pointer; user-select: none;
        }
        .faq-item summary::-webkit-details-marker { display: none; }
        .faq-item summary::after {
          content: "+"; font-size: 20px; font-weight: 300;
          color: var(--text-muted); flex-shrink: 0; margin-left: 16px; line-height: 1;
        }
        .faq-item[open] summary::after { content: "−"; }
        .faq-item .faq-body {
          padding: 0 0 18px; font-size: 14px;
          color: var(--text-muted); line-height: 1.65;
        }
      `}</style>
      {FAQS.map((faq) => (
        <details key={faq.q} className="faq-item">
          <summary>{faq.q}</summary>
          <p className="faq-body">{faq.a}</p>
        </details>
      ))}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <main style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      {/* Earlybird banner */}
      <div
        style={{
          background: "rgba(163,230,53,0.07)",
          borderBottom: "1px solid rgba(163,230,53,0.14)",
          padding: "10px 24px", textAlign: "center",
          fontSize: 13, color: "var(--text-muted)",
        }}
      >
        🔒{" "}
        <strong style={{ color: "var(--text)" }}>Early access pricing</strong> — locked in forever
        for the first 100 users.{" "}
        <Link href="/" style={{ color: "var(--accent)", textDecoration: "none" }}>
          Start free →
        </Link>
      </div>

      <div style={{ maxWidth: 1020, margin: "0 auto", padding: "64px 24px" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800,
              letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 12px",
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}
          >
            Simple pricing. No games.
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-muted)", margin: "0 auto", maxWidth: 480, lineHeight: 1.6 }}>
            Credit charged only when all 4 verification levels pass.{" "}
            <strong style={{ color: "var(--text)" }}>Rejected leads are free.</strong>
          </p>
        </div>

        {/* Simplified plan cards + billing toggle */}
        <PricingCards />

        {/* Comparison table */}
        <CompareTable />

        {/* FAQ */}
        <FAQ />

        {/* Try free — bottom CTA */}
        <div
          style={{
            borderTop: "1px solid var(--border)", paddingTop: 64,
            display: "flex", flexDirection: "column", alignItems: "center",
            textAlign: "center", gap: 12,
          }}
        >
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800,
              letterSpacing: "-0.02em", color: "var(--text)", margin: 0,
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}
          >
            Start finding leads for free
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 16, margin: "0 0 24px" }}>
            10 verified leads on us. No card required.
          </p>
          <div style={{ width: "100%", maxWidth: 720 }}>
            <Suspense>
              <LandingComposer variant="fat" composerId="pricing" />
            </Suspense>
          </div>
        </div>
      </div>

      <BackgroundBoxes />
    </main>
  );
}
