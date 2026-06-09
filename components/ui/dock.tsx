"use client";
import React from "react";
import { Home, Zap, CreditCard, MessageSquare } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@/lib/auth/UserContext";

// ── Types ─────────────────────────────────────────────
interface DockIconProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>;
  label: string;
  badge?: string;
  onClick?: () => void;
}

// ── Smooth scroll ────────────────────────────────────
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Nav config ────────────────────────────────────────
const NAV_ITEMS = [
  { id: "hero",    label: "Home",         Icon: Home },
  { id: "how",     label: "How it works", Icon: Zap },
  { id: "pricing", label: "Pricing",      Icon: CreditCard },
  { id: "try",     label: "Try for free", Icon: MessageSquare },
];

// ── DockIcon ──────────────────────────────────────────
function DockIcon({ icon: Icon, label, badge, onClick }: DockIconProps) {
  return (
    <button
      className="hover-halo group relative grid h-12 w-12 place-items-center rounded-xl ring-1 ring-white/10 backdrop-blur-xl shadow-lg transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.05] sm:h-14 sm:w-14"
      style={{
        background: "linear-gradient(to bottom, var(--surface-2), var(--surface))",
      }}
      aria-label={label}
      onClick={onClick}
    >
      <Icon
        className="h-5 w-5 transition-transform duration-200 group-hover:scale-110"
        style={{ color: "rgba(255,255,255,0.75)" }}
        strokeWidth={2.1}
      />
      {badge && (
        <span
          className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ring-1 ring-white/80"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          {badge}
        </span>
      )}
      <span
        className="tooltip pointer-events-none absolute -bottom-6 translate-y-1/2 text-[9px] tracking-wide sm:text-[10px] whitespace-nowrap"
        style={{ color: "rgba(255,255,255,0.9)" }}
      >
        {label}
      </span>
    </button>
  );
}

// ── Dock bar ──────────────────────────────────────────
function Dock() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useUser();

  // On non-landing pages: navigate to /#section instead of scroll
  const handleNav = (id: string) => {
    if (pathname === "/") {
      scrollTo(id);
    } else {
      router.push(`/#${id}`);
    }
  };

  const navItems = NAV_ITEMS.map((item) => {
    if (item.id === "try" && user) {
      return { ...item, label: "Workspace", onClick: () => router.push("/workspace") };
    }
    if (item.id === "try") {
      return {
        ...item,
        onClick: () => {
          const composers = Array.from(
            document.querySelectorAll<HTMLElement>("[data-composer-id]")
          );
          if (composers.length === 0) { handleNav(item.id); return; }

          // Find nearest to current viewport center
          const viewportMid = window.scrollY + window.innerHeight / 2;
          let nearest = composers[0];
          let minDist = Infinity;
          for (const c of composers) {
            const dist = Math.abs(c.getBoundingClientRect().top + window.scrollY - viewportMid);
            if (dist < minDist) { minDist = dist; nearest = c; }
          }

          const nearestId = nearest.getAttribute("data-composer-id") ?? "";
          // Scroll to the section, not the composer element — avoids partial DataGrid strip
          const sectionEl = document.getElementById(nearestId === "hero" ? "hero" : "try");
          if (sectionEl) {
            sectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            nearest.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          window.dispatchEvent(new CustomEvent<string>("composer-shimmer", { detail: nearestId }));
        },
      };
    }
    // Pricing scrolls to #pricing on landing; navigate from Footer link for /pricing page
    return { ...item, onClick: () => handleNav(item.id) };
  });

  return (
    <div className="relative flex items-center gap-2 sm:gap-4 scale-90 sm:scale-95">
      <div
        className="flex items-center gap-3 rounded-[28px] px-3 py-2 shadow-2xl ring-1 ring-white/10 backdrop-blur-lg sm:gap-5 sm:rounded-[48px] sm:px-6 sm:py-3"
        style={{
          background: "var(--surface)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        {navItems.map(({ id, label, Icon, onClick }) => (
          <DockIcon
            key={id}
            icon={Icon}
            label={label}
            onClick={onClick ?? (() => scrollTo(id))}
          />
        ))}
      </div>
    </div>
  );
}

// ── DockNav — used in landing layout ─────────────────
export default function DockNav() {
  return (
    <>
      <style>{`
        .hover-halo { position: relative; }
        .hover-halo::after {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          opacity: 0;
          transition: opacity .25s;
          box-shadow: 0 0 0 0 rgba(163,230,53,.15), 0 12px 30px -10px rgba(0,0,0,.7);
        }
        .hover-halo:hover::after { opacity: 1; }
        .tooltip {
          opacity: 0;
          transform: translateY(6px);
          transition: opacity .2s, transform .2s;
        }
        .group:hover .tooltip { opacity: 1; transform: translateY(0); }
      `}</style>

      <nav
        className="fixed bottom-6 left-1/2 z-50"
        style={{ transform: "translateX(-50%)" }}
        role="navigation"
        aria-label="Page sections"
      >
        <Dock />
      </nav>
    </>
  );
}

export { Dock, DockIcon };
