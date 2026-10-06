import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Privacy — IntentLead AI",
  description: "How the IntentLead Opportunity Intelligence pilot handles data.",
};

const UPDATED = "October 6, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7" style={{ color: "var(--text-muted)" }}>{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-36">
        <Link href="/" className="text-sm" style={{ color: "var(--text-muted)", textDecoration: "none" }}>← Back</Link>
        <h1 className="mt-10 text-4xl font-semibold" style={{ letterSpacing: "-0.04em" }}>Privacy</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Effective date: {UPDATED}</p>

        <div className="mt-14 space-y-10">
          <Section title="1. Current product boundary">
            <p>IntentLead is an Opportunity Intelligence pilot. It processes business context and public evidence to produce company-level Opportunities for human review.</p>
            <p>The current product does not enrich personal contacts, find email addresses, generate outreach sequences, send messages or operate mailboxes.</p>
          </Section>

          <Section title="2. Data we process">
            <ul className="list-disc space-y-2 pl-5">
              <li>Account and workspace identifiers required for authentication and tenant isolation.</li>
              <li>Offer, ICP, market, exclusions and discovery-brief inputs supplied by the user.</li>
              <li>Public source content, URLs, timestamps and provenance used as Opportunity evidence.</li>
              <li>Resolved company information, assessments and human review decisions.</li>
              <li>Operational security, job, cost and error metadata needed to run and protect the service.</li>
            </ul>
          </Section>

          <Section title="3. How data is used">
            <p>We use this data to execute authorized discovery, preserve evidence provenance, prevent cross-workspace access, support human review, measure quality and diagnose failures.</p>
            <p>We do not sell user data or use it for advertising.</p>
          </Section>

          <Section title="4. Providers and hosting">
            <p>Supabase provides authentication and database infrastructure, Vercel hosts the web application, and Railway hosts background workers. Research or inference providers are used only when explicitly configured for an authorized workflow.</p>
            <p>The first self-prospecting pilot uses recorded authorized evidence and zero paid-provider spend.</p>
          </Section>

          <Section title="5. Public-source evidence">
            <p>Public availability does not remove provenance, retention or compliance obligations. IntentLead stores only the evidence needed for the bounded research purpose and records where it came from.</p>
          </Section>

          <Section title="6. Retention and deletion">
            <p>Workspace data is retained only while needed for the service, quality evaluation, security or legal obligations. Authorized deletion redacts or removes workspace-owned evidence and derived records according to the active retention policy.</p>
          </Section>

          <Section title="7. Security and rights">
            <p>Transport uses HTTPS and application data is protected by workspace authorization and database row-level security. Depending on applicable law, users may request access, correction, restriction, portability or deletion of their personal data through the support channel provided with their account.</p>
          </Section>

          <Section title="8. Changes">
            <p>This notice will be updated when the pilot&apos;s data flows or provider set materially changes. Production rollout, billing and additional data categories require separate approval and documentation.</p>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
