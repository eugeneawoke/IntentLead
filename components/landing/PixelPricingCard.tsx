"use client";

import { useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface PricingPlan {
  name: string;
  price: string;
  leads: string;
  note: string;
  cta: string;
  highlight: boolean;
}

const PLANS: PricingPlan[] = [
  {
    name: "Free",
    price: "$0",
    leads: "10 leads",
    note: "One time, forever",
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Starter",
    price: "$39",
    leads: "30 leads/mo",
    note: "For solo founders",
    cta: "Get Starter",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$89",
    leads: "100 leads/mo",
    note: "For growing agencies",
    cta: "Get Growth",
    highlight: true,
  },
  {
    name: "Agency",
    price: "$199",
    leads: "300 leads/mo",
    note: "High volume",
    cta: "Get Agency",
    highlight: false,
  },
];

interface Pixel {
  x: number;
  y: number;
  opacity: number;
  speed: number;
  r: number;
  g: number;
  b: number;
}

function PixelCard({ plan }: { plan: PricingPlan }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const pixelsRef = useRef<Pixel[]>([]);
  const router = useRouter();

  // Growth: тёмный лесной зелёный hsl(150,60%,20%) ≈ rgb(20,82,51) — как в Hero
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
            x: c * step,
            y: r * step,
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
      for (const p of pixelsRef.current) {
        p.opacity = Math.max(0, p.opacity - 0.04);
      }
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
    return () => {
      ro.disconnect();
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className="relative rounded-2xl p-6"
      style={{
        overflow: "visible",
        background: "var(--surface)",
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
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap z-10"
          style={{
            background: "var(--accent)",
            color: "var(--accent-fg)",
          }}
        >
          MOST POPULAR
        </div>
      )}

      <div className="relative z-10">
        <div
          className="text-xs font-medium uppercase tracking-widest mb-3"
          style={{ color: "var(--text)" }}
        >
          {plan.name}
        </div>
        <div
          className="text-4xl font-bold mb-1"
          style={{ color: "var(--text)", fontFamily: "Geist, sans-serif" }}
        >
          {plan.price}
          {plan.price !== "$0" && (
            <span
              className="text-sm font-normal"
              style={{ color: "var(--text-muted)" }}
            >
              /mo
            </span>
          )}
        </div>
        <div
          className="text-sm font-semibold mb-1"
          style={{ color: "var(--accent)" }}
        >
          {plan.leads}
        </div>
        <div className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
          {plan.note}
        </div>
        <button
          onClick={() => router.push("/chat")}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
          style={
            plan.highlight
              ? {
                  background: "var(--accent)",
                  color: "var(--accent-fg)",
                  border: "none",
                  cursor: "pointer",
                }
              : {
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }
          }
        >
          {plan.cta}
        </button>
      </div>
    </div>
  );
}

export default function PricingSection() {
  return (
    <section id="pricing" className="w-full max-w-6xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <h2
          className="text-4xl font-semibold mb-3"
          style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
        >
          Simple pricing
        </h2>
        <p style={{ color: "var(--text-muted)" }}>
          Credit charged only when all 4 verification levels pass. Rejected
          leads are free.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {PLANS.map((plan) => (
          <PixelCard key={plan.name} plan={plan} />
        ))}
      </div>
    </section>
  );
}
