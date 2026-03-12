"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 40 }}>
          <Image src="/orb-logo.png" alt="Orb" width={48} height={48} style={{ borderRadius: "50%" }} />
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
              style={{ width: "100%", background: loading ? "var(--bg-overlay)" : "var(--brand-primary)", color: loading ? "var(--text-secondary)" : "#000", border: "none", borderRadius: "var(--radius-md)", padding: "11px", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 0 20px var(--brand-glow)", transition: "all 0.15s", marginTop: 4 }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-secondary)" }}>
          No account?{" "}
          <Link href="/register" style={{ color: "var(--brand-primary)", textDecoration: "none", fontWeight: 500 }}>Create one free</Link>
        </p>
      </div>
    </div>
  );
}
