import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Privacy — IntentLead AI",
  description: "How the IntentLead Opportunity Intelligence pilot handles data.",
};

const UPDATED = "October 6, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border p-6 sm:p-7" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h2 className="text-lg font-semibold tracking-[-.015em]">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-7" style={{ color: "var(--text-muted)" }}>{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="overflow-hidden" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <main className="relative mx-auto max-w-3xl px-6 pb-24 pt-36">
        <div aria-hidden className="pointer-events-none absolute -right-64 top-16 h-96 w-96 rounded-full blur-3xl" style={{ background: "rgba(107,164,255,.08)" }} />
        <Link href="/" className="relative inline-flex items-center gap-2 text-sm no-underline" style={{ color: "var(--text-muted)" }}><ArrowLeft size={15} /> Back</Link>
        <div className="relative mt-10 border-b pb-10" style={{ borderColor: "var(--border)" }}><div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(107,164,255,.1)", color: "#6ba4ff" }}><ShieldCheck size={21} /></div><h1 className="mt-6 text-4xl font-semibold sm:text-5xl" style={{ letterSpacing: "-0.045em" }}>Privacy</h1><p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>Effective date: {UPDATED}</p><p className="mt-5 max-w-2xl text-base leading-7" style={{ color: "var(--text-muted)" }}>How the controlled Opportunity Intelligence pilot handles user inputs, public evidence and workspace records.</p></div>

        <div className="relative mt-10 space-y-5">
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
