"use client";

import { Suspense } from "react";
import LandingComposer from "./LandingComposer";
import { useLang } from "@/lib/i18n/LangContext";

export function LandingPricingCta() {
  const { t } = useLang();
  return (
    <div className="px-6 text-center" style={{ marginTop: -48, marginBottom: 72 }}>
      <a
        href="/pricing"
        className="inline-flex min-h-11 items-center rounded-full px-4 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--accent)]"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--accent)",
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        {t.pricingCta}
      </a>
    </div>
  );
}

export function LandingTrySection() {
  const { t } = useLang();
  return (
    <section
      id="try"
      aria-labelledby="landing-try-heading"
      className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8 px-5 py-28 text-center sm:px-6 lg:py-36"
    >
      <h2
        id="landing-try-heading"
        style={{
          fontSize: "clamp(32px, 4.5vw, 56px)",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "var(--text)",
          margin: 0,
        }}
      >
        {t.try.heading}
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: 16, margin: 0 }}>
        {t.try.subheading}
      </p>
      <Suspense>
        <LandingComposer variant="fat" composerId="try" />
      </Suspense>
    </section>
  );
}
