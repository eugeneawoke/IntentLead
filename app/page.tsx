import { Suspense } from "react";
import DockNav from "@/components/ui/dock";
import GradientCards from "@/components/ui/gradient-card-showcase";
import PricingSection from "@/components/landing/PixelPricingCard";
import BackgroundBoxes from "@/components/ui/background-boxes";
import LandingComposer from "@/components/landing/LandingComposer";
import HeroSection from "@/components/landing/HeroSection";
import { Footer } from "@/components/layout/Footer";

export default function Home() {
  return (
    <main
      style={{
        background: "var(--bg)",
        color: "var(--text)",
        overflowX: "hidden",
      }}
    >
      <DockNav />

      {/* ── HERO ─────────────────────────────────── */}
      <HeroSection />

      {/* ── HOW IT WORKS ─────────────────────────── */}
      <GradientCards />

      {/* ── PRICING ──────────────────────────────── */}
      <PricingSection />

      {/* ── TRY FOR FREE ─────────────────────────── */}
      <section
        id="try"
        className="w-full max-w-3xl mx-auto px-6 py-24 flex flex-col items-center text-center gap-8"
      >
        <h2
          style={{
            fontSize: "clamp(32px, 4.5vw, 56px)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text)",
            margin: 0,
          }}
        >
          Start finding leads for free
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: 16, margin: 0 }}>
          10 verified leads on us. No card required.
        </p>
        <Suspense>
          <LandingComposer variant="fat" composerId="try" />
        </Suspense>
      </section>

      {/* ── FOOTER ───────────────────────────────── */}
      <Footer />
      <BackgroundBoxes />
    </main>
  );
}
