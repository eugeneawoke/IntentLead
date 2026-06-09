"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mic, ArrowUp } from "lucide-react";

const PLACEHOLDERS = [
  "Who are you selling to and what pain do you solve?",
  "Describe your ideal customer...",
  "Who do you want to find today?",
];

// variant="fat" — уже + больше padding (для Try for free секции)
export default function LandingComposer({
  variant = "default",
  composerId = "composer",
}: {
  variant?: "default" | "fat";
  composerId?: string;
}) {
  const isFat = variant === "fat";
  const [input, setInput] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [shimmer, setShimmer] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planValue, setPlanValue] = useState("Search");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Typewriter placeholder effect
  useEffect(() => {
    const phrase = PLACEHOLDERS[phraseIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && displayText === phrase) {
      // Full phrase typed — wait then start deleting
      timeout = setTimeout(() => setIsDeleting(true), 2200);
    } else if (isDeleting && displayText === "") {
      // Fully deleted — move to next phrase
      setIsDeleting(false);
      setPhraseIndex((i) => (i + 1) % PLACEHOLDERS.length);
    } else if (!isDeleting) {
      // Typing
      timeout = setTimeout(() => setDisplayText(phrase.slice(0, displayText.length + 1)), 55);
    } else {
      // Deleting
      timeout = setTimeout(() => setDisplayText(displayText.slice(0, -1)), 28);
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, phraseIndex]);

  // Shimmer effect triggered by dock "Try for free" click
  useEffect(() => {
    const handler = (e: Event) => {
      const targetId = (e as CustomEvent<string>).detail;
      if (targetId && targetId !== composerId) return;
      setShimmer(true);
      setTimeout(() => setShimmer(false), 1400);
    };
    window.addEventListener("composer-shimmer", handler);
    return () => window.removeEventListener("composer-shimmer", handler);
  }, [composerId]);

  // Close plan dropdown on outside click (bubble phase — options use stopPropagation)
  useEffect(() => {
    if (!planOpen) return;
    const close = () => setPlanOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [planOpen]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg) return;
    router.push(`/chat?init=${encodeURIComponent(msg)}`);
  }

  return (
    <div className={`flex flex-col items-center mx-auto ${isFat ? "max-w-xl" : "max-w-3xl"} w-full`}>
    <div
      data-composer-id={composerId}
      className={`w-full rounded-3xl transition-all duration-200 ${shimmer ? "composer-shimmer-active" : ""}`}
      style={{
        background: "var(--surface)",
        border: `1px solid ${focused ? "var(--border-strong)" : "var(--border)"}`,
        boxShadow: focused
          ? "var(--accent-glow)"
          : "0 8px 32px rgba(0,0,0,0.4)",
        padding: isFat ? "22px 24px" : "16px 20px",
      }}
    >
      <form onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={displayText}
          rows={isFat ? 3 : 1}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--text)",
            fontSize: 15,
            lineHeight: 1.6,
            resize: "none",
            overflowY: "hidden",
            fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
        />

        <div className="flex items-center justify-between mt-3">
          {/* Left: empty — URL hint moved below composer */}
          <div />

          {/* Right: Plan ▾ + Mic + Send */}
          <div className="flex items-center gap-2">
            <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
              {/* Trigger button */}
              <button
                type="button"
                onClick={() => setPlanOpen((o) => !o)}
                className="flex items-center gap-1.5 transition-colors duration-150"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "5px 10px",
                }}
              >
                {planValue}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-faint)", marginTop: 1 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {/* Dropdown — Lovable style */}
              {planOpen && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 8px)",
                    right: 0,
                    background: "var(--surface-2)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 14,
                    overflow: "hidden",
                    boxShadow: "0 16px 48px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)",
                    zIndex: 50,
                    minWidth: 220,
                    padding: "6px",
                  }}
                >
                  {[
                    { value: "Search",   label: "Search",   desc: "Find verified leads by intent" },
                    { value: "Plan",     label: "Plan",     desc: "Discuss strategy before scanning" },
                    { value: "Strategy", label: "Strategy", desc: "Build full outreach campaign" },
                  ].map((opt, i) => {
                    const isActive = planValue === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPlanValue(opt.value); setPlanOpen(false); }}
                        className="w-full text-left transition-colors duration-100"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 9,
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          marginBottom: i < 2 ? 2 : 0,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                      >
                        {/* Checkmark col */}
                        <span style={{ width: 16, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                          {isActive && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </span>
                        {/* Text */}
                        <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", lineHeight: 1.3 }}>
                            {opt.label}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--text-faint)", lineHeight: 1.3 }}>
                            {opt.desc}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              className="flex items-center justify-center rounded-full"
              style={{
                width: 32,
                height: 32,
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "default",
              }}
            >
              <Mic size={16} />
            </button>

            <button
              type="submit"
              disabled={!input.trim()}
              className="flex items-center justify-center rounded-full transition-all duration-150"
              style={{
                width: 36,
                height: 36,
                border: "none",
                background: input.trim() ? "var(--accent)" : "var(--surface-2)",
                color: input.trim() ? "var(--accent-fg)" : "var(--text-faint)",
                cursor: input.trim() ? "pointer" : "not-allowed",
              }}
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </div>
      </form>
    </div>

    {/* Sub-hint: always visible, below composer */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginTop: 10,
        fontSize: 12,
        color: "var(--text-muted)",
        lineHeight: 1.4,
        userSelect: "none",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
      Have a site?{" "}
      <span style={{ color: "var(--accent)", opacity: 0.62, fontWeight: 500 }}>
        Paste a URL
      </span>
      {" "}— we&apos;ll scan it for context.
    </div>
    </div>
  );
}
