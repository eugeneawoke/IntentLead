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

        <p style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600, margin: "0 0 8px" }}>
          vs
        </p>
        <h1
          style={{
            fontSize: "clamp(24px, 4vw, 40px)",
            fontWeight: 800,
            color: "var(--text)",
            margin: "0 0 16px",
            fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
          }}
        >
          IntentLead AI vs {c.name}
        </h1>

        {/* TL;DR */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 48,
            fontSize: 14,
            color: "var(--text-muted)",
            lineHeight: 1.7,
          }}
        >
          <strong style={{ color: "var(--text)" }}>TL;DR — </strong>
          {c.tldr}
        </div>

        {/* Comparison table */}
        <section style={{ marginBottom: 48 }}>
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
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px 12px 0", color: "var(--text-muted)", fontWeight: 500 }}>Feature</th>
                  <th style={{ textAlign: "center", padding: "8px 12px 12px", color: "var(--accent)", fontWeight: 600 }}>IntentLead</th>
                  <th style={{ textAlign: "center", padding: "8px 0 12px 12px", color: "var(--text-muted)", fontWeight: 500 }}>{c.name}</th>
                </tr>
              </thead>
              <tbody>
                {c.features.map((f, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "10px 12px 10px 0", color: "var(--text-muted)" }}>{f.label}</td>
                    <td style={{ textAlign: "center", padding: "10px 12px" }}>
                      <FeatureValue value={f.intentlead} />
                    </td>
                    <td style={{ textAlign: "center", padding: "10px 0 10px 12px" }}>
                      <FeatureValue value={f.competitor} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "8px 0 0" }}>
              As of {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}. Pricing and features may change.
            </p>
          </div>
        </section>

        {/* Strengths */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: "0 0 16px", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
            Where {c.name} is strong
          </h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {c.strengths.map((s) => (
              <li key={s} style={{ display: "flex", gap: 10, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
                <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>+</span>
                {s}
              </li>
            ))}
          </ul>
        </section>

        {/* Weaknesses */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: "0 0 16px", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
            Where it falls short
          </h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {c.weaknesses.map((w) => (
              <li key={w} style={{ display: "flex", gap: 10, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
                <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>−</span>
                {w}
              </li>
            ))}
          </ul>
        </section>

        {/* Who it's for */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: "0 0 16px", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
            Who should use what
          </h2>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Choose {c.name} if:
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
                {c.whoFor.competitor}
              </p>
            </div>
            <div style={{ background: "rgba(163,230,53,0.05)", border: "1px solid rgba(163,230,53,0.2)", borderRadius: 10, padding: "16px" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Choose IntentLead if:
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
                {c.whoFor.intentlead}
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "32px 28px",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "0 0 8px", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
            Try IntentLead free
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 20px" }}>
            10 verified leads, no credit card required. See the difference intent makes.
          </p>
          <Link
            href={`/?utm_source=vs&utm_medium=organic&utm_campaign=comparison&utm_content=${slug}`}
            style={{
              display: "inline-block",
              background: "var(--accent)",
              color: "var(--accent-fg)",
              padding: "12px 28px",
              borderRadius: 10,
              fontSize: 14,
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
