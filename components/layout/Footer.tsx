import Link from "next/link";

export function Footer() {
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
        <Link
          href="/privacy"
          style={{ color: "var(--text-muted)", textDecoration: "none" }}
        >
          Privacy
        </Link>
        <Link
          href="/terms"
          style={{ color: "var(--text-muted)", textDecoration: "none" }}
        >
          Terms
        </Link>
        <Link
          href="/pricing"
          style={{ color: "var(--text-muted)", textDecoration: "none" }}
        >
          Pricing
        </Link>
        <Link
          href="/vs"
          style={{ color: "var(--text-muted)", textDecoration: "none" }}
        >
          Comparisons
        </Link>
        <a
          href="mailto:support@glook.dev"
          style={{ color: "var(--text-muted)", textDecoration: "none" }}
        >
          support@glook.dev
        </a>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-faint)", margin: 0 }}>
        © {new Date().getFullYear()} IntentLead AI. Built by Eugene Gusakov.
      </p>
    </footer>
  );
}
