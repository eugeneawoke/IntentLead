import Link from "next/link";

export default function WorkspacePage() {
  return (
    <div className="p-10">
      <h1
        className="text-2xl font-semibold mb-2"
        style={{
          color: "var(--text)",
          letterSpacing: "-0.02em",
          fontFamily: "Geist, sans-serif",
        }}
      >
        Workspace
      </h1>
      <p className="mb-8 text-sm" style={{ color: "var(--text-muted)" }}>
        Select a campaign from the sidebar or start a new one.
      </p>
      <Link
        href="/chat"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold"
        style={{
          background: "var(--accent)",
          color: "var(--accent-fg)",
          textDecoration: "none",
        }}
      >
        + New Campaign
      </Link>
    </div>
  );
}
