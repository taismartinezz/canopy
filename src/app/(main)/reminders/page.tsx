"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Check, Sun, CalendarDays, List, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";
import Avatar from "@/components/ui/Avatar";
import ClientOnly from "@/components/ui/ClientOnly";
import type { Reminder, ReminderScope, ReminderPriority, User } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

type ListType = "today" | "scheduled" | "priority" | "all" | "personal" | "lab";

const PRIORITY_MARKS: Record<ReminderPriority, string> = { high: "!!!", medium: "!!", low: "!" };
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

// Unified blue family — deep navy → dark blue → blue → slate-blue
const LIST_COLORS: Record<ListType, string> = {
  today:     "#1B2E4B",  // deep navy (app primary)
  scheduled: "#1E40AF",  // dark blue
  priority:  "#2563EB",  // blue
  all:       "#475569",  // slate-blue
  personal:  "#1D4ED8",  // medium-dark blue
  lab:       "#0F2544",  // darkest navy
};

const LIST_LABELS: Record<ListType, string> = {
  today: "Today", scheduled: "Scheduled", priority: "Priority",
  all: "All", personal: "Personal", lab: "Lab",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStart(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function tomorrowStart(): Date {
  const d = todayStart(); d.setDate(d.getDate() + 1); return d;
}

function filterReminders(list: ListType, all: Reminder[]): Reminder[] {
  const tomorrow = tomorrowStart();
  switch (list) {
    case "today":     return all.filter(r => r.dueAt && new Date(r.dueAt) < tomorrow);
    case "scheduled": return all.filter(r => !!r.dueAt);
    case "priority":  return all.filter(r => !!r.priority);
    case "personal":  return all.filter(r => r.scope === "personal");
    case "lab":       return all.filter(r => r.scope === "lab");
    default:          return all;
  }
}

function sortReminders(list: Reminder[]): Reminder[] {
  return [...list].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority ?? ""] ?? 3;
    const pb = PRIORITY_RANK[b.priority ?? ""] ?? 3;
    if (pa !== pb) return pa - pb;
    if (!a.dueAt && !b.dueAt) return 0;
    if (!a.dueAt) return 1; if (!b.dueAt) return -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
}

function groupScheduled(reminders: Reminder[]): Array<{ label: string; sortKey: number; isPastDue: boolean; items: Reminder[] }> {
  const today = todayStart();
  const tomorrow = tomorrowStart();
  const groups = new Map<string, { label: string; sortKey: number; isPastDue: boolean; items: Reminder[] }>();

  const sorted = [...reminders.filter(r => !!r.dueAt)].sort(
    (a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime()
  );

  for (const r of sorted) {
    const dMid = new Date(r.dueAt!); dMid.setHours(0, 0, 0, 0);
    let label: string;
    const sortKey = dMid.getTime();
    let isPastDue = false;

    if (dMid < today) {
      isPastDue = true;
      label = dMid.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    } else if (dMid.getTime() === today.getTime()) {
      label = "Today";
    } else if (dMid.getTime() === tomorrow.getTime()) {
      label = "Tomorrow";
    } else {
      label = dMid.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    }

    if (!groups.has(label)) groups.set(label, { label, sortKey, isPastDue, items: [] });
    groups.get(label)!.items.push(r);
  }

  return Array.from(groups.values()).sort((a, b) => a.sortKey - b.sortKey);
}

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today, ${timeStr}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${timeStr}`;
  if (d < now) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + `, ${timeStr}`;
  const days = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "short" }) + `, ${timeStr}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(iso?: string): boolean { return !!iso && new Date(iso) < new Date(); }

function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoToLocalTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getDefaultScope(list: ListType): ReminderScope { return list === "lab" ? "lab" : "personal"; }

function makeDueAt(date: string, time: string): string {
  return new Date(time ? `${date}T${time}` : `${date}T09:00`).toISOString();
}

function formatDateLabel(date: string): string {
  const d = new Date(date + "T00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── CalendarPicker ────────────────────────────────────────────────────────────

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LETTERS = ["S","M","T","W","T","F","S"];

function CalendarPicker({ value, accentColor, pos, onSelect, onClear, onClose }: {
  value: string | undefined; accentColor: string; pos: { top: number; left: number };
  onSelect: (date: string) => void; onClear: () => void; onClose: () => void;
}) {
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const todayStr = isoToLocalDate(todayDate.toISOString());
  const [cursor, setCursor] = useState(() => {
    if (value) { const d = new Date(value + "T00:00"); return { year: d.getFullYear(), month: d.getMonth() }; }
    return { year: todayDate.getFullYear(), month: todayDate.getMonth() };
  });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function down(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [onClose]);

  function prevMonth() { setCursor(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 }); }
  function nextMonth() { setCursor(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 }); }

  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const firstDow = new Date(cursor.year, cursor.month, 1).getDay();
  function ds(day: number) { return `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }
  const btnBase: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <div ref={ref} style={{
      position: "fixed", top: pos.top, left: pos.left, zIndex: 400, width: 244,
      backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)",
      borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", padding: "14px 12px 10px",
      fontFamily: "var(--font-roboto)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={prevMonth} style={{ ...btnBase, width: 28, height: 28, borderRadius: 8 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-canvas)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
          <ChevronLeft size={14} color="var(--color-secondary)" />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)" }}>{MONTH_NAMES[cursor.month]} {cursor.year}</span>
        <button onClick={nextMonth} style={{ ...btnBase, width: 28, height: 28, borderRadius: 8 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-canvas)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
          <ChevronRight size={14} color="var(--color-secondary)" />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
        {DAY_LETTERS.map((l, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--color-secondary)", paddingBlock: 3 }}>{l}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1; const d = ds(day);
          const isToday = d === todayStr; const isSel = d === value;
          return (
            <button key={day} onClick={() => onSelect(d)} style={{
              width: 30, height: 30, borderRadius: "50%", margin: "0 auto", display: "flex",
              alignItems: "center", justifyContent: "center",
              border: isToday && !isSel ? `1.5px solid ${accentColor}55` : "1.5px solid transparent",
              backgroundColor: isSel ? accentColor : "transparent",
              color: isSel ? "#fff" : isToday ? accentColor : "var(--color-body)",
              fontSize: 12, fontWeight: isSel || isToday ? 600 : 400, cursor: "pointer", transition: "background-color 0.1s",
            }}
              onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${accentColor}20`; }}
              onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
              {day}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
        <button onClick={onClear} style={{ ...btnBase, fontSize: 12, color: "var(--color-secondary)", padding: "4px 6px", borderRadius: 6 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-body)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-secondary)"; }}>
          Clear
        </button>
        <button onClick={() => onSelect(todayStr)} style={{ ...btnBase, fontSize: 12, fontWeight: 600, color: accentColor, padding: "4px 6px", borderRadius: 6 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${accentColor}12`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
          Today
        </button>
      </div>
    </div>
  );
}

// ── DateTimePicker toolbar helper (shared by Add + Edit rows) ─────────────────

function DateTimeFields({ selDate, selTime, showTime, accentColor, onDateChange, onTimeChange, onToggleTime }: {
  selDate: string | undefined; selTime: string; showTime: boolean; accentColor: string;
  onDateChange: (d: string | undefined) => void; onTimeChange: (t: string) => void; onToggleTime: () => void;
}) {
  const [showCal, setShowCal] = useState(false);
  const [calPos, setCalPos] = useState<{ top: number; left: number } | null>(null);
  const dateButtonRef = useRef<HTMLButtonElement>(null);

  function openCal() {
    if (!dateButtonRef.current) return;
    const r = dateButtonRef.current.getBoundingClientRect();
    setCalPos({ top: r.bottom + 6, left: r.left });
    setShowCal(v => !v);
  }

  const pillBase = (active: boolean): React.CSSProperties => ({
    height: 26, paddingInline: 10, borderRadius: 20, border: "1.5px solid",
    borderColor: active ? accentColor : "var(--color-border)",
    backgroundColor: active ? `${accentColor}18` : "transparent",
    color: active ? accentColor : "var(--color-secondary)",
    fontSize: 12, cursor: "pointer", fontFamily: "var(--font-roboto)",
  });

  return (
    <>
      <button ref={dateButtonRef} onClick={openCal} style={{ ...pillBase(!!selDate), display: "flex", alignItems: "center", gap: 4 }}>
        <CalendarDays size={11} />
        {selDate ? formatDateLabel(selDate) : "Date"}
      </button>

      {selDate && !showTime && (
        <button onClick={onToggleTime} style={{ ...pillBase(false), fontSize: 11 }}>
          + time
        </button>
      )}

      {selDate && showTime && (
        <input type="time" value={selTime} onChange={e => onTimeChange(e.target.value)} style={{
          height: 26, paddingInline: 10, borderRadius: 20, border: "1.5px solid var(--color-border)",
          fontSize: 12, fontFamily: "var(--font-roboto)", backgroundColor: "transparent",
          color: "var(--color-body)", outline: "none", cursor: "pointer",
        }} />
      )}

      {showCal && calPos && (
        <CalendarPicker
          value={selDate} accentColor={accentColor} pos={calPos}
          onSelect={date => { onDateChange(date); setShowCal(false); }}
          onClear={() => { onDateChange(undefined); onTimeChange(""); setShowCal(false); }}
          onClose={() => setShowCal(false)}
        />
      )}
    </>
  );
}

// ── CompletionCircle ──────────────────────────────────────────────────────────

function CompletionCircle({ completing, disabled, color, onClick }: {
  completing: boolean; disabled: boolean; color: string; onClick: () => void;
}) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }} disabled={disabled} aria-label="Mark complete"
      style={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${completing ? color : "var(--color-border)"}`,
        backgroundColor: completing ? color : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        transition: "background-color 0.12s, border-color 0.12s", opacity: disabled ? 0.3 : 1,
      }}
      onMouseEnter={e => { if (!completing && !disabled) (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${color}22`; }}
      onMouseLeave={e => { if (!completing && !disabled) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
      {completing && <Check size={11} color="#fff" strokeWidth={3} />}
    </button>
  );
}

// ── ReminderRow ───────────────────────────────────────────────────────────────

function ReminderRow({ reminder, currentUserId, teamMembers, onComplete, onDelete, onEdit }: {
  reminder: Reminder; currentUserId: string; teamMembers: User[];
  onComplete: (id: string) => void; onDelete: (id: string) => void; onEdit: () => void;
}) {
  const [completing, setCompleting] = useState(false);
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const isCreator = reminder.userId === currentUserId;
  const canCheck = reminder.scope === "lab" || isCreator;
  const overdue = isOverdue(reminder.dueAt);
  const creator = reminder.scope === "lab" ? teamMembers.find(m => m.id === reminder.userId) : undefined;
  const circleColor = reminder.scope === "lab" ? LIST_COLORS.lab : LIST_COLORS.personal;

  function handleCheck() {
    if (!canCheck || completing) return;
    setCompleting(true);
    timerRef.current = setTimeout(() => onComplete(reminder.id), 340);
  }

  return (
    <div style={{
      maxHeight: completing ? 0 : 100, opacity: completing ? 0 : 1, overflow: "hidden",
      transform: completing ? "translateY(-2px)" : "none",
      transition: completing ? "opacity 0.2s, max-height 0.35s ease 0.06s, transform 0.2s" : "none",
      pointerEvents: completing ? "none" : undefined,
    }}>
      <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={onEdit}
        style={{
          display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 16px",
          borderBottom: "1px solid var(--color-border)", minHeight: 44,
          backgroundColor: hovered ? "rgba(0,0,0,0.02)" : "transparent",
          transition: "background-color 0.1s", cursor: "text",
        }}>
        <CompletionCircle completing={completing} disabled={!canCheck} color={circleColor} onClick={handleCheck} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {reminder.priority && (
              <span style={{ fontSize: 12, fontWeight: 800, color: LIST_COLORS.personal, letterSpacing: "-0.5px", flexShrink: 0, userSelect: "none" }}>
                {PRIORITY_MARKS[reminder.priority]}
              </span>
            )}
            <span style={{ fontSize: 15, color: "var(--color-body)", fontFamily: "var(--font-roboto)", lineHeight: 1.3 }}>
              {reminder.title}
            </span>
          </div>
          {reminder.dueAt && (
            <div style={{ fontSize: 12, marginTop: 2, color: overdue ? "#DC2626" : "var(--color-secondary)", fontWeight: overdue ? 600 : 400 }}>
              {formatDueDate(reminder.dueAt)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginTop: 2 }}>
          {creator && <Avatar user={creator} size={18} />}
          {isCreator && hovered && (
            <button onClick={e => { e.stopPropagation(); onDelete(reminder.id); }} aria-label="Delete"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", opacity: 0.45 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.45"; }}>
              <Trash2 size={13} color="var(--color-secondary)" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CompletedReminderRow ──────────────────────────────────────────────────────

function CompletedReminderRow({ reminder, currentUserId, onUncomplete }: {
  reminder: Reminder; currentUserId: string; onUncomplete: (id: string) => void;
}) {
  const isCreator = reminder.userId === currentUserId;
  const circleColor = reminder.scope === "lab" ? LIST_COLORS.lab : LIST_COLORS.personal;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 16px", borderBottom: "1px solid var(--color-border)", opacity: 0.5 }}>
      <button onClick={() => onUncomplete(reminder.id)} disabled={!isCreator} aria-label="Restore reminder"
        style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          border: `2px solid ${circleColor}`, backgroundColor: circleColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: isCreator ? "pointer" : "default",
        }}>
        <Check size={11} color="#fff" strokeWidth={3} />
      </button>
      <span style={{ fontSize: 14, color: "var(--color-secondary)", fontFamily: "var(--font-roboto)", textDecoration: "line-through", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {reminder.title}
      </span>
    </div>
  );
}

// ── ReminderEditRow ───────────────────────────────────────────────────────────

function ReminderEditRow({ reminder, onSave, onCancel }: {
  reminder: Reminder;
  onSave: (id: string, updates: { title: string; priority?: ReminderPriority; dueAt?: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(reminder.title);
  const [priority, setPriority] = useState<ReminderPriority | undefined>(reminder.priority);
  const [selDate, setSelDate] = useState<string | undefined>(reminder.dueAt ? isoToLocalDate(reminder.dueAt) : undefined);
  const [selTime, setSelTime] = useState(reminder.dueAt ? isoToLocalTime(reminder.dueAt) : "");
  const [showTime, setShowTime] = useState(!!reminder.dueAt && isoToLocalTime(reminder.dueAt) !== "09:00");
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const accentColor = reminder.scope === "lab" ? LIST_COLORS.lab : LIST_COLORS.personal;
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  function save() {
    if (!title.trim()) return;
    onSave(reminder.id, { title: title.trim(), priority, dueAt: selDate ? makeDueAt(selDate, selTime) : undefined });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") onCancel();
  }

  function handleContainerBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (rowRef.current?.contains(e.relatedTarget as Node)) return;
    onCancel();
  }

  const pillBase = (active: boolean, color: string): React.CSSProperties => ({
    height: 26, paddingInline: 10, borderRadius: 20, border: "1.5px solid",
    borderColor: active ? color : "var(--color-border)",
    backgroundColor: active ? `${color}18` : "transparent",
    color: active ? color : "var(--color-secondary)",
    fontSize: 12, cursor: "pointer", fontFamily: "var(--font-roboto)",
  });

  return (
    <div ref={rowRef} onBlur={handleContainerBlur}
      style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: `${accentColor}07` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px 6px" }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: `2px solid ${accentColor}`, opacity: 0.4 }} />
        <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)} onKeyDown={handleKeyDown}
          style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "var(--font-roboto)", backgroundColor: "transparent", color: "var(--color-body)" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px 11px 50px", flexWrap: "wrap" }}>
        {(["low", "medium", "high"] as ReminderPriority[]).map(p => (
          <button key={p} onClick={() => setPriority(priority === p ? undefined : p)}
            style={{ ...pillBase(priority === p, accentColor), fontWeight: 800, letterSpacing: "-0.5px" }}>
            {PRIORITY_MARKS[p]}
          </button>
        ))}
        <div style={{ width: 1, height: 16, backgroundColor: "var(--color-border)" }} />
        <DateTimeFields selDate={selDate} selTime={selTime} showTime={showTime} accentColor={accentColor}
          onDateChange={setSelDate} onTimeChange={setSelTime} onToggleTime={() => setShowTime(v => !v)} />
        <div style={{ flex: 1 }} />
        <button onClick={onCancel} style={{ fontSize: 12, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}>Cancel</button>
        <button onClick={save} disabled={!title.trim()} style={{
          height: 26, paddingInline: 12, borderRadius: 7, border: "none",
          backgroundColor: title.trim() ? accentColor : "var(--color-border)",
          color: title.trim() ? "#fff" : "var(--color-secondary)",
          fontSize: 12, fontWeight: 700, cursor: title.trim() ? "pointer" : "default",
          fontFamily: "var(--font-roboto)", transition: "background-color 0.1s",
        }}>Done</button>
      </div>
    </div>
  );
}

// ── InlineAddRow ──────────────────────────────────────────────────────────────

function InlineAddRow({ defaultScope, accentColor, onAdd, onClose }: {
  defaultScope: ReminderScope; accentColor: string;
  onAdd: (title: string, scope: ReminderScope, priority?: ReminderPriority, dueAt?: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<ReminderScope>(defaultScope);
  const [priority, setPriority] = useState<ReminderPriority | undefined>();
  const [selDate, setSelDate] = useState<string | undefined>();
  const [selTime, setSelTime] = useState("");
  const [showTime, setShowTime] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const circleColor = scope === "lab" ? LIST_COLORS.lab : LIST_COLORS.personal;
  useEffect(() => { inputRef.current?.focus(); }, []);

  function commit() {
    if (!title.trim()) return;
    onAdd(title.trim(), scope, priority, selDate ? makeDueAt(selDate, selTime) : undefined);
    setTitle(""); setPriority(undefined); setSelDate(undefined); setSelTime(""); setShowTime(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") {
      if (title) { setTitle(""); } else { onClose(); }
    }
  }

  function handleContainerBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (rowRef.current?.contains(e.relatedTarget as Node)) return;
    if (title.trim()) { onAdd(title.trim(), scope, priority, selDate ? makeDueAt(selDate, selTime) : undefined); }
    onClose();
  }

  const pillBase = (active: boolean, color: string): React.CSSProperties => ({
    height: 26, paddingInline: 10, borderRadius: 20, border: "1.5px solid",
    borderColor: active ? color : "var(--color-border)",
    backgroundColor: active ? `${color}18` : "transparent",
    color: active ? color : "var(--color-secondary)",
    fontSize: 12, cursor: "pointer", fontFamily: "var(--font-roboto)",
  });

  return (
    <div ref={rowRef} onBlur={handleContainerBlur}
      style={{ borderTop: "1px solid var(--color-border)", backgroundColor: `${accentColor}07` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px 6px" }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: `2px solid ${circleColor}`, opacity: 0.4 }} />
        <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="New Reminder"
          style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "var(--font-roboto)", backgroundColor: "transparent", color: "var(--color-body)" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px 11px 50px", flexWrap: "wrap" }}>
        {(["personal", "lab"] as ReminderScope[]).map(s => (
          <button key={s} onClick={() => setScope(s)} style={{ ...pillBase(scope === s, LIST_COLORS[s]), fontWeight: scope === s ? 700 : 400 }}>
            {s === "personal" ? "Personal" : "Lab"}
          </button>
        ))}
        <div style={{ width: 1, height: 16, backgroundColor: "var(--color-border)" }} />
        {(["low", "medium", "high"] as ReminderPriority[]).map(p => (
          <button key={p} onClick={() => setPriority(priority === p ? undefined : p)}
            style={{ ...pillBase(priority === p, accentColor), fontWeight: 800, letterSpacing: "-0.5px" }}>
            {PRIORITY_MARKS[p]}
          </button>
        ))}
        <div style={{ width: 1, height: 16, backgroundColor: "var(--color-border)" }} />
        <DateTimeFields selDate={selDate} selTime={selTime} showTime={showTime} accentColor={accentColor}
          onDateChange={setSelDate} onTimeChange={setSelTime} onToggleTime={() => setShowTime(v => !v)} />
      </div>
    </div>
  );
}

// ── SmartListCard ─────────────────────────────────────────────────────────────

function SmartListCard({ id, count, icon, selected, onClick }: {
  id: ListType; count: number; icon: React.ReactNode; selected: boolean; onClick: () => void;
}) {
  const color = LIST_COLORS[id];
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left", backgroundColor: color, borderRadius: 13,
      padding: "12px 14px", minHeight: 84, display: "flex", flexDirection: "column", justifyContent: "space-between",
      border: `2px solid ${selected ? "rgba(255,255,255,0.25)" : "transparent"}`,
      cursor: "pointer", transition: "opacity 0.1s", boxSizing: "border-box",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}>
      <div style={{ color: "rgba(255,255,255,0.9)", display: "flex" }}>{icon}</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", lineHeight: 1, marginBottom: 3 }}>{count}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500, fontFamily: "var(--font-roboto)" }}>{LIST_LABELS[id]}</div>
      </div>
    </button>
  );
}

// ── MyListRow ─────────────────────────────────────────────────────────────────

function MyListRow({ id, count, selected, onClick }: { id: "personal" | "lab"; count: number; selected: boolean; onClick: () => void; }) {
  const color = LIST_COLORS[id];
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
      borderRadius: 9, border: "none", backgroundColor: selected ? "rgba(0,0,0,0.06)" : "transparent",
      cursor: "pointer", textAlign: "left",
    }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,0,0,0.03)"; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <List size={14} color="#fff" />
      </div>
      <span style={{ flex: 1, fontSize: 15, color: "var(--color-body)", fontFamily: "var(--font-roboto)", fontWeight: selected ? 600 : 400 }}>
        {id === "personal" ? "Personal" : "Lab"}
      </span>
      <span style={{ fontSize: 13, color: "var(--color-secondary)", fontFamily: "var(--font-roboto)" }}>{count}</span>
    </button>
  );
}

// ── LeftPanel ─────────────────────────────────────────────────────────────────

function LeftPanel({ selected, activeReminders, onSelect }: {
  selected: ListType; activeReminders: Reminder[]; onSelect: (list: ListType) => void;
}) {
  const tomorrow = tomorrowStart();
  const counts = useMemo(() => ({
    today:     activeReminders.filter(r => r.dueAt && new Date(r.dueAt) < tomorrow).length,
    scheduled: activeReminders.filter(r => !!r.dueAt).length,
    priority:  activeReminders.filter(r => !!r.priority).length,
    all:       activeReminders.length,
    personal:  activeReminders.filter(r => r.scope === "personal").length,
    lab:       activeReminders.filter(r => r.scope === "lab").length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [activeReminders]);

  return (
    <div style={{ width: 240, flexShrink: 0, padding: "20px 16px", overflowY: "auto", borderRight: "1px solid var(--color-border)", backgroundColor: "var(--color-canvas)", height: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        <SmartListCard id="today" count={counts.today} icon={<Sun size={20} />} selected={selected === "today"} onClick={() => onSelect("today")} />
        <SmartListCard id="scheduled" count={counts.scheduled} icon={<CalendarDays size={20} />} selected={selected === "scheduled"} onClick={() => onSelect("scheduled")} />
        <SmartListCard id="priority" count={counts.priority}
          icon={<span style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-1px", lineHeight: 1 }}>!</span>}
          selected={selected === "priority"} onClick={() => onSelect("priority")} />
        <SmartListCard id="all" count={counts.all} icon={<List size={20} />} selected={selected === "all"} onClick={() => onSelect("all")} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, paddingLeft: 12 }}>My Lists</div>
        <MyListRow id="personal" count={counts.personal} selected={selected === "personal"} onClick={() => onSelect("personal")} />
        <MyListRow id="lab" count={counts.lab} selected={selected === "lab"} onClick={() => onSelect("lab")} />
      </div>
    </div>
  );
}

// ── Shared reminder row renderer (used by both flat and grouped views) ─────────

type ReminderRowRendererProps = {
  visible: Reminder[]; completedVisible: Reminder[]; showCompleted: boolean;
  currentUserId: string; teamMembers: User[]; editingId: string | null;
  panelColor: string; isAdding: boolean; selectedList: ListType;
  onComplete: (id: string) => void; onDelete: (id: string) => void;
  onEdit: (id: string) => void; onSave: (id: string, u: { title: string; priority?: ReminderPriority; dueAt?: string }) => void;
  onCancelEdit: () => void; onAdd: (title: string, scope: ReminderScope, priority?: ReminderPriority, dueAt?: string) => void;
  onCloseAdd: () => void; onToggleCompleted: () => void;
  onUncomplete: (id: string) => void;
  hideAddRow?: boolean;
};

function ReminderCardContent({ visible, completedVisible, showCompleted, currentUserId, teamMembers,
  editingId, panelColor, isAdding, selectedList, onComplete, onDelete, onEdit, onSave,
  onCancelEdit, onAdd, onCloseAdd, onToggleCompleted, onUncomplete, hideAddRow }: ReminderRowRendererProps) {
  return (
    <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden" }}>
      {visible.map(reminder => (
        editingId === reminder.id ? (
          <ReminderEditRow key={reminder.id} reminder={reminder} onSave={onSave} onCancel={onCancelEdit} />
        ) : (
          <ReminderRow key={reminder.id} reminder={reminder} currentUserId={currentUserId}
            teamMembers={teamMembers} onComplete={onComplete} onDelete={onDelete} onEdit={() => onEdit(reminder.id)} />
        )
      ))}

      {!hideAddRow && (
        isAdding ? (
          <InlineAddRow defaultScope={getDefaultScope(selectedList)} accentColor={panelColor} onAdd={onAdd} onClose={onCloseAdd} />
        ) : (
          <button onClick={onCloseAdd}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontFamily: "var(--font-roboto)", borderTop: visible.length > 0 ? "1px solid var(--color-border)" : "none" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,0,0,0.02)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
            <Plus size={15} color={panelColor} />
            <span style={{ color: panelColor, fontWeight: 500 }}>New Reminder</span>
          </button>
        )
      )}

      {/* Completed toggle */}
      {completedVisible.length > 0 && (
        <div style={{ borderTop: "1px solid var(--color-border)" }}>
          <button onClick={onToggleCompleted}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 16px", background: "none", border: "none", cursor: "pointer" }}>
            <span style={{ fontSize: 13, color: "var(--color-secondary)", fontFamily: "var(--font-roboto)" }}>
              {completedVisible.length} Completed
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: panelColor, fontFamily: "var(--font-roboto)" }}>
              {showCompleted ? "Hide" : "Show"}
            </span>
          </button>
          {showCompleted && completedVisible.map(r => (
            <CompletedReminderRow key={r.id} reminder={r} currentUserId={currentUserId} onUncomplete={onUncomplete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── ScheduledView ─────────────────────────────────────────────────────────────

function ScheduledView(props: ReminderRowRendererProps & { panelColor: string }) {
  const { visible, panelColor } = props;
  const groups = useMemo(() => groupScheduled(visible), [visible]);

  if (groups.length === 0 && !props.isAdding) return null;

  return (
    <>
      {groups.map(group => (
        <div key={group.label} style={{ marginBottom: 20 }}>
          <div style={{ padding: "0 24px 6px", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: group.isPastDue ? "#DC2626" : "var(--color-secondary)", letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "var(--font-roboto)" }}>
              {group.label}
            </span>
            {group.isPastDue && <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 500 }}>· overdue</span>}
          </div>
          <div style={{ margin: "0 24px" }}>
            <ReminderCardContent {...props} visible={group.items} completedVisible={[]} showCompleted={false}
              onToggleCompleted={() => {}} hideAddRow={true} />
          </div>
        </div>
      ))}

      {/* New reminder + completed at the bottom of scheduled view */}
      <div style={{ margin: "0 24px 24px" }}>
        <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden" }}>
          {props.isAdding ? (
            <InlineAddRow defaultScope={getDefaultScope(props.selectedList)} accentColor={panelColor}
              onAdd={props.onAdd} onClose={props.onCloseAdd} />
          ) : (
            <button onClick={() => props.onCloseAdd()}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontFamily: "var(--font-roboto)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,0,0,0.02)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
              <Plus size={15} color={panelColor} />
              <span style={{ color: panelColor, fontWeight: 500 }}>New Reminder</span>
            </button>
          )}
          {props.completedVisible.length > 0 && (
            <div style={{ borderTop: "1px solid var(--color-border)" }}>
              <button onClick={props.onToggleCompleted}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 16px", background: "none", border: "none", cursor: "pointer" }}>
                <span style={{ fontSize: 13, color: "var(--color-secondary)", fontFamily: "var(--font-roboto)" }}>{props.completedVisible.length} Completed</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: panelColor, fontFamily: "var(--font-roboto)" }}>{props.showCompleted ? "Hide" : "Show"}</span>
              </button>
              {props.showCompleted && props.completedVisible.map(r => (
                <CompletedReminderRow key={r.id} reminder={r} currentUserId={props.currentUserId} onUncomplete={props.onUncomplete} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── UndoToast ─────────────────────────────────────────────────────────────────

function UndoToast({ title, onUndo }: { title: string; onUndo: () => void }) {
  return (
    <>
      <style>{`@keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style>
      <div role="status" aria-live="polite" style={{
        position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
        backgroundColor: "#1B2E4B", color: "#fff", borderRadius: 10, padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 12,
        boxShadow: "0 4px 20px rgba(0,0,0,0.22)", zIndex: 200,
        fontSize: 13, fontFamily: "var(--font-roboto)", whiteSpace: "nowrap",
        animation: "toastIn 0.18s ease",
      }}>
        <Check size={13} color="rgba(255,255,255,0.7)" />
        <span style={{ color: "rgba(255,255,255,0.85)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
        <button onClick={onUndo} style={{ background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 6, padding: "4px 10px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-roboto)" }}>
          Undo
        </button>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface PendingUndo { reminder: Reminder; timerId: ReturnType<typeof setTimeout>; }

export default function RemindersPage() {
  const { projectId, isLoading: projectLoading } = useProject();
  const [currentUserId, setCurrentUserId] = useState("");
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedList, setSelectedList] = useState<ListType>("all");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      try {
        const stored = localStorage.getItem("canopy_user");
        if (stored) setCurrentUserId(JSON.parse(stored).id ?? "demo");
      } catch { /* ignore */ }
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setCurrentUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    if (isSupabaseConfigured && projectLoading) return;

    async function load() {
      setLoading(true);
      if (!isSupabaseConfigured) { setLoading(false); return; }

      if (projectId) {
        const { data: members } = await supabase
          .from("team_members")
          .select("user_id, role, user_profiles(name, avatar_color, avatar_initials, avatar_url)")
          .eq("project_id", projectId);
        if (members) {
          const { computeInitials } = await import("@/lib/utils");
          setTeamMembers(members.map(row => {
            const p = Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles;
            const profile = p as Record<string, string> | null;
            const name = profile?.name ?? "Team Member";
            return { id: row.user_id as string, name, email: "", role: (row.role ?? "researcher") as User["role"], avatarColor: profile?.avatar_color ?? "#B4D4E3", avatarInitials: computeInitials(name) || (profile?.avatar_initials ?? "??"), avatarUrl: profile?.avatar_url ?? undefined };
          }));
        }
      }

      const filter = projectId
        ? `and(scope.eq.personal,user_id.eq.${currentUserId}),and(scope.eq.lab,project_id.eq.${projectId})`
        : `scope.eq.personal,user_id.eq.${currentUserId}`;

      // Fetch all reminders (both active and completed) — no .eq("completed", false)
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .or(filter)
        .order("due_at", { ascending: true, nullsFirst: false });

      if (error) console.error("[Reminders] fetch:", error);
      if (data) {
        setReminders(data.map(row => ({
          id: row.id as string, userId: row.user_id as string,
          projectId: (row.project_id as string) ?? undefined,
          scope: (row.scope as ReminderScope) ?? "personal",
          title: row.title as string,
          dueAt: (row.due_at as string) ?? undefined,
          linkedTaskId: (row.linked_task_id as string) ?? undefined,
          linkedEventId: (row.linked_event_id as string) ?? undefined,
          emailEnabled: (row.email_enabled as boolean) ?? false,
          sent: (row.sent as boolean) ?? false,
          completed: (row.completed as boolean) ?? false,
          priority: (row.priority as ReminderPriority) ?? undefined,
          recurrence: (row.recurrence as Reminder["recurrence"]) ?? undefined,
          createdAt: row.created_at as string,
        })));
      }
      setLoading(false);
    }
    load();
  }, [currentUserId, projectId, projectLoading]);

  function commitDelete(id: string) {
    if (isSupabaseConfigured) {
      supabase.from("reminders").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("[Reminders] delete:", error); });
    }
  }

  function commitComplete(id: string) {
    if (isSupabaseConfigured) {
      supabase.from("reminders").update({ completed: true }).eq("id", id)
        .then(({ error }) => { if (error) console.error("[Reminders] complete:", error); });
    }
  }

  function handleComplete(id: string) {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;
    if (pendingUndo) { clearTimeout(pendingUndo.timerId); commitComplete(pendingUndo.reminder.id); }
    setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: true } : r));
    const timerId = setTimeout(() => { commitComplete(id); setPendingUndo(null); }, 4000);
    setPendingUndo({ reminder, timerId });
  }

  function handleUndo() {
    if (!pendingUndo) return;
    clearTimeout(pendingUndo.timerId);
    setReminders(prev => prev.map(r => r.id === pendingUndo!.reminder.id ? { ...r, completed: false } : r));
    setPendingUndo(null);
  }

  async function handleUncomplete(id: string) {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, completed: false } : r));
    if (isSupabaseConfigured) {
      const { error } = await supabase.from("reminders").update({ completed: false }).eq("id", id);
      if (error) console.error("[Reminders] uncomplete:", error);
    }
  }

  async function handleAdd(title: string, scope: ReminderScope, priority?: ReminderPriority, dueAt?: string) {
    const tempId = crypto.randomUUID();
    const newReminder: Reminder = {
      id: tempId, userId: currentUserId,
      projectId: scope === "lab" ? (projectId ?? undefined) : undefined,
      scope, title, priority, dueAt,
      emailEnabled: false, sent: false, completed: false,
      createdAt: new Date().toISOString(),
    };
    setReminders(prev => sortReminders([newReminder, ...prev]));

    if (isSupabaseConfigured && currentUserId) {
      const { data, error } = await supabase
        .from("reminders")
        .insert({ user_id: currentUserId, project_id: scope === "lab" ? (projectId ?? null) : null, scope, title, priority: priority ?? null, due_at: dueAt ?? null, email_enabled: false, sent: false, completed: false })
        .select().single();
      if (!error && data) {
        setReminders(prev => prev.map(r => r.id === tempId ? { ...newReminder, id: data.id as string } : r));
      } else if (error) {
        console.error("[Reminders] add:", error);
      }
    }
  }

  function handleDelete(id: string) {
    setReminders(prev => prev.filter(r => r.id !== id));
    commitDelete(id);
  }

  async function handleUpdate(id: string, updates: { title: string; priority?: ReminderPriority; dueAt?: string }) {
    setReminders(prev => sortReminders(prev.map(r => r.id === id ? { ...r, ...updates } : r)));
    setEditingId(null);
    if (isSupabaseConfigured) {
      const { error } = await supabase.from("reminders").update({ title: updates.title, priority: updates.priority ?? null, due_at: updates.dueAt ?? null }).eq("id", id);
      if (error) console.error("[Reminders] update:", error);
    }
  }

  function handleListSelect(list: ListType) {
    setSelectedList(list); setIsAdding(false); setEditingId(null); setShowCompleted(false);
  }

  // Split reminders into active / completed, then filter by current list
  const allActive = useMemo(() => reminders.filter(r => !r.completed), [reminders]);
  const allCompleted = useMemo(() => reminders.filter(r => r.completed), [reminders]);
  const visible = useMemo(() => sortReminders(filterReminders(selectedList, allActive)), [selectedList, allActive]);
  const completedVisible = useMemo(() => filterReminders(selectedList, allCompleted), [selectedList, allCompleted]);
  const panelColor = LIST_COLORS[selectedList];
  const panelLabel = LIST_LABELS[selectedList];

  if (loading || (isSupabaseConfigured && projectLoading)) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: "var(--color-canvas)" }}>
        <div style={{ width: 28, height: 28, border: "3px solid var(--color-border)", borderTopColor: "var(--color-navy)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const sharedProps: ReminderRowRendererProps = {
    visible, completedVisible, showCompleted,
    currentUserId, teamMembers, editingId, panelColor,
    isAdding, selectedList,
    onComplete: handleComplete, onDelete: handleDelete,
    onEdit: (id) => setEditingId(id),
    onSave: handleUpdate, onCancelEdit: () => setEditingId(null),
    onAdd: handleAdd,
    onCloseAdd: () => {
      if (!isAdding) setIsAdding(true);
      else setIsAdding(false);
    },
    onToggleCompleted: () => setShowCompleted(v => !v),
    onUncomplete: handleUncomplete,
  };

  return (
    <ClientOnly>
      <div style={{ display: "flex", height: "100%", overflow: "hidden", backgroundColor: "var(--color-canvas)" }}>

        {/* Left panel — desktop only */}
        <div className="hidden md:block" style={{ height: "100%", flexShrink: 0 }}>
          <LeftPanel selected={selectedList} activeReminders={allActive} onSelect={handleListSelect} />
        </div>

        {/* Right content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Mobile: horizontal list picker */}
          <div className="flex md:hidden" style={{ overflowX: "auto", padding: "12px 16px", gap: 8, borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
            {(["today", "scheduled", "priority", "all", "personal", "lab"] as ListType[]).map(id => {
              const isAct = selectedList === id;
              return (
                <button key={id} onClick={() => handleListSelect(id)} style={{
                  height: 32, paddingInline: 14, borderRadius: 20, flexShrink: 0, border: "none",
                  backgroundColor: isAct ? LIST_COLORS[id] : "rgba(0,0,0,0.06)",
                  color: isAct ? "#fff" : "var(--color-secondary)",
                  fontSize: 13, fontWeight: isAct ? 700 : 400, cursor: "pointer", fontFamily: "var(--font-roboto)",
                }}>{LIST_LABELS[id]}</button>
              );
            })}
          </div>

          {/* Header */}
          <div style={{ padding: "22px 24px 14px", flexShrink: 0 }}>
            <h1 style={{ fontSize: 30, fontWeight: 700, color: panelColor, margin: 0, fontFamily: "var(--font-roboto)", lineHeight: 1 }}>
              {panelLabel}
            </h1>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {selectedList === "scheduled" ? (
              visible.length > 0 || isAdding || completedVisible.length > 0 ? (
                <ScheduledView {...sharedProps} panelColor={panelColor} />
              ) : (
                <EmptyState panelColor={panelColor} onAdd={() => setIsAdding(true)} />
              )
            ) : visible.length > 0 || isAdding ? (
              <div style={{ margin: "0 24px 24px" }}>
                <ReminderCardContent {...sharedProps}
                  onCloseAdd={() => { if (!isAdding) setIsAdding(true); else setIsAdding(false); }} />
              </div>
            ) : completedVisible.length > 0 ? (
              <div style={{ margin: "0 24px 24px" }}>
                <ReminderCardContent {...sharedProps} visible={[]} />
              </div>
            ) : (
              <EmptyState panelColor={panelColor} onAdd={() => setIsAdding(true)} />
            )}
          </div>
        </div>
      </div>

      {pendingUndo && <UndoToast title={pendingUndo.reminder.title} onUndo={handleUndo} />}
    </ClientOnly>
  );
}

function EmptyState({ panelColor, onAdd }: { panelColor: string; onAdd: () => void }) {
  return (
    <div style={{ margin: "0 24px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "56px 0", textAlign: "center", backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: `${panelColor}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Check size={20} color={panelColor} />
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-body)", margin: "0 0 4px" }}>No Reminders</p>
        <p style={{ fontSize: 13, color: "var(--color-secondary)", margin: "0 0 20px" }}>Nothing here.</p>
        <button onClick={onAdd} style={{ display: "flex", alignItems: "center", gap: 6, height: 34, paddingInline: 16, backgroundColor: panelColor, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-roboto)" }}>
          <Plus size={14} /> New Reminder
        </button>
      </div>
    </div>
  );
}
