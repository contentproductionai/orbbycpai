"use client";
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
