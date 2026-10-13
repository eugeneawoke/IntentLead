import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Method — IntentLead AI",
  description: "How IntentLead turns public business evidence into reviewable Opportunities.",
};

const STAGES = [
  {
    title: "1. Define the offer and ICP",
    body: "Record what the user sells, who can benefit, the relevant market and explicit exclusions. A website can supply business identity and positioning context, but IntentLead does not audit its technical, SEO or AI-readiness quality.",
  },
  {
    title: "2. Discover business evidence",
    body: "Search permitted public sources for observable events, expressed needs, operational problems or market changes. A signal is a research lead, not proof of purchase intent.",
  },
  {
    title: "3. Resolve the company",
    body: "Connect the evidence to a real organization, retain source URLs and timestamps, and reject candidates whose identity cannot be defended.",
  },
  {
    title: "4. Assess the commercial reason",
    body: "Compare the evidence with the offer and ICP. Produce QUALIFY, REVIEW or REJECT together with supporting facts, counter-evidence and uncertainty.",
  },
  {
    title: "5. Human review",
    body: "A person inspects the evidence package and records a decision. Rejection reasons become quality feedback for discovery and assessment policies.",
  },
];

export default function MethodologyPage() {
  return (
    <main style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-40">
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Method</p>
        <h1 className="mt-4 text-4xl font-semibold sm:text-6xl" style={{ letterSpacing: "-0.045em" }}>
          Evidence-backed Opportunity discovery
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8" style={{ color: "var(--text-muted)" }}>
          IntentLead is designed to find companies with a concrete reason to consider an offer. It does not build contact lists, write sequences or send messages.
        </p>

        <div className="mt-14 space-y-4">
          {STAGES.map((stage) => (
            <article key={stage.title} className="rounded-2xl border p-6 sm:p-8" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <h2 className="text-xl font-semibold">{stage.title}</h2>
              <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-muted)" }}>{stage.body}</p>
            </article>
          ))}
        </div>

        <aside className="mt-10 rounded-2xl border p-6" style={{ borderColor: "rgba(245,196,81,0.24)", background: "rgba(245,196,81,0.05)" }}>
          <h2 className="text-base font-semibold">Current pilot boundary</h2>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
            The first pilot is IntentLead self-prospecting in EN_DISCOVERY_ONLY, using recorded authorized evidence and zero provider spend. Personal contacts, drafts, sending and AI Visibility are outside this stage.
          </p>
        </aside>
      </section>
      <Footer />
    </main>
  );
}
