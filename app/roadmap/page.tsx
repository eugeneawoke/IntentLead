"use client";
import React from "react";
import Link from "next/link";
import DockNav from "@/components/ui/dock";
import BackgroundBoxes from "@/components/ui/background-boxes";
import { CheckCircle, Clock, Circle } from "lucide-react";

const DELIVERED = [
  "4-level verification pipeline (L1 intent → L2 company → L3 contact → L4 email)",
  "Reddit + HN signal detection",
  "Email waterfall: Prospeo → Hunter → Apollo",
  "Personalized message generation (GPT-4o + RAG grounding)",
  "Credit charged only on verified leads — rejected leads are free",
];

const IN_PROGRESS = [
  "Workspace dashboard with campaign history",
  "CSV + Google Sheets export",
  "Magic link auth (Supabase)",
];

const PLANNED = [
  "Auto-send via Gmail / Outlook (V2)",
  "LinkedIn signals (Phase 2)",
  "Semantic ICP matching via RAG (V2)",
  "Multi-workspace support (Agency plan V2)",
  "Webhook auto-billing (PayPro Global)",
  "Perplexity why-now narrative (V2)",
  "Parallel API deep research (V2)",
];

type EntryStatus = "shipped" | "in-progress" | "planned";

interface TimelineEntryProps {
  version: string;
  status: EntryStatus;
  items: React.ReactNode[];
}

function StatusBadge({ status }: { status: EntryStatus }) {
  const styles: Record<EntryStatus, { color: string; bg: string; label: string }> = {
    shipped: {
      color: "var(--accent)",
      bg: "rgba(163,230,53,0.1)",
      label: "Shipped",
    },
    "in-progress": {
      color: "var(--pending)",
      bg: "rgba(245,196,81,0.1)",
      label: "In Progress",
    },
    planned: {
      color: "var(--text-faint)",
      bg: "rgba(91,102,117,0.12)",
      label: "Planned",
    },
  };

  const s = styles[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.04em",
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.color}30`,
        borderRadius: 6,
        padding: "2px 8px",
        fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
      }}
    >
      {status === "shipped" && (
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color, display: "inline-block" }} />
      )}
      {s.label}
    </span>
  );
}

function DotIcon({ status }: { status: EntryStatus }) {
  if (status === "shipped") {
    return (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(163,230,53,0.12)",
          border: "1.5px solid var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <CheckCircle size={13} style={{ color: "var(--accent)" }} />
      </div>
    );
  }
  if (status === "in-progress") {
    return (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(245,196,81,0.1)",
          border: "1.5px solid var(--pending)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Clock size={13} style={{ color: "var(--pending)" }} />
      </div>
    );
  }
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "rgba(91,102,117,0.1)",
        border: "1.5px solid var(--border-strong)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Circle size={13} style={{ color: "var(--text-faint)" }} />
    </div>
  );
}

function ItemIcon({ status }: { status: EntryStatus }) {
  if (status === "shipped") {
    return <CheckCircle size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />;
  }
  if (status === "in-progress") {
    return <Clock size={14} style={{ color: "var(--pending)", flexShrink: 0, marginTop: 1 }} />;
  }
  return <Circle size={14} style={{ color: "var(--text-faint)", flexShrink: 0, marginTop: 1 }} />;
}

function TimelineEntry({ version, status, items }: TimelineEntryProps) {
  const itemColor =
    status === "shipped"
      ? "var(--text)"
      : status === "in-progress"
      ? "var(--text)"
      : "var(--text-muted)";

  const cardBorder =
    status === "shipped"
      ? "var(--border)"
      : status === "in-progress"
      ? "rgba(245,196,81,0.18)"
      : "var(--border)";

  return (
    <div style={{ display: "flex", gap: "1.25rem", position: "relative" }}>
      {/* Dot + line connector */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <DotIcon status={status} />
        <div
          style={{
            width: 1,
            flex: 1,
            background: "var(--border)",
            marginTop: 6,
          }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: "2.5rem" }}>
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: "0.75rem",
            marginTop: 2,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text)",
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
              letterSpacing: "-0.01em",
            }}
          >
            {version}
          </span>
          <StatusBadge status={status} />
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--surface)",
            border: `1px solid ${cardBorder}`,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "0.75rem 1.125rem",
                borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <ItemIcon status={status} />
              <span
                style={{
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  color: itemColor,
                  fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
                }}
              >
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RoadmapPage() {
  const deliveredItems: React.ReactNode[] = [
    ...DELIVERED,
    <>
      <a
        href="https://glook.app"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--accent)", textDecoration: "underline", textUnderlineOffset: 3 }}
      >
        Glook
      </a>{" "}
      warm-entry integration — skip discovery when site audit already done
    </>,
  ];

  return (
    <main
      style={{
        background: "var(--bg)",
        color: "var(--text)",
        minHeight: "100vh",
        fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2.5rem 1.5rem 8rem" }}>
        {/* Page header */}
        <div style={{ marginBottom: "3.5rem" }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--text)",
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
              margin: "0 0 0.5rem",
            }}
          >
            Roadmap
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-muted)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            What&apos;s shipped, what&apos;s in progress, and what&apos;s coming.
          </p>
        </div>

        {/* Timeline */}
        <div>
          <TimelineEntry
            version="v1.0 — MVP"
            status="shipped"
            items={deliveredItems}
          />
          <TimelineEntry
            version="v1.1 — In Progress"
            status="in-progress"
            items={IN_PROGRESS}
          />
          <TimelineEntry
            version="v2.0 — Horizon"
            status="planned"
            items={PLANNED}
          />
        </div>
      </div>
      <BackgroundBoxes />
      <DockNav />
    </main>
  );
}
