import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav style={{ borderBottom: "1px solid var(--border-subtle)", background: "rgba(8,8,8,0.8)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #a78bfa, #7c3aed)", boxShadow: "0 0 12px rgba(124,58,237,0.5)" }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Orb</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/login" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", padding: "6px 14px", borderRadius: "var(--radius-md)", textDecoration: "none" }}>Sign in</Link>
            <Link href="/register" style={{ fontSize: 13, fontWeight: 500, color: "#fff", background: "var(--brand-primary)", padding: "6px 16px", borderRadius: "var(--radius-md)", textDecoration: "none", boxShadow: "0 0 16px var(--brand-glow)" }}>Get started free</Link>
          </div>
        </div>
      </nav>

      <section style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "96px 24px 80px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse at center, rgba(124,58,237,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--brand-subtle)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 100, padding: "4px 12px", marginBottom: 32 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa" }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "#a78bfa", letterSpacing: "0.02em" }}>AI-native content production</span>
        </div>
        <h1 style={{ fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.03em", color: "var(--text-primary)", maxWidth: 800, marginBottom: 20 }}>
          On-brand content at the{" "}
          <span className="text-gradient">speed of thought</span>
        </h1>
        <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: "var(--text-secondary)", maxWidth: 520, lineHeight: 1.6, marginBottom: 40 }}>
          Paste your URL. Orb reads your brand DNA and generates 40 on-brand social posts — ready to download in seconds.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/register" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, color: "#fff", background: "var(--brand-primary)", padding: "12px 28px", borderRadius: "var(--radius-lg)", textDecoration: "none", boxShadow: "0 0 24px var(--brand-glow)", letterSpacing: "-0.01em" }}>
            Start for free →
          </Link>
          <Link href="/login" style={{ display: "inline-flex", alignItems: "center", fontSize: 15, fontWeight: 500, color: "var(--text-secondary)", background: "var(--bg-elevated)", border: "1px solid var(--border-default)", padding: "12px 28px", borderRadius: "var(--radius-lg)", textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
        <p style={{ marginTop: 32, fontSize: 12, color: "var(--text-tertiary)" }}>3 free generations · No credit card required</p>
      </section>

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

      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 96px", width: "100%" }}>
        <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 8, textAlign: "center" }}>Simple pricing</h2>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", textAlign: "center", marginBottom: 40 }}>Start free. Scale when you&apos;re ready.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, maxWidth: 900, margin: "0 auto" }}>
          {[
            { name: "Starter", price: "$49", features: ["25 generations/mo", "All 4 platforms", "ZIP download", "Generation history"], highlight: false },
            { name: "Growth", price: "$99", features: ["100 generations/mo", "All 4 platforms", "ZIP download", "Chat editing", "Priority support"], highlight: true },
            { name: "Pro", price: "$199", features: ["Unlimited generations", "All 4 platforms", "ZIP download", "Chat editing", "API access", "Dedicated support"], highlight: false },
          ].map((plan) => (
            <div key={plan.name} style={{ background: plan.highlight ? "var(--bg-elevated)" : "var(--bg-surface)", border: plan.highlight ? "1px solid rgba(124,58,237,0.4)" : "1px solid var(--border-subtle)", borderRadius: "var(--radius-xl)", padding: 28, position: "relative", boxShadow: plan.highlight ? "0 0 32px var(--brand-glow)" : "none" }}>
              {plan.highlight && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "var(--brand-primary)", color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 12px", borderRadius: 100, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>Most popular</div>}
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
              <Link href="/register" style={{ display: "block", textAlign: "center", fontSize: 13, fontWeight: 600, color: plan.highlight ? "#fff" : "var(--text-primary)", background: plan.highlight ? "var(--brand-primary)" : "var(--bg-overlay)", border: plan.highlight ? "none" : "1px solid var(--border-default)", padding: 10, borderRadius: "var(--radius-md)", textDecoration: "none" }}>Get started</Link>
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
