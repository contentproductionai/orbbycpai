"use client";

import { useEffect, useRef } from "react";

// Deterministic star positions so SSR and client match (no Math.random on render)
const STARS = Array.from({ length: 120 }, (_, i) => {
  // Simple LCG pseudo-random seeded by index
  const seed = (i * 2654435761) >>> 0;
  const x = (seed % 10000) / 100;           // 0–100 %
  const y = ((seed * 1664525 + 1013904223) >>> 0) % 10000 / 100; // 0–100 %
  const size = (seed % 3) + 1;              // 1, 2, or 3 px
  const delay = (seed % 4000) / 1000;       // 0–4 s
  const dur = 2 + (seed % 3000) / 1000;     // 2–5 s
  const opacity = 0.3 + (seed % 60) / 100;  // 0.3–0.9
  return { x, y, size, delay, dur, opacity };
});

export default function UfoHero() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {/* ── Starfield ── */}
      {STARS.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: "#fff",
            opacity: s.opacity,
            animation: `star-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      {/* ── UFO wrapper — floats up/down ── */}
      <div
        style={{
          position: "absolute",
          top: "6%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 180,
          height: 260,
          animation: "orb-float 5s ease-in-out infinite",
        }}
      >
        {/* Outer glow halo behind saucer */}
        <div style={{
          position: "absolute",
          top: 28,
          left: "50%",
          transform: "translateX(-50%)",
          width: 160,
          height: 80,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(0,212,170,0.18) 0%, transparent 70%)",
          filter: "blur(8px)",
        }} />

        {/* ── Saucer dome (top hemisphere) ── */}
        <div style={{
          position: "absolute",
          top: 30,
          left: "50%",
          transform: "translateX(-50%)",
          width: 64,
          height: 34,
          borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
          background: "radial-gradient(ellipse at 40% 30%, #00d4aa 0%, #007a62 55%, #002e25 100%)",
          boxShadow: "0 0 20px rgba(0,212,170,0.55), 0 0 40px rgba(0,212,170,0.2)",
          zIndex: 3,
        }} />

        {/* ── Saucer rim / disc body ── */}
        <div style={{
          position: "absolute",
          top: 60,
          left: "50%",
          transform: "translateX(-50%)",
          width: 120,
          height: 22,
          borderRadius: "50%",
          background: "linear-gradient(180deg, #00b894 0%, #005c4b 60%, #002e25 100%)",
          boxShadow: "0 0 18px rgba(0,212,170,0.45), 0 4px 24px rgba(0,0,0,0.6)",
          zIndex: 2,
        }} />

        {/* ── Outer elliptical orbit ring ── */}
        <div style={{
          position: "absolute",
          top: 55,
          left: "50%",
          transform: "translateX(-50%) rotateX(78deg)",
          width: 170,
          height: 170,
          borderRadius: "50%",
          border: "1px solid rgba(0,212,170,0.22)",
          animation: "orbit-spin 9s linear infinite",
          zIndex: 1,
        }} />

        {/* ── Inner elliptical orbit ring ── */}
        <div style={{
          position: "absolute",
          top: 58,
          left: "50%",
          transform: "translateX(-50%) rotateX(78deg)",
          width: 130,
          height: 130,
          borderRadius: "50%",
          border: "1px solid rgba(0,212,170,0.32)",
          animation: "orbit-spin-slow 6s linear infinite",
          zIndex: 1,
        }} />

        {/* ── Tractor beam ── */}
        <div style={{
          position: "absolute",
          top: 72,
          left: "50%",
          transform: "translateX(-50%)",
          width: 120,
          height: 160,
          background: "linear-gradient(to bottom, rgba(0,212,170,0.20) 0%, rgba(0,212,170,0.07) 55%, transparent 100%)",
          clipPath: "polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)",
          animation: "beam-pulse 3.5s ease-in-out infinite",
          zIndex: 0,
          overflow: "hidden",
        }}>
          {/* Scan line 1 */}
          <div style={{
            position: "absolute",
            left: 0, right: 0,
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(0,212,170,0.7), transparent)",
            animation: "scan-line 2.2s linear infinite",
          }} />
          {/* Scan line 2 — offset */}
          <div style={{
            position: "absolute",
            left: 0, right: 0,
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(0,212,170,0.45), transparent)",
            animation: "scan-line 2.2s linear 1.1s infinite",
          }} />
        </div>
      </div>
    </div>
  );
}
