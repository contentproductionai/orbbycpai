"use client";

import { useState, useEffect, useRef } from "react";

const DEMO_STEPS = [
  { label: "Fetching brand assets…", delay: 600 },
  { label: "Reading color palette…", delay: 1100 },
  { label: "Extracting typography…", delay: 1600 },
  { label: "Analysing tone of voice…", delay: 2200 },
  { label: "Mapping shape language…", delay: 2800 },
  { label: "Brand DNA locked.", delay: 3400, done: true },
];

const DEMO_COLORS = ["#00d4aa", "#1a1a2e", "#e8f4f8", "#ff6b35", "#2d3436"];
const DEMO_FONTS = ["Inter", "Helvetica Neue", "GT Walsheim"];
const DEMO_TONES = ["Confident", "Aspirational", "Direct"];

export default function HeroDemo() {
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<{ label: string; done?: boolean }[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [font, setFont] = useState("");
  const [tone, setTone] = useState("");
  const [complete, setComplete] = useState(false);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  function reset() {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
    setSteps([]);
    setColors([]);
    setFont("");
    setTone("");
    setComplete(false);
    setRunning(false);
  }

  function runDemo(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    reset();
    setRunning(true);

    DEMO_STEPS.forEach((step, i) => {
      const t = setTimeout(() => {
        setSteps((prev) => [...prev, { label: step.label, done: step.done }]);
        if (i === 1) setColors(DEMO_COLORS);
        if (i === 2) setFont(DEMO_FONTS[Math.floor(Math.random() * DEMO_FONTS.length)]);
        if (i === 3) setTone(DEMO_TONES[Math.floor(Math.random() * DEMO_TONES.length)]);
        if (step.done) setComplete(true);
      }, step.delay);
      timerRefs.current.push(t);
    });
  }

  useEffect(() => () => timerRefs.current.forEach(clearTimeout), []);

  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
      <form onSubmit={runDemo} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); if (complete || running) reset(); }}
          placeholder="https://yourbrand.com"
          required
          style={{
            flex: 1,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            padding: "11px 16px",
            fontSize: 14,
            color: "var(--text-primary)",
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--brand-primary)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")}
        />
        <button
          type="submit"
          disabled={running && !complete}
          style={{
            background: "var(--brand-primary)",
            color: "#000",
            fontWeight: 600,
            fontSize: 13,
            padding: "11px 20px",
            borderRadius: "var(--radius-md)",
            border: "none",
            cursor: running && !complete ? "not-allowed" : "pointer",
            opacity: running && !complete ? 0.7 : 1,
            whiteSpace: "nowrap",
            transition: "opacity 0.15s",
          }}
        >
          {running && !complete ? "Reading…" : "Read brand →"}
        </button>
      </form>

      {steps.length > 0 && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 20px",
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            fontSize: 12,
            lineHeight: 1.8,
            minHeight: 120,
          }}
        >
          {steps.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: s.done ? "var(--brand-primary)" : "var(--text-secondary)",
                animation: "fade-in 0.25s ease-out",
              }}
            >
              <span style={{ color: s.done ? "var(--brand-primary)" : "var(--text-tertiary)" }}>
                {s.done ? "✓" : "›"}
              </span>
              {s.label}
            </div>
          ))}

          {colors.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>PALETTE</span>
              {colors.map((c) => (
                <div
                  key={c}
                  title={c}
                  style={{ width: 18, height: 18, borderRadius: 4, background: c, border: "1px solid rgba(255,255,255,0.12)", flexShrink: 0 }}
                />
              ))}
              {font && (
                <span style={{ marginLeft: 8, color: "var(--text-secondary)", fontSize: 11 }}>
                  {font}
                </span>
              )}
              {tone && (
                <span style={{ marginLeft: 4, color: "var(--brand-primary)", fontSize: 11, fontWeight: 600 }}>
                  · {tone}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {complete && (
        <p style={{ marginTop: 10, fontSize: 12, color: "var(--brand-primary)", textAlign: "center", animation: "fade-in 0.3s ease-out" }}>
          Brand DNA captured — ready to generate 40 posts →
        </p>
      )}
    </div>
  );
}
