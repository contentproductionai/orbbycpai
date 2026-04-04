import React from "react";
import Link from "next/link";
import Image from "next/image";
import BrandKitForm from "./BrandKitForm";

export const metadata = {
  title: "New Brand — Orb",
  description: "Upload your brand kit and start generating on-brand social content.",
};

export default function NewBrandPage() {
  return (
    <div data-theme="light" style={{ minHeight: "100vh", background: "#FAF8F4", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── Nav ── */}
      <nav style={{
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        background: "rgba(250,248,244,0.90)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
            <Image src="/orb-logo.png" alt="Orb" width={88} height={40} style={{ display: "block", filter: "invert(1)" }} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/dashboard" style={{
              fontSize: 13, fontWeight: 500, color: "#555",
              padding: "6px 14px", borderRadius: 10,
              textDecoration: "none",
              border: "1px solid rgba(0,0,0,0.10)",
              background: "#fff",
            }}>
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Page header ── */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 0" }}>

        {/* Eyebrow */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(0,229,160,0.10)",
          border: "1px solid rgba(0,229,160,0.30)",
          borderRadius: 100, padding: "4px 14px",
          marginBottom: 20,
        }}>
          {/* UFO icon */}
          <svg width="14" height="14" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="26" cy="27" rx="12" ry="4" stroke="#00e5a0" strokeWidth="2.5" fill="none"/>
            <path d="M20 27 Q20 21 26 21 Q32 21 32 27" stroke="#00e5a0" strokeWidth="2.5" fill="none"/>
            <ellipse cx="26" cy="27" rx="16" ry="5.5" stroke="#00e5a0" strokeWidth="1.5" fill="none" opacity="0.5"/>
            <path d="M22 31 L19 38 M30 31 L33 38" stroke="#00e5a0" strokeWidth="1.5" opacity="0.4"/>
            <line x1="19" y1="38" x2="33" y2="38" stroke="#00e5a0" strokeWidth="1.5" opacity="0.3"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#00b87a", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Brand Kit Upload
          </span>
        </div>

        <h1 style={{
          fontSize: "clamp(28px, 4vw, 44px)",
          fontWeight: 700,
          color: "#111",
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          marginBottom: 14,
        }}>
          Tell us who you are.
        </h1>
        <p style={{ fontSize: 16, color: "#666", lineHeight: 1.65, maxWidth: 520, marginBottom: 48 }}>
          Upload your brand tokens directly — exact hex codes, fonts, and product images. No scraping, no guessing. Your brand, precisely.
        </p>
      </div>

      {/* ── Form ── */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 96px" }}>
        <BrandKitForm />
      </div>
    </div>
  );
}
