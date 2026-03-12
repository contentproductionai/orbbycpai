import { auth } from "@/auth";
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
