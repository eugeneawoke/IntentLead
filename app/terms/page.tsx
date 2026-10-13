import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Pilot Terms — IntentLead AI",
  description: "Terms for the IntentLead Opportunity Intelligence pilot.",
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

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-36">
        <Link href="/" className="text-sm" style={{ color: "var(--text-muted)", textDecoration: "none" }}>← Back</Link>
        <h1 className="mt-10 text-4xl font-semibold" style={{ letterSpacing: "-0.04em" }}>Pilot terms</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Effective date: {UPDATED}</p>

        <div className="mt-14 space-y-10">
          <Section title="1. Pilot status">
            <p>IntentLead is currently a local and controlled Opportunity Intelligence pilot. It is not a generally available paid service, and no public pricing, lead quota or credit guarantee is offered at this stage.</p>
          </Section>

          <Section title="2. What the product does">
            <p>The product researches permitted public business evidence, resolves companies and prepares an evidence-backed Opportunity assessment for human review.</p>
            <p>It does not provide contact databases, email enrichment, automated or assisted sending, mailbox operation, sequences or delivery tracking.</p>
          </Section>

          <Section title="3. Authorized use">
            <p>Users must provide lawful research objectives and may use only sources and data they are authorized to access. The service must not be used to collect protected personal categories, bypass access controls, violate source terms or create unsupported claims about a company.</p>
          </Section>

          <Section title="4. Evidence and human judgment">
            <p>An Opportunity is a research assessment, not proof that a company intends to buy. Source content can be incomplete, outdated or ambiguous. Users must review the evidence and uncertainty before acting on a result.</p>
          </Section>

          <Section title="5. No outreach authorization">
            <p>Using IntentLead does not authorize unsolicited contact or transfer responsibility for compliance with privacy, marketing or communications law. The current product does not send or facilitate messages.</p>
          </Section>

          <Section title="6. Availability and warranties">
            <p>The pilot is provided as-is for evaluation. Workflows may be changed, paused or removed while quality, security and economics are validated. No minimum Opportunity volume, acceptance rate or commercial outcome is guaranteed.</p>
          </Section>

          <Section title="7. Account and data handling">
            <p>Access may be suspended for abuse, unauthorized data collection or attempts to bypass security boundaries. Workspace data is handled according to the current Privacy notice and retention policy.</p>
          </Section>

          <Section title="8. Future commercial terms">
            <p>Any production release, billing model or paid plan will require separate terms presented before purchase or production use. Historical pricing and verified-lead packages are not current offers.</p>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
