"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/lib/i18n/LangContext";

const CARD_META = [
  { badge: "L1 · Intent Score", badgeColor: "#A3E635", step: "01", gradientFrom: "rgba(163,230,53,0.06)", gradientTo: "rgba(163,230,53,0.02)", borderColor: "rgba(163,230,53,0.18)" },
  { badge: "L2 · Company",      badgeColor: "#6BA4FF", step: "02", gradientFrom: "rgba(107,164,255,0.06)", gradientTo: "rgba(107,164,255,0.02)", borderColor: "rgba(107,164,255,0.18)" },
  { badge: "L3 · Contact",      badgeColor: "#C084FC", step: "03", gradientFrom: "rgba(192,132,252,0.06)", gradientTo: "rgba(192,132,252,0.02)", borderColor: "rgba(192,132,252,0.18)" },
  { badge: "L4 · Email",        badgeColor: "#34D399", step: "04", gradientFrom: "rgba(52,211,153,0.06)",  gradientTo: "rgba(52,211,153,0.02)",  borderColor: "rgba(52,211,153,0.18)"  },
];

export default function GradientCards() {
  const { t } = useLang();

  return (
    <section id="how" className="w-full max-w-6xl mx-auto px-6 py-24">
      <div className="text-center mb-16">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
          style={{
            border: "1px solid rgba(163,230,53,0.3)",
            background: "rgba(163,230,53,0.08)",
            color: "var(--accent)",
          }}
        >
          {t.how.badge}
        </div>
        <h2
          className="text-4xl font-semibold"
          style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
        >
          {t.how.heading}
        </h2>
        <p
          className="mt-3 text-lg max-w-xl mx-auto"
          style={{ color: "var(--text-muted)" }}
        >
          {t.how.description}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {CARD_META.map((meta, i) => {
          const card = t.how.cards[i];
          return (
            <motion.div
              key={meta.step}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="relative overflow-hidden rounded-2xl p-8 flex flex-col gap-4"
              style={{
                background: `linear-gradient(135deg, ${meta.gradientFrom}, ${meta.gradientTo})`,
                border: `1px solid ${meta.borderColor}`,
              }}
            >
              {/* Large step number bg */}
              <span
                className="absolute top-5 right-7 text-8xl font-bold select-none pointer-events-none"
                style={{ color: meta.borderColor, lineHeight: 1 }}
              >
                {meta.step}
              </span>

              {/* Badge */}
              <div
                className="inline-flex items-center gap-2 w-fit px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${meta.borderColor}`,
                  color: meta.badgeColor,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.badgeColor }} />
                {meta.badge}
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--text)" }}>
                  {card.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {card.description}
                </p>
              </div>

              <div
                className="flex items-center gap-1 text-sm font-medium mt-auto"
                style={{ color: meta.badgeColor }}
              >
                {t.how.learnMore} <ArrowRight size={14} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
