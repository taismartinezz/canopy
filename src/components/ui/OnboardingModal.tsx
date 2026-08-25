"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

const LS_KEY = "canopy_onboarding_seen";

// ── Step illustrations - thin-stroke SVG in Canopy logo style ─────────────────

function IllustrationCanopy() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64} fill="none" aria-hidden="true">
      <path d="M8 58 Q8 12 40 12 Q72 12 72 58" stroke="var(--color-navy)" strokeWidth="1.5" strokeLinecap="round" opacity="0.25" />
      <path d="M16 58 Q16 20 40 20 Q64 20 64 58" stroke="var(--color-navy)" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d="M24 58 Q24 28 40 28 Q56 28 56 58" stroke="var(--color-navy)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="8" y1="58" x2="72" y2="58" stroke="var(--color-navy)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <circle cx="40" cy="12" r="2" fill="var(--color-navy)" opacity="0.25" />
      <circle cx="40" cy="20" r="2" fill="var(--color-navy)" opacity="0.55" />
      <circle cx="40" cy="28" r="2.5" fill="var(--color-navy)" />
    </svg>
  );
}

function IllustrationScope() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64} fill="none" aria-hidden="true">
      {/* House */}
      <polyline points="20,44 20,62 44,62 44,44" stroke="var(--color-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="14,46 32,26 50,46" stroke="var(--color-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Door */}
      <rect x="28" y="50" width="8" height="12" rx="1" stroke="var(--color-navy)" strokeWidth="1.5" />
      {/* Project chip */}
      <rect x="50" y="28" width="20" height="12" rx="4" stroke="var(--color-navy)" strokeWidth="1.5" opacity="0.55" />
      <line x1="54" y1="34" x2="66" y2="34" stroke="var(--color-navy)" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
      <rect x="50" y="44" width="20" height="12" rx="4" stroke="var(--color-navy)" strokeWidth="1.5" opacity="0.3" />
      <line x1="54" y1="50" x2="66" y2="50" stroke="var(--color-navy)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

function IllustrationTasks() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64} fill="none" aria-hidden="true">
      {/* Three kanban columns */}
      <rect x="8"  y="16" width="18" height="10" rx="3" stroke="var(--color-navy)" strokeWidth="1.5" opacity="0.3" />
      <rect x="8"  y="30" width="18" height="10" rx="3" stroke="var(--color-navy)" strokeWidth="1.5" opacity="0.3" />
      <rect x="8"  y="44" width="18" height="10" rx="3" stroke="var(--color-navy)" strokeWidth="1.5" opacity="0.3" />

      <rect x="31" y="16" width="18" height="10" rx="3" stroke="var(--color-navy)" strokeWidth="2" opacity="0.6" />
      <rect x="31" y="30" width="18" height="10" rx="3" stroke="var(--color-navy)" strokeWidth="2" opacity="0.6" />

      <rect x="54" y="16" width="18" height="10" rx="3" stroke="var(--color-navy)" strokeWidth="2.5" />
      {/* Checkmark in last card */}
      <polyline points="58,21 62,25 70,17" stroke="var(--color-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Column headers */}
      <line x1="8"  y1="10" x2="26" y2="10" stroke="var(--color-navy)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      <line x1="31" y1="10" x2="49" y2="10" stroke="var(--color-navy)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="54" y1="10" x2="72" y2="10" stroke="var(--color-navy)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IllustrationJournal() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64} fill="none" aria-hidden="true">
      {/* Open notebook */}
      <rect x="12" y="14" width="56" height="52" rx="4" stroke="var(--color-navy)" strokeWidth="2" />
      <line x1="40" y1="14" x2="40" y2="66" stroke="var(--color-navy)" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      {/* Binding dots */}
      <circle cx="40" cy="24" r="1.5" fill="var(--color-navy)" opacity="0.4" />
      <circle cx="40" cy="34" r="1.5" fill="var(--color-navy)" opacity="0.4" />
      <circle cx="40" cy="44" r="1.5" fill="var(--color-navy)" opacity="0.4" />
      {/* Writing lines left page */}
      <line x1="18" y1="27" x2="35" y2="27" stroke="var(--color-navy)" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
      <line x1="18" y1="34" x2="35" y2="34" stroke="var(--color-navy)" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
      <line x1="18" y1="41" x2="30" y2="41" stroke="var(--color-navy)" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
      {/* Lock icon on right page - signals privacy */}
      <rect x="48" y="32" width="16" height="12" rx="2" stroke="var(--color-navy)" strokeWidth="1.5" opacity="0.7" />
      <path d="M51 32 v-4 a5 5 0 0 1 10 0 v4" stroke="var(--color-navy)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <circle cx="56" cy="38" r="1.5" fill="var(--color-navy)" opacity="0.7" />
    </svg>
  );
}

function IllustrationLiterature() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64} fill="none" aria-hidden="true">
      {/* Open book */}
      <path d="M40 20 Q26 18 14 22 L14 62 Q26 58 40 60" stroke="var(--color-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M40 20 Q54 18 66 22 L66 62 Q54 58 40 60" stroke="var(--color-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="40" y1="20" x2="40" y2="60" stroke="var(--color-navy)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      {/* Text lines left page */}
      <line x1="19" y1="30" x2="36" y2="29" stroke="var(--color-navy)" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
      <line x1="19" y1="36" x2="36" y2="35" stroke="var(--color-navy)" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
      <line x1="19" y1="42" x2="33" y2="41" stroke="var(--color-navy)" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
      {/* Highlight on right page */}
      <line x1="44" y1="30" x2="61" y2="29" stroke="var(--color-navy)" strokeWidth="3" strokeLinecap="round" opacity="0.18" />
      <line x1="44" y1="30" x2="61" y2="29" stroke="var(--color-navy)" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
      <line x1="44" y1="36" x2="61" y2="35" stroke="var(--color-navy)" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
      <line x1="44" y1="42" x2="58" y2="41" stroke="var(--color-navy)" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

function IllustrationBookmarks() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64} fill="none" aria-hidden="true">
      {/* Bookmark ribbon */}
      <path d="M28 14 L52 14 L52 58 L40 48 L28 58 Z" stroke="var(--color-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Tag line */}
      <line x1="34" y1="26" x2="46" y2="26" stroke="var(--color-navy)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="34" y1="33" x2="46" y2="33" stroke="var(--color-navy)" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
      {/* Small document */}
      <rect x="54" y="18" width="16" height="20" rx="2" stroke="var(--color-navy)" strokeWidth="1.5" opacity="0.45" />
      <line x1="57" y1="24" x2="67" y2="24" stroke="var(--color-navy)" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <line x1="57" y1="29" x2="67" y2="29" stroke="var(--color-navy)" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <line x1="57" y1="34" x2="63" y2="34" stroke="var(--color-navy)" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

function IllustrationTeam() {
  return (
    <svg viewBox="0 0 80 80" width={64} height={64} fill="none" aria-hidden="true">
      {/* Center person */}
      <circle cx="40" cy="24" r="8" stroke="var(--color-navy)" strokeWidth="2" />
      <path d="M22 62 Q22 44 40 44 Q58 44 58 62" stroke="var(--color-navy)" strokeWidth="2" strokeLinecap="round" />
      {/* Left person (faded) */}
      <circle cx="18" cy="28" r="6" stroke="var(--color-navy)" strokeWidth="1.5" opacity="0.45" />
      <path d="M6 62 Q6 48 18 48 Q24 48 28 52" stroke="var(--color-navy)" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      {/* Right person (faded) */}
      <circle cx="62" cy="28" r="6" stroke="var(--color-navy)" strokeWidth="1.5" opacity="0.45" />
      <path d="M74 62 Q74 48 62 48 Q56 48 52 52" stroke="var(--color-navy)" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

const STEPS: { title: string; body: string; hint: string; Icon: () => React.ReactNode }[] = [
  {
    Icon: IllustrationCanopy,
    title: "Welcome to Canopy",
    body: "Your research lab's home base: tasks, literature, bookmarks, scheduling, and team coordination in one workspace.",
    hint: "",
  },
  {
    Icon: IllustrationScope,
    title: "Lab Home vs. Projects",
    body: "The left icon rail is your context switcher. The house icon shows Lab Home with all lab-wide data. Clicking a project icon narrows every page to that project's tasks, activity, and team.",
    hint: "The breadcrumb at the top of each page shows which context you are in.",
  },
  {
    Icon: IllustrationTasks,
    title: "Tasks",
    body: "Plan and track research work on a Kanban board or list. Assign teammates, set due dates, and move cards from To Do through In Progress to Done. Tasks scope automatically to your active project.",
    hint: "Use the Board view to see workload at a glance and List view for quick bulk editing.",
  },
  {
    Icon: IllustrationJournal,
    title: "Journal - your private space",
    body: "Write field notes, research reflections, and meeting prep in your personal journal. Journal entries are only visible to you - no teammate or PI can read them.",
    hint: "Journal is the only private space in Canopy. Tasks, literature, and bookmarks are shared with your lab.",
  },
  {
    Icon: IllustrationLiterature,
    title: "Literature",
    body: "A citation manager built for your lab. Import from Zotero, attach PDFs, add notes and annotations, and track reading status. All teammates see the same library.",
    hint: 'In Zotero, export with "Export Files" and "Include Annotations" checked to carry over PDF highlights.',
  },
  {
    Icon: IllustrationBookmarks,
    title: "Bookmarks and Files",
    body: "Bookmarks are for links your team shares: papers, protocols, supplier pages, Zoom recordings, or any URL. PDFs and datasets attach directly to each Literature item under its Files tab.",
    hint: "Bookmarks are automatically categorized by URL type (paper, doc, sheet, code, and more).",
  },
  {
    Icon: IllustrationTeam,
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
        {/* Close */}
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
        <div style={{ padding: "4px 32px 28px" }}>
          {/* SVG illustration */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <current.Icon />
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

        {/* Footer */}
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
                  border: "none", cursor: "pointer",
                  transition: "width 200ms ease, background-color 200ms ease",
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

    function handleRetrigger() {
      localStorage.removeItem(LS_KEY);
      setShow(true);
    }
    window.addEventListener("canopy:show-onboarding", handleRetrigger);
    return () => window.removeEventListener("canopy:show-onboarding", handleRetrigger);
  }, []);

  return { show, open: () => setShow(true), close: () => setShow(false) };
}
