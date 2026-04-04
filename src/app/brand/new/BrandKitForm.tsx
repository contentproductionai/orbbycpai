"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";

// ── Design tokens (light theme) ──────────────────────────────────────────────
const T = {
  bg: "#FAF8F4",
  surface: "#FFFFFF",
  elevated: "#F5F2EC",
  border: "rgba(0,0,0,0.09)",
  borderStrong: "rgba(0,0,0,0.16)",
  text: "#111111",
  textSub: "#555555",
  textMuted: "#999999",
  teal: "#00e5a0",
  tealDark: "#00b87a",
  tealSubtle: "rgba(0,229,160,0.10)",
  tealBorder: "rgba(0,229,160,0.30)",
  pink: "#ff01c7",
  yellow: "#e1ff00",
  radius: 12,
  radiusSm: 8,
  radiusLg: 16,
};

// ── Shared input style ────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  fontSize: 14,
  color: T.text,
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: T.radiusSm,
  outline: "none",
  fontFamily: "Inter, system-ui, sans-serif",
  transition: "border-color 0.15s",
};

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, subtitle, required, children }: {
  title: string;
  subtitle?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text, letterSpacing: "-0.01em" }}>{title}</span>
          {required && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: T.tealDark,
              background: T.tealSubtle, border: `1px solid ${T.tealBorder}`,
              borderRadius: 100, padding: "1px 8px", letterSpacing: "0.04em", textTransform: "uppercase",
            }}>Required</span>
          )}
        </div>
        {subtitle && <p style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Color swatch picker ───────────────────────────────────────────────────────
function ColorField({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* Swatch */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: 40, height: 40,
          borderRadius: T.radiusSm,
          background: value || "#E0DDD6",
          border: `1px solid ${T.border}`,
          cursor: "pointer",
          overflow: "hidden",
        }}>
          <input
            type="color"
            value={value || "#000000"}
            onChange={e => onChange(e.target.value)}
            style={{ opacity: 0, position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "pointer", border: "none" }}
          />
        </div>
      </div>
      {/* Hex input */}
      <div style={{ flex: 1 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: T.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || "#000000"}
          style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13 }}
          maxLength={7}
        />
      </div>
    </div>
  );
}

// ── File upload field ─────────────────────────────────────────────────────────
function FileUploadField({ label, hint, accept, value, onChange }: {
  label: string;
  hint: string;
  accept: string;
  value: File | null;
  onChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onChange(file);
  };

  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: T.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `1.5px dashed ${dragOver ? T.teal : T.border}`,
          borderRadius: T.radius,
          padding: "24px 20px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? T.tealSubtle : T.elevated,
          transition: "all 0.15s",
        }}
      >
        {value ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            {value.type.startsWith("image/") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={URL.createObjectURL(value)}
                alt="preview"
                style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 6, border: `1px solid ${T.border}` }}
              />
            )}
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{value.name}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>{(value.size / 1024).toFixed(0)} KB · Click to replace</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 22, marginBottom: 8 }}>↑</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.textSub, marginBottom: 4 }}>Drop file or click to upload</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>{hint}</div>
          </>
        )}
        <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} onChange={e => onChange(e.target.files?.[0] || null)} />
      </div>
    </div>
  );
}

// ── Stat pill row ─────────────────────────────────────────────────────────────
function StatRow({ stats, onChange }: { stats: string[]; onChange: (s: string[]) => void }) {
  const add = () => onChange([...stats, ""]);
  const update = (i: number, v: string) => { const s = [...stats]; s[i] = v; onChange(s); };
  const remove = (i: number) => onChange(stats.filter((_, idx) => idx !== i));

  return (
    <div>
      {stats.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            value={s}
            onChange={e => update(i, e.target.value)}
            placeholder={i === 0 ? "e.g. 5× more effective" : i === 1 ? "e.g. 60+ ingredients" : "e.g. 3rd party tested"}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            style={{
              width: 38, height: 38, flexShrink: 0,
              border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
              background: T.surface, color: T.textMuted,
              cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >×</button>
        </div>
      ))}
      {stats.length < 4 && (
        <button
          type="button"
          onClick={add}
          style={{
            fontSize: 12, fontWeight: 500, color: T.tealDark,
            background: T.tealSubtle, border: `1px solid ${T.tealBorder}`,
            borderRadius: T.radiusSm, padding: "7px 14px",
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          + Add stat
        </button>
      )}
    </div>
  );
}

// ── Voice chip selector ───────────────────────────────────────────────────────
const VOICE_OPTIONS = ["Bold", "Playful", "Premium", "Clinical", "Irreverent", "Warm", "Minimal", "Energetic"];

function VoiceSelector({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter(s => s !== v));
    else if (selected.length < 3) onChange([...selected, v]);
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {VOICE_OPTIONS.map(v => {
        const active = selected.includes(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => toggle(v)}
            style={{
              fontSize: 12, fontWeight: 500,
              padding: "6px 14px", borderRadius: 100,
              cursor: "pointer", transition: "all 0.15s",
              border: active ? `1.5px solid ${T.teal}` : `1px solid ${T.border}`,
              background: active ? T.tealSubtle : T.surface,
              color: active ? T.tealDark : T.textSub,
            }}
          >{v}</button>
        );
      })}
      <span style={{ fontSize: 11, color: T.textMuted, alignSelf: "center" }}>Pick up to 3</span>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
export default function BrandKitForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [textColor, setTextColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [fontName, setFontName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [productFile, setProductFile] = useState<File | null>(null);
  const [stats, setStats] = useState<string[]>([""]);
  const [voice, setVoice] = useState<string[]>([]);
  const [instagramHandle, setInstagramHandle] = useState("");

  const isValid = brandName.trim().length > 0 && primaryColor.length >= 4 && textColor.length >= 4;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("brandName", brandName.trim());
      formData.append("primaryColor", primaryColor);
      formData.append("textColor", textColor);
      if (accentColor) formData.append("accentColor", accentColor);
      if (secondaryColor) formData.append("secondaryColor", secondaryColor);
      if (fontName) formData.append("fontName", fontName.trim());
      if (logoFile) formData.append("logo", logoFile);
      if (productFile) formData.append("productImage", productFile);
      const filteredStats = stats.filter(s => s.trim());
      if (filteredStats.length) formData.append("stats", JSON.stringify(filteredStats));
      if (voice.length) formData.append("voice", JSON.stringify(voice));
      if (instagramHandle) formData.append("instagramHandle", instagramHandle.trim());

      const res = await fetch("/api/brand/create-manual", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setSubmitted(true);
      // Redirect to dashboard after short delay
      setTimeout(() => router.push("/dashboard"), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success state ──
  if (submitted) {
    return (
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusLg,
        padding: "48px 40px",
        textAlign: "center",
      }}>
        {/* UFO icon */}
        <div style={{ marginBottom: 20 }}>
          <svg width="48" height="48" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="26" cy="27" rx="12" ry="4" stroke="#00e5a0" strokeWidth="2" fill="none"/>
            <path d="M20 27 Q20 21 26 21 Q32 21 32 27" stroke="#00e5a0" strokeWidth="2" fill="none"/>
            <ellipse cx="26" cy="27" rx="16" ry="5.5" stroke="#00e5a0" strokeWidth="1.5" fill="none" opacity="0.5"/>
            <path d="M22 31 L19 38 M30 31 L33 38" stroke="#00e5a0" strokeWidth="1.5" opacity="0.4"/>
            <line x1="19" y1="38" x2="33" y2="38" stroke="#00e5a0" strokeWidth="1.5" opacity="0.3"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: "-0.02em", marginBottom: 10 }}>
          Brand profile created.
        </h2>
        <p style={{ fontSize: 14, color: T.textSub, lineHeight: 1.6 }}>
          Taking you to your dashboard…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>

      {/* ── Card wrapper ── */}
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.radiusLg,
        overflow: "hidden",
      }}>

        {/* Card header */}
        <div style={{
          padding: "20px 28px",
          borderBottom: `1px solid ${T.border}`,
          background: T.elevated,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <svg width="18" height="18" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="26" cy="27" rx="12" ry="4" stroke="#00e5a0" strokeWidth="2.5" fill="none"/>
            <path d="M20 27 Q20 21 26 21 Q32 21 32 27" stroke="#00e5a0" strokeWidth="2.5" fill="none"/>
            <ellipse cx="26" cy="27" rx="16" ry="5.5" stroke="#00e5a0" strokeWidth="1.5" fill="none" opacity="0.5"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text, letterSpacing: "-0.01em" }}>Brand Kit</span>
          <span style={{ fontSize: 12, color: T.textMuted, marginLeft: "auto" }}>* Required fields</span>
        </div>

        {/* Form body */}
        <div style={{ padding: "32px 28px" }}>

          {/* ── Brand Name ── */}
          <Section title="Brand Name *" required>
            <input
              type="text"
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              placeholder="e.g. Magic Mind, BRUNT, Cometeer"
              style={inputStyle}
              required
            />
          </Section>

          {/* ── Colors ── */}
          <Section
            title="Colors *"
            subtitle="Primary is your dominant background or brand color. Text color must be readable on top of it."
            required
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <ColorField label="Primary Color *" value={primaryColor} onChange={setPrimaryColor} placeholder="#00572C" />
              <ColorField label="Text Color *" value={textColor} onChange={setTextColor} placeholder="#FFFFFF" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <ColorField label="Accent Color" value={accentColor} onChange={setAccentColor} placeholder="#FFCC2F" />
              <ColorField label="Secondary Color" value={secondaryColor} onChange={setSecondaryColor} placeholder="#007E40" />
            </div>
          </Section>

          {/* Divider */}
          <div style={{ borderTop: `1px solid ${T.border}`, margin: "8px 0 32px" }} />

          {/* ── Font ── */}
          <Section
            title="Font"
            subtitle="The name of your primary brand font. Use the exact Google Fonts or system font name."
          >
            <input
              type="text"
              value={fontName}
              onChange={e => setFontName(e.target.value)}
              placeholder="e.g. Work Sans, DM Sans, Space Grotesk, Barlow Condensed"
              style={inputStyle}
            />
          </Section>

          {/* ── Assets ── */}
          <Section
            title="Brand Assets"
            subtitle="Logo and product images significantly improve output quality. PNG with transparent background preferred for product shots."
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FileUploadField
                label="Logo"
                hint="PNG, SVG, or JPG · Max 5MB"
                accept="image/*"
                value={logoFile}
                onChange={setLogoFile}
              />
              <FileUploadField
                label="Product Image"
                hint="Transparent PNG preferred · Max 10MB"
                accept="image/*"
                value={productFile}
                onChange={setProductFile}
              />
            </div>
          </Section>

          {/* Divider */}
          <div style={{ borderTop: `1px solid ${T.border}`, margin: "8px 0 32px" }} />

          {/* ── Stats ── */}
          <Section
            title="Key Stats"
            subtitle="Your strongest proof points. These become the hero element in stat-driven layouts."
          >
            <StatRow stats={stats} onChange={setStats} />
          </Section>

          {/* ── Voice ── */}
          <Section
            title="Brand Voice"
            subtitle="How your brand sounds. Guides copy generation."
          >
            <VoiceSelector selected={voice} onChange={setVoice} />
          </Section>

          {/* ── Instagram handle ── */}
          <Section title="Instagram Handle">
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <span style={{
                padding: "11px 12px",
                background: T.elevated,
                border: `1px solid ${T.border}`,
                borderRight: "none",
                borderRadius: `${T.radiusSm}px 0 0 ${T.radiusSm}px`,
                fontSize: 14, color: T.textMuted,
                flexShrink: 0,
              }}>@</span>
              <input
                type="text"
                value={instagramHandle}
                onChange={e => setInstagramHandle(e.target.value.replace(/^@/, ""))}
                placeholder="yourbrand"
                style={{ ...inputStyle, borderRadius: `0 ${T.radiusSm}px ${T.radiusSm}px 0`, borderLeft: "none" }}
              />
            </div>
          </Section>

        </div>

        {/* ── Footer / submit ── */}
        <div style={{
          padding: "20px 28px",
          borderTop: `1px solid ${T.border}`,
          background: T.elevated,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}>
          <p style={{ fontSize: 12, color: T.textMuted, maxWidth: 360, lineHeight: 1.5 }}>
            You can always update your brand profile later. The more you provide, the better the output.
          </p>

          {error && (
            <div style={{ fontSize: 12, color: "#ef4444", fontWeight: 500 }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={!isValid || submitting}
            style={{
              padding: "11px 28px",
              fontSize: 14, fontWeight: 600,
              background: isValid ? T.teal : T.elevated,
              color: isValid ? "#000" : T.textMuted,
              border: "none",
              borderRadius: T.radiusSm,
              cursor: isValid ? "pointer" : "not-allowed",
              transition: "all 0.15s",
              flexShrink: 0,
              letterSpacing: "-0.01em",
              boxShadow: isValid ? `0 0 20px rgba(0,229,160,0.25)` : "none",
            }}
          >
            {submitting ? "Creating profile…" : "Create brand profile →"}
          </button>
        </div>
      </div>

    </form>
  );
}
