"use client";

import { useState, useRef, useEffect } from "react";
import {
  JOURNAL_ENTRIES, JOURNAL_PROMPTS, ACTIVE_PROMPT_IDS,
  CHECKIN_QUESTIONS, CHECKIN_LABELS, CHECKIN_COLORS, CURRENT_USER_ID,
} from "@/lib/mock-data";
import type { JournalEntry, CheckinResponse, PromptCategory } from "@/types";
import { Lock, Mic, MicOff, HelpingHand, Search, Plus, X, Phone, ChevronLeft, Users, Building2 } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEntryDate(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFullDate(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function getTodayISO() { return new Date().toISOString().split("T")[0]; }

const DRAFT_KEY    = "canopy_journal_draft";
const DISMISS_KEY  = "canopy_prompt_dismissed";

const CATEGORY_LABELS: Record<PromptCategory, string> = {
  emotional_processing: "Emotional Processing",
  research_reflection:  "Research Reflection",
  team_support:         "Team & Support",
  boundaries_workload:  "Boundaries & Workload",
  looking_forward:      "Looking Forward",
};

// ── Prompt card ───────────────────────────────────────────────────────────────

function PromptCard({ number, promptText, response, onResponseChange }: {
  number: number; promptText: string; response: string; onResponseChange: (v: string) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(96, el.scrollHeight)}px`;
  }, [response]);

  return (
    <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
      <div className="flex items-center justify-between px-4 md:px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="flex items-center justify-center rounded-full shrink-0" style={{ width: 28, height: 28, backgroundColor: "var(--color-navy)", color: "#fff", fontSize: 12, fontWeight: 700 }}>
            {number}
          </span>
          <span style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 14, color: "var(--color-body)", lineHeight: 1.35 }}>
            {promptText}
          </span>
        </div>
        <button
          onClick={() => setIsRecording(!isRecording)}
          className="relative shrink-0 flex items-center justify-center rounded-full transition-all ml-3"
          style={{ width: 44, height: 44, backgroundColor: isRecording ? "#C0392B" : "var(--color-navy)", color: "#fff", border: "none", cursor: "pointer" }}
          aria-label={isRecording ? "Stop recording" : "Voice input"}
        >
          {isRecording ? (
            <><MicOff size={14} /><span className="absolute inset-0 rounded-full animate-pulse-ring" style={{ border: "2px solid #C0392B" }} /></>
          ) : <Mic size={14} />}
        </button>
      </div>
      <div className="px-4 md:px-5 py-4">
        <textarea
          ref={textareaRef}
          value={response}
          onChange={(e) => onResponseChange(e.target.value)}
          placeholder="Take a moment. There's no right answer here."
          style={{ width: "100%", fontSize: 14, color: "var(--color-body)", fontFamily: "var(--font-roboto)", lineHeight: 1.65, backgroundColor: "transparent", border: "none", outline: "none", resize: "none", minHeight: 96, caretColor: "var(--color-navy)" }}
        />
      </div>
    </div>
  );
}

// ── Weekly check-in card ──────────────────────────────────────────────────────

const SCORE_COLORS = CHECKIN_COLORS as unknown as Record<number, string>;
const SCORE_LABELS = CHECKIN_LABELS as unknown as Record<number, string>;

function CheckinCard({ question, response, onScore }: {
  question: { id: string; text: string };
  response?: CheckinResponse;
  onScore: (score: 1 | 2 | 3 | 4 | 5) => void;
}) {
  const selected = response?.score;
  return (
    <div style={{ backgroundColor: "var(--color-surface)", border: `2px solid ${selected !== undefined ? SCORE_COLORS[selected] : "var(--color-border)"}`, borderRadius: 10, padding: "16px 16px", transition: "border-color 0.2s" }}>
      <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.5, marginBottom: 14 }}>{question.text}</p>
      <div className="flex items-center gap-1.5 md:gap-2">
        {([1, 2, 3, 4, 5] as const).map((score) => {
          const isSelected = selected === score;
          const color = SCORE_COLORS[score];
          return (
            <button key={score} onClick={() => onScore(score)}
              className="flex flex-col items-center gap-1.5 flex-1 py-2 rounded-lg transition-all"
              style={{ border: `1px solid ${isSelected ? color : "var(--color-border)"}`, backgroundColor: isSelected ? `${color}14` : "transparent", cursor: "pointer", minHeight: 52 }}
              aria-label={`${score} — ${SCORE_LABELS[score]}`} aria-pressed={isSelected}
            >
              <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: isSelected ? color : "var(--color-border)", backgroundColor: isSelected ? color : "transparent" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: isSelected ? color : "var(--color-secondary)", textAlign: "center", lineHeight: 1.2 }}>{score}</span>
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-2">
        <span style={{ fontSize: 10, color: "var(--color-secondary)" }}>Strongly Disagree</span>
        <span className="hidden md:block" style={{ fontSize: 10, color: "var(--color-secondary)" }}>Neutral</span>
        <span style={{ fontSize: 10, color: "var(--color-secondary)" }}>Strongly Agree</span>
      </div>
    </div>
  );
}

// ── Support modal ─────────────────────────────────────────────────────────────

function SupportModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: "rgba(27,46,75,0.4)" }} onClick={onClose}>
      <div className="w-full max-w-md" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "28px 24px", boxShadow: "0 8px 40px rgba(27,46,75,0.18)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 20, color: "var(--color-navy)", margin: 0 }}>Support is available.</h2>
            <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 6, lineHeight: 1.5 }}>You don't have to navigate this alone.</p>
          </div>
          <button onClick={onClose} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 44, height: 44 }} aria-label="Close"><X size={16} color="var(--color-secondary)" /></button>
        </div>
        <div className="space-y-3">
          <button className="w-full text-left px-4 py-3.5 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", borderRadius: 10 }}>
            <div className="flex items-start gap-3">
              <Users size={18} color="var(--color-navy)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)" }}>Request a check-in with your supervisor</p>
                <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 3, lineHeight: 1.4 }}>Sends an anonymous notification to your PI. Your identity is never shared.</p>
              </div>
            </div>
          </button>
          <a href="#" className="block px-4 py-3.5 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", borderRadius: 10, textDecoration: "none" }}>
            <div className="flex items-start gap-3">
              <Building2 size={18} color="var(--color-navy)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)" }}>Counseling & Psychological Services (CAPS)</p>
                <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 3 }}>University of Michigan CAPS — (734) 764-8312</p>
              </div>
            </div>
          </a>
          <a href="tel:988" className="block px-4 py-3.5 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", borderRadius: 10, textDecoration: "none" }}>
            <div className="flex items-start gap-3">
              <Phone size={18} color="var(--color-navy)" style={{ marginTop: 2 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)" }}>Crisis Support Line</p>
                <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 3 }}>Call or text 988 · Available 24/7</p>
              </div>
            </div>
          </a>
        </div>
        <div className="flex items-center gap-2 mt-5 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
          <Lock size={13} color="var(--color-secondary)" />
          <p style={{ fontSize: 11, color: "var(--color-secondary)", lineHeight: 1.4 }}>Your journal and check-in responses are completely private. Your PI and team cannot see them under any circumstances.</p>
        </div>
      </div>
    </div>
  );
}

// ── Discard draft modal ───────────────────────────────────────────────────────

function DiscardDraftModal({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: "rgba(27,46,75,0.35)" }}>
      <div style={{ backgroundColor: "var(--color-surface)", maxWidth: 380, width: "100%", borderRadius: 10, padding: 28, boxShadow: "0 8px 32px rgba(27,46,75,0.16)" }}>
        <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 16, color: "var(--color-navy)", margin: "0 0 10px" }}>
          You have an unsaved draft.
        </h2>
        <p style={{ fontSize: 13, color: "var(--color-secondary)", lineHeight: 1.5, marginBottom: 20 }}>
          Discard it and start a new entry?
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onKeep} style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)", border: "1px solid var(--color-border)", borderRadius: 7, padding: "8px 16px", backgroundColor: "transparent", cursor: "pointer", fontFamily: "var(--font-roboto)" }}>
            Keep editing
          </button>
          <button onClick={onDiscard} style={{ fontSize: 13, fontWeight: 700, color: "#fff", backgroundColor: "var(--color-error)", border: "none", borderRadius: 7, padding: "8px 16px", cursor: "pointer", fontFamily: "var(--font-roboto)" }}>
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Prompt bank modal ─────────────────────────────────────────────────────────

function PromptBankModal({ activeIds, onSave, onClose }: {
  activeIds: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(activeIds);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3 ? [...prev, id] : prev
    );
  }

  const categories = [...new Set(JOURNAL_PROMPTS.map((p) => p.category))] as PromptCategory[];

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: "rgba(27,46,75,0.35)" }} onClick={onClose}>
      <div style={{ backgroundColor: "var(--color-surface)", maxWidth: 560, width: "100%", borderRadius: 10, padding: 28, boxShadow: "0 8px 40px rgba(27,46,75,0.18)", maxHeight: "85dvh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 17, color: "var(--color-navy)", margin: 0 }}>
            Choose your prompts
          </h2>
          <button onClick={onClose} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 36, height: 36 }} aria-label="Close">
            <X size={16} color="var(--color-secondary)" />
          </button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 20, marginTop: 4 }}>
          Select up to 3 prompts. {selected.length}/3 selected.
        </p>

        {categories.map((cat) => {
          const prompts = JOURNAL_PROMPTS.filter((p) => p.category === cat);
          return (
            <div key={cat} className="mb-5">
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-secondary)", marginBottom: 8 }}>
                {CATEGORY_LABELS[cat]}
              </p>
              <div className="space-y-2">
                {prompts.map((p) => {
                  const isSelected = selected.includes(p.id);
                  const disabled = !isSelected && selected.length >= 3;
                  return (
                    <button
                      key={p.id}
                      onClick={() => !disabled && toggle(p.id)}
                      className="w-full text-left px-4 py-3 rounded-lg transition-all"
                      style={{
                        border: `1px solid ${isSelected ? "var(--color-navy)" : "var(--color-border)"}`,
                        backgroundColor: isSelected ? "rgba(27,46,75,0.05)" : "transparent",
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.45 : 1,
                        fontFamily: "var(--font-lora)",
                        fontSize: 13,
                        color: "var(--color-body)",
                        lineHeight: 1.45,
                      }}
                    >
                      {p.text}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex justify-end gap-2 mt-2 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
          <button onClick={onClose} style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)", border: "1px solid var(--color-border)", borderRadius: 7, padding: "8px 16px", backgroundColor: "transparent", cursor: "pointer", fontFamily: "var(--font-roboto)" }}>
            Cancel
          </button>
          <button
            onClick={() => { onSave(selected); onClose(); }}
            style={{ fontSize: 13, fontWeight: 700, color: "#fff", backgroundColor: "var(--color-navy)", border: "none", borderRadius: 7, padding: "8px 20px", cursor: "pointer", fontFamily: "var(--font-roboto)" }}
          >
            Save prompts
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Left panel ────────────────────────────────────────────────────────────────

function JournalSidebarContent({
  search, setSearch, groupedEntries, selectedEntryId, onSelectEntry, showClose, onClose,
}: {
  search: string; setSearch: (v: string) => void;
  groupedEntries: { today: JournalEntry[]; earlier: JournalEntry[]; older: JournalEntry[] };
  selectedEntryId: string | "new"; onSelectEntry: (id: string | "new") => void;
  showClose?: boolean; onClose?: () => void;
}) {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div>
          <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 16, color: "var(--color-navy)", margin: 0 }}>Journal</h2>
          <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 3 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </p>
        </div>
        {showClose && (
          <button onClick={onClose} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 44, height: 44 }} aria-label="Close entries">
            <X size={16} color="var(--color-secondary)" />
          </button>
        )}
      </div>
      <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <button
          onClick={() => onSelectEntry("new")}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--color-navy)", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", borderRadius: 7, cursor: "pointer", minHeight: 44 }}
        >
          <Plus size={13} /> New Entry
        </button>
      </div>
      <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="var(--color-secondary)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entries..."
            style={{ width: "100%", paddingLeft: 28, paddingRight: 8, height: 32, border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)", outline: "none" }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {groupedEntries.today.length > 0 && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-secondary)", padding: "6px 16px 4px" }}>Today</p>
            {groupedEntries.today.map((e) => <EntryListItem key={e.id} entry={e} selected={selectedEntryId === e.id} onClick={() => onSelectEntry(e.id)} />)}
          </div>
        )}
        {groupedEntries.earlier.length > 0 && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-secondary)", padding: "10px 16px 4px" }}>Earlier</p>
            {groupedEntries.earlier.map((e) => <EntryListItem key={e.id} entry={e} selected={selectedEntryId === e.id} onClick={() => onSelectEntry(e.id)} />)}
          </div>
        )}
        {groupedEntries.older.length > 0 && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-secondary)", padding: "10px 16px 4px" }}>
              {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            {groupedEntries.older.map((e) => <EntryListItem key={e.id} entry={e} selected={selectedEntryId === e.id} onClick={() => onSelectEntry(e.id)} />)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--color-border)", backgroundColor: "var(--color-canvas)" }}>
        <Lock size={12} color="var(--color-secondary)" />
        <span style={{ fontSize: 11, color: "var(--color-secondary)" }}>Only you can see this</span>
      </div>
    </div>
  );
}

function EntryListItem({ entry, selected, onClick }: { entry: JournalEntry; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-2.5 transition-colors"
      style={{ backgroundColor: selected ? "rgba(27,46,75,0.06)" : "transparent", cursor: "pointer", border: "none", borderLeft: selected ? "2px solid var(--color-navy)" : "2px solid transparent", minHeight: 44 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-body)", marginBottom: 2 }}>{formatEntryDate(entry.date)}</p>
      <p style={{ fontSize: 11, color: "var(--color-secondary)", lineHeight: 1.35 }}>
        {entry.prompts[0]?.response ? entry.prompts[0].response.slice(0, 42) + "…" : "No response"}
      </p>
    </button>
  );
}

// ── Journal page ──────────────────────────────────────────────────────────────

export default function JournalPage() {
  const todayISO = getTodayISO();

  const [entries, setEntries]               = useState<JournalEntry[]>(JOURNAL_ENTRIES);
  const [activePromptIds, setActivePromptIds] = useState<string[]>(ACTIVE_PROMPT_IDS);
  const [selectedEntryId, setSelectedEntryId] = useState<string | "new">("new");
  const [responses, setResponses]           = useState<Record<string, string>>({});
  const [checkinResponses, setCheckinResponses] = useState<CheckinResponse[]>([]);
  const [supportOpen, setSupportOpen]       = useState(false);
  const [search, setSearch]                 = useState("");
  const [entryListOpen, setEntryListOpen]   = useState(false);
  const [saveMsg, setSaveMsg]               = useState<{ text: string; color: string } | null>(null);
  const [promptBankOpen, setPromptBankOpen] = useState(false);
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts) < 7 * 24 * 60 * 60 * 1000;
  });

  const activePrompts = activePromptIds
    .map((id) => JOURNAL_PROMPTS.find((p) => p.id === id))
    .filter(Boolean) as typeof JOURNAL_PROMPTS;

  const checkinTotal   = CHECKIN_QUESTIONS.length;
  const checkinAnswered = checkinResponses.length;

  const filteredEntries = entries.filter((e) =>
    !search || e.prompts.some((p) => p.response.toLowerCase().includes(search.toLowerCase()))
  );

  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);

  const groupedEntries = {
    today:   filteredEntries.filter((e) => e.date === todayISO),
    earlier: filteredEntries.filter((e) => { const d = new Date(e.date); return d < new Date(todayISO) && d >= weekAgo; }),
    older:   filteredEntries.filter((e) => new Date(e.date) < weekAgo),
  };

  const isViewingEntry = selectedEntryId !== "new";
  const viewedEntry    = isViewingEntry ? entries.find((e) => e.id === selectedEntryId) : null;

  function hasDraft() {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(DRAFT_KEY);
  }

  function handleSelectEntry(id: string | "new") {
    setSelectedEntryId(id);
    setEntryListOpen(false);
  }

  function handleNewEntry() {
    const draftExists = hasDraft() || Object.values(responses).some((v) => v.trim());
    if (draftExists && selectedEntryId === "new") {
      setDiscardModalOpen(true);
    } else {
      resetToNew();
    }
  }

  function resetToNew() {
    setResponses({});
    setCheckinResponses([]);
    setSelectedEntryId("new");
    setSaveMsg(null);
    localStorage.removeItem(DRAFT_KEY);
    setDiscardModalOpen(false);
  }

  function handleSaveDraft() {
    const draft = { responses, checkinResponses, timestamp: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setSaveMsg({ text: "Draft saved.", color: "var(--color-secondary)" });
    setTimeout(() => setSaveMsg(null), 2000);
  }

  function handleSaveEntry() {
    const hasResponse = Object.values(responses).some((v) => v.trim());
    if (!hasResponse) {
      setSaveMsg({ text: "Write at least one reflection to save.", color: "var(--color-error)" });
      setTimeout(() => setSaveMsg(null), 3000);
      return;
    }

    const newEntry: JournalEntry = {
      id: crypto.randomUUID(),
      userId: CURRENT_USER_ID,
      date: todayISO,
      prompts: activePrompts.map((p) => ({
        promptId: p.id,
        promptText: p.text,
        response: responses[p.id] ?? "",
      })),
      checkin: checkinResponses,
      isDraft: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setEntries((prev) => [newEntry, ...prev]);
    localStorage.removeItem(DRAFT_KEY);

    setSaveMsg({ text: "✓ Entry saved.", color: "var(--color-success)" });
    setTimeout(() => {
      setSaveMsg(null);
      setSelectedEntryId(newEntry.id);
    }, 3000);
  }

  useEffect(() => {
    if (entryListOpen) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [entryListOpen]);

  const showPromptBanner = !isViewingEntry && !promptDismissed;

  return (
    <div className="flex h-full" style={{ fontFamily: "var(--font-roboto)" }}>

      {entryListOpen && (
        <div className="fixed inset-0 z-20 md:hidden" style={{ backgroundColor: "rgba(0,0,0,0.3)" }} onClick={() => setEntryListOpen(false)} aria-hidden="true" />
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col shrink-0" style={{ width: 230, borderRight: "1px solid var(--color-border)" }}>
        <JournalSidebarContent
          search={search} setSearch={setSearch}
          groupedEntries={groupedEntries}
          selectedEntryId={selectedEntryId}
          onSelectEntry={(id) => {
            if (id === "new") { handleNewEntry(); } else { handleSelectEntry(id); }
          }}
        />
      </div>

      {/* Mobile drawer */}
      <div className="md:hidden fixed top-0 left-0 h-full z-30" style={{ width: 280, transform: entryListOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.22s ease-out", borderRight: "1px solid var(--color-border)" }} aria-hidden={!entryListOpen}>
        <JournalSidebarContent
          search={search} setSearch={setSearch}
          groupedEntries={groupedEntries}
          selectedEntryId={selectedEntryId}
          onSelectEntry={(id) => {
            if (id === "new") { handleNewEntry(); } else { handleSelectEntry(id); }
          }}
          showClose onClose={() => setEntryListOpen(false)}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1" style={{ maxWidth: 700, margin: "0 auto", padding: "28px 16px 80px", width: "100%" }}>

          <button onClick={() => setEntryListOpen(true)} className="md:hidden flex items-center gap-1.5 mb-5 px-3 py-2 rounded-lg hover:bg-[rgba(27,46,75,0.06)] transition-colors" style={{ fontSize: 13, color: "var(--color-navy)", fontWeight: 600, border: "1px solid var(--color-border)", borderRadius: 7, backgroundColor: "var(--color-surface)", minHeight: 44 }}>
            <ChevronLeft size={15} /> Entries
          </button>

          {/* Header */}
          <div className="flex items-start justify-between mb-7 gap-3">
            <div>
              <h1 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 26, color: "var(--color-navy)", margin: 0, lineHeight: 1.2 }}>
                {isViewingEntry && viewedEntry ? formatEntryDate(viewedEntry.date) : "Today's Entry"}
              </h1>
              <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 5 }}>
                {isViewingEntry && viewedEntry ? formatFullDate(viewedEntry.date) : formatFullDate(todayISO)}
              </p>
            </div>
            {!isViewingEntry && (
              <button onClick={() => setSupportOpen(true)} className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg shrink-0" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-navy)", color: "var(--color-navy)", fontSize: 12, fontWeight: 600, borderRadius: 7, cursor: "pointer", minHeight: 44 }}>
                <HelpingHand size={14} />
                <span className="hidden sm:inline">Need support?</span>
                <span className="sm:hidden">Support</span>
              </button>
            )}
          </div>

          {/* Weekly prompt banner */}
          {showPromptBanner && (
            <div className="mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-lg animate-fade-in" style={{ backgroundColor: "rgba(27,46,75,0.04)", border: "1px solid var(--color-border)", borderRadius: 8 }}>
              <p style={{ fontSize: 13, color: "var(--color-body)" }}>Using these prompts again next week?</p>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => { localStorage.setItem(DISMISS_KEY, String(Date.now())); setPromptDismissed(true); }}
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--color-navy)", border: "1px solid var(--color-navy)", borderRadius: 6, padding: "5px 12px", backgroundColor: "transparent", cursor: "pointer", fontFamily: "var(--font-roboto)" }}
                >
                  Keep them
                </button>
                <button
                  onClick={() => setPromptBankOpen(true)}
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--color-secondary)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "5px 12px", backgroundColor: "transparent", cursor: "pointer", fontFamily: "var(--font-roboto)" }}
                >
                  Edit prompts
                </button>
              </div>
            </div>
          )}

          {/* Reflections */}
          <div className="mb-8">
            <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 16, color: "var(--color-body)", marginBottom: 16 }}>Reflections</h2>
            <div className="space-y-4">
              {isViewingEntry && viewedEntry ? (
                viewedEntry.prompts.map((pr, i) => (
                  <PromptCard key={pr.promptId} number={i + 1} promptText={pr.promptText} response={pr.response} onResponseChange={() => {}} />
                ))
              ) : (
                activePrompts.map((prompt, i) => (
                  <PromptCard
                    key={prompt.id} number={i + 1} promptText={prompt.text}
                    response={responses[prompt.id] ?? ""}
                    onResponseChange={(v) => setResponses((prev) => ({ ...prev, [prompt.id]: v }))}
                  />
                ))
              )}
            </div>
          </div>

          {/* Weekly check-in */}
          <div className="mb-8">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 16, color: "var(--color-body)", margin: 0 }}>Weekly Check-in</h2>
                <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 4, lineHeight: 1.4 }}>Takes under 2 minutes. Responses are private.</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-secondary)", whiteSpace: "nowrap", paddingTop: 2 }}>
                {isViewingEntry && viewedEntry ? viewedEntry.checkin.length : checkinAnswered} / {checkinTotal} answered
              </span>
            </div>
            <div className="space-y-3">
              {CHECKIN_QUESTIONS.map((q) => {
                const existing = isViewingEntry && viewedEntry
                  ? viewedEntry.checkin.find((r) => r.questionId === q.id)
                  : checkinResponses.find((r) => r.questionId === q.id);
                return (
                  <CheckinCard key={q.id} question={q} response={existing} onScore={(score) => {
                    if (isViewingEntry) return;
                    setCheckinResponses((prev) => [...prev.filter((r) => r.questionId !== q.id), { questionId: q.id, score }]);
                  }} />
                );
              })}
            </div>
          </div>
        </div>

        {/* Save bar */}
        {!isViewingEntry && (
          <div className="sticky bottom-0 flex items-center justify-between px-4 md:px-6 py-3 gap-3" style={{ backgroundColor: "var(--color-surface)", borderTop: "1px solid var(--color-border)" }}>
            <span style={{ fontSize: 12, color: "var(--color-secondary)" }} className="hidden sm:block">Your entry is private and encrypted.</span>
            <div className="flex items-center gap-2 ml-auto">
              {saveMsg && (
                <span style={{ fontSize: 12, color: saveMsg.color, fontWeight: 600 }} role="status">{saveMsg.text}</span>
              )}
              <button
                onClick={handleSaveDraft}
                style={{ fontSize: 12, fontWeight: 700, color: "var(--color-navy)", border: "1px solid var(--color-navy)", borderRadius: 7, padding: "8px 14px", backgroundColor: "transparent", cursor: "pointer", minHeight: 44 }}
              >
                Save draft
              </button>
              <button
                onClick={handleSaveEntry}
                style={{ fontSize: 12, fontWeight: 700, color: "#fff", backgroundColor: "var(--color-navy)", border: "none", borderRadius: 7, padding: "8px 14px", cursor: "pointer", minHeight: 44 }}
              >
                Save entry
              </button>
            </div>
          </div>
        )}
      </div>

      {supportOpen     && <SupportModal onClose={() => setSupportOpen(false)} />}
      {promptBankOpen  && <PromptBankModal activeIds={activePromptIds} onSave={setActivePromptIds} onClose={() => setPromptBankOpen(false)} />}
      {discardModalOpen && <DiscardDraftModal onKeep={() => setDiscardModalOpen(false)} onDiscard={resetToNew} />}
    </div>
  );
}
