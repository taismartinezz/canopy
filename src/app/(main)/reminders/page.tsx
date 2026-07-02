"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, RefreshCw, Check, Trash2, Mail, ChevronDown, ChevronUp } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import ClientOnly from "@/components/ui/ClientOnly";
import type { Reminder, ReminderPriority, ReminderRecurrence } from "@/types";

// ── Natural language date parser ──────────────────────────────────────────────

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseTime(text: string): { h: number; m: number } | null {
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!match) return null;
  let h = parseInt(match[1]);
  const m = parseInt(match[2] ?? "0");
  const meridiem = match[3].toLowerCase();
  if (meridiem === "pm" && h !== 12) h += 12;
  if (meridiem === "am" && h === 12) h = 0;
  return { h, m };
}

function setTimeTo(d: Date, h: number, m: number): Date {
  const out = new Date(d);
  out.setHours(h, m, 0, 0);
  return out;
}

export function parseNaturalDate(text: string): Date | null {
  const lower = text.toLowerCase().trim();
  if (!lower) return null;
  const now = new Date();
  const time = parseTime(lower);
  const defaultH = 9;

  if (lower.includes("tonight")) {
    return setTimeTo(now, time?.h ?? 20, time?.m ?? 0);
  }
  if (lower.includes("this morning")) {
    return setTimeTo(now, time?.h ?? 9, time?.m ?? 0);
  }
  if (lower.includes("this afternoon")) {
    return setTimeTo(now, time?.h ?? 14, time?.m ?? 0);
  }
  if (lower.includes("this evening")) {
    return setTimeTo(now, time?.h ?? 18, time?.m ?? 0);
  }
  if (lower.includes("today")) {
    return setTimeTo(now, time?.h ?? now.getHours() + 1, time?.m ?? 0);
  }
  if (lower.includes("tomorrow")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return setTimeTo(d, time?.h ?? defaultH, time?.m ?? 0);
  }
  if (lower.includes("next week")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return setTimeTo(d, time?.h ?? defaultH, time?.m ?? 0);
  }
  if (lower.includes("next month")) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + 1, 1);
    return setTimeTo(d, time?.h ?? defaultH, time?.m ?? 0);
  }

  // "in X minutes / hours / days"
  const inMatch = lower.match(/\bin (\d+)\s*(min(?:ute)?s?|hour?s?|days?)\b/);
  if (inMatch) {
    const n = parseInt(inMatch[1]);
    const unit = inMatch[2];
    const d = new Date(now);
    if (unit.startsWith("min")) d.setMinutes(d.getMinutes() + n);
    else if (unit.startsWith("hour") || unit.startsWith("hr")) d.setHours(d.getHours() + n);
    else d.setDate(d.getDate() + n);
    return d;
  }

  // day of week
  for (let i = 0; i < DAYS.length; i++) {
    if (lower.includes(DAYS[i])) {
      const d = new Date(now);
      let diff = i - d.getDay();
      if (diff <= 0) diff += 7;
      d.setDate(d.getDate() + diff);
      return setTimeTo(d, time?.h ?? defaultH, time?.m ?? 0);
    }
  }

  return null;
}

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStr = now.toDateString();
  const tmrw = new Date(now);
  tmrw.setDate(tmrw.getDate() + 1);

  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (d.toDateString() === todayStr) return `Today, ${timeStr}`;
  if (d.toDateString() === tmrw.toDateString()) return `Tomorrow, ${timeStr}`;

  const daysDiff = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (daysDiff > 0 && daysDiff < 7) {
    return d.toLocaleDateString("en-US", { weekday: "short" }) + `, ${timeStr}`;
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(iso?: string): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

// ── Priority config ───────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<ReminderPriority, { label: string; symbol: string; color: string }> = {
  low:    { label: "Low",    symbol: "!",   color: "#3B82F6" },
  medium: { label: "Medium", symbol: "!!",  color: "#F59E0B" },
  high:   { label: "High",   symbol: "!!!", color: "#EF4444" },
};

const RECURRENCE_OPTIONS: { value: ReminderRecurrence | ""; label: string }[] = [
  { value: "",        label: "Never" },
  { value: "daily",   label: "Daily" },
  { value: "weekly",  label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

// ── Completion circle ─────────────────────────────────────────────────────────

function CompletionCircle({
  priority,
  completing,
  onClick,
}: {
  priority?: ReminderPriority;
  completing: boolean;
  onClick: () => void;
}) {
  const borderColor = priority ? PRIORITY_CONFIG[priority].color : "var(--color-border)";
  return (
    <button
      onClick={onClick}
      aria-label="Mark as complete"
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        border: `2px solid ${borderColor}`,
        backgroundColor: completing ? borderColor : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background-color 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => { if (!completing) (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${borderColor}22`; }}
      onMouseLeave={(e) => { if (!completing) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
    >
      {completing && <Check size={10} color="#fff" strokeWidth={3} />}
    </button>
  );
}

// ── Single reminder row ───────────────────────────────────────────────────────

function ReminderRow({
  reminder,
  onComplete,
  onDelete,
  onUpdate,
  isExpanded,
  onToggleExpand,
}: {
  reminder: Reminder;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Reminder>) => void;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}) {
  const [completing, setCompleting] = useState(false);
  const overdue = isOverdue(reminder.dueAt) && !completing;

  function handleComplete() {
    setCompleting(true);
    setTimeout(() => onComplete(reminder.id), 380);
  }

  const pri = reminder.priority ? PRIORITY_CONFIG[reminder.priority] : null;

  return (
    <div
      style={{
        opacity: completing ? 0 : 1,
        transition: "opacity 0.38s ease",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ minHeight: 48 }}>
        <CompletionCircle
          priority={reminder.priority}
          completing={completing}
          onClick={handleComplete}
        />

        <button
          onClick={() => onToggleExpand(reminder.id)}
          className="flex-1 text-left min-w-0"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontSize: 14,
            color: "var(--color-body)",
            textDecoration: completing ? "line-through" : "none",
            lineHeight: 1.4,
            fontFamily: "var(--font-roboto)",
          }}
        >
          {reminder.title}
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {pri && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: pri.color,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
              aria-label={`${pri.label} priority`}
            >
              {pri.symbol}
            </span>
          )}
          {reminder.recurrence && (
            <RefreshCw
              size={11}
              color="var(--color-secondary)"
              aria-label={`Repeats ${reminder.recurrence}`}
            />
          )}
          {reminder.dueAt && (
            <span
              style={{
                fontSize: 11,
                color: overdue ? "var(--color-error)" : "var(--color-secondary)",
                fontWeight: overdue ? 600 : 400,
                whiteSpace: "nowrap",
              }}
            >
              {formatDueDate(reminder.dueAt)}
            </span>
          )}
          <button
            onClick={() => onToggleExpand(reminder.id)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--color-secondary)", display: "flex" }}
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div
          className="px-4 pb-4 space-y-3 animate-fade-in"
          style={{ backgroundColor: "rgba(27,46,75,0.02)", borderTop: "1px solid var(--color-border)" }}
        >
          {/* Date & time */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-secondary)", display: "block", marginBottom: 4, letterSpacing: "0.04em" }}>
              DATE & TIME
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={reminder.dueAt ? reminder.dueAt.slice(0, 10) : ""}
                onChange={(e) => {
                  const existing = reminder.dueAt ? new Date(reminder.dueAt) : new Date();
                  const [y, mo, d] = e.target.value.split("-").map(Number);
                  existing.setFullYear(y, mo - 1, d);
                  onUpdate(reminder.id, { dueAt: existing.toISOString() });
                }}
                style={detailInputStyle}
              />
              <input
                type="time"
                value={reminder.dueAt ? new Date(reminder.dueAt).toTimeString().slice(0, 5) : ""}
                onChange={(e) => {
                  const existing = reminder.dueAt ? new Date(reminder.dueAt) : new Date();
                  const [h, m] = e.target.value.split(":").map(Number);
                  existing.setHours(h, m, 0, 0);
                  onUpdate(reminder.id, { dueAt: existing.toISOString() });
                }}
                style={{ ...detailInputStyle, width: 110 }}
              />
              {reminder.dueAt && (
                <button
                  onClick={() => onUpdate(reminder.id, { dueAt: undefined })}
                  style={{ fontSize: 11, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-secondary)", display: "block", marginBottom: 4, letterSpacing: "0.04em" }}>
              PRIORITY
            </label>
            <div className="flex gap-1.5">
              {(["", "low", "medium", "high"] as const).map((p) => {
                const cfg = p ? PRIORITY_CONFIG[p] : null;
                const active = (reminder.priority ?? "") === p;
                return (
                  <button
                    key={p || "none"}
                    onClick={() => onUpdate(reminder.id, { priority: p || undefined })}
                    style={{
                      height: 30,
                      paddingInline: 10,
                      borderRadius: 20,
                      border: "1.5px solid",
                      borderColor: active ? (cfg?.color ?? "var(--color-navy)") : "var(--color-border)",
                      backgroundColor: active ? (cfg ? `${cfg.color}18` : "rgba(27,46,75,0.08)") : "transparent",
                      color: active ? (cfg?.color ?? "var(--color-navy)") : "var(--color-secondary)",
                      fontSize: 12,
                      fontWeight: active ? 700 : 400,
                      cursor: "pointer",
                      fontFamily: "var(--font-roboto)",
                    }}
                  >
                    {cfg ? cfg.symbol : "None"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-secondary)", display: "block", marginBottom: 4, letterSpacing: "0.04em" }}>
              REPEAT
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {RECURRENCE_OPTIONS.map(({ value, label }) => {
                const active = (reminder.recurrence ?? "") === value;
                return (
                  <button
                    key={label}
                    onClick={() => onUpdate(reminder.id, { recurrence: value || undefined })}
                    style={{
                      height: 30,
                      paddingInline: 10,
                      borderRadius: 20,
                      border: "1.5px solid",
                      borderColor: active ? "var(--color-navy)" : "var(--color-border)",
                      backgroundColor: active ? "rgba(27,46,75,0.08)" : "transparent",
                      color: active ? "var(--color-navy)" : "var(--color-secondary)",
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer",
                      fontFamily: "var(--font-roboto)",
                    }}
                  >
                    {value ? <RefreshCw size={10} style={{ display: "inline", marginRight: 4 }} /> : null}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email notification */}
          <label className="flex items-center gap-2" style={{ cursor: "pointer", fontSize: 13, color: "var(--color-body)" }}>
            <input
              type="checkbox"
              checked={reminder.emailEnabled}
              onChange={(e) => onUpdate(reminder.id, { emailEnabled: e.target.checked })}
              style={{ accentColor: "var(--color-navy)", width: 14, height: 14 }}
            />
            <Mail size={12} style={{ color: "var(--color-secondary)" }} />
            Send email notification
          </label>

          {/* Delete */}
          <button
            onClick={() => onDelete(reminder.id)}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--color-error)", padding: 0 }}
          >
            <Trash2 size={12} /> Delete reminder
          </button>
        </div>
      )}
    </div>
  );
}

const detailInputStyle: React.CSSProperties = {
  flex: 1,
  height: 32,
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  padding: "0 8px",
  fontSize: 12,
  fontFamily: "var(--font-roboto)",
  backgroundColor: "var(--color-canvas)",
  color: "var(--color-body)",
  outline: "none",
  boxSizing: "border-box",
};

// ── Quick-add input ───────────────────────────────────────────────────────────

function QuickAddInput({ onAdd }: { onAdd: (title: string, dueAt?: string) => void }) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseNaturalDate(text), [text]);

  function handleSubmit() {
    const title = text.trim();
    if (!title) return;
    onAdd(title, parsed?.toISOString());
    setText("");
  }

  return (
    <div>
      <div
        className="flex items-center gap-3 px-4"
        style={{
          height: 52,
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          boxShadow: "0 1px 4px rgba(27,46,75,0.06)",
        }}
      >
        <Plus size={16} style={{ color: "var(--color-secondary)", flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder='Add a reminder… try "tomorrow at 9am" or "Friday"'
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: 14,
            fontFamily: "var(--font-roboto)",
            backgroundColor: "transparent",
            color: "var(--color-body)",
          }}
        />
        {text.trim() && (
          <button
            onClick={handleSubmit}
            style={{
              height: 30,
              paddingInline: 12,
              backgroundColor: "var(--color-navy)",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-roboto)",
              flexShrink: 0,
            }}
          >
            Add
          </button>
        )}
      </div>

      {/* Parsed date preview */}
      {parsed && text.trim() && (
        <p
          className="animate-fade-in"
          style={{ fontSize: 11, color: "var(--color-navy)", marginTop: 6, paddingLeft: 4, fontWeight: 500 }}
          aria-live="polite"
        >
          📅 {formatDueDate(parsed.toISOString())}
        </p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RemindersPage() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Separate active from completed
  const active = reminders.filter((r) => !r.completed).sort((a, b) => {
    // Undated at bottom; dated sorted by dueAt; overdue first
    if (!a.dueAt && !b.dueAt) return 0;
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured) {
        try {
          const stored = localStorage.getItem("canopy_user");
          if (stored) setCurrentUserId(JSON.parse(stored).id ?? "demo");
        } catch { /* ignore */ }
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      setCurrentUserId(user.id);

      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", user.id)
        .eq("completed", false)
        .order("due_at", { ascending: true, nullsFirst: false });

      if (!error && data) {
        setReminders(
          data.map((row) => ({
            id: row.id as string,
            userId: row.user_id as string,
            title: row.title as string,
            dueAt: (row.due_at as string) ?? undefined,
            linkedTaskId: (row.linked_task_id as string) ?? undefined,
            linkedEventId: (row.linked_event_id as string) ?? undefined,
            emailEnabled: row.email_enabled as boolean,
            sent: row.sent as boolean,
            completed: row.completed as boolean ?? false,
            completedAt: (row.completed_at as string) ?? undefined,
            priority: (row.priority as Reminder["priority"]) ?? undefined,
            recurrence: (row.recurrence as Reminder["recurrence"]) ?? undefined,
            createdAt: row.created_at as string,
          }))
        );
      }

      setLoading(false);
    }

    init();
  }, []);

  async function handleAdd(title: string, dueAt?: string) {
    const tempId = crypto.randomUUID();
    const newReminder: Reminder = {
      id: tempId,
      userId: currentUserId,
      title,
      dueAt,
      emailEnabled: false,
      sent: false,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setReminders((prev) => [newReminder, ...prev]);

    if (isSupabaseConfigured && currentUserId) {
      const { data, error } = await supabase
        .from("reminders")
        .insert({
          user_id: currentUserId,
          title,
          due_at: dueAt ?? null,
          email_enabled: false,
          sent: false,
          completed: false,
          priority: null,
          recurrence: null,
        })
        .select()
        .single();

      if (!error && data) {
        setReminders((prev) => prev.map((r) => r.id === tempId ? { ...newReminder, id: data.id as string } : r));
      } else if (error) {
        console.error("[Reminders] add:", error);
      }
    }
  }

  function handleComplete(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    if (isSupabaseConfigured) {
      supabase
        .from("reminders")
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq("id", id)
        .then(({ error }) => { if (error) console.error("[Reminders] complete:", error); });
    }
  }

  function handleDelete(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    setExpandedId(null);
    if (isSupabaseConfigured) {
      supabase.from("reminders").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("[Reminders] delete:", error); });
    }
  }

  function handleUpdate(id: string, patch: Partial<Reminder>) {
    setReminders((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
    if (isSupabaseConfigured) {
      const dbPatch: Record<string, unknown> = {};
      if ("dueAt" in patch)       dbPatch.due_at        = patch.dueAt ?? null;
      if ("priority" in patch)    dbPatch.priority      = patch.priority ?? null;
      if ("recurrence" in patch)  dbPatch.recurrence    = patch.recurrence ?? null;
      if ("emailEnabled" in patch) dbPatch.email_enabled = patch.emailEnabled;
      if (Object.keys(dbPatch).length > 0) {
        supabase.from("reminders").update(dbPatch).eq("id", id)
          .then(({ error }) => { if (error) console.error("[Reminders] update:", error); });
      }
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ backgroundColor: "var(--color-canvas)" }}>
        <div style={{ width: 28, height: 28, border: "3px solid var(--color-border)", borderTopColor: "var(--color-navy)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <ClientOnly>
      <div
        className="px-4 md:px-8 py-6 mx-auto"
        style={{ maxWidth: 600 }}
      >
        {/* Header */}
        <div className="mb-6">
          <h1
            style={{
              fontFamily: "var(--font-lora)",
              fontWeight: 700,
              fontSize: 22,
              color: "var(--color-navy)",
              margin: 0,
            }}
          >
            Reminders
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 3 }}>
            {active.length === 0
              ? "Nothing pending."
              : `${active.length} reminder${active.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Quick-add */}
        <div className="mb-5">
          <QuickAddInput onAdd={handleAdd} />
        </div>

        {/* List */}
        {active.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
            }}
          >
            <Check size={32} style={{ color: "var(--color-border)", marginBottom: 10 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-body)", margin: 0 }}>All caught up</p>
            <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 4 }}>
              Add a reminder above to get started.
            </p>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {active.map((reminder) => (
              <ReminderRow
                key={reminder.id}
                reminder={reminder}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                isExpanded={expandedId === reminder.id}
                onToggleExpand={toggleExpand}
              />
            ))}
          </div>
        )}

        {/* Priority legend — shown when any reminder has a priority */}
        {active.some((r) => r.priority) && (
          <div className="flex items-center gap-4 mt-4 px-1 flex-wrap">
            {(["low", "medium", "high"] as ReminderPriority[]).map((p) => {
              const cfg = PRIORITY_CONFIG[p];
              return (
                <span key={p} className="flex items-center gap-1" style={{ fontSize: 11, color: "var(--color-secondary)" }}>
                  <span style={{ color: cfg.color, fontWeight: 800 }}>{cfg.symbol}</span>
                  {cfg.label} priority
                </span>
              );
            })}
          </div>
        )}
      </div>
    </ClientOnly>
  );
}
