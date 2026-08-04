"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

const LS_KEY = "canopy_onboarding_seen";

const STEPS = [
  {
    emoji: "🌿",
    title: "Welcome to Canopy",
    body: "Your research lab's home base — tasks, literature, bookmarks, scheduling, and team coordination all in one workspace.",
    hint: "",
  },
  {
    emoji: "🏠",
    title: "Lab Home vs. Projects",
    body: 'The left icon rail is your context switcher. The house icon shows Lab Home (all lab-wide data). Clicking a project icon (like “GE”) narrows every page to that project’s view — title, tasks, activity, and team.',
    hint: "The breadcrumb at the top of each page always shows which context you're in.",
  },
  {
    emoji: "✅",
    title: "Tasks",
    body: "Plan and track research work on a Kanban board or list. Assign teammates, set due dates, and move cards from To Do → In Progress → Done. Tasks scope automatically to your active project.",
    hint: "Use the Board view to see workload at a glance; List view for quick bulk editing.",
  },
  {
    emoji: "📚",
    title: "Literature",
    body: "A full citation manager built for your lab. Import from Zotero, attach PDFs, add notes and annotations, and track reading status per item. All teammates see the same library.",
    hint: 'Tip: in Zotero, export with "Export Files" + "Include Annotations" checked to carry over PDF highlights.',
  },
  {
    emoji: "🔖",
    title: "Bookmarks & Files",
    body: "Bookmarks are for links your team shares — papers, protocols, supplier pages, Zoom recordings, or any URL. PDFs and datasets live on each Literature item's Files tab, viewable in the in-app reader.",
    hint: "Bookmarks are automatically categorized by URL type (paper, doc, sheet, code, etc.).",
  },
  {
    emoji: "👥",
    title: "Team",
    body: "See what everyone is working on, share your weekly update, and start a Zoom call. PIs and project creators can manage project membership from the Manage Members button.",
    hint: "Scheduling shows everyone's availability calendar so you can find meeting times without back-and-forth.",
  },
];

export default function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function dismiss() {
    localStorage.setItem(LS_KEY, "1");
    onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
      if (e.key === "ArrowRight" && !isLast) setStep((s) => s + 1);
      if (e.key === "ArrowLeft" && step > 0) setStep((s) => s - 1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isLast]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(27,46,75,0.45)" }}
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: 14,
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 16px 48px rgba(27,46,75,0.22)",
          overflow: "hidden",
          fontFamily: "var(--font-roboto)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={dismiss}
            className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]"
            style={{ width: 36, height: 36, background: "none", border: "none", cursor: "pointer" }}
            aria-label="Close tour"
          >
            <X size={16} color="var(--color-secondary)" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "0 32px 28px" }}>
          {/* Emoji illustration */}
          <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 20, textAlign: "center" }}>
            {current.emoji}
          </div>

          {/* Step counter */}
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, textAlign: "center" }}>
            {step + 1} of {STEPS.length}
          </p>

          {/* Title */}
          <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 22, color: "var(--color-navy)", margin: "0 0 12px", textAlign: "center", lineHeight: 1.3 }}>
            {current.title}
          </h2>

          {/* Body */}
          <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.65, marginBottom: current.hint ? 12 : 0, textAlign: "center" }}>
            {current.body}
          </p>

          {/* Hint */}
          {current.hint && (
            <p style={{ fontSize: 12, color: "var(--color-secondary)", lineHeight: 1.55, backgroundColor: "var(--color-canvas)", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
              {current.hint}
            </p>
          )}
        </div>

        {/* Footer: dots + nav */}
        <div style={{ borderTop: "1px solid var(--color-border)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Back */}
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-1"
            style={{ fontSize: 13, fontWeight: 600, color: step === 0 ? "transparent" : "var(--color-secondary)", background: "none", border: "none", cursor: step === 0 ? "default" : "pointer", minHeight: 36, padding: "0 4px" }}
          >
            <ChevronLeft size={14} /> Back
          </button>

          {/* Dot progress */}
          <div style={{ display: "flex", gap: 6 }}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                style={{
                  width: i === step ? 18 : 6, height: 6,
                  borderRadius: 3,
                  backgroundColor: i === step ? "var(--color-navy)" : "var(--color-border)",
                  border: "none", cursor: "pointer", transition: "width 200ms ease, background-color 200ms ease",
                  padding: 0,
                }}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Next / Done */}
          {isLast ? (
            <button
              onClick={dismiss}
              style={{ fontSize: 13, fontWeight: 700, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", cursor: "pointer", minHeight: 36 }}
            >
              Get started
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1"
              style={{ fontSize: 13, fontWeight: 600, color: "var(--color-navy)", background: "none", border: "none", cursor: "pointer", minHeight: 36, padding: "0 4px" }}
            >
              Next <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function useOnboarding() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(LS_KEY)) setShow(true);
  }, []);

  return { show, open: () => setShow(true), close: () => setShow(false) };
}
