"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Link2, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n/LangContext";

export default function LandingComposer({
  variant = "default",
  composerId = "composer",
}: {
  variant?: "default" | "fat";
  composerId?: string;
}) {
  const { t } = useLang();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shimmerTimeoutRef = useRef<number | null>(null);
  const isFat = variant === "fat";
  const [input, setInput] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [shimmer, setShimmer] = useState(false);
  const [modeValue, setModeValue] = useState(t.composer.modes[0].value);
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    const phrases = t.composer.placeholders;
    const phrase = phrases[phraseIndex % phrases.length];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (reducedMotion) {
      setDisplayText(phrase);
      return;
    }
    if (!isDeleting && displayText === phrase) {
      timeout = setTimeout(() => setIsDeleting(true), 2200);
    } else if (isDeleting && displayText === "") {
      setIsDeleting(false);
      setPhraseIndex((index) => (index + 1) % phrases.length);
    } else if (!isDeleting) {
      timeout = setTimeout(() => setDisplayText(phrase.slice(0, displayText.length + 1)), 55);
    } else {
      timeout = setTimeout(() => setDisplayText(displayText.slice(0, -1)), 28);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [displayText, isDeleting, phraseIndex, t.composer.placeholders]);

  useEffect(() => {
    setDisplayText("");
    setIsDeleting(false);
    setPhraseIndex(0);
    setModeValue(t.composer.modes[0].value);
  }, [t.composer.modes, t.composer.placeholders]);

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

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [input]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message) return;
    router.push(`/chat?init=${encodeURIComponent(message)}`);
  }

  return (
    <div className={`mx-auto flex w-full flex-col items-center ${isFat ? "max-w-xl" : "max-w-3xl"}`}>
      <div
        data-composer-id={composerId}
        data-composer-ready={ready ? "true" : "false"}
        className={`w-full rounded-3xl transition-all duration-200 ${shimmer ? "composer-shimmer-active" : ""}`}
        style={{
          background: "rgba(20,24,29,0.96)",
          border: `1px solid ${focused ? "var(--border-strong)" : "var(--border)"}`,
          boxShadow: focused ? "var(--accent-glow)" : "0 12px 38px rgba(0,0,0,0.5)",
          padding: isFat ? "22px 24px" : "16px 20px",
        }}
      >
        <form onSubmit={handleSubmit}>
          <label htmlFor={`${composerId}-input`} className="sr-only">
            {t.composer.label}
          </label>
          <textarea
            ref={textareaRef}
            id={`${composerId}-input`}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={displayText}
            rows={isFat ? 3 : 1}
            readOnly={!ready}
            className="block w-full resize-none overflow-y-hidden border-0 bg-transparent text-[15px] leading-relaxed outline-none"
            style={{ color: "var(--text)", fontFamily: "var(--font-sans, 'DM Sans', sans-serif)" }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />

          <div className="mt-3 flex items-center justify-end gap-2">
            <label className="sr-only" htmlFor={`${composerId}-mode`}>{t.composer.modeLabel}</label>
            <select
              id={`${composerId}-mode`}
              value={modeValue}
              onChange={(event) => setModeValue(event.target.value)}
              aria-label={t.composer.modeLabel}
              className="min-h-11 rounded-lg border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              style={{ background: "var(--surface-2)", color: "var(--text)", borderColor: "var(--border)" }}
            >
              {t.composer.modes.map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </select>

            <button
              type="button"
              disabled
              aria-label={t.composer.microphoneUnavailable}
              title={t.composer.microphoneUnavailable}
              className="grid h-11 w-11 place-items-center rounded-full"
              style={{ color: "var(--text-faint)" }}
            >
              <Mic size={16} aria-hidden="true" />
            </button>

            <button
              type="submit"
              disabled={!ready || !input.trim()}
              aria-label={t.composer.submit}
              title={t.composer.submit}
              className="grid h-11 w-11 place-items-center rounded-full transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:translate-y-0"
              style={{
                background: input.trim() ? "var(--accent)" : "var(--surface-2)",
                color: input.trim() ? "var(--accent-fg)" : "var(--text-faint)",
              }}
            >
              <ArrowUp size={18} aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-center text-xs" style={{ color: "var(--text-muted)" }}>
        <Link2 size={12} aria-hidden="true" style={{ opacity: 0.55 }} />
        <span>{t.composer.siteHint}</span>
      </div>
    </div>
  );
}
