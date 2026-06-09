import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Check, X,
  Radio, SlidersHorizontal, DollarSign, Target,
  Database, ShieldOff, Search, Clock, Zap, MailWarning,
} from "lucide-react";
import BackgroundBoxes from "@/components/ui/background-boxes";
import { competitors, competitorSlugs } from "@/lib/vs/competitors";

export function generateStaticParams() {
  return competitorSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = competitors[slug];
  if (!c) return {};
  return {
    title: `IntentLead AI vs ${c.name} (${new Date().getFullYear()}) — Full comparison`,
    description: c.tldr,
    alternates: { canonical: `/compare/${slug}` },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pain point icons — Lucide, cycling per index
// ─────────────────────────────────────────────────────────────────────────────

const PAIN_LUCIDE = [Radio, Search, DollarSign, Target, Database, SlidersHorizontal, ShieldOff, Clock, Zap, MailWarning];

// Extract short title from weakness text (split on — or : or ,)
function weaknessTitle(w: string): string {
  const parts = w.split(/[—:,]/).map((s) => s.trim());
  const first = parts[0] ?? w;
  return first.length > 40 ? first.slice(0, 38) + "…" : first;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared cells
// ─────────────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 24, height: 24, borderRadius: "50%",
      background: "rgba(163,230,53,0.12)", color: "var(--accent)", flexShrink: 0,
    }}>
      <Check size={13} strokeWidth={2.5} />
    </span>
  );
}

function CrossIcon({ muted }: { muted?: boolean }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 24, height: 24, borderRadius: "50%",
      background: muted ? "rgba(255,255,255,0.04)" : "rgba(248,113,113,0.08)",
      color: muted ? "var(--text-faint)" : "#F87171", flexShrink: 0,
    }}>
      <X size={13} strokeWidth={2.5} />
    </span>
  );
}

function FeatureValue({ value, isUs }: { value: true | false | string; isUs: boolean }) {
  if (value === true) return <CheckIcon />;
  if (value === false) return <CrossIcon muted={!isUs} />;
  return (
    <span style={{
      fontSize: 12, fontWeight: isUs ? 600 : 400,
      color: isUs ? "var(--accent)" : "var(--text-muted)",
    }}>
      {value}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero right — pipeline mockup
// ─────────────────────────────────────────────────────────────────────────────

function PipelineMockup() {
  const steps = [
    { id: "L1", icon: "💬", label: "Intent signal", detail: "r/saas · \"our reply rates are terrible\"" },
    { id: "L2", icon: "🏢", label: "Company identified", detail: "Acme Corp · Series A · B2B SaaS" },
    { id: "L3", icon: "👤", label: "Contact verified", detail: "Head of Growth · decision-maker" },
    { id: "L4", icon: "✉️", label: "Email confirmed", detail: "john@acme.com · deliverable" },
  ];

  return (
    <div style={{
      background: "var(--surface)", borderRadius: 20, border: "1px solid var(--border)",
      padding: "24px", width: 330, boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 20,
        paddingBottom: 16, borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Pipeline · live
        </div>
        <div style={{
          marginLeft: "auto", width: 7, height: 7, borderRadius: "50%",
          background: "var(--accent)", boxShadow: "0 0 6px var(--accent)",
        }} />
      </div>
      {steps.map((step, i) => (
        <div key={step.id}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: "rgba(163,230,53,0.08)", border: "1px solid rgba(163,230,53,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
            }}>
              {step.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{step.label}</div>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: "var(--accent)",
                  background: "rgba(163,230,53,0.1)", border: "1px solid rgba(163,230,53,0.2)",
                  borderRadius: 20, padding: "2px 7px", letterSpacing: "0.06em",
                }}>
                  {step.id} ✓
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2, lineHeight: 1.4 }}>
                {step.detail}
              </div>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: 1, height: 12, background: "rgba(163,230,53,0.2)", margin: "5px 0 5px 16px" }} />
          )}
        </div>
      ))}
      <div style={{
        marginTop: 18, padding: "10px 14px",
        background: "rgba(163,230,53,0.08)", border: "1px solid rgba(163,230,53,0.25)",
        borderRadius: 10, display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>🎯</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>Lead verified · 1 credit</div>
          <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 1 }}>All 4 levels passed · ready to send</div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chess block mockups
// ─────────────────────────────────────────────────────────────────────────────

function SignalCardMockup() {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)",
      padding: 20, width: 330, boxShadow: "0 16px 60px rgba(0,0,0,0.35)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
        Intent signals · live feed
      </div>
      {[
        { src: "Reddit", sub: "r/saas", time: "2m", score: 94, text: "\"We've tried Apollo — reply rates are terrible. Anyone found a tool that finds people actively searching?\"" },
        { src: "HN", sub: "Ask HN", time: "18m", score: 87, text: "\"How do you find leads who actually have the problem you solve, not just fit the ICP criteria?\"" },
      ].map((s, i) => (
        <div key={i} style={{
          background: "var(--surface-2)", borderRadius: 10, padding: "12px 14px",
          marginBottom: i === 0 ? 10 : 0, border: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{
              fontSize: 10, fontWeight: 800,
              color: i === 0 ? "#FF4500" : "#F5C451",
              background: i === 0 ? "rgba(255,69,0,0.1)" : "rgba(245,196,81,0.1)",
              padding: "2px 8px", borderRadius: 20,
            }}>
              {s.src}
            </div>
            <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{s.sub} · {s.time} ago</span>
            <div style={{
              marginLeft: "auto", fontSize: 9, fontWeight: 700,
              color: "var(--accent)", background: "rgba(163,230,53,0.1)",
              padding: "2px 7px", borderRadius: 20, border: "1px solid rgba(163,230,53,0.2)",
            }}>
              {s.score}% intent
            </div>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>{s.text}</p>
        </div>
      ))}
    </div>
  );
}

function VerifyMockup() {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)",
      padding: 20, width: 330, boxShadow: "0 16px 60px rgba(0,0,0,0.35)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>
        Verification result
      </div>
      {[
        { label: "L1 Signal", value: "Reddit · r/saas · 94% intent" },
        { label: "L2 Company", value: "Acme Corp · Series A · HQ SF" },
        { label: "L3 Contact", value: "John Smith · Head of Growth" },
        { label: "L4 Email", value: "j.smith@acme.com · deliverable" },
      ].map((row, i) => (
        <div key={row.label} style={{
          display: "flex", alignItems: "center", gap: 10,
          paddingBottom: i < 3 ? 12 : 0, marginBottom: i < 3 ? 12 : 0,
          borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: "rgba(163,230,53,0.08)", border: "1px solid rgba(163,230,53,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Check size={13} color="var(--accent)" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {row.label}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{row.value}</div>
          </div>
        </div>
      ))}
      <div style={{
        marginTop: 16, padding: "10px 14px",
        background: "rgba(163,230,53,0.08)", border: "1px solid rgba(163,230,53,0.25)",
        borderRadius: 10, fontSize: 12, fontWeight: 700, color: "var(--accent)", textAlign: "center",
      }}>
        ✓ All 4 levels passed — 1 credit charged
      </div>
    </div>
  );
}

function EmailMockup() {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)",
      padding: 20, width: 330, boxShadow: "0 16px 60px rgba(0,0,0,0.35)",
    }}>
      <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F87171" }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F5C451" }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ADE80" }} />
        <div style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-faint)" }}>GPT-4o · signal-grounded</div>
      </div>
      <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 14px", border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>To:</span> j.smith@acme.com ·{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Subj:</span> Re: your r/saas post
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>
          Hi John,<br /><br />
          Saw your post about reply rates — we built IntentLead for exactly this.{" "}
          Instead of cold lists, it finds people{" "}
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>actively posting about the pain</span>{" "}
          you solve, then verifies the contact.<br /><br />
          Worth 10 minutes?
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={{
          fontSize: 11, padding: "6px 14px", borderRadius: 7,
          background: "var(--accent)", color: "var(--accent-fg)",
          border: "none", cursor: "pointer", fontWeight: 700,
        }}>Copy</button>
        <button style={{
          fontSize: 11, padding: "6px 14px", borderRadius: 7,
          background: "transparent", color: "var(--text-faint)",
          border: "1px solid var(--border)", cursor: "pointer",
        }}>Regenerate</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function CompareSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = competitors[slug];
  if (!c) notFound();

  const others = competitorSlugs.filter((s) => s !== slug).slice(0, 4);

  // Chess blocks: align = where the TEXT is
  const chessBlocks = [
    {
      eyebrow: "Signal-first sourcing",
      headline: "Find people who already have the pain",
      body: `${c.name} starts from a list or database you provide. IntentLead starts from zero — it monitors Reddit and Hacker News for posts where people explicitly express the exact problem your product solves. Every lead has a real why-now.`,
      mockup: <SignalCardMockup />,
      align: "right" as const, // text RIGHT → mockup LEFT
    },
    {
      eyebrow: "4-level verification",
      headline: "Pay nothing if any level fails",
      body: "Every lead runs through 4 automated checks: signal relevance → company identity → contact role → email deliverability. A credit is charged only when all 4 pass. Red on any level = rejected, credit untouched.",
      mockup: <VerifyMockup />,
      align: "left" as const, // text LEFT → mockup RIGHT
    },
    {
      eyebrow: "Signal-grounded email",
      headline: "First message referencing their exact words",
      body: `The GPT-4o draft is anchored to the actual signal — it references what the prospect posted. Not a generic template. Reply rates are consistently higher than ${c.name}-style outreach from static databases.`,
      mockup: <EmailMockup />,
      align: "right" as const, // text RIGHT → mockup LEFT
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>

      {/* ── 1. HERO ─────────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 100, paddingBottom: 100, paddingLeft: 24, paddingRight: 24, overflow: "hidden" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 64, alignItems: "center", flexWrap: "wrap" }}>

          <div style={{ flex: "1 1 460px", minWidth: 0 }}>
            <div style={{ marginBottom: 32 }}>
              <Link href="/compare" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-faint)", textDecoration: "none" }}>
                <ArrowLeft size={12} />
                All comparisons
              </Link>
            </div>
            <div style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>
              #1 {c.name.toUpperCase()} ALTERNATIVE
            </div>
            <h1 style={{
              fontSize: "clamp(34px, 5vw, 54px)", fontWeight: 800,
              letterSpacing: "-0.03em", color: "var(--text)",
              margin: "0 0 20px", lineHeight: 1.05,
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}>
              Cold outreach shouldn&apos;t{" "}
              <span style={{ color: "var(--text-faint)" }}>feel like {c.name}</span>
            </h1>
            <p style={{ fontSize: 17, color: "var(--text-muted)", margin: "0 0 36px", lineHeight: 1.65, maxWidth: 480 }}>
              IntentLead finds people <strong style={{ color: "var(--text)", fontWeight: 600 }}>actively expressing the pain you solve</strong> — then verifies the contact and writes the first email. {c.name} {c.tagline.toLowerCase()}.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <Link href="/" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "var(--accent)", color: "var(--accent-fg)",
                padding: "14px 28px", borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: "none",
              }}>
                Get started free →
              </Link>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>10 verified leads free.</div>
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No credit card.</div>
              </div>
            </div>
          </div>

          {/* Pipeline mockup — on RIGHT, text LEFT → tilt="right" = rotateY(-6deg), origin right */}
          <div style={{ flex: "0 0 auto", display: "flex", justifyContent: "center" }}>
            <div style={{
              transform: "perspective(1000px) rotateY(-6deg) rotateX(2deg)",
              transformOrigin: "right center",
            }}>
              <PipelineMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. PAIN POINTS — ClickUp style, no cards ─────────────────────── */}
      <section style={{ paddingBottom: 96, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <h2 style={{
              fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800,
              letterSpacing: "-0.025em", color: "var(--text)", margin: "0 0 14px",
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}>
              <span style={{ color: "var(--text-faint)" }}>{c.name}</span> is all over the place
            </h2>
            <p style={{ fontSize: 17, color: "var(--text-muted)", margin: 0 }}>
              Don&apos;t settle for silos.
            </p>
          </div>

          {/* ClickUp-style: icon + text, NO card borders */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "40px 56px",
          }}>
            {c.weaknesses.map((w, i) => {
              const Icon = PAIN_LUCIDE[i % PAIN_LUCIDE.length];
              const title = weaknessTitle(w);
              const desc = w.slice(title.replace("…", "").length).replace(/^[—:,\s]+/, "");
              return (
                <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  {/* Icon square */}
                  <div style={{
                    width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--text-faint)",
                  }}>
                    <Icon size={20} strokeWidth={1.5} />
                  </div>
                  {/* Text */}
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6, lineHeight: 1.3 }}>
                      {title}
                    </div>
                    {desc && (
                      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.65 }}>
                        {desc}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 3. CHESS BLOCKS — perspective toward text ────────────────────── */}
      <section style={{ paddingBottom: 40, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {chessBlocks.map((block, idx) => {
            // align:"right" → text RIGHT, mockup LEFT  → flexRow-reverse, mockup tilts right = rotateY(+)
            // align:"left"  → text LEFT, mockup RIGHT → flexRow, mockup tilts left  = rotateY(-)
            const isTextRight = block.align === "right";
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexDirection: isTextRight ? "row-reverse" : "row",
                  gap: 80, alignItems: "center",
                  marginBottom: 96,
                }}
              >
                {/* Text */}
                <div style={{ flex: "1 1 360px", minWidth: 0 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: "var(--accent)",
                    letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16,
                  }}>
                    {String(idx + 1).padStart(2, "0")} — {block.eyebrow}
                  </div>
                  <h3 style={{
                    fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 700,
                    color: "var(--text)", margin: "0 0 18px", lineHeight: 1.2,
                    fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
                  }}>
                    {block.headline}
                  </h3>
                  <p style={{ fontSize: 15, color: "var(--text-muted)", margin: 0, lineHeight: 1.75 }}>
                    {block.body}
                  </p>
                </div>

                {/* Mockup — tilt toward text */}
                <div style={{ flex: "0 0 auto" }}>
                  <div style={{
                    // text RIGHT → mockup LEFT → faces right → rotateY(+6) + origin left
                    // text LEFT  → mockup RIGHT → faces left → rotateY(-6) + origin right
                    transform: isTextRight
                      ? "perspective(1000px) rotateY(6deg) rotateX(2deg)"
                      : "perspective(1000px) rotateY(-6deg) rotateX(2deg)",
                    transformOrigin: isTextRight ? "left center" : "right center",
                  }}>
                    {block.mockup}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 4. COMPARISON CARDS ──────────────────────────────────────────── */}
      <section style={{ paddingBottom: 96, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
              Compare intent-based vs database-based
            </div>
            <h2 style={{
              fontSize: "clamp(24px, 3.5vw, 40px)", fontWeight: 800,
              letterSpacing: "-0.025em", color: "var(--text)", margin: 0, lineHeight: 1.15,
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}>
              Find 30 people ready to buy — or blast{" "}
              <span style={{ color: "var(--text-faint)" }}>3,000 from {c.name}?</span>
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* IntentLead */}
            <div style={{
              background: "rgba(163,230,53,0.04)", border: "1.5px solid rgba(163,230,53,0.3)",
              borderRadius: 20, padding: "36px 32px", boxShadow: "0 0 60px rgba(163,230,53,0.07)",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>IntentLead AI</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "0 0 24px", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>from $0/mo</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
                {["Finds people actively expressing the pain you solve", "All 4 verification levels — pay only on verified leads", "First email grounded in the prospect's exact signal"].map((pt) => (
                  <div key={pt} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <CheckIcon />
                    <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{pt}</span>
                  </div>
                ))}
              </div>
              <Link href="/" style={{
                display: "inline-flex", alignItems: "center",
                background: "var(--accent)", color: "var(--accent-fg)",
                padding: "12px 24px", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none",
              }}>
                Get started free →
              </Link>
            </div>

            {/* Competitor */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "36px 32px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>{c.name}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-muted)", margin: "0 0 24px", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>{c.pricingRange}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
                {c.weaknesses.slice(0, 3).map((w) => (
                  <div key={w} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <CrossIcon />
                    <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{w}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "inline-block", fontSize: 13, color: "var(--text-faint)", padding: "11px 20px", borderRadius: 10, border: "1px solid var(--border)" }}>
                {c.whoFor.competitor.split(".")[0]}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. FEATURE TABLE — sticky thead, overflow:clip preserves sticky ── */}
      <section style={{ paddingBottom: 96, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{
              fontSize: "clamp(22px, 3vw, 34px)", fontWeight: 800,
              letterSpacing: "-0.025em", color: "var(--text)", margin: 0,
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}>
              IntentLead AI vs {c.name} — feature by feature
            </h2>
          </div>

          {/* overflow:clip clips border-radius WITHOUT breaking position:sticky */}
          <div style={{ borderRadius: 16, border: "1px solid var(--border)", overflow: "clip" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{
                    textAlign: "left", padding: "24px 32px",
                    background: "var(--bg)",
                    borderBottom: "1px solid var(--border)",
                    position: "sticky", top: 80, zIndex: 10,
                    fontSize: 11, fontWeight: 600, color: "var(--text-faint)",
                    letterSpacing: "0.07em", textTransform: "uppercase",
                    width: "44%",
                  }}>
                    Feature
                  </th>
                  <th style={{
                    textAlign: "center", padding: "24px 20px",
                    background: "var(--surface)",
                    borderBottom: "2px solid rgba(163,230,53,0.5)",
                    borderLeft: "1px solid rgba(163,230,53,0.15)",
                    borderRight: "1px solid rgba(163,230,53,0.15)",
                    position: "sticky", top: 80, zIndex: 10,
                    width: "28%",
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--accent)", marginBottom: 4, fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
                      IntentLead AI
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 14 }}>from $0/mo</div>
                    <Link href="/" style={{
                      display: "inline-block",
                      background: "var(--accent)", color: "var(--accent-fg)",
                      padding: "8px 18px", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none",
                    }}>
                      Get started
                    </Link>
                  </th>
                  <th style={{
                    textAlign: "center", padding: "24px 20px",
                    background: "var(--surface)",
                    borderBottom: "1px solid var(--border)",
                    position: "sticky", top: 80, zIndex: 10,
                    width: "28%",
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{c.pricingRange}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.features.map((f, i) => (
                  <tr key={i} style={{ borderBottom: i < c.features.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <td style={{ padding: "16px 32px", color: "var(--text-muted)", fontWeight: 500 }}>
                      {f.label}
                    </td>
                    <td style={{
                      textAlign: "center", padding: "16px 20px",
                      background: "rgba(163,230,53,0.03)",
                      borderLeft: "1px solid rgba(163,230,53,0.08)",
                      borderRight: "1px solid rgba(163,230,53,0.08)",
                    }}>
                      <FeatureValue value={f.intentlead} isUs />
                    </td>
                    <td style={{ textAlign: "center", padding: "16px 20px" }}>
                      <FeatureValue value={f.competitor} isUs={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "10px 0 0", textAlign: "right" }}>
            Data as of {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}. Subject to change.
          </p>
        </div>
      </section>

      {/* ── 6. WHO IT'S FOR ──────────────────────────────────────────────── */}
      <section style={{ paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "0 0 24px", fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)" }}>
            Who should use what
          </h2>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "24px 28px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Choose {c.name} if:
              </div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0, lineHeight: 1.7 }}>{c.whoFor.competitor}</p>
            </div>
            <div style={{ background: "rgba(163,230,53,0.04)", border: "1px solid rgba(163,230,53,0.2)", borderRadius: 14, padding: "24px 28px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Choose IntentLead if:
              </div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0, lineHeight: 1.7 }}>{c.whoFor.intentlead}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. OTHER COMPARISONS ─────────────────────────────────────────── */}
      {others.length > 0 && (
        <section style={{ paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              More comparisons
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {others.map((s) => (
                <Link key={s} href={`/compare/${s}`} style={{
                  fontSize: 13, color: "var(--text-muted)", textDecoration: "none",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "9px 18px", display: "inline-block",
                }}>
                  vs {competitors[s].name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 8. BOTTOM CTA ────────────────────────────────────────────────── */}
      <section style={{ paddingBottom: 100, paddingLeft: 24, paddingRight: 24 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{
            background: "linear-gradient(135deg, rgba(163,230,53,0.08) 0%, rgba(163,230,53,0.02) 60%, transparent 100%)",
            border: "1px solid rgba(163,230,53,0.25)", borderRadius: 24,
            padding: "72px 48px", textAlign: "center",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 18 }}>
              Start with signal-first outreach
            </div>
            <h2 style={{
              fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800,
              color: "var(--text)", margin: "0 0 14px", lineHeight: 1.15,
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}>
              Try IntentLead free — 10 verified leads
            </h2>
            <p style={{ fontSize: 15, color: "var(--text-muted)", margin: "0 0 36px", lineHeight: 1.6, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
              No {c.name} subscription needed. If a lead doesn&apos;t pass all 4 verification levels, you pay nothing.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/" style={{
                display: "inline-block", background: "var(--accent)", color: "var(--accent-fg)",
                padding: "15px 40px", borderRadius: 12, fontSize: 16, fontWeight: 700, textDecoration: "none",
              }}>
                Get 10 free leads →
              </Link>
              <Link href="/compare" style={{
                display: "inline-block", color: "var(--text-muted)",
                border: "1px solid var(--border)", background: "transparent",
                padding: "15px 28px", borderRadius: 12, fontSize: 14, fontWeight: 500, textDecoration: "none",
              }}>
                See all comparisons
              </Link>
            </div>
          </div>
        </div>
      </section>

      <BackgroundBoxes />
    </div>
  );
}
