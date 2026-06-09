import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import BackgroundBoxes from "@/components/ui/background-boxes";
import { CompareHeroButton } from "@/components/compare/CompareHeroButton";
import { CompareTableScroll } from "@/components/compare/CompareTableScroll";

export const metadata: Metadata = {
  title: "Why teams switch to IntentLead AI — vs Apollo, Hunter, Clay, Instantly, Lemlist",
  description:
    "IntentLead AI vs Apollo, Hunter.io, Clay, Instantly, Lemlist. The only lead gen tool with 4-level verification and credit guarantee. Compare features and pricing.",
};

// ── Mockup UI components (chess section visuals) ──────────────────────────────

function BrowserFrame({
  children,
  tilt = "right",
}: {
  children: React.ReactNode;
  tilt?: "left" | "right";
}) {
  return (
    <div style={{ perspective: 1000, flexShrink: 0 }}>
      <div
        style={{
          transform:
            tilt === "right"
              ? "rotateY(-8deg) rotateX(3deg)"
              : "rotateY(8deg) rotateX(3deg)",
          transformOrigin: tilt === "right" ? "right center" : "left center",
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
          background: "var(--surface)",
          width: 440,
          maxWidth: "100%",
        }}
      >
        {/* Browser toolbar */}
        <div
          style={{
            background: "var(--surface-2)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F57", flexShrink: 0 }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FEBC2E", flexShrink: 0 }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28C840", flexShrink: 0 }} />
          <div
            style={{
              flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 6,
              height: 22, marginLeft: 8, display: "flex", alignItems: "center",
              padding: "0 10px",
            }}
          >
            <span style={{ fontSize: 10, color: "var(--text-faint)" }}>app.intentlead.ai</span>
          </div>
        </div>
        {/* Content */}
        <div style={{ padding: "20px" }}>{children}</div>
      </div>
    </div>
  );
}

function SignalMockup() {
  return (
    <BrowserFrame tilt="right">
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{
            background: "rgba(255,100,60,0.15)", color: "#FF6430",
            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, letterSpacing: "0.05em",
          }}>r/SaaS</span>
          <span style={{ fontSize: 10, color: "var(--text-faint)" }}>2 hours ago</span>
          <span style={{
            marginLeft: "auto", background: "rgba(163,230,53,0.12)", color: "var(--accent)",
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, letterSpacing: "0.04em",
          }}>Intent · 94%</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
          &quot;We&apos;ve tried 3 tools for outbound but none identify{" "}
          <strong style={{ color: "var(--text)" }}>who is actually looking</strong> for us.
          Any recommendations for intent-based lead gen?&quot;
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          "Signal captured",
          "Company: Acme Corp · SaaS · 50–200",
          "Contact: Sarah Chen, VP Sales",
          "Email: s.chen@acmecorp.com · verified",
        ].map((step) => (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <span style={{
              width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
              background: "rgba(163,230,53,0.15)", color: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700,
            }}>✓</span>
            <span style={{ color: "var(--text-muted)" }}>{step}</span>
          </div>
        ))}
      </div>
    </BrowserFrame>
  );
}

function VerificationMockup() {
  return (
    <BrowserFrame tilt="left">
      <div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
            Sarah Chen — VP Sales, Acme Corp
          </div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>Lead verified · 1 credit charged</div>
        </div>
        {[
          { level: "L1", label: "Signal intent", detail: "94% match · r/SaaS" },
          { level: "L2", label: "Company identified", detail: "Acme Corp · 120 employees" },
          { level: "L3", label: "Contact role verified", detail: "VP Sales · decision maker" },
          { level: "L4", label: "Email verified", detail: "s.chen@acmecorp.com · <3% bounce" },
        ].map((item) => (
          <div
            key={item.level}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
              background: "rgba(163,230,53,0.04)", border: "1px solid rgba(163,230,53,0.12)",
              borderRadius: 8, marginBottom: 6,
            }}
          >
            <span style={{
              fontSize: 9, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.06em",
              background: "rgba(163,230,53,0.15)", padding: "2px 6px", borderRadius: 4,
            }}>{item.level}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>{item.label}</div>
              <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{item.detail}</div>
            </div>
            <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: 700 }}>✓</span>
          </div>
        ))}
      </div>
    </BrowserFrame>
  );
}

function EmailMockup() {
  return (
    <BrowserFrame tilt="right">
      <div>
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            background: "rgba(163,230,53,0.1)", color: "var(--accent)",
            fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.06em",
          }}>GPT-4o</span>
          Generated from r/SaaS signal
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.5 }}>
          <span style={{ color: "var(--text-faint)" }}>Subject: </span>
          <span style={{ color: "var(--text)", fontWeight: 500 }}>Re: intent-based lead gen tools</span>
        </div>
        <div style={{
          fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7,
          borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12,
        }}>
          Hi Sarah,
          <br /><br />
          Saw your post in r/SaaS — specifically about tools that can&apos;t tell you{" "}
          <strong style={{ color: "var(--text)" }}>who is actively looking</strong> for your solution.
          <br /><br />
          That&apos;s exactly what IntentLead solves. We source from Reddit + HN, verify
          company, role, and email before you pay a credit.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button style={{
            background: "var(--accent)", color: "var(--accent-fg)",
            border: "none", borderRadius: 7, padding: "7px 14px",
            fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}>Copy message</button>
          <button style={{
            background: "var(--surface-2)", color: "var(--text-muted)",
            border: "1px solid var(--border)", borderRadius: 7, padding: "7px 14px",
            fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>Regenerate</button>
        </div>
      </div>
    </BrowserFrame>
  );
}

// ── Chess blocks data ─────────────────────────────────────────────────────────

const CHESS_BLOCKS = [
  {
    label: "Step 01",
    heading: "Catch intent as it happens.",
    body: "IntentLead monitors Reddit, Hacker News, and more for signals that match your ICP — not tomorrow's news, but live posts from people expressing the exact pain you solve.",
    visual: <SignalMockup />,
    align: "left" as const,
  },
  {
    label: "Step 02",
    heading: "4 levels of verification. Zero doubt.",
    body: "Signal → Company → Decision-maker → Email. All 4 must pass before a lead is verified. If one fails, no credit charged. No other tool does this.",
    visual: <VerificationMockup />,
    align: "right" as const,
  },
  {
    label: "Step 03",
    heading: "A personalized email, ready to send.",
    body: "GPT-4o writes the first message from the actual signal that triggered the lead — not a template. Your prospect recognizes their own context. Reply rates follow.",
    visual: <EmailMockup />,
    align: "left" as const,
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ComparePage() {
  return (
    <main style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px 80px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 80px" }}>
          <h1
            style={{
              fontSize: "clamp(36px, 5.5vw, 64px)",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: "var(--text)",
              margin: "0 0 20px",
              lineHeight: 1.08,
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}
          >
            Why teams are switching{" "}
            <span style={{ color: "var(--accent)" }}>to IntentLead AI</span>
          </h1>
          <p style={{
            fontSize: 18,
            color: "var(--text-muted)",
            margin: "0 auto 32px",
            lineHeight: 1.65,
            maxWidth: 560,
          }}>
            The only lead gen tool that sources intent signals, verifies 4 levels, and guarantees
            every credit — so you only pay for leads that are actually real.
          </p>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <CompareHeroButton />
            <span style={{ fontSize: 13, color: "var(--text-faint)" }}>
              No card required · 10 verified leads free
            </span>
          </div>
        </div>

        {/* Chess section */}
        <section style={{ marginBottom: 96 }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{
              display: "inline-block", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: "var(--accent)", background: "rgba(163,230,53,0.1)",
              padding: "4px 12px", borderRadius: 20, marginBottom: 16,
            }}>
              How it works
            </div>
            <h2
              style={{
                fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 800,
                letterSpacing: "-0.02em", color: "var(--text)", margin: 0,
                fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
              }}
            >
              The best teams choose IntentLead
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 96 }}>
            {CHESS_BLOCKS.map((block) => (
              <div
                key={block.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 48,
                  flexDirection: block.align === "right" ? "row-reverse" : "row",
                  flexWrap: "wrap",
                }}
              >
                {/* Text */}
                <div style={{ flex: "1 1 300px", minWidth: 280, maxWidth: 400 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                    textTransform: "uppercase", color: "var(--accent)", marginBottom: 12,
                  }}>
                    {block.label}
                  </div>
                  <h3
                    style={{
                      fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 800,
                      letterSpacing: "-0.02em", color: "var(--text)",
                      margin: "0 0 16px", lineHeight: 1.2,
                      fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
                    }}
                  >
                    {block.heading}
                  </h3>
                  <p style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>
                    {block.body}
                  </p>
                </div>

                {/* Visual */}
                <div style={{ flex: "1 1 400px", display: "flex", justifyContent: "center" }}>
                  {block.visual}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison table */}
        <section style={{ marginBottom: 80 }}>
          <div style={{ marginBottom: 32 }}>
            <h2
              style={{
                fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 800,
                letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 8px",
                fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
              }}
            >
              Full feature comparison
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
              Scroll or use arrows to compare all 5 alternatives. Click &ldquo;Full comparison&rdquo; for a detailed head-to-head.
            </p>
          </div>
          <CompareTableScroll />
        </section>

        {/* Bottom CTA */}
        <div
          style={{
            borderTop: "1px solid var(--border)", paddingTop: 64,
            display: "flex", flexDirection: "column", alignItems: "center",
            textAlign: "center", gap: 16,
          }}
        >
          <h2
            style={{
              fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 800,
              letterSpacing: "-0.02em", color: "var(--text)", margin: 0,
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}
          >
            Ready to pay only for leads that work?
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: 16, margin: 0, maxWidth: 480, lineHeight: 1.6 }}>
            10 verified leads free. No card required. If a lead doesn&apos;t pass all 4 levels,
            you pay nothing.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
            <CompareHeroButton />
            <Link
              href="/pricing"
              style={{
                display: "inline-block", padding: "13px 28px",
                background: "transparent", color: "var(--text)",
                border: "1px solid var(--border-strong)",
                borderRadius: 12, fontSize: 15, fontWeight: 600,
                textDecoration: "none",
              }}
            >
              See pricing
            </Link>
          </div>
        </div>
      </div>

      <BackgroundBoxes />
    </main>
  );
}
