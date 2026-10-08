"use client";

import { useLang } from "@/lib/i18n/LangContext";
import { DiscoveryComposer } from "./DiscoveryComposer";
import { landingCopy } from "./opportunity-landing-copy";
import { SignalGridHero } from "./SignalGridHero";

export function OpportunityHero() {
  const { lang } = useLang();
  const copy = landingCopy[lang];

  return (
    <SignalGridHero>
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        <h1 className="max-w-4xl text-balance font-display text-[clamp(2.9rem,6.5vw,5rem)] font-extrabold leading-[0.98] tracking-[-0.035em] text-[var(--text)]">
          {copy.headline}
        </h1>
        <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-[rgba(244,246,248,0.76)] sm:text-lg">
          {copy.subtitle}
        </p>
        <div className="mt-7 w-full max-w-3xl">
          <DiscoveryComposer composerId="hero" />
        </div>
        <div className="mt-7 flex w-full flex-wrap justify-center gap-x-7 gap-y-3">
          {copy.trust.map(item => (
            <div key={item} className="legacy-trust-item"><span aria-hidden="true">✓</span>{item}</div>
          ))}
        </div>
      </div>
    </SignalGridHero>
  );
}
