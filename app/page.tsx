import { Suspense } from "react";
import { StepWizard } from "@/components/landing/StepWizard";

const PRICING = [
  { name: "Free", price: "$0", leads: "10 leads", note: "One time, forever", cta: "Start free", highlight: false },
  { name: "Starter", price: "$39", leads: "30 leads/mo", note: "For solo founders", cta: "Get Starter", highlight: false },
  { name: "Growth", price: "$89", leads: "100 leads/mo", note: "For growing agencies", cta: "Get Growth", highlight: true },
  { name: "Agency", price: "$199", leads: "300 leads/mo", note: "High volume", cta: "Get Agency", highlight: false },
];

export default function Home() {
  return (
    <main
      style={{
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: "Inter, system-ui, sans-serif",
        minHeight: "100vh",
      }}
    >
      {/* Hero */}
      <section
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "80px 24px 60px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 9999,
            border: "1px solid rgba(163,230,53,0.3)",
            background: "rgba(163,230,53,0.08)",
            color: "var(--accent)",
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 24,
          }}
        >
          ● Signal-to-lead pipeline
        </div>

        <h1
          style={{
            fontSize: "clamp(36px, 5vw, 64px)",
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            marginBottom: 20,
          }}
        >
          Find people ready to buy.
        </h1>

        <p
          style={{
            color: "var(--text-muted)",
            fontSize: 18,
            maxWidth: 560,
            margin: "0 auto 40px",
            lineHeight: 1.6,
          }}
        >
          Reddit + HN signals → verified company → verified email → personalized message.
          Pay only for leads that pass all 4 verification levels.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 60 }}>
          <a
            href="/chat"
            style={{
              padding: "12px 28px",
              borderRadius: 9999,
              background: "var(--accent)",
              color: "var(--accent-fg)",
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Find leads for free →
          </a>
          <a
            href="#pricing"
            style={{
              padding: "12px 28px",
              borderRadius: 9999,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 15,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            See pricing
          </a>
        </div>

        {/* Trust strip */}
        <div
          style={{
            display: "flex",
            gap: 32,
            justifyContent: "center",
            flexWrap: "wrap",
            padding: "20px 0",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
            marginBottom: 60,
          }}
        >
          {[
            "4-level verification",
            "Credit charged only when verified",
            "<3% bounce rate",
            "Reddit + HN signals",
          ].map((item) => (
            <div key={item} style={{ color: "var(--text-muted)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--accent)" }}>✓</span>
              {item}
            </div>
          ))}
        </div>

        {/* Step wizard */}
        <Suspense>
          <StepWizard />
        </Suspense>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "60px 24px",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: 32,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          Simple pricing
        </h2>
        <p style={{ textAlign: "center", color: "var(--text-muted)", marginBottom: 40 }}>
          Credit charged only when all 4 verification levels pass. Rejected leads are free.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              style={{
                background: "var(--surface)",
                border: `1px solid ${plan.highlight ? "rgba(163,230,53,0.4)" : "var(--border)"}`,
                borderRadius: 16,
                padding: 24,
                position: "relative",
              }}
            >
              {plan.highlight && (
                <div
                  style={{
                    position: "absolute",
                    top: -10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--accent)",
                    color: "var(--accent-fg)",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 12px",
                    borderRadius: 9999,
                    whiteSpace: "nowrap",
                  }}
                >
                  MOST POPULAR
                </div>
              )}
              <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>{plan.name}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                {plan.price}
                {plan.price !== "$0" && <span style={{ fontSize: 14, color: "var(--text-muted)" }}>/mo</span>}
              </div>
              <div style={{ color: "var(--accent)", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{plan.leads}</div>
              <div style={{ color: "var(--text-faint)", fontSize: 12, marginBottom: 20 }}>{plan.note}</div>
              <a
                href="/chat"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "10px",
                  borderRadius: 8,
                  background: plan.highlight ? "var(--accent)" : "var(--surface-2)",
                  color: plan.highlight ? "var(--accent-fg)" : "var(--text)",
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: "none",
                  border: plan.highlight ? "none" : "1px solid var(--border)",
                }}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
