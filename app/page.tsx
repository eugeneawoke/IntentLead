import { Suspense } from "react";
import DockNav from "@/components/ui/dock";
import { AuthTrigger } from "@/components/landing/AuthTrigger";
import GradientCards from "@/components/ui/gradient-card-showcase";
import PricingSection from "@/components/landing/PixelPricingCard";
import BackgroundBoxes from "@/components/ui/background-boxes";
import HeroSection from "@/components/landing/HeroSection";
import { LandingPricingCta, LandingTrySection } from "@/components/landing/LandingTrySection";

export default function Home() {
  return (
    <main
      style={{
        background: "var(--bg)",
        color: "var(--text)",
        overflowX: "hidden",
      }}
    >
      <Suspense>
        <AuthTrigger />
      </Suspense>

      <DockNav />

      {/* ── HERO ─────────────────────────────────── */}
      <HeroSection />

      {/* ── HOW IT WORKS ─────────────────────────── */}
      <GradientCards />

      {/* ── PRICING ──────────────────────────────── */}
      <PricingSection />

      {/* ── PRICING CTA ──────────────────────────── */}
      <LandingPricingCta />

      {/* ── TRY FOR FREE ─────────────────────────── */}
      <LandingTrySection />

      {/* ── FOOTER (BackgroundBoxes contains footer content) ── */}
      <BackgroundBoxes />
    </main>
  );
}
