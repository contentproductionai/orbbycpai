"use client";
import { useState, useMemo } from "react";

// ── URL intent detection ───────────────────────────────────────────────────────
// Detects whether a URL is a product page or a brand homepage.
// Product URL patterns: /products/, /shop/, /item/, /p/, /collections/.../products/
const PRODUCT_PATH_PATTERNS = [
  /\/products?\//i,
  /\/shop\/.+/i,
  /\/items?\//i,
  /\/p\//i,
  /\/collections\/[^/]+\/products\//i,
  /\/pd\//i,
  /\/detail\//i,
];

function detectUrlIntent(url: string): { type: "product" | "brand" | null; label: string } {
  if (!url) return { type: null, label: "" };
  let parsed: URL;
  try {
    parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return { type: null, label: "" };
  }
  const path = parsed.pathname;
  const isProduct = PRODUCT_PATH_PATTERNS.some((p) => p.test(path));
  if (isProduct) {
    // Attempt to extract a readable product name from the last path segment
    const slug = path.split("/").filter(Boolean).pop() ?? "";
    const productName = slug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
    const label = productName
      ? `Generating product content for ${productName}`
      : "Generating product content from product page";
    return { type: "product", label };
  }
  const domain = parsed.hostname.replace(/^www\./, "");
  return { type: "brand", label: `Generating brand content from homepage · ${domain}` };
}

export default function GenerateForm() {
  const [brandUrl, setBrandUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const urlIntent = useMemo(() => detectUrlIntent(brandUrl), [brandUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    // TODO: POST to /api/generate – wired in Phase 2
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
              placeholder="https://yourcompany.com or /products/your-product"
              style={{ width: "100%", background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 14, color: "var(--text-primary)", outline: "none" }}
            />
            {/* URL intent confirmation line — updates in real time as user types */}
            {urlIntent.type && (
              <p style={{
                fontSize: 11,
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: urlIntent.type === "product" ? "var(--brand-primary)" : "var(--text-secondary)",
                fontWeight: 500,
              }}>
                <span style={{ fontSize: 10 }}>{urlIntent.type === "product" ? "◆" : "○"}</span>
                {urlIntent.label}
              </p>
            )}
            {!urlIntent.type && (
              <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                Paste a homepage URL for brand content, or a product page URL for product-specific content.
              </p>
            )}
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
