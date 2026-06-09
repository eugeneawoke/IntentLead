"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/LangContext";

const PLANS_STATIC = [
  { name: "Free",    monthly: 0,   annual: 0,   leads: "10 leads",     href: "/",                      highlight: false, earlybird: false, earlybirdNote: "" },
  { name: "Starter", monthly: 39,  annual: 31,  leads: "30 leads/mo",  href: "https://payproglobal.com", highlight: false, earlybird: true,  earlybirdNote: "100 leads first 3 months" },
  { name: "Growth",  monthly: 89,  annual: 71,  leads: "100 leads/mo", href: "https://payproglobal.com", highlight: true,  earlybird: true,  earlybirdNote: "Price locked forever" },
  { name: "Agency",  monthly: 199, annual: 159, leads: "300 leads/mo", href: "https://payproglobal.com", highlight: false, earlybird: false, earlybirdNote: "" },
];

export default function PricingCards() {
  const [isAnnual, setIsAnnual] = useState(true);
  const { t } = useLang();

  return (
    <div>
      {/* Billing toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 40 }}>
        <button
          onClick={() => setIsAnnual(false)}
          style={{
            fontSize: 14, fontWeight: isAnnual ? 400 : 600,
            color: isAnnual ? "var(--text-muted)" : "var(--text)",
            background: "none", border: "none", cursor: "pointer", padding: "6px 2px",
          }}
        >
          {t.pricing.billingMonthly}
        </button>

        <button
          onClick={() => setIsAnnual((v) => !v)}
          aria-label="Toggle billing period"
          style={{
            width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
            position: "relative",
            background: isAnnual ? "var(--accent)" : "var(--surface-2)",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute", top: 3,
              left: isAnnual ? 23 : 3,
              width: 18, height: 18, borderRadius: "50%",
              background: isAnnual ? "var(--accent-fg)" : "var(--text-muted)",
              transition: "left 0.2s",
            }}
          />
        </button>

        <button
          onClick={() => setIsAnnual(true)}
          style={{
            fontSize: 14, fontWeight: isAnnual ? 600 : 400,
            color: isAnnual ? "var(--text)" : "var(--text-muted)",
            background: "none", border: "none", cursor: "pointer", padding: "6px 2px",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          {t.pricing.billingAnnual}
          <span
            style={{
              fontSize: 11, fontWeight: 700, color: "var(--accent-fg)",
              background: "var(--accent)", padding: "2px 7px",
              borderRadius: 6, letterSpacing: "0.04em",
            }}
          >
            {t.pricing.billingSave}
          </span>
        </button>
      </div>

      {/* Plan cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 16,
          marginBottom: 72,
        }}
      >
        {PLANS_STATIC.map((plan, i) => {
          const price = isAnnual ? plan.annual : plan.monthly;
          const translated = t.pricing.plans[i];
          return (
            <div
              key={plan.name}
              style={{
                background: plan.highlight ? "var(--surface-2)" : "var(--surface)",
                border: `1px solid ${plan.highlight ? "rgba(163,230,53,0.45)" : "var(--border)"}`,
                borderRadius: 16,
                padding: "28px 22px",
                display: "flex",
                flexDirection: "column",
                position: "relative",
                boxShadow: plan.highlight ? "0 0 40px rgba(163,230,53,0.07)" : "none",
              }}
            >
              {plan.highlight && (
                <div
                  style={{
                    position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)",
                    background: "var(--accent)", color: "var(--accent-fg)",
                    fontSize: 10, fontWeight: 700, padding: "3px 12px",
                    borderRadius: "0 0 8px 8px", letterSpacing: "0.07em",
                    textTransform: "uppercase", whiteSpace: "nowrap",
                  }}
                >
                  {t.pricing.mostPopular}
                </div>
              )}

              {/* Earlybird placeholder keeps cards aligned */}
              <div style={{ minHeight: 20, marginBottom: 16 }}>
                {plan.earlybird && (
                  <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, letterSpacing: "0.04em" }}>
                    ⚡ {t.pricing.earlyAccess} · {plan.earlybirdNote}
                  </span>
                )}
              </div>

              {/* Name + note */}
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>
                {plan.name}
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>
                {translated.note}
              </p>

              {/* Price */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: price === 0 ? 36 : 40, fontWeight: 800,
                    color: "var(--text)", letterSpacing: "-0.02em",
                    fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
                  }}
                >
                  {price === 0 ? "Free" : `$${price}`}
                </span>
                {price > 0 && (
                  <span style={{ fontSize: 14, color: "var(--text-muted)" }}>/mo</span>
                )}
              </div>

              <p style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, margin: "0 0 24px" }}>
                {plan.leads}
              </p>

              {/* CTA */}
              <Link
                href={plan.href}
                style={{
                  display: "block", textAlign: "center", padding: "11px 0",
                  borderRadius: 10,
                  background: plan.highlight ? "var(--accent)" : "transparent",
                  color: plan.highlight ? "var(--accent-fg)" : "var(--text)",
                  border: plan.highlight ? "none" : "1px solid var(--border-strong)",
                  fontSize: 14, fontWeight: 600, textDecoration: "none",
                }}
              >
                {translated.cta}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
