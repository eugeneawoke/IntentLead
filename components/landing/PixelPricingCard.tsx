"use client";

import type { CSSProperties } from "react";
import { useLang } from "@/lib/i18n/LangContext";

const PIXELS = Array.from({ length: 72 }, (_, index) => ({
  id: index,
  left: (index * 37) % 101,
  top: (index * 61) % 97,
  delay: ((index * 17) % 24) / 10,
  opacity: 0.08 + ((index * 13) % 22) / 100,
}));

export default function PricingSection() {
  const { t } = useLang();

  return (
    <section
      id="pricing"
      aria-labelledby="pilot-access-heading"
      className="relative w-full overflow-hidden px-5 py-28 sm:px-8 lg:py-36"
      style={{ background: "var(--bg)" }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <div
            className="mb-4 text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: "var(--accent)" }}
          >
            {t.pricing.eyebrow}
          </div>
          <h2
            id="pilot-access-heading"
            className="text-4xl font-semibold sm:text-5xl"
            style={{
              color: "var(--text)",
              letterSpacing: "-0.03em",
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}
          >
            {t.pricing.heading}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7" style={{ color: "var(--text-muted)" }}>
            {t.pricing.description}
          </p>
        </div>

        <article
          className="relative isolate overflow-hidden border-y px-5 py-10 sm:px-10 sm:py-12 lg:px-14"
          style={{
            borderColor: "var(--border)",
            background:
              "linear-gradient(115deg, rgba(20,24,29,0.94), rgba(10,12,15,0.82) 58%, rgba(20,82,51,0.16))",
          }}
        >
          <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
            {PIXELS.map((pixel) => (
              <span
                key={pixel.id}
                className="pilot-pixel absolute h-1 w-1 rounded-[1px]"
                style={
                  {
                    left: `${pixel.left}%`,
                    top: `${pixel.top}%`,
                    opacity: pixel.opacity,
                    animationDelay: `${pixel.delay}s`,
                    background: "var(--accent)",
                  } as CSSProperties
                }
              />
            ))}
          </div>

          <div className="relative z-10 grid gap-10 lg:grid-cols-[0.9fr_1.6fr] lg:gap-16">
            <div>
              <div className="mb-4 h-px w-14" style={{ background: "var(--accent)" }} />
              <h3 className="text-2xl font-semibold leading-tight sm:text-3xl" style={{ color: "var(--text)" }}>
                {t.pricing.freeTitle}
              </h3>
              <p className="mt-4 text-sm leading-7 sm:text-base" style={{ color: "var(--text-muted)" }}>
                {t.pricing.freeDescription}
              </p>
            </div>

            <div className="grid gap-px sm:grid-cols-3" style={{ background: "var(--border)" }}>
              {t.pricing.points.map((point) => (
                <section
                  key={point.label}
                  className="min-w-0 px-5 py-6 sm:px-6"
                  style={{ background: "rgba(10,12,15,0.9)" }}
                >
                  <div
                    className="mb-3 text-[0.65rem] font-bold uppercase tracking-[0.14em]"
                    style={{ color: "var(--accent)" }}
                  >
                    {point.label}
                  </div>
                  <h4 className="text-base font-semibold leading-snug" style={{ color: "var(--text)" }}>
                    {point.title}
                  </h4>
                  <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                    {point.description}
                  </p>
                </section>
              ))}
            </div>
          </div>

          <div
            className="relative z-10 mt-9 flex flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}
          >
            <span>{t.pricing.terms}</span>
            <span className="font-medium" style={{ color: "var(--text-muted)" }}>
              {t.pricing.noSending}
            </span>
          </div>
        </article>
      </div>

      <style>{`
        @keyframes pilot-pixel-breathe {
          0%, 100% { transform: scale(0.75); opacity: 0.08; }
          50% { transform: scale(1.4); opacity: 0.32; }
        }
        .pilot-pixel { animation: pilot-pixel-breathe 3.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .pilot-pixel { animation: none; }
        }
      `}</style>
    </section>
  );
}
