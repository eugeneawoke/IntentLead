import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Roadmap — IntentLead AI",
  description: "The validation sequence for IntentLead Opportunity Intelligence.",
};

const PHASES = [
  {
    status: "FOUNDATION",
    title: "Opportunity Core",
    body: "Versioned evidence, company, assessment, job, cost and human-review foundations. Legacy lead and outreach surfaces are being removed.",
  },
  {
    status: "CURRENT",
    title: "Self-prospecting discovery",
    body: "Run IntentLead's own offer and ICP through a zero-spend EN_DISCOVERY_ONLY workflow and measure Opportunity quality.",
  },
  {
    status: "NEXT",
    title: "Quality calibration",
    body: "Improve evidence sufficiency, entity resolution, deduplication and explainable rejection on a larger controlled sample.",
  },
  {
    status: "LATER",
    title: "Design-partner workflow",
    body: "Let a small cohort define bounded discovery briefs, inspect evidence packages and record outcomes they consider worth acting on.",
  },
  {
    status: "EVIDENCE-GATED",
    title: "Domain and market expansion",
    body: "Add one detector or market only when measured customer demand, source legality, evidence quality and economics justify it.",
  },
];

export default function RoadmapPage() {
  return (
    <main style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      <section className="mx-auto max-w-4xl px-6 pb-24 pt-40">
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>Validation roadmap</p>
        <h1 className="mt-4 text-4xl font-semibold sm:text-6xl" style={{ letterSpacing: "-0.045em" }}>
          Prove Opportunity quality before expanding.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8" style={{ color: "var(--text-muted)" }}>
          Each phase must improve the ability to find a business with a concrete, defensible reason to consider the user&apos;s offer.
        </p>

        <div className="mt-14 space-y-4">
          {PHASES.map((phase) => (
            <article key={phase.title} className="grid gap-4 rounded-2xl border p-6 sm:grid-cols-[130px_1fr] sm:p-8" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <span className="text-xs font-semibold tracking-[0.12em]" style={{ color: phase.status === "CURRENT" ? "var(--accent)" : "var(--text-faint)" }}>
                {phase.status}
              </span>
              <div>
                <h2 className="text-xl font-semibold">{phase.title}</h2>
                <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-muted)" }}>{phase.body}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border p-6" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold">Not on this roadmap</h2>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
            Automated or assisted sending, mailbox operation, sequences, contact databases and generic website audits are permanent non-goals. AI Visibility remains deferred research, not a first-stage feature.
          </p>
        </div>
      </section>
      <Footer />
    </main>
  );
}
