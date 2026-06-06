"use client";

import { Home, Zap, CreditCard, MessageSquare } from "lucide-react";

const NAV_ITEMS = [
  { id: "hero",    label: "Hero",         Icon: Home },
  { id: "how",     label: "How it works", Icon: Zap },
  { id: "pricing", label: "Pricing",      Icon: CreditCard },
  { id: "try",     label: "Try for free", Icon: MessageSquare },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function DockNav() {
  return (
    <>
      <style>{`
        .dock-icon:hover + .dock-icon {
          width: calc(var(--icon-size) * 1.33) !important;
          height: calc(var(--icon-size) * 1.33) !important;
        }
        .dock-icon:hover + .dock-icon + .dock-icon {
          width: calc(var(--icon-size) * 1.17) !important;
          height: calc(var(--icon-size) * 1.17) !important;
        }
        .dock-icon:has(+ .dock-icon:hover) {
          width: calc(var(--icon-size) * 1.33) !important;
          height: calc(var(--icon-size) * 1.33) !important;
        }
        .dock-icon:has(+ .dock-icon + .dock-icon:hover) {
          width: calc(var(--icon-size) * 1.17) !important;
          height: calc(var(--icon-size) * 1.17) !important;
        }
        .dock-icon {
          transition: width 150ms cubic-bezier(0.25,1,0.5,1),
                      height 150ms cubic-bezier(0.25,1,0.5,1);
        }
        .dock-icon:hover .dock-icon-inner svg {
          color: #A3E635 !important;
        }
      `}</style>
      <nav
        className="fixed bottom-6 left-1/2 z-50"
        style={{ transform: "translateX(-50%)" }}
        role="navigation"
        aria-label="Page sections"
      >
        <ul
          className="flex items-end gap-2 rounded-2xl border px-3 py-2"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset",
          }}
        >
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <li
              key={id}
              className="dock-icon group flex flex-col items-center justify-center cursor-pointer"
              style={
                {
                  width: "var(--icon-size, 48px)",
                  height: "var(--icon-size, 48px)",
                  "--icon-size": "48px",
                } as React.CSSProperties
              }
              onClick={() => scrollTo(id)}
            >
              <div
                className="dock-icon-inner relative flex items-center justify-center w-full h-full rounded-xl border"
                style={{
                  background:
                    "linear-gradient(to top, var(--surface-2), var(--surface))",
                  borderColor: "var(--border)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                {/* Tooltip */}
                <span
                  className="absolute bottom-full mb-2 px-2 py-1 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 60,
                  }}
                >
                  {label}
                </span>
                <Icon size={20} style={{ color: "var(--text-muted)" }} />
              </div>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
