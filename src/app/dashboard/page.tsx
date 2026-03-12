import { auth } from "@/auth";
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
