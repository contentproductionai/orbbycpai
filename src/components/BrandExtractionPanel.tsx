"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Step = "idle" | "extracting" | "done";

const EXTRACT_STEPS = [
  "extracting brand profile...",
  "reading color palette...",
  "mapping typography...",
  "analysing tone of voice...",
  "locking brand DNA...",
];

export default function BrandExtractionPanel() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [handle, setHandle] = useState("");
  const [topic, setTopic] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [stepLabel, setStepLabel] = useState(EXTRACT_STEPS[0]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function runExtraction() {
    if (!url) return;
    setStep("extracting");
    let i = 0;
    setStepLabel(EXTRACT_STEPS[0]);
    const tick = () => {
      i++;
      if (i < EXTRACT_STEPS.length) {
        setStepLabel(EXTRACT_STEPS[i]);
        timerRef.current = setTimeout(tick, 900);
      } else {
        setStep("done");
      }
    };
    timerRef.current = setTimeout(tick, 900);
  }

  function handleGenerate() {
    if (step === "idle") {
      runExtraction();
    } else if (step === "done") {
      router.push("/register");
    }
  }

  const isExtracting = step === "extracting";
  const isDone = step === "done";

  return (
    <div style={{
      width: "100%",
      maxWidth: 680,
      background: "rgba(12,18,16,0.82)",
      border: "1px solid rgba(0,212,170,0.18)",
      borderRadius: 16,
      padding: "0 0 0 0",
      backdropFilter: "blur(16px)",
      boxShadow: "0 0 48px rgba(0,212,170,0.08), 0 8px 32px rgba(0,0,0,0.5)",
      overflow: "hidden",
    }}>
      {/* Title bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "14px 20px",
        borderBottom: "1px solid rgba(0,212,170,0.1)",
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
        </div>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: "rgba(0,212,170,0.7)",
          letterSpacing: "0.12em",
          marginLeft: 8,
          fontFamily: "monospace",
        }}>BRAND.EXTRACTION</span>
      </div>

      {/* Fields */}
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* URL field */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "rgba(0,212,170,0.05)",
          border: "1px solid rgba(0,212,170,0.15)",
          borderRadius: 10,
          padding: "12px 16px",
        }}>
          <span style={{ fontSize: 16, color: "rgba(0,212,170,0.7)", flexShrink: 0 }}>⊕</span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourwebsite.com"
            disabled={isExtracting || isDone}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 15,
              color: url ? "var(--text-primary)" : "rgba(255,255,255,0.35)",
              fontFamily: "monospace",
              letterSpacing: "0.01em",
            }}
          />
        </div>

        {/* Instagram handle */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 10,
          padding: "12px 16px",
        }}>
          <span style={{ fontSize: 15, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>◯</span>
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="instagram handle"
            disabled={isExtracting || isDone}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 14,
              color: "rgba(255,255,255,0.45)",
              fontFamily: "monospace",
            }}
          />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em", fontFamily: "monospace" }}>optional</span>
        </div>

        {/* Topic */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 10,
          padding: "12px 16px",
        }}>
          <span style={{ fontSize: 15, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>≡</span>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="what should these posts be about?"
            disabled={isExtracting || isDone}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 14,
              color: "rgba(255,255,255,0.45)",
              fontFamily: "monospace",
            }}
          />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em", fontFamily: "monospace" }}>optional</span>
        </div>
      </div>

      {/* Footer bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 20px 16px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 24 }}>
          {isExtracting && (
            <>
              <div style={{
                width: 16, height: 16,
                borderRadius: "50%",
                border: "2px solid rgba(0,212,170,0.25)",
                borderTopColor: "#00d4aa",
                animation: "spin 0.8s linear infinite",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, color: "rgba(0,212,170,0.8)", fontFamily: "monospace" }}>{stepLabel}</span>
            </>
          )}
          {isDone && (
            <span style={{ fontSize: 13, color: "#00d4aa", fontFamily: "monospace" }}>✓ brand DNA locked – sign up to generate</span>
          )}
          {step === "idle" && (
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>paste your URL above to begin</span>
          )}
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!url || isExtracting}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: !url || isExtracting ? "rgba(0,212,170,0.15)" : "#00d4aa",
            color: !url || isExtracting ? "rgba(0,212,170,0.5)" : "#000",
            border: "none",
            borderRadius: 8,
            padding: "9px 20px",
            fontSize: 14,
            fontWeight: 600,
            cursor: !url || isExtracting ? "not-allowed" : "pointer",
            transition: "all 0.15s",
            boxShadow: !url || isExtracting ? "none" : "0 0 16px rgba(0,212,170,0.35)",
            letterSpacing: "-0.01em",
          }}
        >
          {isDone ? "Create account →" : "Generate →"}
        </button>
      </div>
    </div>
  );
}
