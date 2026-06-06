"use client";

import { type ReactNode } from "react";

interface FluidGlassPillProps {
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
  accent?: string;
}

export default function FluidGlassPill({
  children,
  style,
  className,
}: FluidGlassPillProps) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        borderRadius: 100,
        background: "rgba(10, 12, 15, 0.5)",
        backdropFilter: "blur(8px) saturate(1.4)",
        WebkitBackdropFilter: "blur(8px) saturate(1.4)",
        border: "1px solid rgba(255,255,255,0.11)",
        boxShadow:
          "0 2px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
