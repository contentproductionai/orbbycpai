"use client";

// Deterministic star positions — no Math.random on render (SSR safe)
const STARS = Array.from({ length: 80 }, (_, i) => {
  const a = (i * 2654435761) >>> 0;
  const b = (a * 1664525 + 1013904223) >>> 0;
  const c = (b * 1664525 + 1013904223) >>> 0;
  const x = (a % 10000) / 100;
  const y = (b % 10000) / 100;
  const size = (c % 3) + 1;
  const delay = (a % 4000) / 1000;
  const dur = 2 + (b % 3000) / 1000;
  const opacity = 0.25 + (c % 55) / 100;
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

      {/* ── Orb — large, centered, behind text ── */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -52%)",
        width: 420,
        height: 420,
        animation: "orb-float 6s ease-in-out infinite",
      }}>
        {/* Outer diffuse glow */}
        <div style={{
          position: "absolute",
          inset: -60,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(0,212,170,0.13) 0%, transparent 65%)",
          filter: "blur(20px)",
        }} />

        {/* Outer orbit ring */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: 400, height: 400,
          marginTop: -200, marginLeft: -200,
          borderRadius: "50%",
          border: "1px solid rgba(0,212,170,0.15)",
          transform: "rotateX(80deg)",
          animation: "orbit-spin 12s linear infinite",
        }} />

        {/* Inner orbit ring */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: 290, height: 290,
          marginTop: -145, marginLeft: -145,
          borderRadius: "50%",
          border: "1px solid rgba(0,212,170,0.22)",
          transform: "rotateX(80deg)",
          animation: "orbit-spin-slow 8s linear infinite",
        }} />

        {/* The orb sphere */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: 180, height: 180,
          marginTop: -90, marginLeft: -90,
          borderRadius: "50%",
          background: "radial-gradient(circle at 38% 35%, rgba(0,212,170,0.55) 0%, rgba(0,130,100,0.35) 45%, rgba(0,30,24,0.6) 100%)",
          boxShadow: "0 0 60px rgba(0,212,170,0.3), 0 0 120px rgba(0,212,170,0.12)",
          backdropFilter: "blur(2px)",
        }} />

        {/* Tractor beam — below orb */}
        <div style={{
          position: "absolute",
          top: "calc(50% + 80px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: 180,
          height: 220,
          background: "linear-gradient(to bottom, rgba(0,212,170,0.18) 0%, rgba(0,212,170,0.06) 55%, transparent 100%)",
          clipPath: "polygon(25% 0%, 75% 0%, 100% 100%, 0% 100%)",
          animation: "beam-pulse 4s ease-in-out infinite",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute",
            left: 0, right: 0, height: 1,
            background: "linear-gradient(90deg, transparent, rgba(0,212,170,0.6), transparent)",
            animation: "scan-line 2.5s linear infinite",
          }} />
          <div style={{
            position: "absolute",
            left: 0, right: 0, height: 1,
            background: "linear-gradient(90deg, transparent, rgba(0,212,170,0.35), transparent)",
            animation: "scan-line 2.5s linear 1.25s infinite",
          }} />
        </div>
      </div>
    </div>
  );
}
