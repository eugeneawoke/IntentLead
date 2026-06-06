import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { competitors, competitorSlugs } from "@/lib/vs/competitors";

export const metadata: Metadata = {
  title: "IntentLead AI vs Alternatives — Competitor Comparisons",
  description: "Compare IntentLead AI with Clay, Apollo, Hunter, Instantly, and Lemlist. See how intent-based lead generation stacks up.",
};

export default function VsIndexPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "80px 24px 64px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 64 }}>
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
            marginBottom: 20,
          }}>
            Honest comparisons
          </div>
          <h1 style={{
            fontSize: "clamp(28px, 5vw, 48px)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text)",
            margin: "0 0 16px",
            fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
          }}>
            IntentLead vs the alternatives
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-muted)", margin: 0, maxWidth: 520, marginInline: "auto", lineHeight: 1.7 }}>
            Most tools give you a list to search — IntentLead gives you people who are searching right now.
            See how we compare.
          </p>
        </div>

        {/* Cards grid */}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {competitorSlugs.map((slug) => {
            const c = competitors[slug];
            return (
              <Link
                key={slug}
                href={`/vs/${slug}`}
                style={{
                  display: "block",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  padding: "24px",
                  textDecoration: "none",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                className="group hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", margin: "0 0 4px", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
                      vs {c.name}
                    </h2>
                    <p style={{ fontSize: 11, color: "var(--text-faint)", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {c.pricingRange}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--accent)",
                      fontWeight: 600,
                      opacity: 0,
                      transition: "opacity 0.15s",
                    }}
                    className="group-hover:opacity-100"
                  >
                    View →
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {c.tldr}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {c.targetKeywords.slice(0, 2).map((kw) => (
                    <span key={kw} style={{
                      fontSize: 10,
                      color: "var(--text-faint)",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      padding: "2px 8px",
                      letterSpacing: "0.04em",
                    }}>
                      {kw}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
