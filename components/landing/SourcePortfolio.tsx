"use client";

import { useLang } from "@/lib/i18n/LangContext";
import { landingCopy } from "./opportunity-landing-copy";

export function SourcePortfolio() {
  const { lang } = useLang();
  const copy = landingCopy[lang];

  return (
    <section className="legacy-source-section px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div className="max-w-xl">
            <p className="legacy-section-eyebrow">{copy.sourceEyebrow}</p>
            <h2 className="mt-4 text-balance font-display text-4xl font-semibold tracking-[-0.035em] text-[var(--text)]">{copy.sourceTitle}</h2>
            <p className="mt-5 text-base leading-7 text-[var(--text-muted)]">{copy.sourceSubtitle}</p>
          </div>
          <div className="legacy-source-list">
            {copy.sourceGroups.map(group => (
              <div key={group.title} className="legacy-source-row">
                <span>{group.title}</span>
                <p>{group.sources}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
