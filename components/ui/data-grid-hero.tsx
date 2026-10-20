"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface DataGridHeroProps {
  rows: number;
  cols: number;
  spacing: number;
  duration: number;
  color: string;
  animationType: "pulse" | "wave" | "random";
  pulseEffect: boolean;
  mouseGlow: boolean;
  opacityMin: number;
  opacityMax: number;
  background: string;
  ariaLabel: string;
  children?: ReactNode;
}

interface InstrumentedCanvas extends HTMLCanvasElement {
  __gridDrawCount?: number;
}

function delayForCell(
  index: number,
  rows: number,
  cols: number,
  animationType: DataGridHeroProps["animationType"],
  duration: number
) {
  const row = Math.floor(index / cols);
  const col = index % cols;
  if (animationType === "wave") return (row + col) * 0.1;
  if (animationType === "random") return (((index * 37) % 101) / 101) * duration;

  const centerRow = Math.floor(rows / 2);
  const centerCol = Math.floor(cols / 2);
  return Math.hypot(row - centerRow, col - centerCol) * 0.2;
}

export default function DataGridHero({
  rows,
  cols,
  spacing,
  duration,
  color,
  animationType,
  pulseEffect,
  mouseGlow,
  opacityMin,
  opacityMax,
  background,
  ariaLabel,
  children,
}: DataGridHeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current as InstrumentedCanvas | null;
    const grid = gridRef.current;
    const hero = heroRef.current;
    if (!canvas || !grid || !hero) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame: number | null = null;
    let revealFrame: number | null = null;
    let previousFrame = 0;
    let hasPainted = false;
    let isIntersecting = false;
    let pageVisible = document.visibilityState === "visible";

    const draw = (elapsedSeconds: number) => {
      const rect = grid.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const renderWidth = Math.max(1, Math.round(rect.width * ratio));
      const renderHeight = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
        canvas.width = renderWidth;
        canvas.height = renderHeight;
      }

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      context.fillStyle = color;

      const trackWidth = rect.width / cols;
      const trackHeight = rect.height / rows;
      const cellWidth = Math.max(1, trackWidth - spacing);
      const cellHeight = Math.max(1, trackHeight - spacing);
      const staticOpacity = (opacityMin + opacityMax) / 2;

      canvas.dataset.trackWidth = trackWidth.toFixed(3);
      canvas.dataset.trackHeight = trackHeight.toFixed(3);
      canvas.dataset.cellWidth = cellWidth.toFixed(3);
      canvas.dataset.cellHeight = cellHeight.toFixed(3);
      canvas.dataset.gap = String(spacing);
      canvas.dataset.cellOriginX = "0";
      canvas.dataset.cellOriginY = "0";
      canvas.__gridDrawCount = (canvas.__gridDrawCount ?? 0) + 1;

      for (let index = 0; index < rows * cols; index += 1) {
        const row = Math.floor(index / cols);
        const col = index % cols;
        const x = col * trackWidth;
        const y = row * trackHeight;
        const delay = delayForCell(index, rows, cols, animationType, duration);
        const phase = ((elapsedSeconds - delay) / duration) * Math.PI * 2;
        const progress = (Math.sin(phase) + 1) / 2;
        context.globalAlpha = pulseEffect && !motionPreference.matches
          ? opacityMin + (opacityMax - opacityMin) * progress
          : staticOpacity;
        context.beginPath();
        context.roundRect(x, y, cellWidth, cellHeight, Math.min(2, cellWidth / 3, cellHeight / 3));
        context.fill();
      }
      context.globalAlpha = 1;

      if (!hasPainted) {
        hasPainted = true;
        canvas.dataset.painted = "true";
        revealFrame = window.requestAnimationFrame(() => {
          setPainted(true);
          revealFrame = null;
        });
      }
    };

    const stopAnimation = () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    };

    const animate = (timestamp: number) => {
      if (motionPreference.matches || !pulseEffect || !isIntersecting || !pageVisible) {
        animationFrame = null;
        return;
      }
      if (timestamp - previousFrame >= 1000 / 30) {
        draw(timestamp / 1000);
        previousFrame = timestamp;
        const reportedFrame = Number(canvas.dataset.frame ?? "0");
        if (reportedFrame < 2) canvas.dataset.frame = String(reportedFrame + 1);
      }
      animationFrame = window.requestAnimationFrame(animate);
    };

    const syncAnimation = () => {
      stopAnimation();
      if (motionPreference.matches || !pulseEffect) {
        canvas.dataset.motion = "reduced";
        draw(0);
        return;
      }
      if (!isIntersecting || !pageVisible) {
        canvas.dataset.motion = "paused";
        return;
      }
      canvas.dataset.motion = "running";
      previousFrame = performance.now();
      animationFrame = window.requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(() => draw(performance.now() / 1000));
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isIntersecting = entry.isIntersecting && entry.intersectionRatio > 0;
      syncAnimation();
    }, { threshold: 0.01 });
    const updateDocumentVisibility = () => {
      pageVisible = document.visibilityState === "visible";
      syncAnimation();
    };

    resizeObserver.observe(grid);
    intersectionObserver.observe(hero);
    motionPreference.addEventListener("change", syncAnimation);
    document.addEventListener("visibilitychange", updateDocumentVisibility);
    syncAnimation();

    return () => {
      stopAnimation();
      if (revealFrame !== null) window.cancelAnimationFrame(revealFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      motionPreference.removeEventListener("change", syncAnimation);
      document.removeEventListener("visibilitychange", updateDocumentVisibility);
    };
  }, [animationType, color, cols, duration, opacityMax, opacityMin, pulseEffect, rows, spacing]);

  useEffect(() => {
    if (!mouseGlow) return;
    const hero = heroRef.current;
    const grid = gridRef.current;
    if (!hero || !grid) return;

    const moveGlow = (event: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      const x = `${Math.round(event.clientX - rect.left)}px`;
      const y = `${Math.round(event.clientY - rect.top)}px`;
      hero.style.setProperty("--mouse-x", x);
      hero.style.setProperty("--mouse-y", y);
      grid.style.setProperty("--mouse-x", x);
      grid.style.setProperty("--mouse-y", y);
    };
    hero.addEventListener("pointermove", moveGlow);
    return () => hero.removeEventListener("pointermove", moveGlow);
  }, [mouseGlow]);

  return (
    <div ref={heroRef} className="data-grid-hero" style={{ background }}>
      <div
        ref={gridRef}
        className="grid-container"
        data-grid-painted={painted ? "true" : "false"}
        aria-hidden="true"
        style={{
          "--mouse-glow-opacity": mouseGlow ? "1" : "0",
          "--grid-color": color,
          "--grid-background": background,
          "--grid-gap": `${spacing}px`,
          "--grid-cols": String(cols),
          "--grid-rows": String(rows),
          "--grid-fallback-opacity": String((opacityMin + opacityMax) / 2),
        } as CSSProperties}
      >
        <div className="grid-fallback" data-grid-fallback />
        <canvas
          ref={canvasRef}
          className="grid-canvas"
          data-grid-canvas
          data-motion="pending"
          data-painted={painted ? "true" : "false"}
        />
      </div>
      <div className="hero-content" role="region" aria-label={ariaLabel}>
        {children}
      </div>
      <style>{`
        .data-grid-hero .grid-container {
          isolation: isolate;
        }
        .data-grid-hero .grid-fallback {
          position: absolute;
          inset: 0;
          z-index: 0;
          opacity: var(--grid-fallback-opacity);
          background-color: var(--grid-color);
          background-image:
            linear-gradient(to right, transparent calc(100% - var(--grid-gap)), var(--grid-background) 0),
            linear-gradient(to bottom, transparent calc(100% - var(--grid-gap)), var(--grid-background) 0);
          background-size:
            calc(100% / var(--grid-cols)) calc(100% / var(--grid-rows));
          transition: opacity 180ms ease-out;
        }
        .data-grid-hero .grid-container[data-grid-painted="true"] .grid-fallback {
          opacity: 0;
        }
        .data-grid-hero .grid-canvas {
          position: relative;
          z-index: 1;
          width: 100%;
          height: 100%;
          display: block;
        }
        @media (prefers-reduced-motion: reduce) {
          .data-grid-hero .grid-fallback { transition: none; }
          .data-grid-hero .grid-container::after { display: none; }
        }
      `}</style>
    </div>
  );
}
