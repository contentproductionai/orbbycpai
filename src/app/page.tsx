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
              <Image src="/orb-logo.png" alt="Orb" width={110} height={50} style={{ display: "block" }} />
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
        padding: "40px 24px 64px",
        textAlign: "center",
        overflow: "hidden",
      }}>
        <UfoHero />
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 760, width: "100%" }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--brand-subtle)", border: "1px solid rgba(0,212,170,0.25)", borderRadius: 100, padding: "4px 12px", marginBottom: 28 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-primary)" }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--brand-primary)", letterSpacing: "0.02em" }}>AI-Powered Brand Intelligence</span>
          </div>

          {/* H1 */}
          <h1 style={{ margin: "0 0 18px", padding: 0, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            <span style={{ display: "block", fontSize: "clamp(36px, 5.5vw, 68px)", fontWeight: 700, color: "#ffffff" }}>
              Reverse-engineer
            </span>
            <span style={{ display: "block", fontSize: "clamp(36px, 5.5vw, 68px)", fontWeight: 700, color: "#00d4aa" }}>
              any brand.
            </span>
            <span style={{ display: "block", fontSize: "clamp(36px, 5.5vw, 68px)", fontWeight: 700, color: "rgba(255,255,255,0.28)" }}>
              From a URL.
            </span>
          </h1>

          {/* Subheadline */}
          <p style={{ fontSize: "clamp(15px, 1.8vw, 18px)", color: "var(--text-secondary)", maxWidth: 540, lineHeight: 1.65, marginBottom: 36 }}>
            Drop any URL. Orb extracts brand DNA — colors, fonts, tone, archetype — and shows you how GPT, Claude, and Gemini perceive it. Understand your brand. Outposition your competitors.
          </p>

          {/* Live demo panel */}
          <BrandExtractionPanel />
        </div>
      </section>

      {/* ── What you get ── */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 96px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 8 }}>
            Everything you need to know about a brand
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto" }}>
            One URL. A complete intelligence report in under 60 seconds.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {[
            {
              icon: "◈",
              title: "Visual Identity",
              body: "Full color palette with hex codes, typography stack, shape language, and spatial philosophy — extracted directly from the live site.",
            },
            {
              icon: "✦",
              title: "Brand Archetype",
              body: "Classified against all 12 Jungian archetypes with a rationale. Understand the psychological positioning behind the brand.",
            },
            {
              icon: "⬡",
              title: "AI Brand Perception",
              body: "See how GPT-5, Claude, and Gemini describe the brand based on their training data. A proxy for real-world brand equity.",
            },
            {
              icon: "◇",
              title: "Product Intelligence",
              body: "Business model, pricing, target customer, key features, and primary CTA — everything a competitive analyst needs.",
            },
            {
              icon: "⊕",
              title: "Competitor Comparison",
              body: "Run up to 3 competitors side-by-side. See where you win, where you're exposed, and get AI-generated USP statements.",
            },
            {
              icon: "≡",
              title: "Tone of Voice",
              body: "Directness, formality, emotionality — classified and summarized so you know exactly how a brand communicates.",
            },
          ].map((f) => (
            <div key={f.title} className="surface" style={{ padding: 28 }}>
              <div style={{ fontSize: 24, color: "var(--brand-primary)", marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "-0.01em" }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 96px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 8 }}>
            How it works
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>Two steps. No setup required.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {[
            {
              step: "01",
              icon: "⊕",
              title: "Drop a URL",
              body: "Paste any brand website — yours, a competitor, or a brand you admire. Orb scrapes the live site, not cached data.",
            },
            {
              step: "02",
              icon: "◈",
              title: "AI extracts the brand",
              body: "Claude analyzes the DOM to extract visual tokens, tone, archetype, and positioning. Then GPT, Claude, and Gemini each weigh in on brand perception.",
            },
            {
              step: "03",
              icon: "✦",
              title: "Get your intelligence report",
              body: "A full brand report card — plus competitor comparison and AI-generated USP statements — ready to act on.",
            },
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

      {/* ── Use cases ── */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 96px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 8 }}>
            Built for people who think about brands
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {[
            { role: "Founders", use: "Understand your own brand positioning before a board meeting or investor pitch." },
            { role: "CMOs", use: "Audit a competitor's brand in minutes. Know their archetype, tone, and how AI perceives them." },
            { role: "Agencies", use: "Walk into a new client meeting with a full brand audit already done. Impress before you pitch." },
            { role: "Investors", use: "Quickly assess brand strength and positioning as part of due diligence." },
          ].map((u) => (
            <div key={u.role} style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "20px 22px",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-primary)", letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 8 }}>{u.role}</div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>{u.use}</p>
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
            {
              name: "Starter",
              price: "$29",
              features: ["10 brand analyses/mo", "Full brand report", "AI perception (3 models)", "Competitor comparison", "Export to PDF"],
              highlight: false,
            },
            {
              name: "Growth",
              price: "$79",
              features: ["50 brand analyses/mo", "Full brand report", "AI perception (3 models)", "Competitor comparison", "Export to PDF", "Analysis history", "Priority support"],
              highlight: true,
            },
            {
              name: "Pro",
              price: "$149",
              features: ["Unlimited analyses", "Full brand report", "AI perception (3 models)", "Competitor comparison", "Export to PDF", "Analysis history", "API access", "Dedicated support"],
              highlight: false,
            },
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

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid var(--border-subtle)", padding: 24, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>© 2026 Orb · contentproduction.ai</p>
      </footer>
    </main>
  );
}
