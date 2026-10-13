"use client";

import { Check, CircleAlert } from "lucide-react";
import { useLang } from "@/lib/i18n/LangContext";
import { landingCopy } from "./opportunity-landing-copy";

export function OpportunityProof() {
  const { lang } = useLang();
  const copy = landingCopy[lang];

  return (
    <section id="example" className="legacy-section mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <p className="legacy-section-eyebrow">{copy.proofEyebrow}</p>
        <h2 className="mt-4 text-balance font-display text-4xl font-semibold tracking-[-0.035em] text-[var(--text)]">
          {copy.proofTitle}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--text-muted)]">
          {copy.proofSubtitle}
        </p>
      </div>

      <div className="legacy-package-grid mt-12">
        {copy.packageCards.map((card, index) => (
          <article key={card.label} className={`legacy-package-card ${index === 3 ? "legacy-package-card-featured" : ""}`}>
            {index === 3 && <span className="legacy-package-featured-label">{copy.packageReady}</span>}
            <p className="legacy-package-kicker">{card.label}</p>
            <h3>{card.title}</h3>
            <p className="legacy-package-summary">{card.summary}</p>
            <div className="legacy-package-divider" />
            <ul>
              {card.items.map((item) => (
                <li key={item}><Check size={13} aria-hidden="true" />{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <p className="legacy-package-boundary">
        <CircleAlert size={15} aria-hidden="true" />
        {copy.packageBoundary}
      </p>
    </section>
  );
}
