import { Suspense } from "react";
import { AuthTrigger } from "@/components/landing/AuthTrigger";
import { OpportunityHero } from "@/components/landing/OpportunityHero";
import { OpportunityJourney } from "@/components/landing/OpportunityJourney";
import { OpportunityProof } from "@/components/landing/OpportunityProof";
import { SignalDock } from "@/components/landing/SignalDock";
import { SignalFooter } from "@/components/landing/SignalFooter";
import { SourcePortfolio } from "@/components/landing/SourcePortfolio";

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--bg)] text-[var(--text)]">
      <Suspense><AuthTrigger /></Suspense>
      <SignalDock />
      <OpportunityHero />
      <OpportunityJourney />
      <OpportunityProof />
      <SourcePortfolio />
      <SignalFooter />
    </main>
  );
}
