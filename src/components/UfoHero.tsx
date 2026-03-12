"use client";

// Deterministic pseudo-random — SSR safe, no Math.random on render
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Stars — each has a fixed x, random y start, speed, size, opacity
const STARS = Array.from({ length: 120 }, (_, i) => {
  const rng = lcg(i * 2654435761 + 1);
  const x = rng() * 100;
  const y = rng() * 100;
  const size = 1 + rng() * 2;
  const speed = 18 + rng() * 28; // seconds for one full upward cycle
  const delay = -(rng() * speed); // negative delay = already mid-flight on load
  const opacity = 0.2 + rng() * 0.55;
  return { x, y, size, speed, delay, opacity };
});

// Particles in the beam — drift upward into the saucer
const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const rng = lcg(i * 999983 + 7);
  const x = 30 + rng() * 40; // % within beam width
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
      {/* ── Moving starfield — drift upward, wrap around ── */}
      {STARS.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: "#fff",
            opacity: s.opacity,
            // animationName drives the upward drift; star-twinkle adds pulse
            animation: `star-drift ${s.speed}s linear ${s.delay}s infinite, star-twinkle ${2 + (i % 3)}s ease-in-out ${(i * 0.3) % 2}s infinite`,
            // start position encoded via CSS custom property trick via top
            top: `${s.y}%`,
          }}
        />
      ))}

      {/* ── UFO — positioned above center, floats gently ── */}
      <div style={{
        position: "absolute",
        top: "16%",
        left: "50%",
        transform: "translateX(-50%)",
        width: 160,
        height: 160,
        animation: "orb-float 5s ease-in-out infinite",
      }}>

        {/* Outer diffuse teal glow */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: 220, height: 100,
          marginTop: -50, marginLeft: -110,
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(0,212,170,0.22) 0%, transparent 70%)",
          filter: "blur(18px)",
        }} />

        {/* Saucer body — flat ellipse disc */}
        <div style={{
          position: "absolute",
          top: "52%", left: "50%",
          width: 130, height: 28,
          marginTop: -14, marginLeft: -65,
          borderRadius: "50%",
          background: "linear-gradient(180deg, rgba(0,212,170,0.25) 0%, rgba(0,60,50,0.8) 60%, rgba(0,20,16,0.95) 100%)",
          boxShadow: "0 0 20px rgba(0,212,170,0.3), 0 4px 12px rgba(0,0,0,0.8)",
          border: "1px solid rgba(0,212,170,0.35)",
        }} />

        {/* Saucer dome — rounded top */}
        <div style={{
          position: "absolute",
          top: "28%", left: "50%",
          width: 72, height: 40,
          marginLeft: -36,
          borderRadius: "50% 50% 0 0",
          background: "linear-gradient(160deg, rgba(0,212,170,0.18) 0%, rgba(0,40,32,0.85) 100%)",
          border: "1px solid rgba(0,212,170,0.25)",
          borderBottom: "none",
          boxShadow: "inset 0 4px 12px rgba(0,212,170,0.12)",
        }} />

        {/* Rim glow strip */}
        <div style={{
          position: "absolute",
          top: "calc(52% - 2px)", left: "50%",
          width: 130, height: 4,
          marginLeft: -65,
          borderRadius: 2,
          background: "linear-gradient(90deg, transparent 0%, rgba(0,212,170,0.6) 30%, rgba(0,212,170,0.8) 50%, rgba(0,212,170,0.6) 70%, transparent 100%)",
          filter: "blur(2px)",
          animation: "beam-pulse 3s ease-in-out infinite",
        }} />

        {/* Orbit ring */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: 155, height: 155,
          marginTop: -77, marginLeft: -77,
          borderRadius: "50%",
          border: "1px solid rgba(0,212,170,0.12)",
          transform: "rotateX(78deg)",
          animation: "orbit-spin 14s linear infinite",
        }} />

        {/* Tractor beam — tapered downward */}
        <div style={{
          position: "absolute",
          top: "calc(52% + 12px)",
          left: "50%",
          transform: "translateX(-50%)",
          width: 110,
          height: 200,
          background: "linear-gradient(to bottom, rgba(0,212,170,0.15) 0%, rgba(0,212,170,0.06) 60%, transparent 100%)",
          clipPath: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)",
          animation: "beam-pulse 4s ease-in-out infinite",
          overflow: "visible",
        }}>
          {/* Scan lines */}
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
              left: `calc(50% - 55px + ${p.x / 100 * 110}px)`,
              top: "calc(52% + 200px)",
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

      {/* Background teal radial — very faint, centered */}
      <div style={{
        position: "absolute",
        top: "30%", left: "50%",
        width: 600, height: 400,
        marginLeft: -300,
        borderRadius: "50%",
        background: "radial-gradient(ellipse at center, rgba(0,212,170,0.07) 0%, transparent 65%)",
        filter: "blur(40px)",
        pointerEvents: "none",
      }} />
    </div>
  );
}
