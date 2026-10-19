"use client";
import React from "react";
import { useLang } from "@/lib/i18n/LangContext";

// ── Static meta — colors stay fixed, text comes from translations ─────────────
const CARD_META = [
  { badge: "L1 · Intent Score", gradientFrom: "#A3E635", gradientTo: "#22c55e" },
  { badge: "L2 · Company",      gradientFrom: "#6BA4FF", gradientTo: "#3b82f6" },
  { badge: "L3 · Contact",      gradientFrom: "#C084FC", gradientTo: "#8b5cf6" },
  { badge: "L4 · Email",        gradientFrom: "#34D399", gradientTo: "#06b6d4" },
];

// ── SkewCard — оригинальный компонент ────────────────
function SkewCard({
  title,
  badge,
  desc,
  gradientFrom,
  gradientTo,
}: {
  title: string;
  badge: string;
  desc: string;
  gradientFrom: string;
  gradientTo: string;
}) {
  return (
    <div className="group relative w-[300px] h-[380px] m-[30px_20px] transition-all duration-500 cursor-pointer">
      {/* Skewed gradient panel */}
      <span
        className="absolute top-0 left-[50px] w-1/2 h-full rounded-lg transform skew-x-[15deg] transition-all duration-500 group-hover:skew-x-0 group-hover:left-[20px] group-hover:w-[calc(100%-90px)]"
        style={{
          background: `linear-gradient(315deg, ${gradientFrom}, ${gradientTo})`,
        }}
      />
      {/* Glow blur */}
      <span
        className="absolute top-0 left-[50px] w-1/2 h-full rounded-lg transform skew-x-[15deg] blur-[30px] transition-all duration-500 group-hover:skew-x-0 group-hover:left-[20px] group-hover:w-[calc(100%-90px)]"
        style={{
          background: `linear-gradient(315deg, ${gradientFrom}, ${gradientTo})`,
          opacity: 0.5,
        }}
      />

      {/* Animated blobs */}
      <span className="pointer-events-none absolute inset-0 z-10">
        <span className="absolute top-0 left-0 w-0 h-0 rounded-lg opacity-0 bg-[rgba(255,255,255,0.08)] backdrop-blur-[10px] shadow-[0_5px_15px_rgba(0,0,0,0.3)] transition-all duration-300 animate-blob group-hover:top-[-50px] group-hover:left-[50px] group-hover:w-[100px] group-hover:h-[100px] group-hover:opacity-100" />
        <span className="absolute bottom-0 right-0 w-0 h-0 rounded-lg opacity-0 bg-[rgba(255,255,255,0.08)] backdrop-blur-[10px] shadow-[0_5px_15px_rgba(0,0,0,0.3)] transition-all duration-500 animate-blob animation-delay-1000 group-hover:bottom-[-50px] group-hover:right-[50px] group-hover:w-[100px] group-hover:h-[100px] group-hover:opacity-100" />
      </span>

      {/* Content */}
      <div
        className="relative z-20 left-0 p-[20px_40px] backdrop-blur-[10px] shadow-lg rounded-lg text-white transition-all duration-500 group-hover:left-[-25px] group-hover:p-[40px_40px] h-full flex flex-col justify-start"
        style={{ background: "rgba(20,24,29,0.7)" }}
      >
        {/* Badge */}
        <span
          className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-3 w-fit"
          style={{
            background: `${gradientFrom}22`,
            border: `1px solid ${gradientFrom}44`,
            color: gradientFrom,
          }}
        >
          {badge}
        </span>
        <h2 className="text-xl font-semibold mb-3" style={{ color: "var(--text)" }}>
          {title}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {desc}
        </p>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────
export default function GradientCards() {
  const { t } = useLang();

  return (
    <section id="how" className="w-full py-24 overflow-hidden" style={{ background: "linear-gradient(to bottom, var(--bg) 0%, var(--bg) 4%, transparent 12%)" }}>
      <div className="text-center mb-12 px-6">
        <h2
          className="text-4xl font-semibold"
          style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
        >
          {t.how.heading}
        </h2>
        <p className="mt-3 text-lg max-w-xl mx-auto" style={{ color: "var(--text-muted)" }}>
          {t.how.description}
        </p>
      </div>

      <div className="flex justify-center items-center flex-wrap">
        {CARD_META.map((meta, idx) => {
          const card = t.how.cards[idx];
          return (
            <SkewCard
              key={idx}
              title={card.title}
              badge={meta.badge}
              desc={card.description}
              gradientFrom={meta.gradientFrom}
              gradientTo={meta.gradientTo}
            />
          );
        })}
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translateY(10px); }
          50% { transform: translate(-10px); }
        }
        .animate-blob { animation: blob 2s ease-in-out infinite; }
        .animation-delay-1000 { animation-delay: -1s; }
      `}</style>
    </section>
  );
}
