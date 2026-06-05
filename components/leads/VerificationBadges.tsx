type BadgeStatus = "verified" | "pending" | "rejected";

interface VerificationBadgesProps {
  verifySignal: boolean;
  verifyCompany: boolean;
  verifyContact: boolean;
  verifyEmail: boolean;
  showRejected?: boolean;
}

const LEVELS = [
  { key: "verifySignal", label: "Signal" },
  { key: "verifyCompany", label: "Company" },
  { key: "verifyContact", label: "Contact" },
  { key: "verifyEmail", label: "Email" },
] as const;

export function VerificationBadges({
  verifySignal,
  verifyCompany,
  verifyContact,
  verifyEmail,
  showRejected = true,
}: VerificationBadgesProps) {
  const values = { verifySignal, verifyCompany, verifyContact, verifyEmail };

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {LEVELS.map(({ key, label }) => {
        const passed = values[key];
        if (!passed && !showRejected) return null;

        return (
          <span
            key={key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 10px",
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 500,
              background: passed ? "rgba(163,230,53,0.12)" : "rgba(107,114,128,0.15)",
              color: passed ? "var(--verified)" : "var(--rejected)",
              border: `1px solid ${passed ? "rgba(163,230,53,0.25)" : "rgba(107,114,128,0.25)"}`,
            }}
          >
            <span>{passed ? "✓" : "✕"}</span>
            {label}
          </span>
        );
      })}
    </div>
  );
}
