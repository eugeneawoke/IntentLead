import Link from "next/link";
import { Suspense } from "react";
import { AuthTrigger } from "@/components/landing/AuthTrigger";
import { Footer } from "@/components/layout/Footer";

const STEPS = [
  {
    number: "01",
    title: "Understand the business",
    description:
      "Capture the offer, ideal customer and exclusions. A company website may help describe what the business sells, who it serves and how it positions itself.",
  },
  {
    number: "02",
    title: "Find observable reasons",
    description:
      "Discover public signals, changes and problems that create a concrete reason for a company to consider the offer.",
  },
  {
    number: "03",
    title: "Build an evidence package",
    description:
      "Resolve the company, preserve source provenance and explain both the commercial fit and the uncertainty.",
  },
  {
    number: "04",
    title: "Review the Opportunity",
    description:
      "A human accepts, rejects or requests more research. The product stops before contacts, messages or outreach.",
  },
];

const BOUNDARIES = [
  "No contact or email enrichment",
  "No message sending or sequences",
  "No generic website, SEO or AI Visibility audit",
  "No claim without inspectable evidence",
];

export default function Home() {
  return (
    <main style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      <Suspense>
        <AuthTrigger />
      </Suspense>

      <section className="mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-center px-6 pb-20 pt-36">
        <div
          className="mb-7 w-fit rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]"
          style={{ borderColor: "rgba(163,230,53,0.28)", color: "var(--accent)", background: "rgba(163,230,53,0.06)" }}
        >
          Self-prospecting pilot · EN discovery only
        </div>
        <h1
          className="max-w-5xl text-5xl font-bold leading-[0.98] sm:text-7xl lg:text-8xl"
          style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.055em" }}
        >
          Find companies with a reason to care.
        </h1>
        <p className="mt-8 max-w-2xl text-lg leading-8 sm:text-xl" style={{ color: "var(--text-muted)" }}>
          IntentLead turns public business evidence into reviewable Opportunities: a company, a concrete commercial reason, the supporting sources and an honest assessment of uncertainty.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/workspace/opportunities"
            className="inline-flex min-h-12 items-center rounded-full px-6 py-3 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-fg)", textDecoration: "none" }}
          >
            Open Opportunity workspace
          </Link>
          <Link
            href="/methodology"
            className="inline-flex min-h-12 items-center rounded-full border px-6 py-3 text-sm font-semibold"
            style={{ borderColor: "var(--border-strong)", color: "var(--text)", textDecoration: "none" }}
          >
            See the method
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24" aria-labelledby="workflow-title">
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>
          Opportunity intelligence
        </p>
        <h2 id="workflow-title" className="mt-3 max-w-3xl text-3xl font-semibold sm:text-5xl" style={{ letterSpacing: "-0.035em" }}>
          From business context to a defensible why-now.
        </h2>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {STEPS.map((step) => (
            <article key={step.number} className="rounded-2xl border p-6 sm:p-8" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>{step.number}</span>
              <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
              <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-muted)" }}>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-24" aria-labelledby="boundaries-title">
        <div className="rounded-3xl border p-8 sm:p-12" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--pending)" }}>Hard boundaries</p>
          <h2 id="boundaries-title" className="mt-3 text-3xl font-semibold" style={{ letterSpacing: "-0.03em" }}>
            Quality before volume. Evidence before automation.
          </h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {BOUNDARIES.map((boundary) => (
              <li key={boundary} className="flex items-start gap-3 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                <span aria-hidden="true" style={{ color: "var(--accent)" }}>—</span>
                {boundary}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Footer />
    </main>
  );
}
