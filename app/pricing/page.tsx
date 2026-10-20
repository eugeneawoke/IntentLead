import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Search, ShieldCheck, UserRoundCheck } from "lucide-react";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Pilot Access — IntentLead AI",
  description: "How the closed, founder-managed IntentLead diagnostic pilot works.",
};

const pilotSteps = [
  { icon: Search, title: "Define the discovery brief", body: "We clarify the offer, ICP, market, geography, language and evidence that would make an Opportunity relevant." },
  { icon: ShieldCheck, title: "Run authorized discovery", body: "IntentLead uses only the source portfolio that is available and authorized for that specific run." },
  { icon: UserRoundCheck, title: "Review the evidence together", body: "Every package separates facts, inference and uncertainty. A person decides what is useful and what to reject." },
];

const continuations = [
  "Later runs for the same or another ICP",
  "Recurring discovery at an agreed cadence",
  "Agreed expansion of the source portfolio",
  "Deeper company, buyer and contact work",
  "Evidence-grounded briefs and drafts",
  "Review or export adapted to the partner workflow",
];

export default function PricingPage() {
  return (
    <main className="min-h-screen overflow-hidden" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <style>{`@keyframes pilot-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}} .pilot-rise{animation:pilot-rise .7s cubic-bezier(.22,1,.36,1) both}@media(prefers-reduced-motion:reduce){.pilot-rise{animation:none}}`}</style>
      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-40 text-center">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 opacity-60" style={{ background: "radial-gradient(circle at center,rgba(163,230,53,.12),transparent 66%)" }} />
        <div className="pilot-rise relative">
          <span className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[.14em]" style={{ borderColor: "rgba(163,230,53,.28)", background: "rgba(163,230,53,.08)", color: "var(--accent)" }}>Closed partner program</span>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-[-.045em] sm:text-6xl">The first diagnostic pilot is free</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8" style={{ color: "var(--text-muted)" }}>A real, founder-managed discovery run built around your offer and market. No plan selection, no credit package, and no automatic outreach.</p>
          <a href="#how-access-works" data-public-primary-action className="mt-9 inline-flex items-center gap-2 rounded-xl px-7 py-3.5 font-semibold no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>See how the pilot works <ArrowRight size={17} /></a>
          <p className="mt-4 text-xs" style={{ color: "var(--text-faint)" }}>Pilot Access is invitation-, referral- or founder-selection based. A future waitlist is separate and does not guarantee access.</p>
        </div>
      </section>

      <section id="how-access-works" className="mx-auto max-w-6xl scroll-mt-28 px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: "var(--accent)" }}>One honest engagement</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-.035em] sm:text-4xl">Useful evidence before commercial terms.</h2>
            <p className="mt-5 leading-7" style={{ color: "var(--text-muted)" }}>The pilot exists to learn whether IntentLead can produce Opportunities worth reviewing for this business—not to push a predefined subscription.</p>
          </div>
          <div className="grid gap-4">
            {pilotSteps.map(({ icon: Icon, title, body }, index) => <article key={title} className="grid gap-5 rounded-2xl border p-6 sm:grid-cols-[52px_1fr]" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "rgba(163,230,53,.09)", color: "var(--accent)" }}><Icon size={22} /></div>
              <div><p className="text-[11px] font-semibold uppercase tracking-[.14em]" style={{ color: "var(--text-faint)" }}>Step {index + 1}</p><h3 className="mt-1 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>{body}</p></div>
            </article>)}
          </div>
        </div>
      </section>

      <section className="border-y px-6 py-20" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          <article className="rounded-3xl border p-7 sm:p-9" style={{ borderColor: "rgba(163,230,53,.22)", background: "rgba(163,230,53,.035)" }}>
            <p className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: "var(--accent)" }}>Complete run target</p>
            <h2 className="mt-4 text-3xl font-semibold">At least 20 confirmed, evidence-backed signals</h2>
            <p className="mt-4 text-sm leading-7" style={{ color: "var(--text-muted)" }}>This target applies only when current source and backend coverage can support it. Weak, unsupported or duplicate candidates never fill the gap.</p>
          </article>
          <article className="rounded-3xl border p-7 sm:p-9" style={{ borderColor: "rgba(245,196,81,.24)", background: "rgba(245,196,81,.035)" }}>
            <p className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: "var(--pending)" }}>When coverage is insufficient</p>
            <h2 className="mt-4 text-3xl font-semibold">PARTIAL, with the actual count</h2>
            <p className="mt-4 text-sm leading-7" style={{ color: "var(--text-muted)" }}>The result names the shortfall, source limits and capability gaps. There is no guaranteed volume independent of source readiness.</p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: "var(--accent)" }}>After the diagnostic</p><h2 className="mt-4 text-3xl font-semibold tracking-[-.035em]">Continuation is an individual agreement.</h2><p className="mt-5 leading-7" style={{ color: "var(--text-muted)" }}>Nothing begins automatically. Founder and partner first review usefulness, repeatability and delivery economics, then agree scope, cadence, price and deliverables.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">{continuations.map((item) => <div key={item} className="flex gap-3 rounded-xl border p-4 text-sm leading-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}><Check size={17} className="mt-1 shrink-0" style={{ color: "var(--accent)" }} /><span>{item}</span></div>)}</div>
        </div>
        <aside className="mt-10 rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}><h2 className="text-lg font-semibold">Explicit provider agreement, always</h2><p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>Any paid search, enrichment or verification provider needs separate agreement and a visible authorized cost. IntentLead never incurs paid-provider cost silently. It also never sends messages: the partner reviews each package and decides whether and how to act.</p></aside>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24 pt-8"><h2 className="text-2xl font-semibold">Questions before a conversation</h2><div className="mt-6 divide-y" style={{ borderColor: "var(--border)" }}>
        {[{q:"Is this a public pricing tier?",a:"No. Pilot Access is a closed founder-managed program, not a plan, queue position or standardized package."},{q:"Does a waitlist application guarantee access?",a:"No. The future Early Access Waitlist is a separate expression of interest; selection depends on suitability and current delivery capacity."},{q:"Does IntentLead contact the companies it finds?",a:"No. IntentLead prepares evidence-backed Opportunities, available buyer/contact verification and grounded material for human review. It does not connect a mailbox or send."}].map(({q,a}) => <details key={q} className="group py-5"><summary className="cursor-pointer list-none font-semibold">{q}<span className="float-right" aria-hidden>+</span></summary><p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: "var(--text-muted)" }}>{a}</p></details>)}
      </div><div className="mt-12 rounded-3xl border p-8 text-center" style={{ borderColor: "rgba(163,230,53,.22)", background: "rgba(163,230,53,.04)" }}><h2 className="text-2xl font-semibold">Start with the business problem.</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6" style={{ color: "var(--text-muted)" }}>If the pilot is a fit, the founder will explain the available sources, realistic coverage and next step personally.</p><Link href="/#try" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold no-underline" style={{ color: "var(--accent)" }}>Describe your discovery problem <ArrowRight size={15} /></Link></div></section>
      <Footer />
    </main>
  );
}
