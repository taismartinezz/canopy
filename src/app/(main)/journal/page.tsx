"use client";

import { useState, useRef, useEffect } from "react";
import {
  JOURNAL_ENTRIES, JOURNAL_PROMPTS, ACTIVE_PROMPT_IDS,
  CHECKIN_QUESTIONS, CHECKIN_LABELS, CHECKIN_COLORS,
} from "@/lib/mock-data";
import type { JournalEntry, CheckinResponse } from "@/types";
import { Lock, Mic, MicOff, HelpingHand, Search, Plus, ChevronDown, X, Phone } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEntryDate(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFullDate(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function getTodayISO() {
  return new Date().toISOString().split("T")[0];
}

// ── Prompt card ───────────────────────────────────────────────────────────────

function PromptCard({
  number,
  promptText,
  response,
  onResponseChange,
}: {
  number: number;
  promptText: string;
  response: string;
  onResponseChange: (v: string) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(96, el.scrollHeight)}px`;
  }, [response]);

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
            style={{
              backgroundColor: "var(--color-navy)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "var(--font-roboto)",
            }}
          >
            {number}
          </span>
          <span
            style={{
              fontFamily: "var(--font-lora)",
              fontWeight: 600,
              fontSize: 14,
              color: "var(--color-body)",
              lineHeight: 1.35,
            }}
          >
            {promptText}
          </span>
        </div>

        {/* Voice input button */}
        <button
          onClick={() => setIsRecording(!isRecording)}
          className="relative shrink-0 flex items-center justify-center rounded-full transition-all"
          style={{
            width: 32,
            height: 32,
            minWidth: 44,
            minHeight: 44,
            backgroundColor: isRecording ? "#C0392B" : "var(--color-navy)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
          aria-label={isRecording ? "Stop recording" : "Voice input"}
          title={isRecording ? "Stop recording" : "Voice input"}
        >
          {isRecording ? (
            <>
              <MicOff size={14} />
              <span
                className="absolute inset-0 rounded-full animate-pulse-ring"
                style={{ border: "2px solid #C0392B" }}
              />
            </>
          ) : (
            <Mic size={14} />
          )}
        </button>
      </div>

      {/* Response textarea */}
      <div className="px-5 py-4">
        <textarea
          ref={textareaRef}
          value={response}
          onChange={(e) => onResponseChange(e.target.value)}
          placeholder="Take a moment. There's no right answer here."
          style={{
            width: "100%",
            fontSize: 14,
            color: "var(--color-body)",
            fontFamily: "var(--font-roboto)",
            lineHeight: 1.65,
            backgroundColor: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            minHeight: 96,
            caretColor: "var(--color-navy)",
          }}
        />
      </div>
    </div>
  );
}

// ── Weekly check-in ───────────────────────────────────────────────────────────

const SCORE_LABELS: Record<number, string> = CHECKIN_LABELS as unknown as Record<number, string>;
const SCORE_COLORS: Record<number, string> = CHECKIN_COLORS as unknown as Record<number, string>;

function CheckinCard({
  question,
  response,
  onScore,
}: {
  question: { id: string; text: string };
  response?: CheckinResponse;
  onScore: (score: 1 | 2 | 3 | 4 | 5) => void;
}) {
  const selected = response?.score;

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface)",
        border: `2px solid ${selected !== undefined ? SCORE_COLORS[selected] : "var(--color-border)"}`,
        borderRadius: 10,
        padding: "16px 20px",
        transition: "border-color 0.2s",
      }}
    >
      <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.5, marginBottom: 14 }}>
        {question.text}
      </p>

      {/* Likert scale */}
      <div className="flex items-center gap-2">
        {([1, 2, 3, 4, 5] as const).map((score) => {
          const isSelected = selected === score;
          const color = SCORE_COLORS[score];
          return (
            <button
              key={score}
              onClick={() => onScore(score)}
              className="flex flex-col items-center gap-1.5 flex-1 py-2 rounded-lg transition-all"
              style={{
                border: `1px solid ${isSelected ? color : "var(--color-border)"}`,
                backgroundColor: isSelected ? `${color}14` : "transparent",
                cursor: "pointer",
                minHeight: 44,
              }}
              aria-label={`${score} — ${SCORE_LABELS[score]}`}
              aria-pressed={isSelected}
            >
              <span
                className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                style={{
                  borderColor: isSelected ? color : "var(--color-border)",
                  backgroundColor: isSelected ? color : "transparent",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: isSelected ? color : "var(--color-secondary)",
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                {score}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-2">
        <span style={{ fontSize: 10, color: "var(--color-secondary)" }}>Strongly Disagree</span>
        <span style={{ fontSize: 10, color: "var(--color-secondary)" }}>Strongly Agree</span>
      </div>
    </div>
  );
}

// ── Support modal ─────────────────────────────────────────────────────────────

function SupportModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: "rgba(27,46,75,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: "32px 28px",
          boxShadow: "0 8px 40px rgba(27,46,75,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2
              style={{
                fontFamily: "var(--font-lora)",
                fontWeight: 700,
                fontSize: 20,
                color: "var(--color-navy)",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Support is available.
            </h2>
            <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 6, lineHeight: 1.5 }}>
              You don't have to navigate this alone.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)] transition-colors shrink-0 mt-0.5"
            aria-label="Close"
          >
            <X size={16} color="var(--color-secondary)" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Request check-in */}
          <button
            className="w-full text-left px-4 py-3.5 rounded-lg transition-all hover:shadow-sm"
            style={{
              backgroundColor: "var(--color-canvas)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
            }}
          >
            <div className="flex items-start gap-3">
              <span style={{ fontSize: 18, marginTop: 1 }}>🤝</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)" }}>
                  Request a check-in with your supervisor
                </p>
                <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 3, lineHeight: 1.4 }}>
                  Sends an anonymous notification to your PI. Your identity is never shared.
                </p>
              </div>
            </div>
          </button>

          {/* CAPS */}
          <a
            href="#"
            className="block px-4 py-3.5 rounded-lg transition-all hover:shadow-sm"
            style={{
              backgroundColor: "var(--color-canvas)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              textDecoration: "none",
            }}
          >
            <div className="flex items-start gap-3">
              <span style={{ fontSize: 18, marginTop: 1 }}>🏛️</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)" }}>
                  Counseling & Psychological Services (CAPS)
                </p>
                <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 3 }}>
                  University of Michigan CAPS — (734) 764-8312
                </p>
              </div>
            </div>
          </a>

          {/* 988 */}
          <a
            href="tel:988"
            className="block px-4 py-3.5 rounded-lg transition-all hover:shadow-sm"
            style={{
              backgroundColor: "var(--color-canvas)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              textDecoration: "none",
            }}
          >
            <div className="flex items-start gap-3">
              <Phone size={18} color="var(--color-navy)" style={{ marginTop: 2 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)" }}>
                  Crisis Support Line
                </p>
                <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 3 }}>
                  Call or text 988 · Available 24/7
                </p>
              </div>
            </div>
          </a>
        </div>

        <div
          className="flex items-center gap-2 mt-5 pt-4"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <Lock size={13} color="var(--color-secondary)" />
          <p style={{ fontSize: 11, color: "var(--color-secondary)", lineHeight: 1.4 }}>
            Your journal and check-in responses are completely private. Your PI and team cannot see them under any circumstances.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Journal page ──────────────────────────────────────────────────────────────

export default function JournalPage() {
  const todayISO = getTodayISO();

  const [selectedEntryId, setSelectedEntryId] = useState<string | "new">("new");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [checkinResponses, setCheckinResponses] = useState<CheckinResponse[]>([]);
  const [supportOpen, setSupportOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");

  const activePrompts = ACTIVE_PROMPT_IDS.map(
    (id) => JOURNAL_PROMPTS.find((p) => p.id === id)
  ).filter(Boolean) as typeof JOURNAL_PROMPTS;

  const allEntries = JOURNAL_ENTRIES;

  const checkinAnswered = checkinResponses.length;
  const checkinTotal = CHECKIN_QUESTIONS.length;

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const filteredEntries = allEntries.filter((e) => {
    if (!search) return true;
    return e.prompts.some((p) => p.response.toLowerCase().includes(search.toLowerCase()));
  });

  const groupedEntries = {
    today: filteredEntries.filter((e) => e.date === todayISO),
    earlier: filteredEntries.filter((e) => {
      const d = new Date(e.date);
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return d < new Date(todayISO) && d >= weekAgo;
    }),
    older: filteredEntries.filter((e) => {
      const d = new Date(e.date);
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return d < weekAgo;
    }),
  };

  function getEntryPreview(entry: JournalEntry) {
    const first = entry.prompts[0];
    if (!first?.response) return "No response";
    return first.response.slice(0, 48) + (first.response.length > 48 ? "…" : "");
  }

  const isViewingEntry = selectedEntryId !== "new";
  const viewedEntry = isViewingEntry
    ? allEntries.find((e) => e.id === selectedEntryId)
    : null;

  return (
    <div className="flex h-full" style={{ fontFamily: "var(--font-roboto)" }}>

      {/* ── Left panel ── */}
      <div
        className="flex flex-col shrink-0"
        style={{
          width: 230,
          backgroundColor: "var(--color-surface)",
          borderRight: "1px solid var(--color-border)",
        }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <h2
            style={{
              fontFamily: "var(--font-lora)",
              fontWeight: 700,
              fontSize: 16,
              color: "var(--color-navy)",
              margin: 0,
            }}
          >
            Journal
          </h2>
          <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 3 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </p>
        </div>

        {/* New entry button */}
        <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <button
            onClick={() => setSelectedEntryId("new")}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--color-navy)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              border: "none",
              borderRadius: 7,
              cursor: "pointer",
              minHeight: 36,
            }}
          >
            <Plus size={13} /> New Entry
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="var(--color-secondary)" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search entries..."
              style={{
                width: "100%",
                paddingLeft: 28,
                paddingRight: 8,
                height: 30,
                border: "1px solid var(--color-border)",
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "var(--font-roboto)",
                backgroundColor: "var(--color-canvas)",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* Today */}
          {groupedEntries.today.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-secondary)", padding: "6px 16px 4px" }}>Today</p>
              {groupedEntries.today.map((e) => (
                <EntryListItem key={e.id} entry={e} selected={selectedEntryId === e.id} onClick={() => setSelectedEntryId(e.id)} />
              ))}
            </div>
          )}

          {/* Earlier this week */}
          {groupedEntries.earlier.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-secondary)", padding: "10px 16px 4px" }}>Earlier</p>
              {groupedEntries.earlier.map((e) => (
                <EntryListItem key={e.id} entry={e} selected={selectedEntryId === e.id} onClick={() => setSelectedEntryId(e.id)} />
              ))}
            </div>
          )}

          {/* Older */}
          {groupedEntries.older.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-secondary)", padding: "10px 16px 4px" }}>
                {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
              {groupedEntries.older.map((e) => (
                <EntryListItem key={e.id} entry={e} selected={selectedEntryId === e.id} onClick={() => setSelectedEntryId(e.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Privacy anchor badge */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderTop: "1px solid var(--color-border)", backgroundColor: "var(--color-canvas)" }}
        >
          <Lock size={12} color="var(--color-secondary)" />
          <span style={{ fontSize: 11, color: "var(--color-secondary)", lineHeight: 1.35 }}>
            Only you can see this
          </span>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex-1 overflow-y-auto">
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 24px 80px" }}>

          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1
                style={{
                  fontFamily: "var(--font-lora)",
                  fontWeight: 700,
                  fontSize: 26,
                  color: "var(--color-navy)",
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {isViewingEntry && viewedEntry ? formatEntryDate(viewedEntry.date) : "Today's Entry"}
              </h1>
              <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 5 }}>
                {isViewingEntry && viewedEntry
                  ? formatFullDate(viewedEntry.date)
                  : formatFullDate(todayISO)}
              </p>
            </div>

            {!isViewingEntry && (
              <button
                onClick={() => setSupportOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all hover:shadow-sm"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-navy)",
                  color: "var(--color-navy)",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 7,
                  cursor: "pointer",
                  minHeight: 44,
                }}
              >
                <HelpingHand size={14} />
                Need support?
              </button>
            )}
          </div>

          {/* Reflections */}
          <div className="mb-8">
            <h2
              style={{
                fontFamily: "var(--font-lora)",
                fontWeight: 600,
                fontSize: 16,
                color: "var(--color-body)",
                marginBottom: 16,
              }}
            >
              Reflections
            </h2>

            <div className="space-y-4">
              {isViewingEntry && viewedEntry ? (
                viewedEntry.prompts.map((pr, i) => (
                  <PromptCard
                    key={pr.promptId}
                    number={i + 1}
                    promptText={pr.promptText}
                    response={pr.response}
                    onResponseChange={() => {}}
                  />
                ))
              ) : (
                activePrompts.map((prompt, i) => (
                  <PromptCard
                    key={prompt.id}
                    number={i + 1}
                    promptText={prompt.text}
                    response={responses[prompt.id] ?? ""}
                    onResponseChange={(v) => setResponses((prev) => ({ ...prev, [prompt.id]: v }))}
                  />
                ))
              )}
            </div>
          </div>

          {/* Weekly check-in */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2
                  style={{
                    fontFamily: "var(--font-lora)",
                    fontWeight: 600,
                    fontSize: 16,
                    color: "var(--color-body)",
                    margin: 0,
                  }}
                >
                  Weekly Check-in
                </h2>
                <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 4, lineHeight: 1.4 }}>
                  Takes under 2 minutes. Responses are private and help track your well-being over time.
                </p>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--color-secondary)",
                  whiteSpace: "nowrap",
                  marginLeft: 16,
                }}
              >
                {isViewingEntry && viewedEntry
                  ? `${viewedEntry.checkin.length} / ${checkinTotal} answered`
                  : `${checkinAnswered} / ${checkinTotal} answered`}
              </span>
            </div>

            <div className="space-y-3 mt-4">
              {CHECKIN_QUESTIONS.map((q) => {
                const existing = isViewingEntry && viewedEntry
                  ? viewedEntry.checkin.find((r) => r.questionId === q.id)
                  : checkinResponses.find((r) => r.questionId === q.id);
                return (
                  <CheckinCard
                    key={q.id}
                    question={q}
                    response={existing}
                    onScore={(score) => {
                      if (isViewingEntry) return;
                      setCheckinResponses((prev) => {
                        const next = prev.filter((r) => r.questionId !== q.id);
                        return [...next, { questionId: q.id, score }];
                      });
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Save bar (fixed at bottom of scroll area) */}
        {!isViewingEntry && (
          <div
            className="sticky bottom-0 flex items-center justify-between px-6 py-3"
            style={{
              backgroundColor: "var(--color-surface)",
              borderTop: "1px solid var(--color-border)",
              maxWidth: 700,
              margin: "0 auto",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--color-secondary)" }}>
              Your entry is private and encrypted.
            </span>
            <div className="flex items-center gap-2">
              {saved && (
                <span style={{ fontSize: 12, color: "var(--color-success)", fontWeight: 600 }}>
                  ✓ Entry saved
                </span>
              )}
              <button
                onClick={() => {}}
                className="px-4 py-1.5 rounded-lg transition-colors hover:bg-[rgba(27,46,75,0.06)]"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--color-navy)",
                  border: "1px solid var(--color-navy)",
                  borderRadius: 7,
                  cursor: "pointer",
                  backgroundColor: "transparent",
                  minHeight: 36,
                }}
              >
                Save draft
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-1.5 rounded-lg transition-opacity hover:opacity-90"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#fff",
                  backgroundColor: "var(--color-navy)",
                  border: "none",
                  borderRadius: 7,
                  cursor: "pointer",
                  minHeight: 36,
                }}
              >
                Save entry
              </button>
            </div>
          </div>
        )}
      </div>

      {supportOpen && <SupportModal onClose={() => setSupportOpen(false)} />}
    </div>
  );
}

// ── Entry list item ───────────────────────────────────────────────────────────

function EntryListItem({
  entry,
  selected,
  onClick,
}: {
  entry: JournalEntry;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2.5 transition-colors"
      style={{
        backgroundColor: selected ? "rgba(27,46,75,0.06)" : "transparent",
        cursor: "pointer",
        border: "none",
        borderLeft: selected ? "2px solid var(--color-navy)" : "2px solid transparent",
        minHeight: 44,
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-body)", marginBottom: 2 }}>
        {formatEntryDate(entry.date)}
      </p>
      <p style={{ fontSize: 11, color: "var(--color-secondary)", lineHeight: 1.35 }}>
        {entry.prompts[0]?.response
          ? entry.prompts[0].response.slice(0, 42) + "…"
          : "No response"}
      </p>
    </button>
  );
}
