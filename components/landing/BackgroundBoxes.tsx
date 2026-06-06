"use client";

import { motion } from "framer-motion";

const BOX_COLORS = [
  "rgba(163,230,53,0.12)",
  "rgba(163,230,53,0.07)",
  "rgba(163,230,53,0.04)",
  "rgba(107,164,255,0.06)",
  "rgba(255,255,255,0.025)",
  "rgba(52,211,153,0.05)",
];

const ROWS = 10;
const COLS = 14;

export default function BackgroundBoxes() {
  return (
    <footer
      className="relative w-full overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      {/* Gradient masks */}
      <div
        className="absolute inset-0 z-20 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, var(--bg) 0%, transparent 25%, transparent 75%, var(--bg) 100%)",
        }}
      />
      <div
        className="absolute inset-0 z-20 pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, var(--bg) 0%, transparent 15%, transparent 85%, var(--bg) 100%)",
        }}
      />

      {/* Animated box grid */}
      <div className="absolute inset-0 z-10 flex flex-col">
        {Array.from({ length: ROWS }).map((_, ri) => (
          <div key={ri} className="flex flex-1">
            {Array.from({ length: COLS }).map((_, ci) => (
              <motion.div
                key={ci}
                className="flex-1 border"
                style={{ borderColor: "rgba(255,255,255,0.035)" }}
                whileHover={{
                  background:
                    BOX_COLORS[Math.floor(Math.random() * BOX_COLORS.length)],
                  transition: { duration: 0 },
                }}
                animate={{ background: "transparent" }}
                transition={{ duration: 0.8 }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-30 max-w-6xl mx-auto px-6 py-20">
        <div className="flex flex-col md:flex-row justify-between gap-12">
          {/* Brand */}
          <div>
            <div
              className="text-lg font-semibold mb-2"
              style={{
                color: "var(--text)",
                fontFamily: "Geist, sans-serif",
              }}
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            <div>
              <div
                className="text-xs font-medium uppercase tracking-widest mb-4"
                style={{ color: "var(--text-faint)" }}
              >
                Product
              </div>
              {[
                { label: "How it works", href: "/#how" },
                { label: "Pricing", href: "/#pricing" },
                { label: "Methodology", href: "/methodology" },
                { label: "Roadmap", href: "/roadmap" },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="block text-sm mb-2.5 transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) =>
                    ((e.target as HTMLAnchorElement).style.color = "var(--text)")
                  }
                  onMouseLeave={(e) =>
                    ((e.target as HTMLAnchorElement).style.color =
                      "var(--text-muted)")
                  }
                >
                  {label}
                </a>
              ))}
            </div>
            <div>
              <div
                className="text-xs font-medium uppercase tracking-widest mb-4"
                style={{ color: "var(--text-faint)" }}
              >
                Company
              </div>
              {[
                { label: "Glook", href: "https://glook.app" },
                { label: "Twitter / X", href: "https://x.com" },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="block text-sm mb-2.5 transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) =>
                    ((e.target as HTMLAnchorElement).style.color = "var(--text)")
                  }
                  onMouseLeave={(e) =>
                    ((e.target as HTMLAnchorElement).style.color =
                      "var(--text-muted)")
                  }
                >
                  {label}
                </a>
              ))}
            </div>
            <div>
              <div
                className="text-xs font-medium uppercase tracking-widest mb-4"
                style={{ color: "var(--text-faint)" }}
              >
                Legal
              </div>
              {[
                { label: "Privacy", href: "/privacy" },
                { label: "Terms", href: "/terms" },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  className="block text-sm mb-2.5 transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={(e) =>
                    ((e.target as HTMLAnchorElement).style.color = "var(--text)")
                  }
                  onMouseLeave={(e) =>
                    ((e.target as HTMLAnchorElement).style.color =
                      "var(--text-muted)")
                  }
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
