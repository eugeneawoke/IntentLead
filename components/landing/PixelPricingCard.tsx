"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/LangContext";

const PLANS_STATIC = [
  { name: "Free",    monthly: 0,   annual: 0,   leads: "10 leads",     highlight: false, earlybird: false },
  { name: "Starter", monthly: 39,  annual: 31,  leads: "30 leads/mo",  highlight: false, earlybird: true  },
  { name: "Growth",  monthly: 89,  annual: 71,  leads: "100 leads/mo", highlight: true,  earlybird: true  },
  { name: "Agency",  monthly: 199, annual: 159, leads: "300 leads/mo", highlight: false, earlybird: false },
];

interface Pixel {
  x: number; y: number; opacity: number; speed: number;
  r: number; g: number; b: number;
}

function PixelCard({
  plan,
  isAnnual,
  note,
  cta,
  features,
  mostPopular,
  earlyAccessLabel,
}: {
  plan: typeof PLANS_STATIC[0];
  isAnnual: boolean;
  note: string;
  cta: string;
  features: string[];
  mostPopular: string;
  earlyAccessLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const pixelsRef = useRef<Pixel[]>([]);

  const pixelColor = plan.highlight
    ? { r: 20, g: 82, b: 51 }
    : { r: 53, g: 61, b: 73 };

  const buildPixels = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    const size = 4;
    const gap = 1;
    const step = size + gap;
    const cols = Math.floor(W / step);
    const rows = Math.floor(H / step);
    const pixels: Pixel[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 0.65) {
          pixels.push({
            x: c * step, y: r * step,
            opacity: 0,
            speed: 0.015 + Math.random() * 0.035,
            ...pixelColor,
          });
        }
      }
    }
    pixelsRef.current = pixels;
  }, [pixelColor]);

  const animateIn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    buildPixels();
    cancelAnimationFrame(animRef.current);
    function tick() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let allDone = true;
      for (const p of pixelsRef.current) {
        p.opacity = Math.min(1, p.opacity + p.speed);
        if (p.opacity < 1) allDone = false;
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.opacity * 0.4})`;
        ctx.fillRect(p.x, p.y, 4, 4);
      }
      if (!allDone) animRef.current = requestAnimationFrame(tick);
    }
    tick();
  }, [buildPixels]);

  const animateOut = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    cancelAnimationFrame(animRef.current);
    function fadeOut() {
      if (!canvas || !ctx) return;
      for (const p of pixelsRef.current) p.opacity = Math.max(0, p.opacity - 0.04);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let anyVisible = false;
      for (const p of pixelsRef.current) {
        if (p.opacity > 0) {
          anyVisible = true;
          ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${p.opacity * 0.4})`;
          ctx.fillRect(p.x, p.y, 4, 4);
        }
      }
      if (anyVisible) animRef.current = requestAnimationFrame(fadeOut);
    }
    fadeOut();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const card = cardRef.current;
    if (!canvas || !card) return;
    function resize() {
      if (!canvas || !card) return;
      canvas.width = card.offsetWidth;
      canvas.height = card.offsetHeight;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(card);
    return () => { ro.disconnect(); cancelAnimationFrame(animRef.current); };
  }, []);

  const price = isAnnual ? plan.annual : plan.monthly;

  return (
    <div
      ref={cardRef}
      className="relative rounded-2xl p-6 flex flex-col"
      style={{
        overflow: "hidden",
        background: plan.highlight ? "var(--surface-2)" : "var(--surface)",
        border: plan.highlight
          ? "2px solid rgba(163,230,53,0.5)"
          : "1px solid var(--border)",
        boxShadow: plan.highlight
          ? "0 0 40px rgba(163,230,53,0.08), 0 8px 24px rgba(0,0,0,0.4)"
          : "0 4px 16px rgba(0,0,0,0.3)",
      }}
      onMouseEnter={animateIn}
      onMouseLeave={animateOut}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{ width: "100%", height: "100%" }}
      />

      {plan.highlight && (
        <div
          className="absolute -top-0 left-1/2 -translate-x-1/2 text-xs font-bold px-4 py-1 whitespace-nowrap z-10"
          style={{
            background: "var(--accent)",
            color: "var(--accent-fg)",
            borderRadius: "0 0 10px 10px",
            letterSpacing: "0.06em",
          }}
        >
          {mostPopular}
        </div>
      )}

      <div className="relative z-10 flex flex-col flex-1">
        {/* Earlybird */}
        <div style={{ minHeight: 20, marginBottom: 12 }}>
          {plan.earlybird && (
            <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, letterSpacing: "0.04em" }}>
              ⚡ {earlyAccessLabel}
            </span>
          )}
        </div>

        {/* Name */}
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
          {plan.name}
        </div>

        {/* Price */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
          <span
            style={{
              fontSize: price === 0 ? 36 : 40,
              fontWeight: 800,
              color: "var(--text)",
              letterSpacing: "-0.02em",
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}
          >
            {price === 0 ? "Free" : `$${price}`}
          </span>
          {price > 0 && (
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>/mo</span>
          )}
        </div>

        {/* Leads */}
        <div className="text-sm font-semibold mb-1" style={{ color: "var(--accent)" }}>
          {plan.leads}
        </div>

        {/* Note */}
        <div className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
          {note}
        </div>

        {/* CTA */}
        <Link
          href={plan.monthly === 0 ? "/" : "/pricing"}
          className="block text-center py-2.5 rounded-xl text-sm font-semibold mb-6 transition-all duration-150"
          style={
            plan.highlight
              ? { background: "var(--accent)", color: "var(--accent-fg)", textDecoration: "none" }
              : { background: "var(--surface-2)", color: "var(--text)", border: "1px solid var(--border-strong)", textDecoration: "none" }
          }
        >
          {cta}
        </Link>

        {/* Divider */}
        <div style={{ borderTop: "1px solid var(--border)", marginBottom: 16 }} />

        {/* Features */}
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
          {features.map((f) => (
            <li
              key={f}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontSize: 13,
                color: "var(--text-muted)",
                lineHeight: 1.4,
              }}
            >
              <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1, fontSize: 12 }}>✓</span>
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function PricingSection() {
  const { t } = useLang();
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section id="pricing" className="w-full max-w-6xl mx-auto px-6 py-24">
      {/* Header */}
      <div className="text-center mb-10">
        <h2
          className="text-4xl font-semibold mb-3"
          style={{ color: "var(--text)", letterSpacing: "-0.02em", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}
        >
          {t.pricing.heading}
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: 16, marginBottom: 24 }}>
          {t.pricing.description}
        </p>

        {/* Billing toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <button
            onClick={() => setIsAnnual(false)}
            style={{
              fontSize: 14,
              fontWeight: isAnnual ? 400 : 600,
              color: isAnnual ? "var(--text-muted)" : "var(--text)",
              background: "none", border: "none", cursor: "pointer", padding: "4px 2px",
            }}
          >
            {t.pricing.billingMonthly}
          </button>

          <button
            onClick={() => setIsAnnual((v) => !v)}
            aria-label="Toggle billing period"
            style={{
              width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
              position: "relative",
              background: isAnnual ? "var(--accent)" : "var(--surface-2)",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute", top: 3,
                left: isAnnual ? 23 : 3,
                width: 18, height: 18, borderRadius: "50%",
                background: isAnnual ? "var(--accent-fg)" : "var(--text-muted)",
                transition: "left 0.2s",
              }}
            />
          </button>

          <button
            onClick={() => setIsAnnual(true)}
            style={{
              fontSize: 14,
              fontWeight: isAnnual ? 600 : 400,
              color: isAnnual ? "var(--text)" : "var(--text-muted)",
              background: "none", border: "none", cursor: "pointer", padding: "4px 2px",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {t.pricing.billingAnnual}
            <span
              style={{
                fontSize: 10, fontWeight: 700, color: "var(--accent-fg)",
                background: "var(--accent)", padding: "2px 7px",
                borderRadius: 6, letterSpacing: "0.04em",
              }}
            >
              {t.pricing.billingSave}
            </span>
          </button>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {PLANS_STATIC.map((plan, i) => (
          <PixelCard
            key={plan.name}
            plan={plan}
            isAnnual={isAnnual}
            note={t.pricing.plans[i]?.note ?? ""}
            cta={t.pricing.plans[i]?.cta ?? ""}
            features={t.pricing.plans[i]?.features ?? []}
            mostPopular={t.pricing.mostPopular}
            earlyAccessLabel={t.pricing.earlyAccess}
          />
        ))}
      </div>
    </section>
  );
}
