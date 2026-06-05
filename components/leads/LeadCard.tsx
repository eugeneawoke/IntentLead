"use client";
import { useState } from "react";
import { VerificationBadges } from "./VerificationBadges";
import type { Lead } from "@/types/lead";

interface LeadCardProps {
  lead: Lead & {
    message?: { subject: string | null; body: string; generation_failed: boolean } | null;
  };
}

function IntentChip({ score }: { score: number }) {
  const isHot = score >= 90;
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        background: isHot ? "rgba(163,230,53,0.15)" : "rgba(163,230,53,0.08)",
        color: "var(--accent)",
        border: "1px solid rgba(163,230,53,0.3)",
        fontFamily: "monospace",
      }}
    >
      {isHot ? "HOT" : "STRONG"} {score}
    </span>
  );
}

export function LeadCard({ lead }: LeadCardProps) {
  const [copied, setCopied] = useState<"email" | "message" | null>(null);

  function copyToClipboard(text: string, type: "email" | "message") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const messageText = lead.message?.body ?? "";
  const mailtoLink = `mailto:${lead.email ?? ""}?subject=${encodeURIComponent(lead.message?.subject ?? "")}&body=${encodeURIComponent(messageText)}`;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 24,
        transition: "border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-strong)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLDivElement).style.transform = "none";
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ color: "var(--text)", fontSize: 16, fontWeight: 600, marginBottom: 2 }}>
            {lead.company_name ?? "Unknown Company"}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "monospace" }}>
            {lead.company_domain ?? ""}
          </div>
        </div>
        {lead.intent_score !== null && <IntentChip score={lead.intent_score} />}
      </div>

      {/* Contact */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ color: "var(--text)", fontWeight: 500 }}>{lead.contact_name ?? "—"}</span>
          {lead.contact_role && (
            <span
              style={{
                padding: "1px 8px",
                borderRadius: 4,
                fontSize: 11,
                background: "var(--surface-2)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              {lead.contact_role}
            </span>
          )}
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 13, fontFamily: "monospace" }}>
          {lead.email ?? "—"}
          {lead.email_provider && (
            <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-faint)" }}>
              via {lead.email_provider}
            </span>
          )}
        </div>
      </div>

      {/* Why now */}
      {lead.why_now && (
        <div style={{ marginBottom: 16, color: "var(--text-muted)", fontSize: 13 }}>
          {lead.why_now}
        </div>
      )}

      {/* Opening line */}
      {lead.opening_line && (
        <div
          style={{
            background: "var(--surface-2)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            color: "var(--text-muted)",
            fontSize: 13,
            fontStyle: "italic",
            borderLeft: "2px solid var(--border-strong)",
          }}
        >
          {lead.opening_line}
        </div>
      )}

      {/* Verification badges */}
      <div style={{ marginBottom: 16 }}>
        <VerificationBadges
          verifySignal={lead.verify_signal}
          verifyCompany={lead.verify_company}
          verifyContact={lead.verify_contact}
          verifyEmail={lead.verify_email}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {lead.email && (
          <button
            onClick={() => copyToClipboard(lead.email!, "email")}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: copied === "email" ? "var(--accent)" : "var(--text-muted)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {copied === "email" ? "Copied!" : "Copy email"}
          </button>
        )}
        {messageText && (
          <button
            onClick={() => copyToClipboard(messageText, "message")}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: copied === "message" ? "var(--accent)" : "var(--text-muted)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {copied === "message" ? "Copied!" : "Copy message"}
          </button>
        )}
        {lead.email && (
          <a
            href={mailtoLink}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text-muted)",
              fontSize: 13,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Open in mail
          </a>
        )}
      </div>
    </div>
  );
}
