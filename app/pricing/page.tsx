import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import LandingComposer from "@/components/landing/LandingComposer";
import BackgroundBoxes from "@/components/ui/background-boxes";

export const metadata: Metadata = {
  title: "Pricing — IntentLead AI",
  description: "Simple credit-based pricing. Pay only for leads that pass all 4 verification levels. Start free — 10 verified leads, no card required.",
};

const PLANS = [
  {
    name: "Free",
    monthly: 0,
    leads: "10 verified leads",
    note: "One time, forever. No card required.",
    cta: "Start free",
    href: "/",
    highlight: false,
    earlybird: false,
    earlybirdNote: "",
    features: ["Full 4-level verification", "Email + company + contact", "Personalized message"],
  },
  {
    name: "Starter",
    monthly: 39,
    leads: "30 leads/mo",
    note: "Solo founders & freelancers",
    cta: "Get Starter",
    href: "https://payproglobal.com",
    highlight: false,
    earlybird: true,
    earlybirdNote: "100 leads first 3 months, then 30/mo",
    features: ["Everything in Free", "30 verified leads/mo", "CSV export", "Plan & Strategy modes"],
  },
  {
    name: "Growth",
    monthly: 89,
    leads: "100 leads/mo",
    note: "Growing outbound agencies",
    cta: "Get Growth",
    href: "https://payproglobal.com",
    highlight: true,
    earlybird: true,
    earlybirdNote: "Price locked forever",
    features: ["Everything in Starter", "100 verified leads/mo", "Priority pipeline", "3 team members"],
  },
  {
    name: "Agency",
    monthly: 199,
    leads: "300 leads/mo",
    note: "High-volume agencies",
    cta: "Get Agency",
    href: "https://payproglobal.com",
    highlight: false,
    earlybird: false,
    earlybirdNote: "",
    features: ["Everything in Growth", "300 verified leads/mo", "10 team members", "API access", "Unlimited Plan/Strategy"],
  },
];

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
    a: "First 100 users get price-locked rates forever. Starter gets 100 leads/month for the first 3 months (then 30/mo at the same $39 price). Growth gets price locked at $89/mo regardless of future price increases.",
  },
  {
    q: "What happens when I use all my free leads?",
    a: "Your 10 free leads are a one-time allocation — they don't reset monthly. When they're used, you'll see an upgrade prompt. You keep access to all your verified leads and generated emails forever.",
  },
  {
    q: "Can I use Plan and Strategy modes without credits?",
    a: "Yes. Plan (outreach sequence builder) and Strategy (ICP & messaging refinement) are AI-only chat modes. They don't run the lead pipeline and don't consume credits. They do have daily message limits by plan.",
  },
  {
    q: "How are payments handled?",
    a: "Payments are processed by PayPro Global (Merchant of Record). They handle taxes, VAT, and billing compliance so you don't have to. We never see your card details.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel anytime — your plan stays active until the end of the billing period. No penalties, no questions.",
  },
  {
    q: "What sources do you use for signals?",
    a: "Reddit, Hacker News, GitHub, Stack Overflow, VK, Telegram, Habr, vc.ru, Google Reviews, Yelp, 2GIS, Yandex Business, and Foursquare. The sources used depend on your business type (SaaS vs local vs enterprise).",
  },
];

const COMPARISON: Array<{ feature: string; free: boolean | string; starter: boolean | string; growth: boolean | string; agency: boolean | string }> = [
  { feature: "Verified leads", free: "10 (one-time)", starter: "30/mo", growth: "100/mo", agency: "300/mo" },
  { feature: "4-level verification", free: true, starter: true, growth: true, agency: true },
  { feature: "Credit guarantee (pay only on verified)", free: true, starter: true, growth: true, agency: true },
  { feature: "Personalized email message", free: true, starter: true, growth: true, agency: true },
  { feature: "CSV export", free: false, starter: true, growth: true, agency: true },
  { feature: "Plan mode (outreach sequences)", free: "20 msg/day", starter: "100 msg/day", growth: "300 msg/day", agency: "Unlimited" },
  { feature: "Strategy mode (ICP refinement)", free: "20 msg/day", starter: "100 msg/day", growth: "300 msg/day", agency: "Unlimited" },
  { feature: "Team members", free: "1", starter: "1", growth: "3", agency: "10" },
  { feature: "Priority pipeline", free: false, starter: false, growth: true, agency: true },
  { feature: "API access", free: false, starter: false, growth: false, agency: true },
];

function PlanCard({ plan }: { plan: typeof PLANS[0] }) {
  return (
    <div
      style={{
        background: plan.highlight ? "var(--surface-2)" : "var(--surface)",
        border: `1px solid ${plan.highlight ? "rgba(163,230,53,0.5)" : "var(--border)"}`,
        borderRadius: 16,
        padding: "28px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        position: "relative",
        boxShadow: plan.highlight ? "0 0 40px rgba(163,230,53,0.08)" : "none",
      }}
    >
      {plan.highlight && (
        <div
          style={{
            position: "absolute",
            top: -1,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--accent)",
            color: "var(--accent-fg)",
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 12px",
            borderRadius: "0 0 8px 8px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Most popular
        </div>
      )}

      {plan.earlybird && (
        <div
          style={{
            fontSize: 11,
            color: "var(--accent)",
            fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          ⚡ Early access · {plan.earlybirdNote}
        </div>
      )}

      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>
          {plan.name}
        </h3>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
          {plan.note}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          style={{
            fontSize: plan.monthly === 0 ? 36 : 40,
            fontWeight: 800,
            color: "var(--text)",
            letterSpacing: "-0.02em",
            fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
          }}
        >
          {plan.monthly === 0 ? "Free" : `$${plan.monthly}`}
        </span>
        {plan.monthly > 0 && (
          <span style={{ fontSize: 14, color: "var(--text-muted)" }}>/mo</span>
        )}
      </div>

      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{plan.leads}</p>

      <a
        href={plan.href}
        style={{
          display: "block",
          textAlign: "center",
          padding: "11px 0",
          borderRadius: 10,
          background: plan.highlight ? "var(--accent)" : "var(--surface-2)",
          color: plan.highlight ? "var(--accent-fg)" : "var(--text)",
          border: plan.highlight ? "none" : "1px solid var(--border)",
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        {plan.cta}
      </a>

      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {plan.features.map((f) => (
          <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
            <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PricingPage() {
  return (
    <main style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      {/* Earlybird banner */}
      <div
        style={{
          background: "rgba(163,230,53,0.08)",
          borderBottom: "1px solid rgba(163,230,53,0.15)",
          padding: "10px 24px",
          textAlign: "center",
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        🔒 <strong style={{ color: "var(--text)" }}>Early access pricing</strong> — locked in forever for the first 100 users.{" "}
        <Link href="/" style={{ color: "var(--accent)", textDecoration: "none" }}>
          Start free →
        </Link>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "64px 24px" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 56px)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              margin: "0 0 12px",
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}
          >
            Simple pricing. No games.
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-muted)", margin: 0, maxWidth: 480, marginInline: "auto" }}>
            Credit charged only when all 4 verification levels pass.{" "}
            <strong style={{ color: "var(--text)" }}>Rejected leads are free.</strong>
          </p>
        </div>

        {/* Plan grid — responsive 4-col */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {PLANS.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>

        {/* Comparison table */}
        <section className="mb-16 overflow-x-auto">
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "0 0 24px", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
            Compare plans
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "10px 12px 10px 0", color: "var(--text-muted)", fontWeight: 500, minWidth: 180 }}>Feature</th>
                <th style={{ textAlign: "center", padding: "10px 12px", color: "var(--text-muted)", fontWeight: 500 }}>Free</th>
                <th style={{ textAlign: "center", padding: "10px 12px", color: "var(--text-muted)", fontWeight: 500 }}>Starter</th>
                <th style={{ textAlign: "center", padding: "10px 12px", color: "var(--accent)", fontWeight: 600 }}>Growth</th>
                <th style={{ textAlign: "center", padding: "10px 0 10px 12px", color: "var(--text-muted)", fontWeight: 500 }}>Agency</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.feature} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "10px 12px 10px 0", color: "var(--text-muted)" }}>{row.feature}</td>
                  {(["free", "starter", "growth", "agency"] as const).map((plan) => (
                    <td key={plan} style={{ textAlign: "center", padding: "10px 12px", color: row[plan] === true ? "var(--accent)" : row[plan] === false ? "var(--text-faint)" : "var(--text-muted)", fontWeight: row[plan] === true || row[plan] === false ? 700 : 400, fontSize: typeof row[plan] === "string" ? 12 : 14 }}>
                      {row[plan] === true ? "✓" : row[plan] === false ? "—" : row[plan]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* FAQ */}
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--text)",
              margin: "0 0 32px",
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}
          >
            Frequently asked questions
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {FAQS.map((faq) => (
              <div key={faq.q} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: "0 0 8px" }}>
                  {faq.q}
                </h3>
                <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Try free — AI chat */}
        <div style={{ marginTop: 80, borderTop: "1px solid var(--border)", paddingTop: 64, textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 12px", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
            Start finding leads for free
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 16, margin: "0 0 32px" }}>
            10 verified leads on us. No card required.
          </p>
          <div className="w-full max-w-3xl mx-auto">
            <Suspense>
              <LandingComposer variant="fat" composerId="pricing" />
            </Suspense>
          </div>
        </div>
      </div>

      <Footer />
      <BackgroundBoxes />
    </main>
  );
}
