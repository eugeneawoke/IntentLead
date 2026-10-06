import Link from "next/link";

export default function WorkspaceOpportunityEntry() {
  return (
    <section className="p-6 sm:p-10" aria-labelledby="workspace-entry-title">
      <div
        className="max-w-3xl rounded-2xl border p-6 sm:p-8"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <p className="mb-3 text-sm" style={{ color: "var(--text-muted)" }}>
          Discovery-only workspace
        </p>
        <h1
          id="workspace-entry-title"
          className="text-2xl font-semibold sm:text-3xl"
          style={{ color: "var(--text)", letterSpacing: "-0.02em", fontFamily: "Geist, sans-serif" }}
        >
          Discover and review Opportunities
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: "var(--text-muted)" }}>
          Define the offer and ideal company, run the zero-spend synthetic contract fixture, then inspect evidence and record a human assessment. Website context means products, audience and positioning only—not a technical audit.
        </p>
        <div className="mt-6 flex flex-wrap gap-3"><Link href="/workspace/discovery" className="inline-flex min-h-11 items-center rounded-full px-5 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: "var(--accent)", color: "var(--accent-fg)", textDecoration: "none" }}>Create discovery brief</Link><Link href="/workspace/opportunities" className="inline-flex min-h-11 items-center rounded-lg border px-5 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2" style={{ borderColor: "var(--border)", color: "var(--text)", textDecoration: "none" }}>Review Opportunities</Link></div>
      </div>
    </section>
  );
}
