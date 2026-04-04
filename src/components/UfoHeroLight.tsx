"use client";

// Deterministic pseudo-random – SSR safe, no Math.random on render
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Floating dots — soft, warm-tinted, subtle on cream background
const DOTS = Array.from({ length: 60 }, (_, i) => {
  const rng = lcg(i * 2654435761 + 1);
  const x = rng() * 100;
  const yStart = rng() * 100;
  const size = 1 + rng() * 2.5;
  const speed = 18 + rng() * 24;
  const delay = -(rng() * speed);
  const opacity = 0.04 + rng() * 0.10;
  return { x, yStart, size, speed, delay, opacity };
});

// Particles in beam
const PARTICLES = Array.from({ length: 12 }, (_, i) => {
  const rng = lcg(i * 999983 + 7);
  const x = 30 + rng() * 40;
  const dur = 2.4 + rng() * 2.2;
  const delay = -(rng() * dur);
  const size = 2 + rng() * 2.5;
  const opacity = 0.35 + rng() * 0.45;
  return { x, dur, delay, size, opacity };
});

export default function UfoHeroLight() {
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
      {/* Floating ambient dots on cream */}
      {DOTS.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${d.x}%`,
            top: `${d.yStart}%`,
            width: d.size,
            height: d.size,
            borderRadius: "50%",
            background: "#00e5a0",
            opacity: d.opacity,
            animation: `star-drift ${d.speed}s linear ${d.delay}s infinite`,
          }}
        />
      ))}

      {/* UFO — centered, floats vertically */}
      <div style={{
        position: "absolute",
        top: "8%",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        animation: "orb-float 5s ease-in-out infinite",
        pointerEvents: "none",
      }}>
        <div style={{ position: "relative", width: 220, height: 220 }}>

          {/* Outer diffuse teal glow — softer on light bg */}
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: 320, height: 140,
            marginTop: -70, marginLeft: -160,
            borderRadius: "50%",
            background: "radial-gradient(ellipse at center, rgba(0,229,160,0.18) 0%, transparent 70%)",
            filter: "blur(24px)",
          }} />

          {/* Saucer body */}
          <div style={{
            position: "absolute",
            top: "52%", left: "50%",
            width: 150, height: 32,
            marginTop: -16, marginLeft: -75,
            borderRadius: "50%",
            background: "linear-gradient(180deg, rgba(0,229,160,0.30) 0%, rgba(0,160,110,0.55) 55%, rgba(0,100,70,0.70) 100%)",
            boxShadow: "0 0 28px rgba(0,229,160,0.22), 0 4px 16px rgba(0,0,0,0.10)",
            border: "1px solid rgba(0,229,160,0.40)",
          }} />

          {/* Saucer dome */}
          <div style={{
            position: "absolute",
            top: "28%", left: "50%",
            width: 80, height: 44,
            marginLeft: -40,
            borderRadius: "50% 50% 0 0",
            background: "linear-gradient(160deg, rgba(0,229,160,0.22) 0%, rgba(0,180,130,0.45) 100%)",
            border: "1px solid rgba(0,229,160,0.30)",
            borderBottom: "none",
            boxShadow: "inset 0 4px 12px rgba(0,229,160,0.12)",
          }} />

          {/* Rim glow strip */}
          <div style={{
            position: "absolute",
            top: "calc(52% - 2px)", left: "50%",
            width: 150, height: 4,
            marginLeft: -75,
            borderRadius: 2,
            background: "linear-gradient(90deg, transparent 0%, rgba(0,229,160,0.50) 25%, rgba(0,229,160,0.80) 50%, rgba(0,229,160,0.50) 75%, transparent 100%)",
            filter: "blur(2px)",
            animation: "beam-pulse 3s ease-in-out infinite",
          }} />

          {/* Orbit ring */}
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: 180, height: 180,
            marginTop: -90, marginLeft: -90,
            borderRadius: "50%",
            border: "1px solid rgba(0,229,160,0.18)",
            transform: "rotateX(78deg)",
            animation: "orbit-spin 14s linear infinite",
          }} />

          {/* Tractor beam */}
          <div style={{
            position: "absolute",
            top: "calc(52% + 14px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: 130,
            height: 220,
            background: "linear-gradient(to bottom, rgba(0,229,160,0.12) 0%, rgba(0,229,160,0.04) 60%, transparent 100%)",
            clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
            animation: "beam-pulse 4s ease-in-out infinite",
            overflow: "visible",
          }}>
            <div style={{
              position: "absolute",
              left: 0, right: 0, height: 1,
              background: "linear-gradient(90deg, transparent, rgba(0,229,160,0.45), transparent)",
              animation: "scan-line 2.8s linear infinite",
            }} />
            <div style={{
              position: "absolute",
              left: 0, right: 0, height: 1,
              background: "linear-gradient(90deg, transparent, rgba(0,229,160,0.28), transparent)",
              animation: "scan-line 2.8s linear 1.4s infinite",
            }} />
          </div>

          {/* Particles rising into beam */}
          {PARTICLES.map((p, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `calc(50% - 65px + ${p.x / 100 * 130}px)`,
                top: "calc(52% + 220px)",
                width: p.size,
                height: p.size,
                borderRadius: "50%",
                background: "#00e5a0",
                opacity: p.opacity,
                animation: `particle-rise ${p.dur}s ease-in ${p.delay}s infinite`,
                boxShadow: "0 0 4px rgba(0,229,160,0.6)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Background teal radial — very faint on cream */}
      <div style={{
        position: "absolute",
        top: "15%", left: "50%",
        width: 700, height: 500,
        marginLeft: -350,
        borderRadius: "50%",
        background: "radial-gradient(ellipse at center, rgba(0,229,160,0.07) 0%, transparent 65%)",
        filter: "blur(50px)",
      }} />
    </div>
  );
}
