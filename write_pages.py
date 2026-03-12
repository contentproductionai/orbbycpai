"""
Script to write all Orb app pages.
Run with: python3.11 write_pages.py
"""
import pathlib

base = pathlib.Path('/home/ubuntu/orb-app/src/app')

# ── page.tsx ─────────────────────────────────────────────────────────────────
(base / 'page.tsx').write_text(r'''import Link from "next/link";

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
''')
print("page.tsx done")

# ── login/page.tsx ────────────────────────────────────────────────────────────
(base / 'login').mkdir(exist_ok=True)
(base / 'login' / 'page.tsx').write_text(r'''"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 40, justifyContent: "center" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #a78bfa, #7c3aed)", boxShadow: "0 0 16px rgba(124,58,237,0.5)" }} />
          <span style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Orb</span>
        </div>

        <div className="surface-elevated" style={{ padding: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.02em" }}>Welcome back</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 28 }}>Sign in to your account</p>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#f87171" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.02em" }}>EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 14, color: "var(--text-primary)", outline: "none" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.02em" }}>PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 14, color: "var(--text-primary)", outline: "none" }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", background: loading ? "var(--bg-overlay)" : "var(--brand-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", padding: "11px", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 0 20px var(--brand-glow)", transition: "all 0.15s", marginTop: 4 }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-secondary)" }}>
          No account?{" "}
          <Link href="/register" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 500 }}>Create one free</Link>
        </p>
      </div>
    </div>
  );
}
''')
print("login/page.tsx done")

# ── register/page.tsx ─────────────────────────────────────────────────────────
(base / 'register').mkdir(exist_ok=True)
(base / 'register' / 'page.tsx').write_text(r'''"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
    } else {
      router.push("/login?registered=1");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 40, justifyContent: "center" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #a78bfa, #7c3aed)", boxShadow: "0 0 16px rgba(124,58,237,0.5)" }} />
          <span style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Orb</span>
        </div>

        <div className="surface-elevated" style={{ padding: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "-0.02em" }}>Create your account</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 28 }}>3 free generations. No credit card required.</p>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#f87171" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.02em" }}>NAME</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 14, color: "var(--text-primary)", outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.02em" }}>EMAIL</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 14, color: "var(--text-primary)", outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.02em" }}>PASSWORD</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="8+ characters" minLength={8} style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 14, color: "var(--text-primary)", outline: "none" }} />
            </div>
            <button type="submit" disabled={loading} style={{ width: "100%", background: loading ? "var(--bg-overlay)" : "var(--brand-primary)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", padding: 11, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 0 20px var(--brand-glow)", transition: "all 0.15s", marginTop: 4 }}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
''')
print("register/page.tsx done")

# ── dashboard/page.tsx ────────────────────────────────────────────────────────
(base / 'dashboard').mkdir(exist_ok=True)
(base / 'dashboard' / 'page.tsx').write_text(r'''import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top nav */}
      <nav style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)", height: 56, display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #a78bfa, #7c3aed)" }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Orb</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{session.user?.email}</span>
          <Link href="/api/auth/signout" style={{ fontSize: 13, color: "var(--text-tertiary)", textDecoration: "none" }}>Sign out</Link>
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, maxWidth: 1120, margin: "0 auto", padding: "40px 24px", width: "100%" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: 6 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Generate on-brand social content from any URL.
          </p>
        </div>

        {/* New generation CTA */}
        <div className="surface-elevated" style={{ padding: 32, marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: 4 }}>
              New generation
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Paste your website URL and Orb will extract your brand identity automatically.
            </p>
          </div>
          <Link
            href="/generate"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "#fff", background: "var(--brand-primary)", padding: "10px 22px", borderRadius: "var(--radius-md)", textDecoration: "none", boxShadow: "0 0 20px var(--brand-glow)", whiteSpace: "nowrap" }}
          >
            Generate content →
          </Link>
        </div>

        {/* Empty state */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16, letterSpacing: "-0.01em" }}>
            Recent generations
          </h2>
          <div className="surface" style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◎</div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>No generations yet</p>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Your generated content will appear here.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
''')
print("dashboard/page.tsx done")

# ── generate/page.tsx ─────────────────────────────────────────────────────────
(base / 'generate').mkdir(exist_ok=True)
(base / 'generate' / 'page.tsx').write_text(r'''import { auth } from "@/auth";
import { redirect } from "next/navigation";
import GenerateForm from "./GenerateForm";

export default async function GeneratePage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)", height: 56, display: "flex", alignItems: "center", padding: "0 24px", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #a78bfa, #7c3aed)" }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Orb</span>
        </div>
        <a href="/dashboard" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>← Dashboard</a>
      </nav>
      <main style={{ flex: 1, maxWidth: 720, margin: "0 auto", padding: "48px 24px", width: "100%" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: 6 }}>
          New generation
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 40 }}>
          Orb will extract your brand identity and generate 40 on-brand social posts.
        </p>
        <GenerateForm />
      </main>
    </div>
  );
}
''')
print("generate/page.tsx done")

# ── generate/GenerateForm.tsx ─────────────────────────────────────────────────
(base / 'generate' / 'GenerateForm.tsx').write_text(r'''"use client";
import { useState } from "react";

export default function GenerateForm() {
  const [brandUrl, setBrandUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    // TODO: POST to /api/generate — wired in Phase 2
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setError("Generation pipeline will be wired in Phase 2.");
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="surface-elevated" style={{ padding: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 20, letterSpacing: "-0.01em" }}>Brand inputs</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.02em" }}>WEBSITE URL *</label>
            <input
              type="url"
              value={brandUrl}
              onChange={(e) => setBrandUrl(e.target.value)}
              required
              placeholder="https://yourcompany.com"
              style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 14, color: "var(--text-primary)", outline: "none" }}
            />
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>Orb will extract your brand colors, typography, and tone from this URL.</p>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.02em" }}>INSTAGRAM URL <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(optional)</span></label>
            <input
              type="url"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/yourbrand"
              style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 14, color: "var(--text-primary)", outline: "none" }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "var(--radius-md)", padding: "12px 16px", fontSize: 13, color: "#f87171" }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !brandUrl}
        style={{ background: loading || !brandUrl ? "var(--bg-overlay)" : "var(--brand-primary)", color: loading || !brandUrl ? "var(--text-tertiary)" : "#fff", border: "none", borderRadius: "var(--radius-lg)", padding: "13px", fontSize: 15, fontWeight: 600, cursor: loading || !brandUrl ? "not-allowed" : "pointer", boxShadow: loading || !brandUrl ? "none" : "0 0 24px var(--brand-glow)", transition: "all 0.15s" }}
      >
        {loading ? "Extracting brand..." : "Generate 40 posts →"}
      </button>
    </form>
  );
}
''')
print("generate/GenerateForm.tsx done")

print("\nAll pages written successfully.")
