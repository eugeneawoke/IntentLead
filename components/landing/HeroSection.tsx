"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import LandingComposer from "./LandingComposer";

const DataGridHero = dynamic(
  () => import("@/components/ui/data-grid-hero"),
  { ssr: false }
);

export default function HeroSection() {
  return (
    <div id="hero">
      <Suspense
        fallback={
          <div style={{ minHeight: "100vh", background: "var(--bg)" }} />
        }
      >
        <DataGridHero
          rows={25}
          cols={35}
          spacing={4}
          duration={7.5}
          color="hsl(150, 60%, 20%)"
          animationType="pulse"
          pulseEffect
          mouseGlow
          opacityMin={0.08}
          opacityMax={0.65}
          background="var(--bg)"
        >
          <div className="flex flex-col items-center text-center gap-6 max-w-3xl">
            {/* Headline */}
            <h1
              style={{
                fontSize: "clamp(44px, 6.5vw, 80px)",
                fontWeight: 800,
                lineHeight: 1.0,
                letterSpacing: "-0.02em",
                color: "var(--text)",
                margin: 0,
              }}
            >
              Find people ready to buy.
            </h1>

            <p
              style={{
                color: "var(--text)",
                opacity: 0.75,
                fontSize: 18,
                lineHeight: 1.6,
                maxWidth: 520,
                margin: 0,
              }}
            >
              Reddit + HN signals → verified company → verified email →
              personalized message.
              <br />
              Pay only for leads that pass all 4 verification levels.
            </p>

            {/* Chat input #1 */}
            <LandingComposer composerId="hero" />

            {/* Trust items */}
            <div className="flex flex-wrap gap-6 justify-center pt-4 w-full">
              {[
                "4-level verification",
                "Credit charged only when verified",
                "<3% bounce rate",
                "Reddit + HN signals",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span style={{ color: "var(--accent)" }}>✓</span>
                  {item}
                </div>
              ))}
            </div>

          </div>

          {/* Bottom fade-out → плавный переход в How it works */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 180,
              background: "linear-gradient(to bottom, transparent 0%, var(--bg) 100%)",
              zIndex: 5,
              pointerEvents: "none",
            }}
          />
        </DataGridHero>
      </Suspense>
    </div>
  );
}
