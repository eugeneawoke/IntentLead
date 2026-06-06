import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "IntentLead AI — Find people ready to buy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0C0F",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Grid dots background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexWrap: "wrap",
            gap: "32px",
            padding: "16px",
            opacity: 0.15,
          }}
        >
          {Array.from({ length: 500 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: 3,
                borderRadius: "50%",
                background: "#A3E635",
              }}
            />
          ))}
        </div>

        {/* Accent glow */}
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 300,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(163,230,53,0.12) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -55%)",
          }}
        />

        {/* Logo badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 32,
            background: "rgba(163,230,53,0.1)",
            border: "1px solid rgba(163,230,53,0.3)",
            borderRadius: 9999,
            padding: "8px 20px",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#A3E635",
            }}
          />
          <span style={{ color: "#A3E635", fontSize: 15, fontWeight: 600, letterSpacing: "0.06em" }}>
            INTENTLEAD AI
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            color: "#F4F6F8",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            textAlign: "center",
            maxWidth: 900,
            marginBottom: 24,
          }}
        >
          Find people ready to buy.
        </div>

        {/* Pipeline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 18,
            color: "#9AA4B2",
            marginBottom: 48,
          }}
        >
          {["Signal", "Company", "Email", "Message"].map((step, i) => (
            <div key={step} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: "#F4F6F8" }}>{step}</span>
              {i < 3 && <span style={{ color: "#A3E635", fontSize: 14 }}>→</span>}
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div style={{ display: "flex", gap: 16 }}>
          {["4-level verification", "Credit charged only when verified", "<3% bounce"].map((item) => (
            <div
              key={item}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#14181D",
                border: "1px solid #262C35",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                color: "#9AA4B2",
              }}
            >
              <span style={{ color: "#A3E635" }}>✓</span>
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
