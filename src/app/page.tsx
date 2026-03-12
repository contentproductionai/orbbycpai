import Link from "next/link";
import UfoHero from "@/components/UfoHero";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── Nav ── */}
      <nav style={{ borderBottom: "1px solid var(--border-subtle)", background: "rgba(8,8,8,0.85)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #00d4aa, #00856b)", boxShadow: "0 0 12px rgba(0,212,170,0.45)" }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Orb</span>
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
        padding: "0 24px",
        textAlign: "center",
        overflow: "hidden",
      }}>
        {/* Starfield + orb — fills section, sits behind text */}
        <UfoHero />

        {/* Text content — above the orb layer */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 900 }}>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--brand-subtle)", border: "1px solid rgba(0,212,170,0.25)", borderRadius: 100, padding: "4px 12px", marginBottom: 32 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-primary)" }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--brand-primary)", letterSpacing: "0.02em" }}>AI-native content production</span>
          </div>

          {/* H1 — three lines matching reference */}
          <h1 style={{ margin: "0 0 28px", padding: 0, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            <span style={{ display: "block", fontSize: "clamp(52px, 8vw, 110px)", fontWeight: 700, color: "#ffffff" }}>
              Your brand.
            </span>
            <span style={{ display: "block", fontSize: "clamp(52px, 8vw, 110px)", fontWeight: 700, color: "#00d4aa" }}>
              Every platform.
            </span>
            <span style={{ display: "block", fontSize: "clamp(52px, 8vw, 110px)", fontWeight: 700, color: "rgba(255,255,255,0.28)" }}>
              60 seconds.
            </span>
          </h1>

          {/* Subheadline */}
          <p style={{ fontSize: "clamp(15px, 1.8vw, 19px)", color: "var(--text-secondary)", maxWidth: 560, lineHeight: 1.65, marginBottom: 40 }}>
            Drop your URL. Orb reads your brand DNA and generates 40 scroll-stopping posts sized perfectly for every platform.
          </p>

          {/* CTA row */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              href="/register"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                fontSize: 15, fontWeight: 600, color: "#000",
                background: "#00d4aa",
                padding: "13px 28px",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                boxShadow: "0 0 24px rgba(0,212,170,0.4)",
                letterSpacing: "-0.01em",
              }}
            >
              Generate for free →
            </Link>
            <Link
              href="#how-it-works"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                fontSize: 15, fontWeight: 500, color: "var(--text-secondary)",
                background: "transparent",
                border: "1px solid var(--border-default)",
                padding: "13px 24px",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                letterSpacing: "-0.01em",
              }}
            >
              <span style={{ fontSize: 16, color: "var(--brand-primary)" }}>◎</span> See demo
            </Link>
          </div>

          <p style={{ marginTop: 20, fontSize: 12, color: "var(--text-tertiary)" }}>3 free generations · No credit card required</p>
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 96px", width: "100%" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {[
            { icon: "◎", title: "Brand extraction", body: "Paste any URL. Orb reads your colors, typography, shape language, and tone of voice automatically." },
            { icon: "⬡", title: "40 posts per generation", body: "10 unique designs across Instagram, Facebook, LinkedIn, and X — every size, every format." },
            { icon: "◈", title: "Chat-based editing", body: "Make the background darker. Use a warmer photo. Orb refines in real time." },
            { icon: "⬙", title: "WCAG AA guaranteed", body: "Every post passes 4.5:1 contrast ratio. Accessibility is non-negotiable." },
          ].map((f) => (
            <div key={f.title} className="surface" style={{ padding: 24 }}>
              <div style={{ fontSize: 22, marginBottom: 12, color: "var(--brand-primary)" }}>{f.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.01em" }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{f.body}</p>
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
            { step: "01", icon: "⬡", title: "Signal", body: "Drop your URL. Orb reads your brand DNA — colors, type, tone, and shape language — in seconds." },
            { step: "02", icon: "◎", title: "Generate", body: "10 designs × 4 platforms = 40 images in 60 seconds. Every format, every size, every time." },
            { step: "03", icon: "◈", title: "Refine & Download", body: "Chat to adjust anything. Make the background darker. Swap the photo. Download instantly — no ZIP files." },
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
