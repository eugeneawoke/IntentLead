"use client";

import type { CSSProperties } from "react";
import { useLang } from "@/lib/i18n/LangContext";
import { landingCopy } from "./opportunity-landing-copy";

const GRADIENTS = [
  ["#a3e635", "#22c55e"],
  ["#6ba4ff", "#3b82f6"],
  ["#c084fc", "#8b5cf6"],
  ["#34d399", "#06b6d4"],
];

export function OpportunityJourney() {
  const { lang } = useLang();
  const copy = landingCopy[lang];

  return (
    <section id="method" className="legacy-section relative overflow-hidden px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="legacy-section-eyebrow">{copy.journeyEyebrow}</p>
          <h2 className="mt-4 text-balance font-display text-4xl font-semibold tracking-[-0.035em] text-[var(--text)]">{copy.journeyTitle}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[var(--text-muted)]">{copy.journeySubtitle}</p>
        </div>

        <div className="legacy-skew-card-grid mt-12">
          {copy.journey.map((item, index) => {
            const [from, to] = GRADIENTS[index];
            return (
              <article
                key={item.step}
                className="legacy-skew-card"
                style={{ "--card-from": from, "--card-to": to } as CSSProperties}
              >
                <span className="legacy-skew-plane" aria-hidden="true" />
                <span className="legacy-skew-glow" aria-hidden="true" />
                <span className="legacy-skew-blob legacy-skew-blob-a" aria-hidden="true" />
                <span className="legacy-skew-blob legacy-skew-blob-b" aria-hidden="true" />
                <div className="legacy-skew-content">
                  <span className="legacy-skew-badge" style={{ color: from, borderColor: `${from}55`, background: `${from}18` }}>
                    {item.badge}
                  </span>
                  <span className="legacy-skew-step">{item.step}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
