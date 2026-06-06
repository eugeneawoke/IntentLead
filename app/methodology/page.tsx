import Link from "next/link";
import DockNav from "@/components/ui/dock";
import BackgroundBoxes from "@/components/ui/background-boxes";

const LEVELS = [
  {
    level: "L1",
    color: "#A3E635",
    title: "Signal Detection",
    desc: "We scan Reddit and Hacker News using your keywords. Every post where someone expresses pain, asks for a tool, or compares solutions is a potential signal.",
    detail:
      "Signals are classified by GPT-4o-mini (confidence 0–100). Score < 80 → rejected immediately, before any expensive lookup.",
    technical: [
      "Keywords matched against post title + body + top comments",
      "Score is 0–100; threshold 80 filters ~65% of raw signals",
      "Deduplication: same company seen in 7 days → skipped",
    ],
    rejection: "Score below 80, keyword match in noise context, or duplicate signal within 7-day window → rejected, no further processing.",
  },
  {
    level: "L2",
    color: "#6BA4FF",
    title: "Company Identification",
    desc: "From the post author's username, we identify their company using Exa entity search + GPT extraction. No guessing — the domain must resolve.",
    detail:
      "If the company can't be identified with high confidence, the lead is rejected. L3 never runs.",
    technical: [
      "Exa entity search: semantic company search from username/profile data",
      "GPT-4o extracts: company name, domain, industry, employee count estimate",
      "Domain must return HTTP 200 and not be a free email provider",
    ],
    rejection: "No domain found, domain returns non-200, or domain belongs to a free email provider (gmail, outlook, etc.) → rejected.",
  },
  {
    level: "L3",
    color: "#C084FC",
    title: "Contact & Role Verification",
    desc: "We find the right decision-maker at the identified company. Role, seniority, and LinkedIn presence are checked.",
    detail:
      "We target founders, heads of growth, CMOs — whoever matches your ICP. Generic contacts are rejected.",
    technical: [
      "Role hierarchy: Founder > C-suite > VP > Head of > Director",
      "LinkedIn presence required for contact to be valid",
      "Apollo used as secondary source if primary APIs have no match",
    ],
    rejection: "No matching role found, contact lacks LinkedIn presence, or only generic/shared roles available → rejected.",
  },
  {
    level: "L4",
    color: "#34D399",
    title: "Email Waterfall",
    desc: "Email is found via waterfall: Prospeo → Hunter → Apollo. We verify deliverability before surfacing the lead.",
    detail:
      "Credit is only charged when all 4 levels pass. A rejected lead at any stage costs you nothing.",
    technical: [
      "Prospeo checked first (highest accuracy, pattern-based)",
      "Hunter as secondary (domain pattern fallback)",
      "Apollo as tertiary — marked 'requires verification' but still valid",
      "MX record check before surfacing — disposable/role emails rejected",
    ],
    rejection: "No email found across all three providers, MX record check fails, or email is a disposable/role address (hello@, info@) → rejected.",
  },
];


export default function MethodologyPage() {
  return (
    <main
      style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}
    >
      <div className="max-w-4xl mx-auto px-6 pb-24 pt-10">
        <div className="mb-16 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
            style={{
              border: "1px solid rgba(163,230,53,0.3)",
              background: "rgba(163,230,53,0.08)",
              color: "var(--accent)",
            }}
          >
            4-Level Verification
          </div>
          <h1
            className="text-4xl font-semibold mb-4"
            style={{ letterSpacing: "-0.02em", fontFamily: "Geist, sans-serif" }}
          >
            How the Pipeline Works
          </h1>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: 18,
              maxWidth: 560,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            Every lead passes 4 verification gates. Credit is only charged when
            all 4 are green. Rejected leads are free — that&apos;s the guarantee.
          </p>
        </div>

        {/* Level cards */}
        <div className="flex flex-col gap-6">
          {LEVELS.map((l) => (
            <div
              key={l.level}
              className="rounded-2xl p-8"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start gap-6">
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-xl text-sm font-bold"
                  style={{
                    width: 48,
                    height: 48,
                    background: `${l.color}18`,
                    border: `1px solid ${l.color}35`,
                    color: l.color,
                  }}
                >
                  {l.level}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold mb-2">{l.title}</h2>
                  <p
                    className="mb-3"
                    style={{
                      color: "var(--text-muted)",
                      fontSize: 15,
                      lineHeight: 1.6,
                    }}
                  >
                    {l.desc}
                  </p>
                  <p
                    className="text-sm px-4 py-3 rounded-xl mb-5"
                    style={{
                      background: "var(--surface-2)",
                      color: "var(--text-muted)",
                      borderLeft: `3px solid ${l.color}`,
                    }}
                  >
                    {l.detail}
                  </p>

                  {/* How it works technically */}
                  <div
                    className="rounded-xl px-5 py-4 mb-4"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                  >
                    <p
                      className="text-xs font-semibold uppercase tracking-wider mb-3"
                      style={{ color: l.color }}
                    >
                      How it works technically
                    </p>
                    <ul className="flex flex-col gap-2">
                      {l.technical.map((point, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm"
                          style={{ color: "var(--text-muted)", lineHeight: 1.55 }}
                        >
                          <span
                            className="flex-shrink-0 mt-0.5 rounded-full"
                            style={{
                              width: 5,
                              height: 5,
                              background: l.color,
                              marginTop: 7,
                            }}
                          />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Rejection criteria callout */}
                  <div
                    className="rounded-xl px-4 py-3 flex items-start gap-3"
                    style={{
                      background: "rgba(251,146,60,0.07)",
                      border: "1px solid rgba(251,146,60,0.2)",
                    }}
                  >
                    <span
                      className="flex-shrink-0 text-xs font-bold px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(251,146,60,0.15)",
                        color: "#FB923C",
                        marginTop: 1,
                      }}
                    >
                      ⚠
                    </span>
                    <p
                      className="text-sm"
                      style={{ color: "rgba(251,146,60,0.85)", lineHeight: 1.55 }}
                    >
                      <span className="font-semibold">Rejection criteria: </span>
                      {l.rejection}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Why rejection is a feature */}
        <div
          className="mt-14 rounded-2xl p-8"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="mb-6">
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--accent)" }}
            >
              Quality guarantee
            </p>
            <h2 className="text-2xl font-semibold" style={{ letterSpacing: "-0.02em" }}>
              Why rejection is a feature
            </h2>
            <p
              className="mt-3 text-sm"
              style={{ color: "var(--text-muted)", lineHeight: 1.65, maxWidth: 560 }}
            >
              Most lead tools surface everything and let you deal with the noise.
              IntentLead rejects 70–85% of signals by design — because a single
              bounced email costs more in reputation than the contact was ever worth.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {[
              {
                label: "Industry avg. bounce rate",
                value: "~35%",
                sub: "cold email lists",
                accent: "#FB923C",
              },
              {
                label: "IntentLead verified bounce rate",
                value: "<3%",
                sub: "post 4-level verification",
                accent: "#A3E635",
              },
              {
                label: "Signal rejection rate",
                value: "70–85%",
                sub: "normal and expected",
                accent: "#6BA4FF",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl px-5 py-5"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <p
                  className="text-3xl font-bold mb-1"
                  style={{ color: stat.accent, letterSpacing: "-0.03em" }}
                >
                  {stat.value}
                </p>
                <p className="text-sm font-medium mb-0.5">{stat.label}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {stat.sub}
                </p>
              </div>
            ))}
          </div>

          <p
            className="mt-5 text-sm"
            style={{
              color: "var(--text-muted)",
              borderTop: "1px solid var(--border)",
              paddingTop: 16,
              lineHeight: 1.65,
            }}
          >
            A 70% rejection rate is the system working correctly. Each gate exists because
            the cost of a bad lead — wasted outreach, domain reputation damage, manual
            cleanup — outweighs the cost of passing fewer leads through.
          </p>
        </div>

        {/* Full pipeline diagram */}
        <div
          className="mt-8 rounded-2xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden" }}
        >
          <div className="px-8 pt-7 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--accent)" }}>
              End-to-end flow
            </p>
            <h2 className="text-2xl font-semibold mb-0" style={{ letterSpacing: "-0.02em" }}>
              Full pipeline
            </h2>
          </div>

          {/* Steps table */}
          <div className="mt-4">
            {[
              { level: "L1", color: "#A3E635", bg: "rgba(163,230,53,0.05)", input: "Reddit / HN post", process: "GPT-4o-mini intent classification", gate: "Score < 80 → rejected" },
              { level: "L2", color: "#6BA4FF", bg: "rgba(107,164,255,0.05)", input: "Post author profile", process: "Exa entity search + GPT domain extract", gate: "No domain resolved → rejected" },
              { level: "L3", color: "#C084FC", bg: "rgba(192,132,252,0.05)", input: "Company domain", process: "Role lookup — LinkedIn / Apollo", gate: "No decision-maker found → rejected" },
              { level: "L4", color: "#34D399", bg: "rgba(52,211,153,0.05)", input: "Decision-maker profile", process: "Email waterfall: Prospeo → Hunter → Apollo", gate: "No verified email → rejected" },
            ].map((step, i) => (
              <div
                key={step.level}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 1fr 1fr",
                  gap: 0,
                  borderTop: i === 0 ? "1px solid var(--border)" : "1px solid var(--border)",
                  background: step.bg,
                  padding: "14px 32px",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: step.color,
                    fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
                  }}
                >
                  {step.level}
                </span>
                <span style={{ fontSize: 13, color: "var(--text-muted)", paddingRight: 16 }}>
                  {step.input}
                </span>
                <span style={{ fontSize: 13, color: "var(--text)", paddingRight: 16 }}>
                  {step.process}
                </span>
                <span style={{ fontSize: 12, color: "#FB923C", opacity: 0.85 }}>
                  {step.gate}
                </span>
              </div>
            ))}

            {/* Final: Verified lead */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "16px 32px",
                borderTop: "1px solid var(--border)",
                background: "rgba(163,230,53,0.06)",
              }}
            >
              <span style={{ fontSize: 20 }}>✓</span>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)", margin: 0 }}>
                  Verified lead
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                  Credit charged only at this point. All 4 gates green.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA — unchanged */}
        <div
          className="mt-12 rounded-2xl p-10 text-center"
          style={{
            background: "rgba(163,230,53,0.06)",
            border: "1px solid rgba(163,230,53,0.2)",
          }}
        >
          <h3 className="text-xl font-semibold mb-2">Rejected is normal</h3>
          <p
            style={{
              color: "var(--text-muted)",
              maxWidth: 480,
              margin: "0 auto 24px",
              lineHeight: 1.6,
            }}
          >
            If 80% of signals get rejected, that means the system is working.
            You get 10 perfect leads instead of 50 questionable ones.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold"
            style={{
              background: "var(--accent)",
              color: "var(--accent-fg)",
              textDecoration: "none",
            }}
          >
            Find verified leads →
          </Link>
        </div>
      </div>
      <BackgroundBoxes />
      <DockNav />
    </main>
  );
}
