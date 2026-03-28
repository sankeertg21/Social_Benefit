import React, { useState, useRef, useCallback } from "react";
import imageCompression from "browser-image-compression";
import { processUnstructuredInput, type TriageResponse } from "./lib/gemini";
import "./index.css";

const CATEGORIES = [
  { id: "medical", label: "Medical", desc: "Symptoms, injuries, vitals", icon: "➕", cls: "cat-medical" },
  { id: "emergency", label: "Emergency", desc: "Accidents, fire, hazards", icon: "⚠️", cls: "cat-emergency" },
  { id: "coordination", label: "Coordination", desc: "Multi-resource logistics", icon: "🔄", cls: "cat-coordination" },
  { id: "disaster", label: "Disaster prep", desc: "Evacuation, readiness", icon: "🛡️", cls: "cat-disaster" },
];

const SEVERITY_MAP: Record<string, string> = {
  Critical: "critical",
  High: "high",
  Medium: "medium",
  Low: "low",
  Unknown: "low",
};

// Sub-components for better memoization and readability
const TriageStep = React.memo(({ step, index }: { step: string; index: number }) => (
  <div className="step-card" role="listitem">
    <div className="step-number" aria-label={`Step ${index + 1}`}>{index + 1}</div>
    <div className="step-content">
      <div className="step-action">{step}</div>
    </div>
  </div>
));

function SeverityAlert({ result }: { result: TriageResponse }) {
  const cls = SEVERITY_MAP[result.severityLevel] ?? "low";
  const alertText = (result.urgencyAlert || `${result.severityLevel} severity — ${result.category}`)
    .replace(/\*\*/g, ""); // strip any markdown bold markers
  return (
    <div className={`urgency-alert ${cls} fade-up`} role="alert" aria-live="assertive">
      <div className="urgency-dot" aria-hidden="true" />
      <div>
        <div className="urgency-title">{alertText}</div>
        <div className="urgency-subtitle">{result.rationale}</div>
      </div>
    </div>
  );
}

function KeyFacts({ facts }: { facts: string[] }) {
  if (!facts?.length) return null;
  return (
    <div className="fade-up">
      <div className="section-label">Key Facts Extracted</div>
      <div className="facts-tags" role="list">
        {facts.map((f, i) => (
          <span key={i} className="fact-tag" role="listitem">{f}</span>
        ))}
      </div>
    </div>
  );
}

function ActionSteps({ steps }: { steps: string[] }) {
  return (
    <div className="fade-up">
      <div className="section-label">What to do — in order</div>
      <div className="steps-list" role="list">
        {steps.map((step, i) => (
          <TriageStep key={i} step={step} index={i} />
        ))}
      </div>
    </div>
  );
}

function DispatchAgencies({ entities }: { entities: string[] }) {
  if (!entities?.length) return null;
  return (
    <div className="fade-up">
      <div className="section-label">Dispatch Required</div>
      <div className="dispatch-chips">
        {entities.map((e, i) => (
          <span key={i} className="dispatch-chip">{e}</span>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [images, setImages] = useState<{ file: File; url: string; data: string; mimeType: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<TriageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  const handleCategoryClick = useCallback((id: string) => {
    setActiveCategory(prev => prev === id ? null : id);
  }, []);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
    for (const file of files) {
      try {
        const compressed = await imageCompression(file, options);
        const reader = new FileReader();
        reader.onloadend = () => {
          const b64 = (reader.result as string).split(",")[1];
          setImages(prev => [...prev, {
            file: compressed as File,
            url: URL.createObjectURL(compressed),
            data: b64,
            mimeType: compressed.type,
          }]);
        };
        reader.readAsDataURL(compressed);
      } catch {
        setError("Failed to process image.");
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removeImage = useCallback((idx: number) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const handleAnalyze = useCallback(async () => {
    const combined = [
      activeCategory ? `[Category: ${CATEGORIES.find(c => c.id === activeCategory)?.label}]` : "",
      textInput.trim(),
    ].filter(Boolean).join("\n");

    if (!combined && images.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    let location: { lat: number; lng: number } | undefined;
    try {
      if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 })
        );
        location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch { /* geolocation optional */ }

    try {
      const res = await processUnstructuredInput(combined, images, location);
      setResult(res);
      // Accessibility: Move focus to the results section once it loads
      setTimeout(() => resultsRef.current?.focus(), 100);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [activeCategory, textInput, images]);

  const canAnalyze = (textInput.trim().length > 0 || images.length > 0) && !isProcessing;

  return (
    <div>
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <h1>Aegis</h1>
          <p>Situation intelligence · powered by AI</p>
        </div>
        <div className="header-actions">
          {/* Header actions removed as requested */}
        </div>
      </header>

      {/* Main Layout */}
      <div className="main-layout">

        {/* ── LEFT PANE ── */}
        <section className="left-pane" aria-label="Input panel">
          <div>
            <h2>What's happening right now?</h2>
            <p className="subtitle">
              Describe anything — medical, accident, disaster, or safety threat. We'll tell you exactly what to do.
            </p>
          </div>

          {/* Category Cards */}
          <div className="category-grid" role="group" aria-label="Incident category">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`cat-card ${cat.cls} ${activeCategory === cat.id ? "active" : ""}`}
                onClick={() => handleCategoryClick(cat.id)}
                aria-pressed={activeCategory === cat.id}
                aria-label={`Category: ${cat.label}`}
              >
                <div className="cat-card-icon" aria-hidden="true">{cat.icon}</div>
                <span className="cat-card-label">{cat.label}</span>
                <span className="cat-card-desc">{cat.desc}</span>
              </button>
            ))}
          </div>

          {/* Text Input */}
          <div className="input-box">
            <label className="input-label" htmlFor="triage-input">Tell us what's going on — in your own words</label>
            <textarea
              id="triage-input"
              className="input-textarea"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="Patient 45yo male, severe chest pain radiating to left arm, short of breath since 20 mins. BP 160/100, heart rate 112. No prior cardiac history..."
              aria-label="Describe the situation"
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAnalyze(); }}
            />

            {images.length > 0 && (
              <div className="image-previews">
                {images.map((img, i) => (
                  <div key={i} className="preview-thumb">
                    <img src={img.url} alt={`Attached image ${i + 1}`} />
                    <button className="btn-remove-img" onClick={() => removeImage(i)} aria-label={`Remove image ${i + 1}`}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="input-actions">
              <button
                className="btn-attach"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach photo"
              >
                📎 Attach photo
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                multiple
                accept="image/*"
                className="hidden"
                aria-hidden="true"
                style={{ display: "none" }}
              />
              <button
                className="btn-analyze"
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                aria-label="Analyze situation"
              >
                {isProcessing ? "Analyzing…" : "Analyze →"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="error-box" role="alert">
              <span>⚠</span>
              <div>
                <div>{error}</div>
                <button className="btn-retry" onClick={handleAnalyze}>Retry</button>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="disclaimer">
            AI-assisted tool only. Always call emergency services for life-threatening situations.
          </p>
        </section>

        {/* ── RIGHT PANE ── */}
        <section className="right-pane" aria-label="Analysis results" aria-live="polite" ref={resultsRef} tabIndex={-1}>
          <div className="right-pane-header">
            <h2>Action plan</h2>
            {result && !isProcessing && (
              <span className="badge-complete">Analysis complete</span>
            )}
          </div>

          {/* Loading */}
          {isProcessing && (
            <div className="loading-state">
              <div className="spinner" aria-hidden="true" />
              <div className="loading-text">Synthesizing data…</div>
            </div>
          )}

          {/* Empty State */}
          {!result && !isProcessing && !error && (
            <div className="awaiting-state">
              <div className="awaiting-icon" aria-hidden="true">🩺</div>
              <h3>Awaiting input</h3>
              <p>Describe the situation on the left, then click Analyze to get an immediate action plan.</p>
            </div>
          )}

          {/* Results */}
          {result && !isProcessing && (
            <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
              <SeverityAlert result={result} />
              <KeyFacts facts={result.keyFacts} />
              <ActionSteps steps={result.actionPlan} />
              <DispatchAgencies entities={result.dispatchEntities} />

              {result.verifiedSummary && (
                <div className="fade-up">
                  <div className="section-label">Verified Summary</div>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {result.verifiedSummary}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
