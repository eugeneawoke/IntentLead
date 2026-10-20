import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileCheck2 } from "lucide-react";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Pilot Terms — IntentLead AI",
  description: "Terms for the IntentLead Opportunity Intelligence pilot.",
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

export default function TermsPage() {
  return (
    <div className="overflow-hidden" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <main className="relative mx-auto max-w-3xl px-6 pb-24 pt-36">
        <div aria-hidden className="pointer-events-none absolute -left-64 top-16 h-96 w-96 rounded-full blur-3xl" style={{ background: "rgba(163,230,53,.07)" }} />
        <Link href="/" className="relative inline-flex items-center gap-2 text-sm no-underline" style={{ color: "var(--text-muted)" }}><ArrowLeft size={15} /> Back</Link>
        <div className="relative mt-10 border-b pb-10" style={{ borderColor: "var(--border)" }}><div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(163,230,53,.09)", color: "var(--accent)" }}><FileCheck2 size={21} /></div><h1 className="mt-6 text-4xl font-semibold sm:text-5xl" style={{ letterSpacing: "-0.045em" }}>Pilot terms</h1><p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>Effective date: {UPDATED}</p><p className="mt-5 max-w-2xl text-base leading-7" style={{ color: "var(--text-muted)" }}>The operating boundary for the controlled Opportunity Intelligence pilot and the responsibilities that stay with its users.</p></div>

        <div className="relative mt-10 space-y-5">
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
