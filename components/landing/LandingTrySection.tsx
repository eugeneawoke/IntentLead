"use client";

import { Suspense } from "react";
import LandingComposer from "./LandingComposer";
import { useLang } from "@/lib/i18n/LangContext";

export function LandingPricingCta() {
  const { t } = useLang();
  return (
    <div style={{ textAlign: "center", marginTop: -32, marginBottom: 48 }}>
      <a
        href="/pricing"
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
