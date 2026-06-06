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
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px" }}>
        <p style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.15em", margin: "0 0 12px", fontWeight: 600 }}>
          Compare
        </p>
        <h1
          style={{
            fontSize: "clamp(24px, 4vw, 36px)",
            fontWeight: 700,
            color: "var(--text)",
            margin: "0 0 12px",
            fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
          }}
        >
          IntentLead vs the alternatives
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 48px", maxWidth: 480, lineHeight: 1.6 }}>
          How does intent-based lead generation compare to popular outbound tools? Honest comparisons — strengths and weaknesses.
        </p>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
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
                  borderRadius: 12,
                  padding: "20px",
                  textDecoration: "none",
                }}
                className="hover:border-[var(--border-strong)] transition-colors"
              >
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: "0 0 4px" }}>
                  IntentLead vs {c.name}
                </h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
                  {c.tagline}
                </p>
                <p style={{ fontSize: 12, color: "var(--accent)", margin: 0, fontWeight: 500 }}>
                  Compare →
                </p>
              </Link>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
