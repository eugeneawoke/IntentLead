"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n/LangContext";
import { TRANSLATIONS } from "@/lib/i18n/translations";

export function Footer() {
  const { lang, t } = useLang();
  const pathname = usePathname();
  const isLocalizedRoute = pathname === "/";
  const displayText = isLocalizedRoute ? t : TRANSLATIONS.en;
  const displayLang = isLocalizedRoute ? lang : "en";

  return (
    <footer
      aria-label="Site footer"
      data-public-shell="footer"
      style={{
        borderTop: "1px solid var(--border)",
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 24px",
          justifyContent: "center",
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        <Link href="/" className="focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--accent)]" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
          IntentLead
        </Link>
        <Link href="/pricing" className="focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--accent)]" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
          {displayLang === "ru" ? "Доступ к пилоту" : "Pilot Access"}
        </Link>
        <Link href="/compare" className="focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--accent)]" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
          {displayText.footer.compare}
        </Link>
        <Link href="/methodology" className="focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--accent)]" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
          {displayText.footer.methodology}
        </Link>
        <Link href="/roadmap" className="focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--accent)]" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
          {displayText.footer.roadmap}
        </Link>
        <Link href="/privacy" className="focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--accent)]" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
          {displayText.footer.privacy}
        </Link>
        <Link href="/terms" className="focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--accent)]" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
          {displayText.footer.terms}
        </Link>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-faint)", margin: 0 }}>
        {displayText.footer.copyright}
      </p>
    </footer>
  );
}
