import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { competitors, competitorSlugs } from "@/lib/vs/competitors";

export function generateStaticParams() {
  return competitorSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = competitors[slug];
  if (!c) return {};
  return {
    title: `IntentLead AI vs ${c.name} — ${new Date().getFullYear()}`,
    description: c.tldr,
    keywords: c.targetKeywords,
  };
}

function Check() {
  return <span style={{ color: "var(--accent)", fontWeight: 700 }}>✓</span>;
}

function Cross() {
  return <span style={{ color: "#6B7280" }}>✕</span>;
}

function FeatureValue({ value }: { value: true | false | string }) {
  if (value === true) return <Check />;
  if (value === false) return <Cross />;
  return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{value}</span>;
}

export default async function VsSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = competitors[slug];
  if (!c) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px" }}>

        {/* Back link */}
        <div style={{ marginBottom: 32 }}>
          <Link
            href="/vs"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "var(--text-muted)",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={14} />
            All comparisons
          </Link>
        </div>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(163,230,53,0.08)",
            border: "1px solid rgba(163,230,53,0.2)",
            borderRadius: 999,
            padding: "4px 14px",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--accent)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 16,
          }}>
            vs {c.name}
          </div>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 44px)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              margin: "0 0 8px",
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}
          >
            IntentLead AI vs {c.name}
          </h1>
        </div>

        {/* TL;DR */}
        <div
          style={{
            borderLeft: "3px solid var(--accent)",
            paddingLeft: 20,
            marginBottom: 56,
            fontSize: 15,
            color: "var(--text-muted)",
            lineHeight: 1.8,
          }}
        >
          <strong style={{ color: "var(--text)", display: "block", marginBottom: 4 }}>The short version</strong>
          {c.tldr}
        </div>

        {/* Comparison table */}
        <section style={{ marginBottom: 56 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text)",
              margin: "0 0 20px",
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}
          >
            Feature comparison
          </h2>
          <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{
                  position: "sticky",
                  top: 0,
                  background: "var(--bg)",
                  zIndex: 10,
                  borderBottom: "1px solid var(--border)",
                }}>
                  <th style={{ textAlign: "left", padding: "14px 16px", color: "var(--text-muted)", fontWeight: 500 }}>Feature</th>
                  <th style={{ textAlign: "center", padding: "14px 16px", color: "var(--accent)", fontWeight: 700 }}>IntentLead</th>
                  <th style={{ textAlign: "center", padding: "14px 16px", color: "var(--text-muted)", fontWeight: 500 }}>{c.name}</th>
                </tr>
              </thead>
              <tbody>
                {c.features.map((f, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      background: i % 2 === 1 ? "rgba(255,255,255,0.02)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "11px 16px", color: "var(--text-muted)" }}>{f.label}</td>
                    <td style={{
                      textAlign: "center",
                      padding: "11px 16px",
                      borderLeft: "1px solid rgba(163,230,53,0.12)",
                      borderRight: "1px solid rgba(163,230,53,0.12)",
                    }}>
                      <FeatureValue value={f.intentlead} />
                    </td>
                    <td style={{ textAlign: "center", padding: "11px 16px" }}>
                      <FeatureValue value={f.competitor} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "10px 0 0" }}>
            As of {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}. Pricing and features may change.
          </p>
        </section>

        {/* Strengths */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: "0 0 16px", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
            Where {c.name} is strong
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {c.strengths.map((s) => (
              <span key={s} style={{
                background: "rgba(163,230,53,0.06)",
                border: "1px solid rgba(163,230,53,0.15)",
                color: "var(--text-muted)",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                lineHeight: 1.5,
              }}>
                {s}
              </span>
            ))}
          </div>
        </section>

        {/* Weaknesses */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: "0 0 16px", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
            Where it falls short
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {c.weaknesses.map((w) => (
              <span key={w} style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                lineHeight: 1.5,
              }}>
                {w}
              </span>
            ))}
          </div>
        </section>

        {/* Who it's for */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: "0 0 16px", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
            Who should use what
          </h2>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Choose {c.name} if:
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.7 }}>
                {c.whoFor.competitor}
              </p>
            </div>
            <div style={{ background: "rgba(163,230,53,0.05)", border: "1px solid rgba(163,230,53,0.2)", borderRadius: 12, padding: "20px" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Choose IntentLead if:
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.7 }}>
                {c.whoFor.intentlead}
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid rgba(163,230,53,0.3)",
            borderRadius: 20,
            padding: "40px 32px",
            textAlign: "center",
            boxShadow: "0 0 60px rgba(163,230,53,0.06)",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
            Start for free
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", margin: "0 0 10px", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
            Try IntentLead free
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px", lineHeight: 1.6 }}>
            10 verified leads, no credit card. See the difference intent makes.
          </p>
          <Link
            href={`/?utm_source=vs&utm_medium=organic&utm_campaign=comparison&utm_content=${slug}`}
            style={{
              display: "inline-block",
              background: "var(--accent)",
              color: "var(--accent-fg)",
              padding: "13px 32px",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Get 10 free verified leads →
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
