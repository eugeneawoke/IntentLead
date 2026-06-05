"use client";
import { useState, useEffect } from "react";

const STEPS = [
  {
    label: "Step 1 of 4",
    title: "Describe who you're looking for",
    preview: (
      <div style={{ fontFamily: "Inter, sans-serif", color: "var(--text-muted)", fontSize: 14 }}>
        <div style={{ color: "var(--text)", marginBottom: 8 }}>
          "I sell website audits to SaaS founders struggling with low conversion..."
        </div>
        <div style={{ color: "var(--accent)", fontSize: 12 }}>→ Keywords extracted: conversion optimization, SaaS landing page, CRO</div>
      </div>
    ),
  },
  {
    label: "Step 2 of 4",
    title: "AI catches intent signals",
    preview: (
      <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)" }}>
        <div style={{ marginBottom: 4 }}>[Reddit] u/saasgrowth: "our signup rate dropped 40%, need help"</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>Intent score: 94</span>
          <span style={{ background: "rgba(163,230,53,0.12)", color: "var(--accent)", borderRadius: 4, padding: "2px 8px", fontSize: 11 }}>HOT</span>
        </div>
      </div>
    ),
  },
  {
    label: "Step 3 of 4",
    title: "4-level verification",
    preview: (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {["Signal", "Company", "Contact", "Email"].map((level) => (
          <div key={level} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ color: "var(--accent)", fontSize: 16 }}>✓</span>
            <span style={{ color: "var(--text)" }}>{level} verified</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    label: "Step 4 of 4",
    title: "Lead + message ready",
    preview: (
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        <div style={{ color: "var(--text)", fontWeight: 600 }}>Sarah Chen · Head of Growth</div>
        <div style={{ color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>sarah@acme.io</div>
        <div style={{ marginTop: 8, color: "var(--text-muted)", fontStyle: "italic", fontSize: 12 }}>
          "Saw your post about conversion drop — we've helped 3 SaaS teams 2x signup rate..."
        </div>
      </div>
    ),
  },
];

export function StepWizard() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % STEPS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      {/* Progress tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            style={{
              flex: 1,
              height: 3,
              border: "none",
              borderRadius: 2,
              background: i === active ? "var(--accent)" : "var(--border)",
              cursor: "pointer",
              transition: "background 240ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        ))}
      </div>

      {/* Step card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 24,
          minHeight: 140,
        }}
      >
        <div style={{ color: "var(--text-faint)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          {STEPS[active].label}
        </div>
        <div style={{ color: "var(--text)", fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          {STEPS[active].title}
        </div>
        {STEPS[active].preview}
      </div>
    </div>
  );
}
