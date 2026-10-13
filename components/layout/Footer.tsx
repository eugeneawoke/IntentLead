"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n/LangContext";

export function Footer() {
  const { t } = useLang();

  return (
    <footer
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
        <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
          IntentLead
        </Link>
        <Link href="/methodology" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
          {t.footer.methodology}
        </Link>
        <Link href="/roadmap" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
          {t.footer.roadmap}
        </Link>
        <Link href="/privacy" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
          {t.footer.privacy}
        </Link>
        <Link href="/terms" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
          {t.footer.terms}
        </Link>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-faint)", margin: 0 }}>
        {t.footer.copyright}
      </p>
    </footer>
  );
}
