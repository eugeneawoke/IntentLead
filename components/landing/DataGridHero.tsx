"use client";

import { useEffect, useRef, ReactNode } from "react";

interface DataGridHeroProps {
  rows?: number;
  cols?: number;
  spacing?: number;
  duration?: number;
  color?: string;
  animationType?: "pulse" | "wave" | "random";
  pulseEffect?: boolean;
  mouseGlow?: boolean;
  opacityMin?: number;
  opacityMax?: number;
  background?: string;
  children?: ReactNode;
}

export default function DataGridHero({
  rows = 28,
  cols = 40,
  spacing = 4,
  duration = 6,
  color = "#A3E635",
  animationType = "pulse",
  pulseEffect = true,
  mouseGlow = true,
  opacityMin = 0.04,
  opacityMax = 0.5,
  background = "#0A0C0F",
  children,
}: DataGridHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const dots: { x: number; y: number; phase: number; base: number }[] = [];

    function resize() {
      if (!canvas) return;
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W * devicePixelRatio;
      canvas.height = H * devicePixelRatio;
      ctx!.scale(devicePixelRatio, devicePixelRatio);
      buildDots();
    }

    function buildDots() {
      dots.length = 0;
      const gapX = W / cols;
      const gapY = H / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({
            x: gapX * c + gapX / 2,
            y: gapY * r + gapY / 2,
            phase: Math.random() * Math.PI * 2,
            base: opacityMin + Math.random() * (opacityMax - opacityMin),
          });
        }
      }
    }

    const start = performance.now();

    function draw(now: number) {
      if (!ctx || !canvas) return;
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, W, H);

      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      for (const dot of dots) {
        let opacity = dot.base;

        if (animationType === "pulse") {
          opacity =
            opacityMin +
            (opacityMax - opacityMin) *
              (0.5 + 0.5 * Math.sin((t / duration) * Math.PI * 2 + dot.phase));
        } else if (animationType === "wave") {
          opacity =
            opacityMin +
            (opacityMax - opacityMin) *
              (0.5 +
                0.5 *
                  Math.sin(
                    (t / duration) * Math.PI * 2 + (dot.x / W) * Math.PI * 2
                  ));
        } else {
          opacity =
            opacityMin +
            (opacityMax - opacityMin) *
              (0.5 + 0.5 * Math.sin((t / duration) * Math.PI * 2 + dot.phase));
        }

        if (mouseGlow) {
          const dx = dot.x - mouseRef.current.x;
          const dy = dot.y - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const glowRadius = 140;
          if (dist < glowRadius) {
            opacity = Math.max(opacity, opacityMax * (1 - dist / glowRadius));
          }
        }

        const size = pulseEffect ? 1.5 + opacity * 1.5 : 2;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`;
        ctx.fill();
      }

      frameRef.current = requestAnimationFrame(draw);
    }

    resize();
    frameRef.current = requestAnimationFrame(draw);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: MouseEvent) => {
      const rect = canvas!.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [rows, cols, duration, color, animationType, pulseEffect, mouseGlow, opacityMin, opacityMax]);

  return (
    <div
      className="relative w-full"
      style={{ background, minHeight: "100vh" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto"
      />
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
        {children}
      </div>
    </div>
  );
}
