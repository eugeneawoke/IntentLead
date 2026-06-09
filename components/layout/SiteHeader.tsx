"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import { useLang } from "@/lib/i18n/LangContext";
import { useUser } from "@/lib/auth/UserContext";

// FluidGlassPill loads client-only (no SSR — Three.js needs browser)
const FluidGlassPill = dynamic(() => import("./FluidGlassPill"), { ssr: false });

export default function SiteHeader() {
  const user = useUser();
  const { lang, setLang, t } = useLang();
  const { openModal } = useAuthModal();

  return (
    <header
      style={{
        position: "fixed",
        top: 20,
        left: 0,
        right: 0,
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* ── Left pill: FluidGlass brand ───────────────── */}
        <FluidGlassPill
          style={{ pointerEvents: "auto" }}
        >
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              padding: "9px 20px",
              textDecoration: "none",
              color: "rgba(255,255,255,0.92)",
              fontWeight: 650,
              fontSize: 14,
              letterSpacing: "-0.01em",
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
              whiteSpace: "nowrap",
            }}
          >
            IntentLead AI
          </Link>
        </FluidGlassPill>

        {/* ── Right pill: FluidGlass nav ────────────────── */}
        <FluidGlassPill
          style={{ pointerEvents: "auto" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "5px 5px 5px 14px",
              gap: 6,
            }}
          >
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === "en" ? "ru" : "en")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.55)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.07em",
                padding: "4px 6px",
                cursor: "pointer",
                borderRadius: 6,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.9)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)"; }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              {lang === "en" ? "EN" : "RU"}
            </button>

            {/* Divider */}
            <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />

            {user ? (
              <Link
                href="/workspace"
                style={{
                  padding: "7px 16px",
                  borderRadius: 100,
                  background: "var(--accent)",
                  color: "var(--accent-fg)",
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.85"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
              >
                {t.header.workspace}
              </Link>
            ) : (
              <>
                <button
                  onClick={() => openModal("signin")}
                  style={{
                    padding: "7px 13px",
                    borderRadius: 100,
                    background: "transparent",
                    color: "rgba(255,255,255,0.65)",
                    fontSize: 13,
                    fontWeight: 500,
                    border: "none",
                    cursor: "pointer",
                    transition: "color 0.15s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.95)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.65)"; }}
                >
                  {t.header.signIn}
                </button>
                <button
                  onClick={() => openModal("signup")}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 100,
                    background: "var(--accent)",
                    color: "var(--accent-fg)",
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                >
                  {t.header.getStarted}
                </button>
              </>
            )}
          </div>
        </FluidGlassPill>
      </div>
    </header>
  );
}
