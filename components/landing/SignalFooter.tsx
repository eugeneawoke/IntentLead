"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n/LangContext";
import { DiscoveryComposer } from "./DiscoveryComposer";
import { landingCopy } from "./opportunity-landing-copy";

const FOOTER_CELLS = Array.from({ length: 180 }, (_, index) => index);

export function SignalFooter() {
  const { lang, t } = useLang();
  const copy = landingCopy[lang];

  return (
    <>
      <section id="try" className="legacy-try-section px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h2 className="text-balance font-display text-4xl font-semibold tracking-[-0.035em] text-[var(--text)] sm:text-5xl">
            {copy.ctaTitle}
          </h2>
          <p className="mt-4 text-base leading-7 text-[var(--text-muted)]">{copy.ctaSubtitle}</p>
          <div className="mt-8 w-full max-w-2xl">
            <DiscoveryComposer composerId="try" roomy />
          </div>
        </div>
      </section>

      <footer className="legacy-footer">
        <div className="legacy-footer-plane" aria-hidden="true">
          {FOOTER_CELLS.map((cell) => <span key={cell} />)}
        </div>
        <div className="legacy-footer-mask" aria-hidden="true" />
        <div className="relative z-10 mx-auto flex max-w-6xl flex-col justify-between gap-12 px-6 py-20 md:flex-row">
          <div>
            <Link href="/" className="font-display text-lg font-semibold text-[var(--text)] no-underline">IntentLead AI</Link>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--text-muted)]">{copy.footerDescription}</p>
            <p className="mt-6 text-xs text-[var(--text-faint)]">{t.footer.copyright}</p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <div className="legacy-footer-links">
              <span>{copy.footerProduct}</span>
              <Link href="/#method">{copy.dock.method}</Link>
              <Link href="/#example">{copy.dock.example}</Link>
              <Link href="/methodology">{t.footer.methodology}</Link>
            </div>
            <div className="legacy-footer-links">
              <span>{copy.footerWorkspace}</span>
              <Link href="/workspace/discovery">{copy.footerDiscovery}</Link>
              <Link href="/workspace/opportunities">{copy.footerOpportunities}</Link>
              <Link href="/roadmap">{t.footer.roadmap}</Link>
            </div>
            <div className="legacy-footer-links">
              <span>{copy.footerLegal}</span>
              <Link href="/privacy">{t.footer.privacy}</Link>
              <Link href="/terms">{t.footer.terms}</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
