"use client";

import LandingComposer from "./LandingComposer";
import { useLang } from "@/lib/i18n/LangContext";
import DataGridHero from "@/components/ui/data-grid-hero";

export default function HeroSection() {
  const { t } = useLang();

  return (
    <section id="hero" aria-labelledby="landing-hero-heading" style={{ minHeight: "100dvh" }}>
      <DataGridHero
          rows={25}
          cols={35}
          spacing={4}
          duration={7.5}
          color="hsl(150, 60%, 20%)"
          animationType="pulse"
          pulseEffect
          mouseGlow
          opacityMin={0.08}
          opacityMax={0.65}
          background="var(--bg)"
          ariaLabel={t.hero.regionLabel}
        >
          <div className="flex w-full max-w-3xl flex-col items-center gap-6 px-1 text-center sm:px-4">
            <h1
              id="landing-hero-heading"
              style={{
                fontSize: "clamp(44px, 6.5vw, 80px)",
                fontWeight: 800,
                lineHeight: 1.0,
                letterSpacing: "-0.02em",
                color: "var(--text)",
                margin: 0,
              }}
            >
              {t.hero.headline}
            </h1>

            <p
              style={{
                color: "var(--text)",
                opacity: 0.75,
                fontSize: 18,
                lineHeight: 1.6,
                maxWidth: 520,
                margin: 0,
              }}
            >
              {t.hero.subtitle}
            </p>

            <LandingComposer composerId="hero" />

            <div className="flex w-full flex-wrap justify-center gap-x-6 gap-y-3 pt-4">
              {t.hero.trust.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span style={{ color: "var(--accent)" }}>✓</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 180,
              background: "linear-gradient(to bottom, transparent 0%, var(--bg) 100%)",
              zIndex: 5,
              pointerEvents: "none",
            }}
          />
      </DataGridHero>
    </section>
  );
}
