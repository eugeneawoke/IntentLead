"use client";

import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { useRef } from "react";

const CELLS = Array.from({ length: 875 }, (_, index) => ({
  id: index,
  opacity: 0.14 + ((index * 37) % 47) / 100,
  delay: ((index * 13) % 61) / 10,
}));

export function SignalGridHero({ children }: { children: ReactNode }) {
  const gridRef = useRef<HTMLDivElement>(null);

  function moveGlow(event: PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    gridRef.current?.style.setProperty("--grid-x", `${event.clientX - rect.left}px`);
    gridRef.current?.style.setProperty("--grid-y", `${event.clientY - rect.top}px`);
  }

  return (
    <section id="hero" className="legacy-grid-hero" onPointerMove={moveGlow}>
      <div ref={gridRef} className="legacy-grid" aria-hidden="true">
        {CELLS.map(cell => (
          <span
            key={cell.id}
            className="legacy-grid-cell"
            style={{
              "--cell-opacity": cell.opacity,
              "--cell-delay": `${cell.delay}s`,
            } as CSSProperties}
          />
        ))}
      </div>
      <div className="legacy-grid-glow" aria-hidden="true" />
      <div className="legacy-grid-fade" aria-hidden="true" />
      <div className="relative z-10 flex min-h-dvh items-center justify-center px-5 pb-28 pt-32 sm:px-8">
        {children}
      </div>
    </section>
  );
}
