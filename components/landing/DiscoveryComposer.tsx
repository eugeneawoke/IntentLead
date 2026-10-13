"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, Globe2, Link2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useUser } from "@/lib/auth/UserContext";
import { useLang } from "@/lib/i18n/LangContext";
import {
  LANDING_DISCOVERY_DRAFT_KEY,
  type LandingDiscoveryDraft,
} from "@/types/landing";
import { landingCopy } from "./opportunity-landing-copy";

export function DiscoveryComposer({
  composerId,
  roomy = false,
}: {
  composerId: string;
  roomy?: boolean;
}) {
  const { lang } = useLang();
  const copy = landingCopy[lang];
  const user = useUser();
  const router = useRouter();
  const { openModal } = useAuthModal();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shimmerTimeoutRef = useRef<number | null>(null);
  const [offerSummary, setOfferSummary] = useState("");
  const [market, setMarket] = useState<LandingDiscoveryDraft["market"]>("GLOBAL_EN");
  const [shimmer, setShimmer] = useState(false);

  useEffect(() => {
    const highlight = (event: Event) => {
      const targetId = (event as CustomEvent<string>).detail;
      if (targetId && targetId !== composerId) return;
      setShimmer(true);
      textareaRef.current?.focus();
      if (shimmerTimeoutRef.current !== null) window.clearTimeout(shimmerTimeoutRef.current);
      shimmerTimeoutRef.current = window.setTimeout(() => setShimmer(false), 1400);
    };
    window.addEventListener("composer-shimmer", highlight);
    return () => {
      window.removeEventListener("composer-shimmer", highlight);
      if (shimmerTimeoutRef.current !== null) window.clearTimeout(shimmerTimeoutRef.current);
    };
  }, [composerId]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const summary = offerSummary.trim();
    if (!summary) return;

    const draft: LandingDiscoveryDraft = {
      schemaVersion: 1,
      offerSummary: summary,
      market,
      savedAt: new Date().toISOString(),
    };

    try {
      sessionStorage.setItem(LANDING_DISCOVERY_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // A blocked browser store must not trap the user on the landing page.
    }

    if (user) router.push("/workspace/discovery?prefill=1");
    else openModal("signup");
  }

  return (
    <div className="landing-composer-shell w-full">
      <form
        data-composer-id={composerId}
        onSubmit={submit}
        className={`landing-composer ${roomy ? "landing-composer-roomy" : ""} ${shimmer ? "composer-shimmer-active" : ""}`}
      >
        <label htmlFor={`${composerId}-offer`} className="sr-only">
          {copy.inputLabel}
        </label>
        <textarea
          ref={textareaRef}
          id={`${composerId}-offer`}
          value={offerSummary}
          onChange={(event) => setOfferSummary(event.target.value)}
          placeholder={copy.placeholder}
          rows={roomy ? 3 : 2}
          required
          className="landing-composer-input"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />

        <div className="landing-composer-actions">
          <label htmlFor={`${composerId}-market`} className="landing-market-select">
            <Globe2 size={14} aria-hidden="true" />
            <span className="sr-only">{copy.marketLabel}</span>
            <select
              id={`${composerId}-market`}
              value={market}
              onChange={(event) => setMarket(event.target.value as LandingDiscoveryDraft["market"])}
            >
              {Object.entries(copy.markets).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={!offerSummary.trim()}
            className="landing-composer-submit"
            aria-label={user ? copy.signedInSubmit : copy.submit}
            title={user ? copy.signedInSubmit : copy.submit}
          >
            <ArrowUp size={17} aria-hidden="true" />
          </button>
        </div>
      </form>

      <div className="landing-composer-hint">
        <span><Link2 size={12} aria-hidden="true" />{copy.siteHint}</span>
        <span><ShieldCheck size={12} aria-hidden="true" />{copy.noSendHint}</span>
      </div>
    </div>
  );
}
