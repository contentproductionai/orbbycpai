"use client";

// Deterministic pseudo-random – SSR safe, no Math.random on render
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Stars – tiny, faint, fast-moving to feel like warp/flight
const STARS = Array.from({ length: 160 }, (_, i) => {
  const rng = lcg(i * 2654435761 + 1);
  const x = rng() * 100;          // % across viewport
  const yStart = rng() * 100;     // % starting position
  const size = 0.5 + rng() * 1.2; // very small: 0.5–1.7px
  const speed = 6 + rng() * 10;   // fast: 6–16s per full cycle (was 18–46s)
  const delay = -(rng() * speed); // already in motion on load
  const opacity = 0.08 + rng() * 0.22; // very faint: 0.08–0.30
  return { x, yStart, size, speed, delay, opacity };
});

// Particles in beam – drift upward into saucer
const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const rng = lcg(i * 999983 + 7);
  const x = 30 + rng() * 40;
  const dur = 2.2 + rng() * 2.4;
  const delay = -(rng() * dur);
  const size = 2 + rng() * 3;
  const opacity = 0.4 + rng() * 0.5;
  return { x, dur, delay, size, opacity };
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
      {/* ── Moving starfield – fast upward drift, tiny & faint ── */}
      {STARS.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.yStart}%`,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: "#ffffff",
            opacity: s.opacity,
            animation: `star-drift ${s.speed}s linear ${s.delay}s infinite`,
          }}
        />
      ))}

      {/* ── UFO – perfectly centered horizontally, floats vertically ── */}
      <div style={{
        position: "absolute",
        top: "12%",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        animation: "orb-float 5s ease-in-out infinite",
        pointerEvents: "none",
      }}>
        <div style={{ position: "relative", width: 200, height: 200 }}>

          {/* Outer diffuse teal glow */}
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: 280, height: 120,
            marginTop: -60, marginLeft: -140,
            borderRadius: "50%",
            background: "radial-gradient(ellipse at center, rgba(0,212,170,0.2) 0%, transparent 70%)",
            filter: "blur(20px)",
          }} />

          {/* Saucer body – flat ellipse disc */}
          <div style={{
            position: "absolute",
            top: "52%", left: "50%",
            width: 140, height: 30,
            marginTop: -15, marginLeft: -70,
            borderRadius: "50%",
            background: "linear-gradient(180deg, rgba(0,212,170,0.22) 0%, rgba(0,60,50,0.8) 55%, rgba(0,20,16,0.95) 100%)",
            boxShadow: "0 0 24px rgba(0,212,170,0.28), 0 4px 14px rgba(0,0,0,0.8)",
            border: "1px solid rgba(0,212,170,0.3)",
          }} />

          {/* Saucer dome */}
          <div style={{
            position: "absolute",
            top: "28%", left: "50%",
            width: 76, height: 42,
            marginLeft: -38,
            borderRadius: "50% 50% 0 0",
            background: "linear-gradient(160deg, rgba(0,212,170,0.16) 0%, rgba(0,40,32,0.85) 100%)",
            border: "1px solid rgba(0,212,170,0.22)",
            borderBottom: "none",
            boxShadow: "inset 0 4px 12px rgba(0,212,170,0.1)",
          }} />

          {/* Rim glow strip */}
          <div style={{
            position: "absolute",
            top: "calc(52% - 2px)", left: "50%",
            width: 140, height: 4,
            marginLeft: -70,
            borderRadius: 2,
            background: "linear-gradient(90deg, transparent 0%, rgba(0,212,170,0.55) 25%, rgba(0,212,170,0.85) 50%, rgba(0,212,170,0.55) 75%, transparent 100%)",
            filter: "blur(2px)",
            animation: "beam-pulse 3s ease-in-out infinite",
          }} />

          {/* Orbit ring */}
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: 170, height: 170,
            marginTop: -85, marginLeft: -85,
            borderRadius: "50%",
            border: "1px solid rgba(0,212,170,0.12)",
            transform: "rotateX(78deg)",
            animation: "orbit-spin 14s linear infinite",
          }} />

          {/* Tractor beam */}
          <div style={{
            position: "absolute",
            top: "calc(52% + 13px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 210,
            background: "linear-gradient(to bottom, rgba(0,212,170,0.14) 0%, rgba(0,212,170,0.05) 60%, transparent 100%)",
            clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
            animation: "beam-pulse 4s ease-in-out infinite",
            overflow: "visible",
          }}>
            <div style={{
              position: "absolute",
              left: 0, right: 0, height: 1,
              background: "linear-gradient(90deg, transparent, rgba(0,212,170,0.5), transparent)",
              animation: "scan-line 2.8s linear infinite",
            }} />
            <div style={{
              position: "absolute",
              left: 0, right: 0, height: 1,
              background: "linear-gradient(90deg, transparent, rgba(0,212,170,0.3), transparent)",
              animation: "scan-line 2.8s linear 1.4s infinite",
            }} />
          </div>

          {/* Particles rising into beam */}
          {PARTICLES.map((p, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `calc(50% - 60px + ${p.x / 100 * 120}px)`,
                top: "calc(52% + 210px)",
                width: p.size,
                height: p.size,
                borderRadius: "50%",
                background: "#00d4aa",
                opacity: p.opacity,
                animation: `particle-rise ${p.dur}s ease-in ${p.delay}s infinite`,
                boxShadow: "0 0 4px rgba(0,212,170,0.8)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Background teal radial – very faint */}
      <div style={{
        position: "absolute",
        top: "20%", left: "50%",
        width: 600, height: 400,
        marginLeft: -300,
        borderRadius: "50%",
        background: "radial-gradient(ellipse at center, rgba(0,212,170,0.06) 0%, transparent 65%)",
        filter: "blur(40px)",
      }} />
    </div>
  );
}
