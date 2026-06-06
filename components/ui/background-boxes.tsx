"use client";
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ── BoxesCore — оригинальный aceternity компонент ────
export const BoxesCore = ({ className, ...rest }: { className?: string }) => {
  const rows = new Array(150).fill(1);
  const cols = new Array(100).fill(1);

  const colors = [
    "rgb(125 211 252)",   // sky-300
    "rgb(249 168 212)",   // pink-300
    "rgb(134 239 172)",   // green-300
    "rgb(253 224 71)",    // yellow-300
    "rgb(252 165 165)",   // red-300
    "rgb(216 180 254)",   // purple-300
    "rgb(147 197 253)",   // blue-300
    "rgb(165 180 252)",   // indigo-300
    "rgb(196 181 253)",   // violet-300
  ];

  const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];

  return (
    <div
      style={{
        transform:
          "translate(-40%,-60%) skewX(-48deg) skewY(14deg) scale(0.675) rotate(0deg) translateZ(0)",
      }}
      className={cn(
        "absolute left-1/4 p-4 -top-1/4 flex -translate-x-1/2 -translate-y-1/2 w-full h-full z-0",
        className
      )}
      {...rest}
    >
      {rows.map((_, i) => (
        <motion.div
          key={`row` + i}
          className="w-16 h-8 border-l border-slate-700 relative"
        >
          {cols.map((_, j) => (
            <motion.div
              whileHover={{
                backgroundColor: getRandomColor(),
                transition: { duration: 0 },
              }}
              animate={{ transition: { duration: 2 } }}
              key={`col` + j}
              className="w-16 h-8 border-r border-t border-slate-700 relative"
            >
              {j % 2 === 0 && i % 2 === 0 ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="absolute h-6 w-10 -top-[14px] -left-[22px] text-slate-700 stroke-[1px] pointer-events-none"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v12m6-6H6"
                  />
                </svg>
              ) : null}
            </motion.div>
          ))}
        </motion.div>
      ))}
    </div>
  );
};

export const Boxes = React.memo(BoxesCore);

// ── Footer с Boxes + Signal Dark контент ─────────────
export default function BackgroundBoxes() {
  return (
    <footer
      className="relative w-full overflow-hidden"
      style={{ background: "var(--bg)", minHeight: 400 }}
    >
      {/* Boxes grid */}
      <Boxes />

      {/* Top mask */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 30%, var(--bg) 80%)",
        }}
      />

      {/* Content */}
      <div className="relative z-20 max-w-6xl mx-auto px-6 py-20">
        <div className="flex flex-col md:flex-row justify-between gap-12">
          {/* Brand */}
          <div>
            <div
              className="text-lg font-semibold mb-2"
              style={{ color: "var(--text)", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}
            >
              IntentLead AI
            </div>
            <p
              className="text-sm max-w-xs leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              Signal-to-lead pipeline. Reddit + HN intent → verified contact →
              personalized message.
            </p>
            <p className="text-xs mt-6" style={{ color: "var(--text-faint)" }}>
              © 2026 IntentLead AI. All rights reserved.
            </p>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-8">
            {[
              {
                title: "Product",
                links: [
                  { label: "How it works", href: "/#how" },
                  { label: "Pricing", href: "/#pricing" },
                  { label: "Methodology", href: "/methodology" },
                  { label: "Roadmap", href: "/roadmap" },
                ],
              },
              {
                title: "Legal",
                links: [
                  { label: "Privacy", href: "/privacy" },
                  { label: "Terms", href: "/terms" },
                ],
              },
            ].map((section) => (
              <div key={section.title}>
                <div
                  className="text-xs font-medium uppercase tracking-widest mb-4"
                  style={{ color: "var(--text-faint)" }}
                >
                  {section.title}
                </div>
                {section.links.map(({ label, href }) => (
                  <a
                    key={label}
                    href={href}
                    className="block text-sm mb-2.5"
                    style={{ color: "var(--text-muted)", textDecoration: "none" }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)")
                    }
                  >
                    {label}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
