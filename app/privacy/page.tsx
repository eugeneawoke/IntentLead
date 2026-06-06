import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — IntentLead AI",
  description: "How IntentLead AI collects, uses, and protects your data.",
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

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 48px" }}>
          Effective date: {UPDATED}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          <Section title="1. Who we are">
            <p>
              IntentLead AI is a lead intelligence tool built and operated by Eugene Gusakov.
              Contact us at{" "}
              <a href={`mailto:${EMAIL}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
                {EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section title="2. What data we collect">
            <p>We collect only what is necessary to provide the service:</p>
            <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <li><strong style={{ color: "var(--text)" }}>Account data</strong> — your email address, provided via Supabase Auth (magic link and Google OAuth).</li>
              <li><strong style={{ color: "var(--text)" }}>Campaign data</strong> — ICP, keywords, tone, business context gathered through the onboarding chat.</li>
              <li><strong style={{ color: "var(--text)" }}>Lead data</strong> — company name, contact email, and role obtained through enrichment providers (Prospeo, Hunter, Apollo) from publicly available sources.</li>
              <li><strong style={{ color: "var(--text)" }}>Signal data</strong> — public posts from Reddit, Hacker News, VK, GitHub, Google Reviews, and other configured sources. We store only what is already public.</li>
              <li><strong style={{ color: "var(--text)" }}>Payment data</strong> — processed by PayPro Global (Merchant of Record). We never see or store your card details.</li>
              <li><strong style={{ color: "var(--text)" }}>Usage data</strong> — campaign history, lead status, credit usage linked to your account.</li>
              <li><strong style={{ color: "var(--text)" }}>Technical data</strong> — standard server logs (IP address, browser, timestamps) retained for up to 30 days.</li>
            </ul>
          </Section>

          <Section title="3. How we use your data">
            <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <li>To run lead generation pipelines and generate personalized messages.</li>
              <li>To manage your account, workspace, and subscription.</li>
              <li>To send transactional emails (billing receipts, magic links). No marketing emails without your consent.</li>
              <li>To detect abuse and protect the service.</li>
            </ul>
            <p>We do not sell your data. We do not use it for advertising.</p>
          </Section>

          <Section title="4. Third-party services">
            <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <li><strong style={{ color: "var(--text)" }}>Supabase</strong> — database and authentication (EU region).</li>
              <li><strong style={{ color: "var(--text)" }}>PayPro Global</strong> — payment processing and billing (Merchant of Record).</li>
              <li><strong style={{ color: "var(--text)" }}>Vercel</strong> — web hosting and edge functions.</li>
              <li><strong style={{ color: "var(--text)" }}>Railway</strong> — pipeline worker hosting (long-running lead enrichment).</li>
              <li><strong style={{ color: "var(--text)" }}>OpenAI</strong> — AI processing (intent classification, company extraction, message generation). Signal content and company data are sent to generate leads and messages.</li>
              <li><strong style={{ color: "var(--text)" }}>Prospeo / Hunter.io / Apollo.io</strong> — contact enrichment. We query these providers to find decision-maker emails from publicly available data.</li>
              <li><strong style={{ color: "var(--text)" }}>Reddit API, HN Algolia, VK API, GitHub API</strong> — signal sources. We access only public content.</li>
            </ul>
          </Section>

          <Section title="4a. Payment processing and PayPro Global">
            <p>
              PayPro Global acts as Merchant of Record and processes all payment and billing data on
              IntentLead AI&apos;s behalf. We do not store card numbers or sensitive payment credentials
              — all payment processing is handled exclusively by PayPro Global.
            </p>
            <p>
              We receive webhooks from PayPro Global containing subscription status events (paid, overdue,
              cancelled). This information is used solely to grant or revoke access to features.
            </p>
          </Section>

          <Section title="5. Cookies">
            <p>
              We use only essential cookies required for session management and authentication. No tracking
              or advertising cookies.
            </p>
          </Section>

          <Section title="6. Data retention">
            <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <li>Campaign data and leads are retained while your account is active.</li>
              <li>You can request deletion of your data at any time by emailing us.</li>
              <li>On account deletion, your data is removed within 30 days.</li>
            </ul>
          </Section>

          <Section title="7. Your rights (GDPR)">
            <p>If you are in the European Economic Area, you have the right to:</p>
            <ul style={{ paddingLeft: 20, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate data.</li>
              <li>Request deletion of your data (&quot;right to be forgotten&quot;).</li>
              <li>Object to or restrict processing.</li>
              <li>Data portability.</li>
            </ul>
            <p>
              To exercise any of these rights, email{" "}
              <a href={`mailto:${EMAIL}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
                {EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section title="8. Security">
            <p>
              All data is transmitted over HTTPS. Database access is protected by row-level security
              (Supabase RLS) — each user sees only their own data. We do not store passwords —
              authentication uses magic links and OAuth.
            </p>
          </Section>

          <Section title="9. Changes to this policy">
            <p>
              We may update this policy. We will notify you by posting the new policy on this page and
              updating the effective date. Material changes will be communicated by email if you have an
              account.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              Questions about this policy? Email{" "}
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
