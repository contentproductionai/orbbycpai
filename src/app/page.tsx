import React from "react";
import Link from "next/link";
import Image from "next/image";
import UfoHero from "@/components/UfoHero";
import BrandExtractionPanel from "@/components/BrandExtractionPanel";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── Nav ── */}
      <nav style={{ borderBottom: "1px solid var(--border-subtle)", background: "rgba(8,8,8,0.85)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ animation: "logo-float 3s ease-in-out infinite", display: "inline-flex" }}>
              <Image src="/orb-logo.png" alt="Orb" width={81} height={81} style={{ borderRadius: "50%" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/login" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", padding: "6px 14px", borderRadius: "var(--radius-md)", textDecoration: "none" }}>Sign in</Link>
            <Link href="/register" style={{ fontSize: 13, fontWeight: 500, color: "#000", background: "var(--brand-primary)", padding: "6px 16px", borderRadius: "var(--radius-md)", textDecoration: "none", boxShadow: "0 0 16px var(--brand-glow)" }}>Get started free</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "0 24px 64px",
        textAlign: "center",
        overflow: "hidden",
      }}>
        {/* Starfield + orb – fills section, sits behind text */}
        <UfoHero />

        {/* Text + panel – above the orb layer */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 760, width: "100%" }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--brand-subtle)", border: "1px solid rgba(0,212,170,0.25)", borderRadius: 100, padding: "4px 12px", marginBottom: 28 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-primary)" }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--brand-primary)", letterSpacing: "0.02em" }}>AI-native content production</span>
          </div>

          {/* H1 – original clamp size restored */}
          <h1 style={{ margin: "0 0 18px", padding: 0, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            <span style={{ display: "block", fontSize: "clamp(36px, 5.5vw, 68px)", fontWeight: 700, color: "#ffffff" }}>
              Your brand.
            </span>
            <span style={{ display: "block", fontSize: "clamp(36px, 5.5vw, 68px)", fontWeight: 700, color: "#00d4aa" }}>
              Every platform.
            </span>
            <span style={{ display: "block", fontSize: "clamp(36px, 5.5vw, 68px)", fontWeight: 700, color: "rgba(255,255,255,0.28)" }}>
              60 seconds.
            </span>
          </h1>

          {/* Subheadline */}
          <p style={{ fontSize: "clamp(15px, 1.8vw, 18px)", color: "var(--text-secondary)", maxWidth: 540, lineHeight: 1.65, marginBottom: 36 }}>
            Drop your URL. Orb reads your brand DNA and generates 40 scroll-stopping posts sized perfectly for every platform.
          </p>

          {/* Brand extraction panel */}
          <BrandExtractionPanel />

          <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-tertiary)" }}>3 free generations · No credit card required</p>
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 96px", width: "100%" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {([
            {
              icon: (
                <svg width="26" height="26" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="26" cy="26" r="24" stroke="#00d4aa" strokeWidth="1.5" fill="none"/>
                  {/* UFO saucer body */}
                  <ellipse cx="26" cy="27" rx="12" ry="4" stroke="#00d4aa" strokeWidth="1.5" fill="none"/>
                  {/* UFO dome */}
                  <path d="M20 27 Q20 21 26 21 Q32 21 32 27" stroke="#00d4aa" strokeWidth="1.5" fill="none"/>
                  {/* UFO ring/orbit */}
                  <ellipse cx="26" cy="27" rx="16" ry="5.5" stroke="#00d4aa" strokeWidth="1" fill="none" opacity="0.5"/>
                  {/* Beam */}
                  <path d="M22 31 L19 38 M30 31 L33 38" stroke="#00d4aa" strokeWidth="1" opacity="0.4"/>
                  <line x1="19" y1="38" x2="33" y2="38" stroke="#00d4aa" strokeWidth="1" opacity="0.3"/>
                </svg>
              ),
              title: "Brand Extraction",
              body: "Paste any URL and Orb reverse-engineers your visual identity – colors, typography, shape language, and tone of voice – automatically, in seconds.",
              pills: ["Color palettes", "Font matching", "Tone of voice", "Logo detection"],
            },
            {
              icon: (
                <svg width="26" height="26" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="26" cy="26" r="24" stroke="#00d4aa" strokeWidth="1.5" fill="none"/>
                  {/* Triangle/prism – 3D effect with inner lines */}
                  <polygon points="26,14 38,36 14,36" stroke="#00d4aa" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
                  {/* Inner prism lines */}
                  <line x1="26" y1="14" x2="26" y2="36" stroke="#00d4aa" strokeWidth="1" opacity="0.5"/>
                  <line x1="26" y1="36" x2="32" y2="25" stroke="#00d4aa" strokeWidth="1" opacity="0.5"/>
                  <line x1="26" y1="36" x2="20" y2="25" stroke="#00d4aa" strokeWidth="1" opacity="0.5"/>
                </svg>
              ),
              title: "40 Posts Per Generation",
              body: "10 unique design concepts, each rendered across Instagram, Facebook, LinkedIn, and X – every dimension, every crop, every format. One click.",
              pills: ["Instagram 1:1 & 9:16", "LinkedIn banners", "Facebook covers", "X cards"],
            },
            {
              icon: (
                <svg width="26" height="26" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="26" cy="26" r="24" stroke="#00d4aa" strokeWidth="1.5" fill="none"/>
                  {/* Pill/capsule – rotated ~35deg */}
                  <rect x="18" y="22" width="20" height="10" rx="5" stroke="#00d4aa" strokeWidth="1.5" fill="none" transform="rotate(-35 26 27)"/>
                  {/* Small circle detail inside pill */}
                  <circle cx="22" cy="30" r="2.5" stroke="#00d4aa" strokeWidth="1" fill="none" transform="rotate(-35 26 27)"/>
                </svg>
              ),
              title: "Chat-Based Editing",
              body: "Skip the design tool. Just describe the change – 'make the background darker,' 'swap the photo,' 'try a warmer palette' – and Orb refines in real time.",
              pills: ["Natural language edits", "Instant preview", "Version history"],
            },
            {
              icon: (
                <svg width="26" height="26" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="26" cy="26" r="24" stroke="#00d4aa" strokeWidth="1.5" fill="none"/>
                  {/* Chevron – downward pointing V */}
                  <polyline points="16,20 26,32 36,20" stroke="#00d4aa" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
                  {/* Second inner chevron for depth */}
                  <polyline points="19,20 26,29 33,20" stroke="#00d4aa" strokeWidth="1" fill="none" strokeLinejoin="round" strokeLinecap="round" opacity="0.45"/>
                </svg>
              ),
              title: "Built for Performance",
              body: "Every post is optimized for the algorithm – platform-native ratios, high-contrast visuals, and copy length calibrated for engagement. What looks great also converts.",
              pills: ["Contrast optimized", "Platform-native sizing", "Engagement-tuned copy", "Instant download"],
            },
            {
              icon: (
                <svg width="26" height="26" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="26" cy="26" r="24" stroke="#00d4aa" strokeWidth="1.5" fill="none"/>
                  {/* Orb/eye – outer ring + inner circle + pupil dot */}
                  <circle cx="26" cy="26" r="11" stroke="#00d4aa" strokeWidth="1.5" fill="none"/>
                  <circle cx="26" cy="26" r="6" stroke="#00d4aa" strokeWidth="1.2" fill="none"/>
                  {/* Pupil/highlight dot */}
                  <circle cx="28.5" cy="23.5" r="1.8" fill="#00d4aa" opacity="0.9"/>
                </svg>
              ),
              title: "Generation History",
              body: "Every set you generate is saved to your account – organized by brand, browsable anytime, and re-downloadable in one click. Nothing gets lost.",
              pills: ["Saved to account", "Organized by brand", "Re-downloadable"],
            },
            {
              icon: (
                <svg width="26" height="26" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="26" cy="26" r="24" stroke="#00d4aa" strokeWidth="1.5" fill="none"/>
                  {/* Jellyfish – dome bell */}
                  <path d="M16 26 Q16 17 26 17 Q36 17 36 26" stroke="#00d4aa" strokeWidth="1.5" fill="none"/>
                  {/* Bell bottom wavy edge */}
                  <path d="M16 26 Q18 28 20 26 Q22 24 24 26 Q26 28 28 26 Q30 24 32 26 Q34 28 36 26" stroke="#00d4aa" strokeWidth="1.2" fill="none"/>
                  {/* Tentacles */}
                  <path d="M19 27 Q18 31 19 35" stroke="#00d4aa" strokeWidth="1" fill="none" strokeLinecap="round"/>
                  <path d="M22 27 Q21 32 22 36" stroke="#00d4aa" strokeWidth="1" fill="none" strokeLinecap="round"/>
                  <path d="M26 27 Q26 32 26 37" stroke="#00d4aa" strokeWidth="1" fill="none" strokeLinecap="round"/>
                  <path d="M30 27 Q31 32 30 36" stroke="#00d4aa" strokeWidth="1" fill="none" strokeLinecap="round"/>
                  <path d="M33 27 Q34 31 33 35" stroke="#00d4aa" strokeWidth="1" fill="none" strokeLinecap="round"/>
                </svg>
              ),
              title: "Multi-Brand Profiles",
              body: "Managing more than one brand? Save unlimited brand profiles and switch between them instantly. Each one remembers its own colors, fonts, and tone.",
              pills: ["Unlimited profiles", "Instant switching", "Per-brand memory"],
            },
          ] as { icon: React.ReactNode; title: string; body: string; pills: string[] }[]).map((f) => (
            <div key={f.title} className="surface" style={{ padding: 24, display: "flex", flexDirection: "column" }}>
              <div style={{ marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.01em" }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 16, flex: 1 }}>{f.body}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {f.pills.map((pill) => (
                  <span key={pill} style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "rgba(0,212,170,0.85)",
                    background: "rgba(0,212,170,0.08)",
                    border: "1px solid rgba(0,212,170,0.18)",
                    borderRadius: 100,
                    padding: "3px 10px",
                    letterSpacing: "0.01em",
                    whiteSpace: "nowrap" as const,
                  }}>{pill}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 96px", width: "100%" }}>
        <h2 style={{ fontSize: "clamp(26px, 3.5vw, 38px)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 8, textAlign: "center" }}>How it works</h2>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", textAlign: "center", marginBottom: 48 }}>Three steps. Sixty seconds.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, maxWidth: 900, margin: "0 auto" }}>
          {[
            { step: "01", icon: "⬡", title: "Signal", body: "Drop your URL. Orb reads your brand DNA – colors, type, tone, and shape language – in seconds." },
            { step: "02", icon: "◎", title: "Generate", body: "10 designs × 4 platforms = 40 images in 60 seconds. Every format, every size, every time." },
            { step: "03", icon: "◈", title: "Refine & Download", body: "Chat to adjust anything. Make the background darker. Swap the photo. Download instantly – no ZIP files." },
          ].map((s) => (
            <div key={s.step} className="surface" style={{ padding: 28, position: "relative" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-primary)", letterSpacing: "0.1em", marginBottom: 16, opacity: 0.7 }}>STEP {s.step}</div>
              <div style={{ fontSize: 24, marginBottom: 12, color: "var(--brand-primary)" }}>{s.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.01em" }}>{s.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 96px", width: "100%" }}>
        <h2 style={{ fontSize: "clamp(26px, 3.5vw, 38px)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 8, textAlign: "center" }}>Simple pricing</h2>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", textAlign: "center", marginBottom: 40 }}>Start free. Scale when you&apos;re ready.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, maxWidth: 900, margin: "0 auto" }}>
          {[
            { name: "Starter", price: "$49", features: ["10 generations/mo", "All 4 platforms", "Instant download", "Generation history"], highlight: false },
            { name: "Growth", price: "$99", features: ["25 generations/mo", "All 4 platforms", "Instant download", "Chat editing", "Priority support"], highlight: true },
            { name: "Pro", price: "$199", features: ["75 generations/mo", "All 4 platforms", "Instant download", "Chat editing", "API access", "Dedicated support"], highlight: false },
          ].map((plan) => (
            <div
              key={plan.name}
              style={{
                background: plan.highlight ? "var(--bg-elevated)" : "var(--bg-surface)",
                border: plan.highlight ? "1px solid rgba(0,212,170,0.35)" : "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-xl)",
                padding: 28,
                position: "relative",
                boxShadow: plan.highlight ? "0 0 32px rgba(0,212,170,0.12)" : "none",
              }}
            >
              {plan.highlight && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "var(--brand-primary)", color: "#000", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 100, letterSpacing: "0.05em", textTransform: "uppercase" as const, whiteSpace: "nowrap" }}>
                  Most popular
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{plan.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 20 }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>{plan.price}</span>
                <span style={{ fontSize: 14, color: "var(--text-tertiary)" }}>/mo</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 8 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--brand-primary)" }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                style={{
                  display: "block", textAlign: "center", fontSize: 13, fontWeight: 600,
                  color: plan.highlight ? "#000" : "var(--text-primary)",
                  background: plan.highlight ? "var(--brand-primary)" : "var(--bg-overlay)",
                  border: plan.highlight ? "none" : "1px solid var(--border-default)",
                  padding: 10, borderRadius: "var(--radius-md)", textDecoration: "none",
                }}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--border-subtle)", padding: 24, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>© 2026 Orb · contentproduction.ai</p>
      </footer>
    </main>
  );
}
