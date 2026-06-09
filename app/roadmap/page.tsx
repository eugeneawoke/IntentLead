"use client";
import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
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

const ease = [0.22, 1, 0.36, 1] as const;

function StatusBadge({ status }: { status: EntryStatus }) {
  const styles: Record<EntryStatus, { color: string; bg: string; label: string }> = {
    shipped: { color: "var(--accent)", bg: "rgba(163,230,53,0.1)", label: "Shipped" },
    "in-progress": { color: "var(--pending)", bg: "rgba(245,196,81,0.1)", label: "In Progress" },
    planned: { color: "var(--text-faint)", bg: "rgba(91,102,117,0.12)", label: "Planned" },
  };
  const s = styles[status];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 11, fontWeight: 500, letterSpacing: "0.04em",
        color: s.color, background: s.bg,
        border: `1px solid ${s.color}30`,
        borderRadius: 6, padding: "2px 8px",
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
  const base = {
    width: 28, height: 28, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  };
  if (status === "shipped") return (
    <div style={{ ...base, background: "rgba(163,230,53,0.12)", border: "1.5px solid var(--accent)" }}>
      <CheckCircle size={13} style={{ color: "var(--accent)" }} />
    </div>
  );
  if (status === "in-progress") return (
    <div style={{ ...base, background: "rgba(245,196,81,0.1)", border: "1.5px solid var(--pending)" }}>
      <Clock size={13} style={{ color: "var(--pending)" }} />
    </div>
  );
  return (
    <div style={{ ...base, background: "rgba(91,102,117,0.1)", border: "1.5px solid var(--border-strong)" }}>
      <Circle size={13} style={{ color: "var(--text-faint)" }} />
    </div>
  );
}

function ItemIcon({ status }: { status: EntryStatus }) {
  if (status === "shipped") return <CheckCircle size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />;
  if (status === "in-progress") return <Clock size={14} style={{ color: "var(--pending)", flexShrink: 0, marginTop: 1 }} />;
  return <Circle size={14} style={{ color: "var(--text-faint)", flexShrink: 0, marginTop: 1 }} />;
}

interface TimelineEntryProps {
  version: string;
  status: EntryStatus;
  items: React.ReactNode[];
  index: number;
}

function TimelineEntry({ version, status, items, index }: TimelineEntryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const itemColor = status === "planned" ? "var(--text-muted)" : "var(--text)";
  const cardBorder = status === "in-progress" ? "rgba(245,196,81,0.18)" : "var(--border)";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease, delay: index * 0.1 }}
      style={{ display: "flex", gap: "1.25rem", position: "relative" }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={inView ? { scale: 1, opacity: 1 } : {}}
          transition={{ duration: 0.4, ease, delay: index * 0.1 + 0.1 }}
        >
          <DotIcon status={status} />
        </motion.div>
        <div style={{ width: 1, flex: 1, background: "var(--border)", marginTop: 6 }} />
      </div>

      <div style={{ flex: 1, paddingBottom: "2.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.75rem", marginTop: 2 }}>
          <span
            style={{
              fontSize: 14, fontWeight: 600, color: "var(--text)",
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
              letterSpacing: "-0.01em",
            }}
          >
            {version}
          </span>
          <StatusBadge status={status} />
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: `1px solid ${cardBorder}`,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.4, ease, delay: index * 0.1 + 0.18 + i * 0.05 }}
              style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "0.75rem 1.125rem",
                borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <ItemIcon status={status} />
              <span
                style={{
                  fontSize: 13.5, lineHeight: 1.5, color: itemColor,
                  fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
                }}
              >
                {item}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
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
        background: "var(--bg)", color: "var(--text)", minHeight: "100vh",
        fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2.5rem 1.5rem 8rem" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          style={{ marginBottom: "3.5rem" }}
        >
          <h1
            style={{
              fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em",
              color: "var(--text)",
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
              margin: "0 0 0.5rem",
            }}
          >
            Roadmap
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
            What&apos;s shipped, what&apos;s in progress, and what&apos;s coming.
          </p>
        </motion.div>

        <div>
          <TimelineEntry version="v1.0 — MVP" status="shipped" items={deliveredItems} index={0} />
          <TimelineEntry version="v1.1 — In Progress" status="in-progress" items={IN_PROGRESS} index={1} />
          <TimelineEntry version="v2.0 — Horizon" status="planned" items={PLANNED} index={2} />
        </div>
      </div>
      <BackgroundBoxes />
      <DockNav />
    </main>
  );
}
