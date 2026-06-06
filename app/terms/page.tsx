import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Terms of Service — IntentLead AI",
  description: "Terms of service for IntentLead AI — credit guarantee, billing, and acceptable use.",
};

const UPDATED = "June 6, 2026";
const EMAIL = "support@glook.dev";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "var(--text)",
          margin: "0 0 12px",
          fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "64px 24px" }}>
        <div style={{ marginBottom: 32 }}>
          <Link
            href="/"
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
            Back
          </Link>
        </div>

        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "var(--text)",
            margin: "0 0 6px",
            fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
          }}
        >
          Terms of Service
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 48px" }}>
          Effective date: {UPDATED}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          <Section title="1. Acceptance">
            <p>
              By accessing or using IntentLead AI (&quot;the Service&quot;), you agree to be bound by these
              Terms. If you do not agree, do not use the Service. IntentLead AI is operated by Eugene Gusakov.
            </p>
          </Section>

          <Section title="2. Description of service">
            <p>
              IntentLead AI is an intent-based lead generation tool. It scans public sources (Reddit, Hacker
              News, VK, GitHub, and others) for intent signals, identifies relevant companies and
              decision-makers, verifies email addresses through a four-level waterfall, and generates
              personalized outreach messages.
            </p>
          </Section>

          <Section title="3. Acceptable use">
            <p>You agree not to:</p>
            <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <li>Use the Service to send spam, unsolicited mass outreach, or bulk automated emails without recipient consent.</li>
              <li>Run lead generation on protected categories of personal data (health, financial status, political views, etc.).</li>
              <li>Violate applicable laws including CAN-SPAM, GDPR, or CASL when contacting leads. You are responsible for compliance with anti-spam laws in your jurisdiction.</li>
              <li>Attempt to reverse-engineer, scrape, or overload the Service.</li>
              <li>Use the Service for any illegal purpose.</li>
            </ul>
            <p>We reserve the right to suspend accounts that violate these rules without prior notice.</p>
          </Section>

          <Section title="4. Free plan limits">
            <p>
              The free plan provides 10 verified leads as a one-time allocation. These leads do not reset
              monthly. Once used, a paid plan is required to continue generating verified leads. Circumventing
              this limit by creating multiple accounts is not permitted.
            </p>
          </Section>

          <Section title="5. Credit guarantee">
            <p
              style={{
                background: "rgba(163,230,53,0.06)",
                border: "1px solid rgba(163,230,53,0.2)",
                borderRadius: 8,
                padding: "12px 16px",
                color: "var(--text)",
              }}
            >
              <strong>Credit guarantee:</strong> A credit is deducted only when a lead passes all 4
              verification levels: signal intent (L1), company identification (L2), contact role
              verification (L3), and email deliverability (L4). Rejected leads — those failing any
              verification level — are never charged. This guarantee is technically enforced at the
              database level via an atomic transaction and cannot be bypassed.
            </p>
          </Section>

          <Section title="6. Paid plans and billing">
            <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <li><strong style={{ color: "var(--text)" }}>Starter:</strong> $39/month (auto-renews monthly). 30 verified leads/month.</li>
              <li><strong style={{ color: "var(--text)" }}>Growth:</strong> $89/month (auto-renews monthly). 100 verified leads/month.</li>
              <li><strong style={{ color: "var(--text)" }}>Agency:</strong> $199/month (auto-renews monthly). 300 verified leads/month.</li>
              <li>Annual plans available at 20% off (auto-renew annually).</li>
              <li>Cancellation takes effect at the end of the current billing period.</li>
              <li>Refunds and chargebacks are handled according to PayPro Global payment provider policies.</li>
              <li>Prices may change with 30 days advance notice to your account email. Earlybird users with locked pricing are exempt from price increases as described at signup.</li>
            </ul>
          </Section>

          <Section title="7. AI-generated content">
            <p>
              Outreach messages are generated by OpenAI and provided as-is. They are starting points, not
              guaranteed results. Always review AI-generated content before sending. IntentLead AI is not
              responsible for issues arising from applying AI suggestions.
            </p>
          </Section>

          <Section title="8. Disclaimer of warranties">
            <p>
              The Service is provided <strong style={{ color: "var(--text)" }}>&quot;as is&quot;</strong>{" "}
              without warranties of any kind. We do not guarantee a specific number of verified leads per
              campaign — results depend on signal availability and verification success rates.
            </p>
          </Section>

          <Section title="9. Limitation of liability">
            <p>
              To the maximum extent permitted by law, IntentLead AI and Eugene Gusakov shall not be liable
              for any indirect, incidental, or consequential damages arising from your use of the Service.
              Our total liability shall not exceed the amount you paid us in the 3 months prior to the claim.
            </p>
          </Section>

          <Section title="10. Termination">
            <p>
              We may suspend or terminate your access for violations of these Terms. You may delete your
              account at any time by contacting us. On termination, your data will be deleted within 30 days.
            </p>
          </Section>

          <Section title="11. Changes to terms">
            <p>
              We may update these Terms. We will notify you by email at least 14 days before material changes
              take effect. Continued use after that date constitutes acceptance.
            </p>
          </Section>

          <Section title="12. Governing law">
            <p>
              These Terms are governed by the laws of the Republic of Belarus. Disputes shall first be
              resolved through good-faith negotiation, then by the courts of Minsk, Belarus.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              Questions about these Terms? Email{" "}
              <a href={`mailto:${EMAIL}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
                {EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
