"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  r: number;
  a: number;
  phase: number;
  warm: number;
};

export function SpaceField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const stars: Star[] = Array.from({ length: 520 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() ** 2.4 * 1.35 + 0.15,
      a: 0.2 + Math.random() ** 1.6 * 0.8,
      phase: Math.random() * Math.PI * 2,
      warm: Math.random(),
    }));

    let frame = 0;
    const draw = (time: number) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
        canvas.width = Math.floor(width * ratio);
        canvas.height = Math.floor(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = "#000000";
      context.fillRect(0, 0, width, height);

      const band = context.createLinearGradient(0, height * 0.15, width, height * 0.85);
      band.addColorStop(0, "rgba(0,0,0,0)");
      band.addColorStop(0.42, "rgba(18, 28, 48, 0.22)");
      band.addColorStop(0.5, "rgba(70, 82, 104, 0.07)");
      band.addColorStop(0.58, "rgba(12, 22, 40, 0.16)");
      band.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = band;
      context.fillRect(0, 0, width, height);

      for (const star of stars) {
        const flicker = 0.72 + 0.28 * Math.sin(time * 0.0007 + star.phase);
        const alpha = star.a * flicker;
        const red = star.warm > 0.82 ? 255 : star.warm < 0.12 ? 214 : 244;
        const green = star.warm > 0.82 ? 236 : star.warm < 0.12 ? 226 : 246;
        const blue = star.warm > 0.82 ? 214 : 255;
        context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
        context.beginPath();
        context.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
        context.fill();
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={ref} className="space-field" aria-hidden="true" />;
}
