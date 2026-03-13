"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageResult {
  schemaId: string;
  schemaName: string;
  size: string;
  url: string;
}

interface Generation {
  id: string;
  brandUrl: string;
  status: string;
  createdAt: string;
  images: ImageResult[];
  brandProfile: Record<string, unknown>;
  errorMessage: string | null;
}

interface Stats {
  totalImages: number;
  completedRuns: number;
  totalGenerations: number;
  generationsUsed: number;
  generationsLimit: number;
}

interface User {
  name: string;
  email: string;
  initials: string;
}

interface Props {
  user: User;
  generations: Generation[];
  stats: Stats;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);
  if (diffHrs < 1) return "Just now";
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
  if (diffHrs < 48) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getBrandName(gen: Generation): string {
  const profile = gen.brandProfile;
  const meta = profile?.meta as Record<string, unknown> | undefined;
  return (meta?.brandName as string) || extractDomain(gen.brandUrl);
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function getBrandInitials(gen: Generation): string {
  const name = getBrandName(gen);
  return name
    .split(/[\s.-]/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getPrimaryColor(gen: Generation): string {
  return (gen.brandProfile?.primaryColor as string) || "#00d4aa";
}

function getStatusColor(status: string): string {
  switch (status) {
    case "complete": return "var(--success)";
    case "processing": return "var(--brand-primary)";
    case "failed": return "var(--error)";
    default: return "var(--text-tertiary)";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "complete": return "Complete";
    case "processing": return "Processing";
    case "failed": return "Failed";
    default: return "Pending";
  }
}

// ─── New Generation Modal ─────────────────────────────────────────────────────

function NewGenerationModal({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: (generationId: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"input" | "extracting" | "done">("input");
  const [events, setEvents] = useState<Array<{ type: string; message?: string; hex?: string; family?: string; role?: string }>>([]);
  const [error, setError] = useState("");
  const [generationId, setGenerationId] = useState("");
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setPhase("extracting");
    setEvents([]);
    setError("");

    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Extraction failed");
        setPhase("input");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "error") {
              setError(event.message);
              setPhase("input");
              return;
            }
            if (event.type === "complete") {
              setGenerationId(event.generationId);
              setPhase("done");
              return;
            }
            setEvents((prev) => [...prev, event]);
          } catch {}
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setPhase("input");
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-xl)", width: "100%", maxWidth: 520,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px", borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
              New generation
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "3px 0 0" }}>
              Paste your website URL to extract brand identity
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", fontSize: 18, padding: 4, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          {phase === "input" && (
            <form onSubmit={handleExtract} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Website URL
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourcompany.com"
                  autoFocus
                  style={{
                    width: "100%", background: "var(--bg-base)",
                    border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)",
                    padding: "10px 14px", fontSize: 14, color: "var(--text-primary)",
                    outline: "none", fontFamily: "inherit",
                  }}
                />
                <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
                  Orb will extract colors, typography, tone, and brand identity.
                </p>
              </div>
              {error && (
                <div style={{
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 12, color: "#f87171",
                }}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={!url.trim()}
                style={{
                  background: !url.trim() ? "var(--bg-overlay)" : "var(--brand-primary)",
                  color: !url.trim() ? "var(--text-tertiary)" : "#000",
                  border: "none", borderRadius: "var(--radius-md)", padding: "11px",
                  fontSize: 14, fontWeight: 700, cursor: !url.trim() ? "not-allowed" : "pointer",
                  boxShadow: !url.trim() ? "none" : "0 0 20px var(--brand-glow)",
                  transition: "all 0.15s", fontFamily: "inherit",
                }}
              >
                Extract brand identity →
              </button>
            </form>
          )}

          {phase === "extracting" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", background: "var(--brand-primary)",
                  boxShadow: "0 0 8px var(--brand-primary)",
                  animation: "pulse-glow 1.5s infinite",
                }} />
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Extracting brand from {extractDomain(url)}...
                </span>
              </div>
              <div style={{
                background: "var(--bg-base)", border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)", padding: 16, maxHeight: 200, overflowY: "auto",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                {events.map((ev, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    {ev.type === "status" && (
                      <>
                        <span style={{ color: "var(--brand-primary)", opacity: 0.7 }}>◎</span>
                        <span style={{ color: "var(--text-secondary)" }}>{ev.message}</span>
                      </>
                    )}
                    {ev.type === "color" && ev.hex && (
                      <>
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: ev.hex, flexShrink: 0 }} />
                        <span style={{ color: "var(--text-tertiary)" }}>Color extracted: {ev.hex}</span>
                      </>
                    )}
                    {ev.type === "font" && (
                      <>
                        <span style={{ color: "var(--brand-primary)", opacity: 0.5 }}>T</span>
                        <span style={{ color: "var(--text-tertiary)" }}>Font: {ev.family} ({ev.role})</span>
                      </>
                    )}
                    {ev.type === "tone" && (
                      <>
                        <span style={{ color: "var(--brand-primary)", opacity: 0.5 }}>~</span>
                        <span style={{ color: "var(--text-tertiary)" }}>Tone: {(ev as { summary?: string }).summary}</span>
                      </>
                    )}
                    {ev.type === "photo" && (
                      <>
                        <span style={{ color: "var(--brand-primary)", opacity: 0.5 }}>⬡</span>
                        <span style={{ color: "var(--text-tertiary)" }}>Photography: {(ev as { style?: string }).style}</span>
                      </>
                    )}
                  </div>
                ))}
                <div ref={eventsEndRef} />
              </div>
            </div>
          )}

          {phase === "done" && (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>◎</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                Brand extracted
              </h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                Ready to generate content. Click below to start.
              </p>
              <button
                onClick={() => onComplete(generationId)}
                style={{
                  background: "var(--brand-primary)", color: "#000",
                  border: "none", borderRadius: "var(--radius-md)", padding: "11px 24px",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 0 20px var(--brand-glow)", fontFamily: "inherit",
                }}
              >
                Generate content →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Generation Card ──────────────────────────────────────────────────────────

function GenerationCard({
  gen,
  isSelected,
  onSelect,
}: {
  gen: Generation;
  isSelected: boolean;
  onSelect: (gen: Generation) => void;
}) {
  const brandName = getBrandName(gen);
  const initials = getBrandInitials(gen);
  const primaryColor = getPrimaryColor(gen);
  const imageCount = gen.images.length;

  return (
    <div
      onClick={() => onSelect(gen)}
      style={{
        background: isSelected ? "var(--bg-elevated)" : "var(--bg-surface)",
        border: `1px solid ${isSelected ? "var(--border-default)" : "var(--border-subtle)"}`,
        borderRadius: "var(--radius-lg)", padding: "14px 16px",
        cursor: "pointer", transition: "all 0.15s",
        display: "flex", alignItems: "center", gap: 12,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-default)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-subtle)";
      }}
    >
      {/* Brand avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: "var(--radius-md)", flexShrink: 0,
        background: `${primaryColor}22`, border: `1px solid ${primaryColor}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: primaryColor, letterSpacing: "0.04em",
      }}>
        {initials}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {brandName}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
          <span>{extractDomain(gen.brandUrl)}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{formatDate(gen.createdAt)}</span>
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
          color: getStatusColor(gen.status),
          padding: "2px 7px", borderRadius: 4,
          background: `${getStatusColor(gen.status)}15`,
        }}>
          {getStatusLabel(gen.status)}
        </div>
        {imageCount > 0 && (
          <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
            {imageCount} image{imageCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Right Panel ──────────────────────────────────────────────────────────────

function RightPanel({
  generation,
  onGenerate,
  isGenerating,
  generationEvents,
}: {
  generation: Generation | null;
  onGenerate: (generationId: string) => void;
  isGenerating: boolean;
  generationEvents: Array<{ type: string; message?: string; schemaId?: string; schemaName?: string; url?: string; size?: string }>;
}) {
  if (!generation) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 28, opacity: 0.2, marginBottom: 10 }}>◎</div>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Select a generation to view details</p>
      </div>
    );
  }

  const profile = generation.brandProfile;
  const palette = (profile?.colorPalette as Array<{ hex: string }>) || [];
  const tone = profile?.tone as Record<string, string> | undefined;
  const typo = profile?.typography as Record<string, Record<string, string>> | undefined;
  const stats = (profile?.statistics as Array<{ value: string; label: string }>) || [];
  const testimonials = (profile?.testimonials as Array<{ quote: string; author: string }>) || [];
  const primaryColor = generation.brandProfile?.primaryColor as string | undefined;

  // Group images by schema
  const bySchema: Record<string, ImageResult[]> = {};
  for (const img of generation.images) {
    if (!bySchema[img.schemaId]) bySchema[img.schemaId] = [];
    bySchema[img.schemaId].push(img);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Panel header */}
      <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 7 }}>
          {isGenerating && (
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--brand-primary)", boxShadow: "0 0 5px var(--brand-primary)", animation: "pulse-glow 1.5s infinite" }} />
          )}
          Brand Intel
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginTop: 4, letterSpacing: "-0.01em" }}>
          {getBrandName(generation)}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
          {extractDomain(generation.brandUrl)}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

        {/* Generate button (if pending) */}
        {generation.status === "pending" && !isGenerating && (
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => onGenerate(generation.id)}
              style={{
                width: "100%", background: "var(--brand-primary)", color: "#000",
                border: "none", borderRadius: "var(--radius-md)", padding: "10px",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 0 16px var(--brand-glow)", fontFamily: "inherit",
              }}
            >
              Generate content →
            </button>
          </div>
        )}

        {/* Generation progress */}
        {isGenerating && (
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 10 }}>
              Generating
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {generationEvents.slice(-6).map((ev, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                  {ev.type === "status" && <><span style={{ color: "var(--brand-primary)", opacity: 0.6 }}>◎</span><span>{ev.message}</span></>}
                  {ev.type === "schema" && <><span style={{ color: "var(--brand-primary)" }}>✦</span><span>Schema: {ev.schemaName}</span></>}
                  {ev.type === "image" && <><span style={{ color: "var(--success)" }}>✓</span><span>{ev.schemaName} · {ev.size}</span></>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Images grid */}
        {generation.images.length > 0 && (
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 10 }}>
              Generated Images
            </div>
            {Object.entries(bySchema).map(([schemaId, imgs]) => (
              <div key={schemaId} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 6, fontWeight: 600 }}>
                  {imgs[0].schemaName}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {imgs.map((img) => (
                    <a
                      key={`${img.schemaId}-${img.size}`}
                      href={img.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ position: "relative", display: "block" }}
                    >
                      <div style={{
                        width: 56, height: 56, borderRadius: 7,
                        background: "var(--bg-overlay)", border: "1px solid var(--border-subtle)",
                        overflow: "hidden", cursor: "pointer",
                        transition: "border-color 0.15s",
                      }}>
                        <img
                          src={img.url}
                          alt={`${img.schemaName} ${img.size}`}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                      <div style={{
                        position: "absolute", bottom: 3, right: 3,
                        background: "rgba(0,0,0,0.75)", borderRadius: 3,
                        padding: "1px 4px", fontSize: 7, fontWeight: 700,
                        color: "rgba(255,255,255,0.55)", letterSpacing: "0.04em",
                      }}>
                        {img.size.toUpperCase().slice(0, 2)}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Color palette */}
        {palette.length > 0 && (
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8 }}>
              Color Palette
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {palette.slice(0, 8).map((c, i) => (
                <div
                  key={i}
                  title={c.hex}
                  style={{ width: 28, height: 28, borderRadius: 7, background: c.hex, border: "1px solid rgba(255,255,255,0.08)", cursor: "default" }}
                />
              ))}
            </div>
            {primaryColor && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
                Primary: <span style={{ color: primaryColor, fontWeight: 600 }}>{primaryColor}</span>
              </div>
            )}
          </div>
        )}

        {/* Tone */}
        {tone && (
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8 }}>
              Brand Tone
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
              {tone.summary}
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {[tone.directness, tone.formality, tone.emotionality].filter(Boolean).map((tag, i) => (
                <span key={i} style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
                  color: "var(--text-secondary)", background: "var(--bg-overlay)",
                  border: "1px solid var(--border-subtle)", borderRadius: 4,
                  padding: "2px 7px", textTransform: "capitalize",
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Typography */}
        {typo?.headline?.fontFamily && (
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8 }}>
              Typography
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              <span style={{ color: "var(--text-tertiary)" }}>Headline: </span>
              {typo.headline.fontFamily}
            </div>
            {typo.body?.fontFamily && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                <span style={{ color: "var(--text-tertiary)" }}>Body: </span>
                {typo.body.fontFamily}
              </div>
            )}
          </div>
        )}

        {/* Statistics */}
        {stats.length > 0 && (
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8 }}>
              Key Statistics
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {stats.slice(0, 3).map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "var(--brand-primary)", letterSpacing: "-0.02em" }}>
                    {s.value}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Testimonials */}
        {testimonials.length > 0 && (
          <div style={{ padding: "14px 18px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8 }}>
              Testimonials
            </div>
            {testimonials.slice(0, 2).map((t, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 4px", fontStyle: "italic" }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                {t.author && (
                  <p style={{ fontSize: 10, color: "var(--text-tertiary)", margin: 0 }}>— {t.author}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardClient({ user, generations: initialGenerations, stats }: Props) {
  const router = useRouter();
  const [generations, setGenerations] = useState<Generation[]>(initialGenerations);
  const [selectedGen, setSelectedGen] = useState<Generation | null>(
    initialGenerations.length > 0 ? initialGenerations[0] : null
  );
  const [showNewModal, setShowNewModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [generationEvents, setGenerationEvents] = useState<Array<{
    type: string; message?: string; schemaId?: string; schemaName?: string; url?: string; size?: string;
  }>>([]);

  async function handleGenerate(generationId: string) {
    setIsGenerating(true);
    setGenerationEvents([]);

    // Update the selected gen to processing
    setGenerations((prev) =>
      prev.map((g) => g.id === generationId ? { ...g, status: "processing" } : g)
    );
    setSelectedGen((prev) =>
      prev?.id === generationId ? { ...prev, status: "processing" } : prev
    );

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId }),
      });

      if (!res.ok) {
        const err = await res.json();
        setGenerations((prev) =>
          prev.map((g) => g.id === generationId ? { ...g, status: "failed", errorMessage: err.error } : g)
        );
        setIsGenerating(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            setGenerationEvents((prev) => [...prev, event]);

            if (event.type === "image") {
              const imgResult: ImageResult = {
                schemaId: event.schemaId,
                schemaName: event.schemaName,
                size: event.size,
                url: event.url,
              };
              setGenerations((prev) =>
                prev.map((g) =>
                  g.id === generationId
                    ? { ...g, images: [...g.images, imgResult] }
                    : g
                )
              );
              setSelectedGen((prev) =>
                prev?.id === generationId
                  ? { ...prev, images: [...prev.images, imgResult] }
                  : prev
              );
            }

            if (event.type === "complete") {
              setGenerations((prev) =>
                prev.map((g) =>
                  g.id === generationId ? { ...g, status: "complete", images: event.images } : g
                )
              );
              setSelectedGen((prev) =>
                prev?.id === generationId
                  ? { ...prev, status: "complete", images: event.images }
                  : prev
              );
              setIsGenerating(false);
            }

            if (event.type === "error") {
              setGenerations((prev) =>
                prev.map((g) =>
                  g.id === generationId ? { ...g, status: "failed", errorMessage: event.message } : g
                )
              );
              setSelectedGen((prev) =>
                prev?.id === generationId
                  ? { ...prev, status: "failed", errorMessage: event.message }
                  : prev
              );
              setIsGenerating(false);
            }
          } catch {}
        }
      }
    } catch {
      setIsGenerating(false);
    }
  }

  function handleExtractionComplete(generationId: string) {
    setShowNewModal(false);
    // Refresh to get the new generation row
    router.refresh();
    // Start generation immediately
    setTimeout(() => {
      handleGenerate(generationId);
    }, 500);
  }

  const usagePercent = Math.min(100, (stats.generationsUsed / stats.generationsLimit) * 100);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-base)" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <nav style={{
        width: 56, height: "100vh", background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "16px 0", gap: 4, flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
          <div style={{
            width: 22, height: 22, borderRadius: "50%",
            background: "var(--brand-primary)",
            boxShadow: "0 0 12px var(--brand-glow)",
            position: "relative",
          }}>
            <div style={{
              position: "absolute", inset: 4, background: "var(--bg-base)", borderRadius: "50%",
            }} />
          </div>
        </div>

        {/* Nav items */}
        {[
          { icon: "⊞", label: "Dashboard", active: true },
          { icon: "✦", label: "Generate", href: "/generate" },
        ].map((item) => (
          <a
            key={item.label}
            href={item.href || "/dashboard"}
            title={item.label}
            style={{
              width: 36, height: 36, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", textDecoration: "none",
              background: item.active ? "var(--brand-subtle)" : "transparent",
              color: item.active ? "var(--brand-primary)" : "var(--text-tertiary)",
              border: item.active ? "1px solid rgba(0,212,170,0.2)" : "1px solid transparent",
              fontSize: 14, transition: "all 0.15s",
            }}
          >
            {item.icon}
          </a>
        ))}

        <div style={{ flex: 1 }} />

        {/* User avatar + dropdown */}
        <div style={{ position: "relative" }}>
          <div
            onClick={() => setShowUserMenu((v) => !v)}
            title={user.email}
            style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--brand-primary), rgba(0,212,170,0.4))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: "#000", cursor: "pointer",
              letterSpacing: "0.02em",
            }}
          >
            {user.initials}
          </div>
          {showUserMenu && (
            <div
              style={{
                position: "absolute", bottom: 40, left: 0,
                background: "var(--surface-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 8, padding: "4px 0", minWidth: 180,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                zIndex: 100,
              }}
            >
              <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-subtle)", marginBottom: 4 }}>
                {user.email}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "8px 12px", fontSize: 12, color: "var(--text-secondary)",
                  background: "none", border: "none", cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ── Main panel ──────────────────────────────────────────────────── */}
      <main style={{ flex: 1, height: "100vh", overflowY: "auto", display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Topbar */}
        <div style={{
          height: 52, padding: "0 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(8,8,8,0.9)", backdropFilter: "blur(12px)",
          position: "sticky", top: 0, zIndex: 9, flexShrink: 0,
        }}>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>Home</span>
            <span style={{ opacity: 0.3 }}>›</span>
            <span style={{ color: "var(--text-secondary)" }}>Dashboard</span>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "var(--brand-primary)", color: "#000", border: "none",
              borderRadius: 8, padding: "7px 14px",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", letterSpacing: "0.01em",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px var(--brand-glow)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
            }}
          >
            <span style={{ fontSize: 11 }}>+</span>
            New generation
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>

          {/* Page header */}
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
              Content Overview
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
              All generations · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[
              {
                label: "Total Images", value: stats.totalImages, unit: "images",
                featured: true, delta: null,
              },
              {
                label: "Generation Runs", value: stats.completedRuns, unit: "runs",
                featured: false, delta: null,
              },
              {
                label: "Generations Used", value: stats.generationsUsed, unit: `/ ${stats.generationsLimit}`,
                featured: false, delta: null,
              },
              {
                label: "Total Brands", value: stats.totalGenerations, unit: "brands",
                featured: false, delta: null,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: stat.featured ? "var(--brand-subtle)" : "var(--bg-surface)",
                  border: `1px solid ${stat.featured ? "rgba(0,212,170,0.2)" : "var(--border-subtle)"}`,
                  borderRadius: "var(--radius-lg)", padding: "14px 16px",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: stat.featured ? "var(--brand-primary)" : "var(--text-tertiary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                  {stat.featured && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--brand-primary)" }} />}
                  {stat.label}
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {stat.value}
                  <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 4 }}>{stat.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Usage bar */}
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)", padding: "14px 18px",
            display: "flex", alignItems: "center", gap: 16,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>Generation quota</span>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  {stats.generationsUsed} / {stats.generationsLimit} used
                </span>
              </div>
              <div style={{ height: 4, background: "var(--bg-overlay)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  background: usagePercent >= 90 ? "var(--error)" : "var(--brand-primary)",
                  width: `${usagePercent}%`,
                  transition: "width 0.8s ease",
                }} />
              </div>
            </div>
          </div>

          {/* Generations list */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em", margin: 0 }}>
                Recent Generations
              </h2>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {generations.length} total
              </span>
            </div>

            {generations.length === 0 ? (
              <div style={{
                background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)", padding: "48px 24px", textAlign: "center",
              }}>
                <div style={{ fontSize: 28, opacity: 0.2, marginBottom: 10 }}>◎</div>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>No generations yet</p>
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 16 }}>
                  Start by generating content from your brand URL.
                </p>
                <button
                  onClick={() => setShowNewModal(true)}
                  style={{
                    background: "var(--brand-primary)", color: "#000", border: "none",
                    borderRadius: "var(--radius-md)", padding: "9px 18px",
                    fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  New generation →
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {generations.map((gen) => (
                  <GenerationCard
                    key={gen.id}
                    gen={gen}
                    isSelected={selectedGen?.id === gen.id}
                    onSelect={(g) => setSelectedGen(g)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Right panel ─────────────────────────────────────────────────── */}
      <aside style={{
        width: 260, height: "100vh", background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-subtle)",
        display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden",
      }}>
        <RightPanel
          generation={selectedGen}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          generationEvents={generationEvents}
        />
      </aside>

      {/* ── New generation modal ─────────────────────────────────────────── */}
      {showNewModal && (
        <NewGenerationModal
          onClose={() => setShowNewModal(false)}
          onComplete={handleExtractionComplete}
        />
      )}
    </div>
  );
}
