"use client";
import React, { useState, useRef } from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColorSample { hex: string; count: number; contexts?: string[] }
interface AiPerceptionEntry {
  // New 5-field perception schema
  dominantAssociations?: string[];
  vocabularyTells?: string;
  positioningDelta?: string;
  categoryAnchor?: string;
  sentimentRationale?: string;
  // Legacy field (kept for backward compat with old DB rows)
  summary?: string;
  sentimentScore: number;
  model: string;
}
interface AiPerception {
  openai: AiPerceptionEntry;
  anthropic: AiPerceptionEntry;
  google: AiPerceptionEntry;
}

interface BrandProfile {
  meta?: { url: string; brandName: string; extractedAt: string };
  primaryColor?: string;
  accentColor?: string;
  colorPalette?: ColorSample[];
  typography?: {
    headline?: { fontFamily?: string; fontSize?: string; fontWeight?: string };
    body?: { fontFamily?: string; fontSize?: string };
    cta?: { fontFamily?: string };
  };
  tone?: { directness: string; formality: string; emotionality: string; summary: string };
  brandArchetype?: { archetype: string; rationale: string };
  brandPersonality?: string;
  industryContext?: string;
  positioningSignal?: string;
  shapeLanguage?: { classification: string };
  spatialPhilosophy?: { classification: string };
  aiPerception?: AiPerception;
  companyMetadata?: { foundedYear?: string | null; employeeCount?: string | null; hqLocation?: string | null; fundingStage?: string | null };
  productIntelligence?: {
    productName?: string; oneLiner?: string; whatItDoes?: string;
    productCategory?: string[]; productType?: string; targetCustomers?: string;
    businessModel?: string[]; pricing?: string; keyFeatures?: string[]; primaryCTA?: string;
    techSignals?: string[];
  };
  statistics?: Array<{ value: string; label: string }>;
  testimonials?: Array<{ quote: string; author: string }>;
  brandAssets?: { favicon?: string; ogImage?: string; logoImgs?: string[] };
}

interface Generation {
  id: string;
  brandUrl: string;
  status: string;
  createdAt: string;
  brandProfile: Record<string, unknown>;
  errorMessage: string | null;
}

interface ComparisonResult {
  primary: BrandProfile;
  competitors: BrandProfile[];
  uspStatements: Record<string, string>;
}

interface User { name: string; email: string; initials: string }
interface Stats { completedRuns: number; totalGenerations: number; generationsUsed: number; generationsLimit: number; tier: string }
interface Props { user: User; generations: Generation[]; stats: Stats }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const diffHrs = (Date.now() - d.getTime()) / 3600000;
  if (diffHrs < 1) return "Just now";
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
  if (diffHrs < 48) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}

function getBrandName(gen: Generation): string {
  const p = gen.brandProfile as BrandProfile;
  return p?.productIntelligence?.productName || p?.meta?.brandName || extractDomain(gen.brandUrl);
}

function getPrimaryColor(gen: Generation): string {
  return (gen.brandProfile as BrandProfile)?.primaryColor || "#00d4aa";
}

const ARCHETYPES_EMOJI: Record<string, string> = {
  "The Innocent": "☀️", "The Sage": "🦉", "The Explorer": "🧭", "The Outlaw": "⚡",
  "The Magician": "✨", "The Hero": "🏆", "The Lover": "❤️", "The Jester": "🎭",
  "The Everyman": "🤝", "The Caregiver": "🌿", "The Ruler": "👑", "The Creator": "🎨",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SentimentBar({ score }: { score: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ display: "flex", gap: 3 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: "50%",
            background: i <= score ? "#00d4aa" : "rgba(255,255,255,0.1)",
            transition: "background 0.2s",
          }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{score}/5</span>
    </div>
  );
}

function Tag({ label, color = "rgba(255,255,255,0.06)" }: { label: string; color?: string }) {
  return (
    <span style={{
      fontSize: 11, color: "rgba(255,255,255,0.6)",
      background: color, border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 100, padding: "3px 10px", display: "inline-block",
    }}>{label}</span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
      {children}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12,
      padding: "18px 20px",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Brand Report Tab ─────────────────────────────────────────────────────────

function BrandReportTab({ profile }: { profile: BrandProfile }) {
  const pi = profile.productIntelligence;
  const archetype = profile.brandArchetype;
  const meta = profile.companyMetadata;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* One-liner */}
      {pi?.oneLiner && (
        <Card>
          <SectionLabel>Positioning Signal</SectionLabel>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, margin: 0 }}>
            {profile.positioningSignal || pi.oneLiner}
          </p>
        </Card>
      )}

      {/* Colors + Typography row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Colors */}
        <Card>
          <SectionLabel>Color Palette</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(profile.colorPalette || []).slice(0, 6).map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: c.hex, border: "1px solid rgba(255,255,255,0.08)",
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: 12, fontFamily: "monospace", color: "rgba(255,255,255,0.7)" }}>
                    {c.hex.toUpperCase()}
                  </div>
                  {i === 0 && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Primary</div>}
                  {i === 1 && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Accent</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Typography */}
        <Card>
          <SectionLabel>Typography</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {profile.typography?.headline?.fontFamily && (
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Heading</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
                  {profile.typography.headline.fontFamily}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                  {profile.typography.headline.fontWeight || "700"} · {profile.typography.headline.fontSize || "—"}
                </div>
              </div>
            )}
            {profile.typography?.body?.fontFamily && (
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Body</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                  {profile.typography.body.fontFamily}
                </div>
              </div>
            )}
            {profile.shapeLanguage?.classification && (
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Shape Language</div>
                <Tag label={profile.shapeLanguage.classification} />
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Tone + Archetype row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Tone */}
        <Card>
          <SectionLabel>Tone of Voice</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {profile.tone && (
              <>
                <div style={{ fontSize: 15, fontWeight: 500, color: "rgba(255,255,255,0.85)", marginBottom: 4 }}>
                  {profile.tone.summary}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Tag label={profile.tone.directness} />
                  <Tag label={profile.tone.formality} />
                  <Tag label={profile.tone.emotionality} />
                </div>
              </>
            )}
            {profile.brandPersonality && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Personality</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{profile.brandPersonality}</div>
              </div>
            )}
          </div>
        </Card>

        {/* Archetype */}
        <Card>
          <SectionLabel>Brand Archetype</SectionLabel>
          {archetype ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 28 }}>{ARCHETYPES_EMOJI[archetype.archetype] || "✦"}</span>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>{archetype.archetype}</div>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: 0 }}>
                {archetype.rationale}
              </p>
            </div>
          ) : (
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Not available</span>
          )}
        </Card>
      </div>

      {/* Product Intelligence */}
      {pi && (
        <Card>
          <SectionLabel>Product Intelligence</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {pi.targetCustomers && (
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Target Customer</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{pi.targetCustomers}</div>
              </div>
            )}
            {pi.pricing && (
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Pricing</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{pi.pricing}</div>
              </div>
            )}
            {(pi.businessModel || []).length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Business Model</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {pi.businessModel!.map((m, i) => <Tag key={i} label={m} />)}
                </div>
              </div>
            )}
            {(pi.keyFeatures || []).length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Key Features</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {pi.keyFeatures!.slice(0, 5).map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <span style={{ color: "#00d4aa", fontSize: 10, marginTop: 3 }}>▸</span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Company Metadata */}
      {meta && (meta.foundedYear || meta.employeeCount || meta.hqLocation || meta.fundingStage) && (
        <Card>
          <SectionLabel>Company</SectionLabel>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {meta.foundedYear && (
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>Founded</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{meta.foundedYear}</div>
              </div>
            )}
            {meta.employeeCount && (
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>Team Size</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{meta.employeeCount}</div>
              </div>
            )}
            {meta.hqLocation && (
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>HQ</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{meta.hqLocation}</div>
              </div>
            )}
            {meta.fundingStage && (
              <div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>Stage</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{meta.fundingStage}</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Statistics */}
      {(profile.statistics || []).length > 0 && (
        <Card>
          <SectionLabel>Key Statistics</SectionLabel>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {profile.statistics!.map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#00d4aa" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── AI Perception Tab ────────────────────────────────────────────────────────

function AiPerceptionTab({ perception, onRerun }: { perception?: AiPerception; onRerun?: () => void }) {
  if (!perception) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
          AI perception data not available for this report.
          <br />
          <span style={{ fontSize: 12, marginTop: 8, display: "block" }}>Re-run the analysis to include AI perception.</span>
        </div>
      </Card>
    );
  }

  const models = [
    { key: "openai" as const, label: "ChatGPT", icon: "⬡", color: "#10a37f" },
    { key: "anthropic" as const, label: "Claude", icon: "◈", color: "#d97706" },
    { key: "google" as const, label: "Gemini", icon: "◇", color: "#4285f4" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 4 }}>
        How three leading AI models perceive this brand based on their training data — a proxy for public brand equity and awareness.
      </div>
      {models.map(({ key, label, icon, color }) => {
        const entry = perception[key];
        // Detect fallback/error strings stored from failed API calls
        const UNAVAILABLE_STRINGS = [
          "Perception data unavailable",
          "Perception data unavailable for this company",
          "API key not configured",
          "No perception data available",
        ];
        // New schema: check dominantAssociations; legacy schema: check summary
        const hasNewSchema = Array.isArray(entry?.dominantAssociations) && entry.dominantAssociations.length > 0;
        const hasLegacySummary = !!entry?.summary && !UNAVAILABLE_STRINGS.some(s => entry.summary!.startsWith(s));
        const isUnavailable = !hasNewSchema && !hasLegacySummary;
        return (
          <Card key={key}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18, color }}>{icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{label}</span>
              </div>
              {!isUnavailable && <SentimentBar score={entry.sentimentScore} />}
              {!isUnavailable && entry.sentimentRationale && (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic", maxWidth: 280, textAlign: "right", lineHeight: 1.4 }}>{entry.sentimentRationale}</span>
              )}
            </div>
            {isUnavailable ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", lineHeight: 1.65, margin: 0, fontStyle: "italic", flex: 1 }}>
                  {label} was temporarily unavailable when this report was generated.
                </p>
                {onRerun && (
                  <button
                    onClick={onRerun}
                    style={{
                      flexShrink: 0,
                      fontSize: 12, fontWeight: 600,
                      color: "#00d4aa",
                      background: "rgba(0,212,170,0.08)",
                      border: "1px solid rgba(0,212,170,0.25)",
                      borderRadius: 6,
                      padding: "6px 12px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ↻ Re-run analysis
                  </button>
                )}
              </div>
            ) : hasNewSchema ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Dominant Associations */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Dominant Associations</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {entry.dominantAssociations!.map((tag, i) => (
                      <span key={i} style={{ fontSize: 12, fontWeight: 500, color: color, background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 4, padding: "3px 8px" }}>{tag}</span>
                    ))}
                  </div>
                </div>
                {/* Vocabulary Tells */}
                {entry.vocabularyTells && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Vocabulary Tells</div>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, margin: 0 }}>{entry.vocabularyTells}</p>
                  </div>
                )}
                {/* Positioning Delta */}
                {entry.positioningDelta && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Positioning Delta</div>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, margin: 0 }}>{entry.positioningDelta}</p>
                  </div>
                )}
                {/* Category Anchor */}
                {entry.categoryAnchor && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>Category Anchor</div>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6, margin: 0 }}>{entry.categoryAnchor}</p>
                  </div>
                )}
              </div>
            ) : (
              // Legacy: old DB rows with summary field
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.65, margin: 0, fontStyle: "italic" }}>
                {entry.summary || "Legacy result — re-run for updated analysis."}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─── Competitor Comparison Tab ────────────────────────────────────────────────

function ComparisonTab({ primaryProfile }: { primaryProfile: BrandProfile }) {
  const [competitorUrls, setCompetitorUrls] = useState<string[]>(["", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState("");

  const handleRunComparison = async () => {
    const validUrls = competitorUrls.filter(u => u.trim());
    if (validUrls.length === 0) return;
    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryUrl: primaryProfile.meta?.url,
          competitorUrls: validUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Comparison failed");
      setResult(data.comparison);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const fields = [
    { key: "archetype", label: "Archetype", render: (p: BrandProfile) => p.brandArchetype?.archetype || "—" },
    { key: "tone", label: "Tone", render: (p: BrandProfile) => p.tone?.summary || "—" },
    { key: "personality", label: "Personality", render: (p: BrandProfile) => p.brandPersonality || "—" },
    { key: "shape", label: "Shape Language", render: (p: BrandProfile) => p.shapeLanguage?.classification || "—" },
    { key: "space", label: "Spatial Philosophy", render: (p: BrandProfile) => p.spatialPhilosophy?.classification || "—" },
    { key: "type", label: "Product Type", render: (p: BrandProfile) => p.productIntelligence?.productType || "—" },
    { key: "model", label: "Business Model", render: (p: BrandProfile) => (p.productIntelligence?.businessModel || []).join(", ") || "—" },
    { key: "pricing", label: "Pricing", render: (p: BrandProfile) => p.productIntelligence?.pricing || "—" },
    { key: "cta", label: "Primary CTA", render: (p: BrandProfile) => p.productIntelligence?.primaryCTA || "—" },
    { key: "sentiment_openai", label: "GPT Sentiment", render: (p: BrandProfile) => p.aiPerception ? `${p.aiPerception.openai.sentimentScore}/5` : "—" },
    { key: "sentiment_claude", label: "Claude Sentiment", render: (p: BrandProfile) => p.aiPerception ? `${p.aiPerception.anthropic.sentimentScore}/5` : "—" },
    { key: "sentiment_gemini", label: "Gemini Sentiment", render: (p: BrandProfile) => p.aiPerception ? `${p.aiPerception.google.sentimentScore}/5` : "—" },
  ];

  const allProfiles = result ? [result.primary, ...result.competitors] : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Input */}
      <Card>
        <SectionLabel>Enter Competitor URLs</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {competitorUrls.map((url, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "8px 12px",
            }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", width: 16 }}>
                {i + 1}.
              </span>
              <input
                type="url"
                value={url}
                onChange={e => {
                  const next = [...competitorUrls];
                  next[i] = e.target.value;
                  setCompetitorUrls(next);
                }}
                placeholder={`competitor${i + 1}.com`}
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "monospace",
                }}
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleRunComparison}
          disabled={isLoading || !competitorUrls.some(u => u.trim())}
          style={{
            background: isLoading ? "rgba(0,212,170,0.15)" : "#00d4aa",
            color: isLoading ? "rgba(0,212,170,0.5)" : "#000",
            border: "none", borderRadius: 8, padding: "9px 20px",
            fontSize: 13, fontWeight: 600,
            cursor: isLoading ? "not-allowed" : "pointer",
            boxShadow: isLoading ? "none" : "0 0 16px rgba(0,212,170,0.3)",
          }}
        >
          {isLoading ? "Analyzing competitors..." : "Run comparison →"}
        </button>
        {error && (
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,100,100,0.8)" }}>{error}</div>
        )}
      </Card>

      {/* Results */}
      {result && allProfiles.length > 0 && (
        <>
          {/* Side-by-side grid */}
          <Card>
            <SectionLabel>Brand Comparison</SectionLabel>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "rgba(255,255,255,0.3)", fontWeight: 500, borderBottom: "1px solid rgba(255,255,255,0.06)", width: 140 }}>
                      Field
                    </th>
                    {allProfiles.map((p, i) => (
                      <th key={i} style={{
                        textAlign: "left", padding: "8px 12px",
                        color: i === 0 ? "#00d4aa" : "rgba(255,255,255,0.7)",
                        fontWeight: 600,
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}>
                        {p.productIntelligence?.productName || p.meta?.brandName || extractDomain(p.meta?.url || "")}
                        {i === 0 && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.6 }}>YOU</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fields.map(({ key, label, render }) => (
                    <tr key={key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "8px 12px", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>{label}</td>
                      {allProfiles.map((p, i) => (
                        <td key={i} style={{
                          padding: "8px 12px",
                          color: i === 0 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.55)",
                        }}>
                          {render(p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* USP Statements */}
          {Object.keys(result.uspStatements).length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                Why You Win
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {result.competitors.map((competitor, i) => {
                  const domain = (() => {
                    try { return new URL(competitor.meta?.url || "").hostname.replace(/^www\./, ""); } catch { return ""; }
                  })();
                  const usp = result.uspStatements[domain];
                  if (!usp) return null;
                  return (
                    <Card key={i} style={{ borderLeft: "3px solid #00d4aa" }}>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                        vs. {competitor.productIntelligence?.productName || domain}
                      </div>
                      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.65, margin: 0 }}>
                        {usp}
                      </p>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── New Analysis Panel ───────────────────────────────────────────────────────

// ─── Upgrade Gate ────────────────────────────────────────────────────────────

function UpgradeGate({ feature }: { feature: string }) {
  return (
    <Card style={{ textAlign: "center", padding: "48px 24px" }}>
      <div style={{ fontSize: 28, marginBottom: 16 }}>🔒</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>
        {feature} is a paid feature
      </div>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, margin: "0 0 20px" }}>
        Your first analysis includes the full report. Upgrade to Starter to unlock {feature} on every analysis.
      </p>
      <a
        href="/#pricing"
        style={{
          display: "inline-block",
          background: "#00d4aa", color: "#000",
          fontSize: 13, fontWeight: 600,
          padding: "10px 24px", borderRadius: 8,
          textDecoration: "none",
        }}
      >
        View plans →
      </a>
    </Card>
  );
}

function NewAnalysisPanel({ onComplete, runsUsed, runsLimit, tier }: { onComplete: (generationId: string, profile: BrandProfile, accessTier: string) => void; runsUsed: number; runsLimit: number; tier: string }) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setError("");
    setStatusMsg("Starting analysis...");

    const normalized = url.startsWith("http") ? url : `https://${url}`;

    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: normalized }),
    });

    if (!res.ok || !res.body) {
      // Handle upgrade_required (402)
      if (res.status === 402) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || "You've used all your free analyses. Upgrade to continue.");
        setIsLoading(false);
        return;
      }
      setError("Failed to start analysis.");
      setIsLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const processChunk = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "status") setStatusMsg(event.message);
            if (event.type === "complete") {
              setIsLoading(false);
              setUrl("");
              onComplete(event.generationId, event.brandProfile, event.accessTier || "full");
              return;
            }
            if (event.type === "error") {
              setError(event.message);
              setIsLoading(false);
              return;
            }
          } catch {}
        }
      }
      setIsLoading(false);
    };

    processChunk().catch(err => {
      setError((err as Error).message);
      setIsLoading(false);
    });
  };

  return (
    <div style={{
      background: "rgba(0,212,170,0.04)",
      border: "1px solid rgba(0,212,170,0.15)",
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 20,
    }}>
      {/* Usage indicator */}
      {tier === "free" && (
        <div style={{ marginBottom: 12, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>FREE TIER</span>
            <span style={{ fontSize: 10, color: runsUsed >= runsLimit ? "rgba(255,100,100,0.7)" : "rgba(255,255,255,0.3)" }}>
              {runsUsed}/{runsLimit} analyses used
            </span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
            <div style={{
              height: "100%",
              width: `${Math.min(100, (runsUsed / runsLimit) * 100)}%`,
              background: runsUsed >= runsLimit ? "rgba(255,100,100,0.6)" : "#00d4aa",
              borderRadius: 2,
              transition: "width 0.3s",
            }} />
          </div>
          {runsUsed >= runsLimit && (
            <div style={{ marginTop: 6, fontSize: 10, color: "rgba(255,100,100,0.7)" }}>
              Upgrade to continue analyzing →
            </div>
          )}
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(0,212,170,0.7)", marginBottom: 10, letterSpacing: "0.04em" }}>
        NEW ANALYSIS
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8, padding: "8px 12px", marginBottom: 8,
      }}>
        <span style={{ color: "rgba(0,212,170,0.6)", fontSize: 14, flexShrink: 0 }}>⊕</span>
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAnalyze()}
          placeholder="Enter any company URL..."
          disabled={isLoading}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "monospace",
            minWidth: 0,
          }}
        />
      </div>
      <button
        onClick={handleAnalyze}
        disabled={!url.trim() || isLoading}
        style={{
          width: "100%",
          background: !url.trim() || isLoading ? "rgba(0,212,170,0.15)" : "#00d4aa",
          color: !url.trim() || isLoading ? "rgba(0,212,170,0.5)" : "#000",
          border: "none", borderRadius: 8, padding: "10px 16px",
          fontSize: 12, fontWeight: 600,
          cursor: !url.trim() || isLoading ? "not-allowed" : "pointer",
        }}
      >
        {isLoading ? "Analyzing..." : "Analyze →"}
      </button>
      {isLoading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <div style={{
            width: 12, height: 12, borderRadius: "50%",
            border: "2px solid rgba(0,212,170,0.2)", borderTopColor: "#00d4aa",
            animation: "spin 0.8s linear infinite",
          }} />
          <span style={{ fontSize: 12, color: "rgba(0,212,170,0.7)", fontFamily: "monospace" }}>{statusMsg}</span>
        </div>
      )}
      {error && <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,100,100,0.8)" }}>{error}</div>}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const ADMIN_EMAILS = ["tyler@yanaapp.com"];

export default function DashboardClient({ user, generations: initialGenerations, stats }: Props) {
  const [generations, setGenerations] = useState(initialGenerations);
  const [selectedId, setSelectedId] = useState<string | null>(initialGenerations[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<"report" | "perception" | "comparison">("report");
  const [runsUsed, setRunsUsed] = useState(stats.generationsUsed);
  const isAdmin = ADMIN_EMAILS.includes((user.email ?? "").toLowerCase());

  const selectedGen = generations.find(g => g.id === selectedId);
  const selectedProfile = selectedGen?.brandProfile as BrandProfile | undefined;
  // Determine if the selected report has full AI perception data
  const selectedHasPerception = !!(selectedProfile?.aiPerception &&
    selectedProfile.aiPerception.openai?.summary &&
    selectedProfile.aiPerception.anthropic?.summary);

  // Re-run the analysis for the currently selected generation's URL
  const handleRerun = async () => {
    const url = selectedGen?.brandUrl;
    if (!url) return;
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok || !res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const processChunk = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "complete") {
              handleNewAnalysis(event.generationId, event.brandProfile, event.accessTier || "full");
              return;
            }
          } catch {}
        }
      }
    };
    processChunk().catch(() => {});
  };

  const handleNewAnalysis = (generationId: string, profile: BrandProfile, accessTier: string) => {
    const newGen: Generation = {
      id: generationId,
      brandUrl: profile.meta?.url || "",
      status: "complete",
      createdAt: new Date().toISOString(),
      brandProfile: profile as unknown as Record<string, unknown>,
      errorMessage: null,
    };
    setGenerations(prev => [newGen, ...prev]);
    setSelectedId(generationId);
    setRunsUsed(prev => prev + 1);
    // For full access runs, go to perception tab to show off the feature
    setActiveTab(accessTier === "full" ? "perception" : "report");
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid var(--border-subtle)",
        background: "rgba(8,8,8,0.9)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Image src="/orb-logo.png" alt="Orb" width={90} height={40} style={{ display: "block" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{user.email}</div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Body */}
      <div style={{ flex: 1, maxWidth: 1280, margin: "0 auto", width: "100%", padding: "24px", display: "grid", gridTemplateColumns: "260px 1fr", gap: 20 }}>
        {/* Sidebar */}
        <div>
          <NewAnalysisPanel
            onComplete={handleNewAnalysis}
            runsUsed={runsUsed}
            runsLimit={stats.generationsLimit}
            tier={isAdmin ? "admin" : stats.tier}
          />

          {/* History */}
          <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
            Analysis History
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {generations.length === 0 && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", padding: "12px 0" }}>
                No analyses yet. Enter a URL above to get started.
              </div>
            )}
            {generations.map(gen => {
              const isSelected = gen.id === selectedId;
              const primaryColor = getPrimaryColor(gen);
              return (
                <button
                  key={gen.id}
                  onClick={() => { setSelectedId(gen.id); setActiveTab("report"); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px",
                    background: isSelected ? "rgba(0,212,170,0.08)" : "transparent",
                    border: isSelected ? "1px solid rgba(0,212,170,0.2)" : "1px solid transparent",
                    borderRadius: 8, cursor: "pointer", textAlign: "left", width: "100%",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                    background: `${primaryColor}22`,
                    border: `1px solid ${primaryColor}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: primaryColor,
                  }}>
                    {getBrandName(gen).slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: isSelected ? "#fff" : "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {getBrandName(gen)}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                      {formatDate(gen.createdAt)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <div>
          {!selectedProfile ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, color: "rgba(255,255,255,0.25)", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⊕</div>
              <div style={{ fontSize: 14 }}>Enter a brand URL to get started</div>
            </div>
          ) : (
            <>
              {/* Brand header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 14, marginBottom: 20,
                padding: "16px 20px",
                background: `linear-gradient(135deg, ${selectedProfile.primaryColor || "#00d4aa"}12 0%, transparent 60%)`,
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
              }}>
                {selectedProfile.brandAssets?.favicon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedProfile.brandAssets.favicon}
                    alt=""
                    width={36}
                    height={36}
                    style={{ borderRadius: 8, objectFit: "contain" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                    {selectedProfile.productIntelligence?.productName || selectedProfile.meta?.brandName}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                    {selectedProfile.industryContext} · {extractDomain(selectedProfile.meta?.url || "")}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                  {selectedProfile.meta?.extractedAt ? formatDate(selectedProfile.meta.extractedAt) : ""}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 0 }}>
                {(["report", "perception", "comparison"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: "8px 16px",
                      fontSize: 13, fontWeight: 500,
                      color: activeTab === tab ? "#00d4aa" : "rgba(255,255,255,0.4)",
                      background: "none", border: "none",
                      borderBottom: activeTab === tab ? "2px solid #00d4aa" : "2px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      marginBottom: -1,
                    }}
                  >
                    {tab === "report" ? "Brand Report" : tab === "perception" ? "AI Perception" : "Competitor Comparison"}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === "report" && <BrandReportTab profile={selectedProfile} />}
              {activeTab === "perception" && (
                selectedHasPerception
                  ? <AiPerceptionTab perception={selectedProfile!.aiPerception} onRerun={handleRerun} />
                  : isAdmin ? <AiPerceptionTab perception={selectedProfile?.aiPerception} onRerun={handleRerun} /> : <UpgradeGate feature="AI Perception" />
              )}
              {activeTab === "comparison" && (
                selectedHasPerception
                  ? <ComparisonTab primaryProfile={selectedProfile!} />
                  : isAdmin ? <ComparisonTab primaryProfile={selectedProfile!} /> : <UpgradeGate feature="Competitor Comparison" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
