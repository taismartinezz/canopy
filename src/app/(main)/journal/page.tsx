"use client";

import { useState, useRef, useEffect } from "react";
import {
  CHECKIN_QUESTIONS, CHECKIN_LABELS, CHECKIN_COLORS,
} from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import type { JournalEntry, CheckinResponse, PromptCategory } from "@/types";
import { Lock, Mic, MicOff, HelpingHand, Search, Plus, X, Phone, ChevronLeft, Users, Building2 } from "lucide-react";

// ── Preset prompts for the picker ─────────────────────────────────────────────

const DEFAULT_PROMPT = "How was your day?";
const PRESET_PROMPTS = [
  "What challenged you today?",
  "What are you grateful for?",
  "What's on your mind about your research?",
  "How are you feeling about your team?",
  "What do you want to remember from today?",
];

type AddedPrompt = { id: string; text: string; response: string };

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
                <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 3 }}>Check with your institution's counseling services</p>
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

// ── Prompt picker dropdown ────────────────────────────────────────────────────

function PromptPicker({ usedTexts, onSelect, onClose }: {
  usedTexts: string[];
  onSelect: (text: string) => void;
  onClose: () => void;
}) {
  const available = PRESET_PROMPTS.filter((t) => !usedTexts.includes(t));

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (available.length === 0) return null;

  return (
    <div className="animate-fade-in" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30, width: 300, backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, boxShadow: "var(--shadow-card)", padding: "6px 0" }}>
      {available.map((text) => (
        <button
          key={text}
          onClick={() => { onSelect(text); onClose(); }}
          className="w-full text-left px-4 py-2.5 hover:bg-[rgba(27,46,75,0.05)] transition-colors"
          style={{ fontSize: 13, color: "var(--color-body)", fontFamily: "var(--font-lora)", lineHeight: 1.4, background: "none", border: "none", cursor: "pointer" }}
        >
          {text}
        </button>
      ))}
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

  const [entries, setEntries]               = useState<JournalEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [authUserId, setAuthUserId]         = useState("local");
  const [selectedEntryId, setSelectedEntryId] = useState<string | "new">("new");
  // New prompt state
  const [defaultResponse, setDefaultResponse] = useState("");
  const [addedPrompts, setAddedPrompts]     = useState<AddedPrompt[]>([]);
  const [promptPickerOpen, setPromptPickerOpen] = useState(false);
  const [checkinResponses, setCheckinResponses] = useState<CheckinResponse[]>([]);
  const [supportOpen, setSupportOpen]       = useState(false);
  const [search, setSearch]                 = useState("");
  const [entryListOpen, setEntryListOpen]   = useState(false);
  const [saveMsg, setSaveMsg]               = useState<{ text: string; color: string } | null>(null);
  const [discardModalOpen, setDiscardModalOpen] = useState(false);

  const checkinTotal    = CHECKIN_QUESTIONS.length;
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
    const hasContent = defaultResponse.trim() || addedPrompts.some((p) => p.response.trim());
    const draftExists = hasDraft() || hasContent;
    if (draftExists && selectedEntryId === "new") {
      setDiscardModalOpen(true);
    } else {
      resetToNew();
    }
  }

  function resetToNew() {
    setDefaultResponse("");
    setAddedPrompts([]);
    setCheckinResponses([]);
    setSelectedEntryId("new");
    setSaveMsg(null);
    localStorage.removeItem(DRAFT_KEY);
    setDiscardModalOpen(false);
  }

  function handleSaveDraft() {
    const draft = { defaultResponse, addedPrompts, checkinResponses, timestamp: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setSaveMsg({ text: "Draft saved.", color: "var(--color-secondary)" });
    setTimeout(() => setSaveMsg(null), 2000);
  }

  function addPrompt(text: string) {
    setAddedPrompts((prev) => [...prev, { id: crypto.randomUUID(), text, response: "" }]);
  }

  function removePrompt(id: string) {
    setAddedPrompts((prev) => prev.filter((p) => p.id !== id));
  }

  function updateAddedResponse(id: string, response: string) {
    setAddedPrompts((prev) => prev.map((p) => p.id === id ? { ...p, response } : p));
  }

  async function handleSaveEntry() {
    const hasResponse = defaultResponse.trim() || addedPrompts.some((p) => p.response.trim());
    if (!hasResponse) {
      setSaveMsg({ text: "Write at least one reflection to save.", color: "var(--color-error)" });
      setTimeout(() => setSaveMsg(null), 3000);
      return;
    }

    const allPrompts = [
      { promptId: "default", promptText: DEFAULT_PROMPT, response: defaultResponse },
      ...addedPrompts.map((p) => ({ promptId: p.id, promptText: p.text, response: p.response })),
    ].filter((p) => p.response.trim());

    const content = {
      date: todayISO,
      prompts: allPrompts,
      checkin: checkinResponses,
      isDraft: false,
    };

    const { data, error } = await supabase
      .from("journal_entries")
      .insert({ user_id: authUserId, content })
      .select()
      .single();

    if (error) {
      console.error("[Journal] insert error:", error);
      setSaveMsg({ text: "Failed to save. Please try again.", color: "var(--color-error)" });
      setTimeout(() => setSaveMsg(null), 3000);
      return;
    }

    const newEntry: JournalEntry = {
      id: data.id as string,
      userId: authUserId,
      date: todayISO,
      prompts: content.prompts,
      checkin: content.checkin,
      isDraft: false,
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      if (!user) { setLoadingEntries(false); return; }
      setAuthUserId(user.id);
      supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) console.error("[Journal] query error:", error);
          if (!error && data) setEntries(data.map((row) => {
            const c = (row.content ?? {}) as {
              date?: string;
              prompts?: JournalEntry["prompts"];
              checkin?: JournalEntry["checkin"];
              isDraft?: boolean;
            };
            return {
              id: row.id as string,
              userId: row.user_id as string,
              date: c.date ?? (row.created_at as string).split("T")[0],
              prompts: c.prompts ?? [],
              checkin: c.checkin ?? [],
              isDraft: c.isDraft ?? false,
              createdAt: row.created_at as string,
              updatedAt: row.updated_at as string,
            };
          }));
          setLoadingEntries(false);
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

          {/* Reflections */}
          <div className="mb-8">
            <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 16, color: "var(--color-body)", marginBottom: 16 }}>Reflections</h2>
            <div className="space-y-4">
              {isViewingEntry && viewedEntry ? (
                viewedEntry.prompts.map((pr, i) => (
                  <PromptCard key={pr.promptId} number={i + 1} promptText={pr.promptText} response={pr.response} onResponseChange={() => {}} />
                ))
              ) : (
                <>
                  {/* Default prompt */}
                  <PromptCard
                    number={1}
                    promptText={DEFAULT_PROMPT}
                    response={defaultResponse}
                    onResponseChange={setDefaultResponse}
                  />

                  {/* User-added prompts */}
                  {addedPrompts.map((p, i) => (
                    <div key={p.id} className="relative">
                      <PromptCard
                        number={i + 2}
                        promptText={p.text}
                        response={p.response}
                        onResponseChange={(v) => updateAddedResponse(p.id, v)}
                      />
                      <button
                        onClick={() => removePrompt(p.id)}
                        className="absolute top-3 right-14 flex items-center justify-center rounded hover:bg-[rgba(27,46,75,0.06)]"
                        style={{ width: 28, height: 28 }}
                        aria-label="Remove prompt"
                      >
                        <X size={14} color="var(--color-secondary)" />
                      </button>
                    </div>
                  ))}

                  {/* Add a prompt button */}
                  {addedPrompts.length < PRESET_PROMPTS.length && (
                    <div className="relative" style={{ display: "inline-block" }}>
                      <button
                        onClick={() => setPromptPickerOpen((o) => !o)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors hover:bg-[rgba(27,46,75,0.06)]"
                        style={{ fontSize: 13, color: "var(--color-navy)", fontWeight: 600, border: "1px dashed var(--color-border)", borderRadius: 8, cursor: "pointer", backgroundColor: "transparent", fontFamily: "var(--font-roboto)" }}
                      >
                        <Plus size={14} /> Add a prompt
                      </button>
                      {promptPickerOpen && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setPromptPickerOpen(false)} aria-hidden="true" />
                          <div style={{ position: "relative", zIndex: 30 }}>
                            <PromptPicker
                              usedTexts={addedPrompts.map((p) => p.text)}
                              onSelect={addPrompt}
                              onClose={() => setPromptPickerOpen(false)}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
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

      {supportOpen      && <SupportModal onClose={() => setSupportOpen(false)} />}
      {discardModalOpen && <DiscardDraftModal onKeep={() => setDiscardModalOpen(false)} onDiscard={resetToNew} />}
    </div>
  );
}
