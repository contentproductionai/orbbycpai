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
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--brand-primary)", letterSpacing: "0.02em" }}>On-Demand Company Intelligence</span>
          </div>

          {/* H1 */}
          <h1 style={{ margin: "0 0 18px", padding: 0, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            <span style={{ display: "block", fontSize: "clamp(36px, 5.5vw, 68px)", fontWeight: 700, color: "#ffffff" }}>
              Know any company.
            </span>
            <span style={{ display: "block", fontSize: "clamp(36px, 5.5vw, 68px)", fontWeight: 700, color: "#00d4aa" }}>
              From a URL.
            </span>
          </h1>

          {/* Subheadline */}
          <p style={{ fontSize: "clamp(15px, 1.8vw, 18px)", color: "var(--text-secondary)", maxWidth: 540, lineHeight: 1.65, marginBottom: 36 }}>
            Drop any URL. Orb scrapes the live site, reads the visual system, analyzes the copy, and queries GPT, Claude, and Gemini to capture how each model describes the company — unprompted. A full intelligence profile in under 60 seconds.
          </p>

          {/* Live demo panel */}
          <BrandExtractionPanel />
        </div>
      </section>

      {/* ── Problem / Built / Result ── */}
      <section style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px 96px", width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 0, borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
          {[
            {
              label: "PROBLEM",
              text: "Most people walk into calls, pitches, and competitive reviews knowing almost nothing about the company on the other side. You can spend 20 minutes on their website and still not know how they position themselves, what AI models say about them, or how they compare to anyone else. The information exists — it's just scattered, slow to gather, and impossible to standardize.",
            },
            {
              label: "BUILT",
              text: "Orb takes a URL and returns the company. It scrapes and renders the live site, reads the visual system with vision models, and analyzes the copy for voice, archetype, and positioning. Then it queries GPT, Claude, and Gemini directly to capture how each model describes that company unprompted. The output is a structured intelligence profile — comparable across any set of companies, generated in under 60 seconds.",
            },
            {
              label: "RESULT",
              text: "A pre-call download that used to take 30 minutes of research now takes 10 seconds. Sales teams use it before discovery calls. Investors use it for deal sourcing. Founders use it to understand their competitive set. Anyone who needs to know a company fast uses Orb.",
            },
          ].map((item) => (
            <div key={item.label} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 32, padding: "32px 0 32px 32px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-primary)", letterSpacing: "0.1em", paddingTop: 3 }}>
                {item.label}
              </div>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.75, margin: 0 }}>
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What you get ── */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 96px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 8 }}>
            Everything in one profile
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 440, margin: "0 auto" }}>
            One URL. A complete intelligence report. No research required.
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
              body: "Classified against all 12 Jungian archetypes with a rationale. Understand the psychological positioning driving the company's communication.",
            },
            {
              icon: "⬡",
              title: "AI Perception",
              body: "GPT-5, Claude, and Gemini each describe the company based on their training data — a direct read on public brand equity and awareness.",
            },
            {
              icon: "◇",
              title: "Product Intelligence",
              body: "Business model, pricing, target customer, key features, and primary CTA — everything a competitive analyst or sales rep needs before a call.",
            },
            {
              icon: "⊕",
              title: "Competitor Comparison",
              body: "Run up to 3 companies side-by-side. See where you differentiate, where you're exposed, and get AI-generated positioning statements.",
            },
            {
              icon: "≡",
              title: "Tone & Voice",
              body: "Directness, formality, emotionality — classified and summarized so you understand exactly how a company communicates and why.",
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



      {/* ── Who uses it ── */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px 96px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 8 }}>
            For anyone who needs to know a company fast
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {[
            { role: "Sales", use: "Drop a prospect's URL before a discovery call. Walk in knowing their positioning, voice, and how AI describes them." },
            { role: "Investors", use: "Assess brand strength and market positioning as part of deal sourcing or due diligence — in seconds, not hours." },
            { role: "Founders", use: "Understand your competitive set at a level most founders never reach. Know exactly where you're differentiated." },
            { role: "Agencies", use: "Walk into a new client meeting with a full company audit already done. Impress before you pitch." },
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
              features: ["10 company profiles/mo", "Full intelligence report", "AI perception — 3 models", "Competitor comparison", "Export to PDF"],
              highlight: false,
            },
            {
              name: "Growth",
              price: "$79",
              features: ["50 company profiles/mo", "Full intelligence report", "AI perception — 3 models", "Competitor comparison", "Export to PDF", "Profile history", "Priority support"],
              highlight: true,
            },
            {
              name: "Pro",
              price: "$149",
              features: ["Unlimited profiles", "Full intelligence report", "AI perception — 3 models", "Competitor comparison", "Export to PDF", "Profile history", "API access", "Dedicated support"],
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
