"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Check, Sun, CalendarDays, List, Trash2, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";
import Avatar from "@/components/ui/Avatar";
import ClientOnly from "@/components/ui/ClientOnly";
import type { Reminder, ReminderScope, ReminderPriority, User } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

type ListType = "today" | "scheduled" | "priority" | "all" | "personal" | "lab";

const PRIORITY_MARKS: Record<ReminderPriority, string> = { high: "!!!", medium: "!!", low: "!" };

const LIST_COLORS: Record<ListType, string> = {
  today:     "#1B2E4B",
  scheduled: "#1E40AF",
  priority:  "#2563EB",
  all:       "#475569",
  personal:  "#1D4ED8",
  lab:       "#0F2544",
};

const LIST_LABELS: Record<ListType, string> = {
  today: "Today", scheduled: "Scheduled", priority: "Priority",
  all: "All", personal: "Personal", lab: "Lab",
};

const HOURS = [1,2,3,4,5,6,7,8,9,10,11,12];
const MINUTES = [0,5,10,15,20,25,30,35,40,45,50,55];
const ITEM_H = 34;

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStart(): Date { const d = new Date(); d.setHours(0,0,0,0); return d; }
function tomorrowStart(): Date { const d = todayStart(); d.setDate(d.getDate()+1); return d; }

// Today at midnight local — "no explicit time" sentinel
function makeTodayDueAt(): string {
  const d = new Date(); d.setHours(0,0,0,0); return d.toISOString();
}

// When user explicitly picks a date (+ optional time)
function makeDueAt(date: string, time: string): string {
  return new Date(time ? `${date}T${time}` : `${date}T09:00`).toISOString();
}

function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function isoToLocalTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function hasExplicitTime(iso: string): boolean {
  const d = new Date(iso); return d.getHours() !== 0 || d.getMinutes() !== 0;
}

function formatTimeDisplay(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2,"0")} ${ap}`;
}

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tmrw = new Date(now); tmrw.setDate(tmrw.getDate()+1);
  const withTime = hasExplicitTime(iso);
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString())  return withTime ? `Today, ${timeStr}` : "Today";
  if (d.toDateString() === tmrw.toDateString()) return withTime ? `Tomorrow, ${timeStr}` : "Tomorrow";
  if (d < now) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + (withTime ? `, ${timeStr}` : "");
  const days = Math.round((d.getTime()-now.getTime())/86400000);
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "short" }) + (withTime ? `, ${timeStr}` : "");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateLabel(date: string): string {
  const d = new Date(date+"T00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const tmrw = new Date(today); tmrw.setDate(today.getDate()+1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tmrw.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(iso?: string): boolean { return !!iso && new Date(iso) < new Date(); }

function getDefaultScope(list: ListType): ReminderScope { return list === "lab" ? "lab" : "personal"; }

// Sort by creation order ascending (insertion order)
function sortByCreation(list: Reminder[]): Reminder[] {
  return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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

function groupScheduled(reminders: Reminder[]): Array<{ label: string; sortKey: number; isPastDue: boolean; items: Reminder[] }> {
  const today = todayStart();
  const tomorrow = tomorrowStart();
  const groups = new Map<string, { label: string; sortKey: number; isPastDue: boolean; items: Reminder[] }>();
  const sorted = [...reminders.filter(r => !!r.dueAt)].sort((a,b) => new Date(a.dueAt!).getTime()-new Date(b.dueAt!).getTime());
  for (const r of sorted) {
    const dMid = new Date(r.dueAt!); dMid.setHours(0,0,0,0);
    const sortKey = dMid.getTime();
    let label: string; let isPastDue = false;
    if (dMid < today) { isPastDue = true; label = dMid.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }); }
    else if (dMid.getTime() === today.getTime()) label = "Today";
    else if (dMid.getTime() === tomorrow.getTime()) label = "Tomorrow";
    else label = dMid.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    if (!groups.has(label)) groups.set(label, { label, sortKey, isPastDue, items: [] });
    groups.get(label)!.items.push(r);
  }
  return Array.from(groups.values()).sort((a,b) => a.sortKey-b.sortKey);
}

// ── CalendarPicker ────────────────────────────────────────────────────────────

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LETTERS = ["S","M","T","W","T","F","S"];

function CalendarPicker({ value, accentColor, pos, onSelect, onClear, onClose }: {
  value: string | undefined; accentColor: string; pos: { top: number; left: number };
  onSelect: (date: string) => void; onClear: () => void; onClose: () => void;
}) {
  const todayDate = new Date(); todayDate.setHours(0,0,0,0);
  const todayStr = isoToLocalDate(todayDate.toISOString());
  const [cursor, setCursor] = useState(() => {
    if (value) { const d = new Date(value+"T00:00"); return { year: d.getFullYear(), month: d.getMonth() }; }
    return { year: todayDate.getFullYear(), month: todayDate.getMonth() };
  });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function down(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [onClose]);

  function prevMonth() { setCursor(p => p.month === 0 ? { year: p.year-1, month: 11 } : { ...p, month: p.month-1 }); }
  function nextMonth() { setCursor(p => p.month === 11 ? { year: p.year+1, month: 0 } : { ...p, month: p.month+1 }); }
  const daysInMonth = new Date(cursor.year, cursor.month+1, 0).getDate();
  const firstDow = new Date(cursor.year, cursor.month, 1).getDay();
  function ds(day: number) { return `${cursor.year}-${String(cursor.month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`; }
  const btnBase: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <div ref={ref} style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 400, width: 244, backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", padding: "14px 12px 10px", fontFamily: "var(--font-roboto)" }}>
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
        {DAY_LETTERS.map((l,i) => <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--color-secondary)", paddingBlock: 3 }}>{l}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i+1; const d = ds(day);
          const isToday = d === todayStr; const isSel = d === value;
          return (
            <button key={day} onClick={() => onSelect(d)} style={{
              width: 30, height: 30, borderRadius: "50%", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center",
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

// ── TimePicker ────────────────────────────────────────────────────────────────

function TimePicker({ value, accentColor, pos, onChange, onClear, onClose }: {
  value: string; accentColor: string; pos: { top: number; left: number };
  onChange: (time: string) => void; onClear: () => void; onClose: () => void;
}) {
  const parsed = useMemo(() => {
    if (!value) return { h: 9, m: 0, ampm: "AM" as const };
    const [hh, mm] = value.split(":").map(Number);
    return { h: hh === 0 ? 12 : hh > 12 ? hh-12 : hh, m: Math.round(mm/5)*5 % 60, ampm: (hh >= 12 ? "PM" : "AM") as "AM"|"PM" };
  }, [value]);

  const [selH, setSelH] = useState(parsed.h);
  const [selM, setSelM] = useState(parsed.m);
  const [selAP, setSelAP] = useState<"AM"|"PM">(parsed.ampm);
  const ref = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLDivElement>(null);
  const minRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function down(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [onClose]);

  useEffect(() => {
    const hi = HOURS.indexOf(selH);
    if (hi >= 0 && hourRef.current) hourRef.current.scrollTop = Math.max(0, (hi-1)*ITEM_H);
    const mi = MINUTES.indexOf(selM);
    if (mi >= 0 && minRef.current) minRef.current.scrollTop = Math.max(0, (mi-1)*ITEM_H);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emit(h: number, m: number, ap: "AM"|"PM") {
    let h24 = h;
    if (ap === "AM" && h === 12) h24 = 0;
    else if (ap === "PM" && h !== 12) h24 = h+12;
    onChange(`${String(h24).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
  }

  function pickH(h: number) { setSelH(h); emit(h, selM, selAP); }
  function pickM(m: number) { setSelM(m); emit(selH, m, selAP); }
  function pickAP(ap: "AM"|"PM") { setSelAP(ap); emit(selH, selM, ap); }

  const colStyle: React.CSSProperties = {
    height: ITEM_H*4, overflowY: "auto", scrollbarWidth: "none",
    msOverflowStyle: "none" as React.CSSProperties["msOverflowStyle"],
  };
  const item = (active: boolean): React.CSSProperties => ({
    height: ITEM_H, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, fontWeight: active ? 700 : 400, cursor: "pointer", borderRadius: 8,
    color: active ? "#fff" : "var(--color-body)", margin: "1px 2px",
    backgroundColor: active ? accentColor : "transparent", transition: "background-color 0.1s",
    userSelect: "none",
  });

  return (
    <div ref={ref} style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 401, width: 200, backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", padding: "12px 10px 10px", fontFamily: "var(--font-roboto)" }}>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {/* Hours */}
        <div ref={hourRef} style={{ flex: 1, ...colStyle }}>
          {HOURS.map(h => (
            <div key={h} onClick={() => pickH(h)} style={item(h === selH)}
              onMouseEnter={e => { if (h !== selH) (e.currentTarget as HTMLDivElement).style.backgroundColor = `${accentColor}18`; }}
              onMouseLeave={e => { if (h !== selH) (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}>
              {h}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-secondary)", paddingBottom: 2 }}>:</div>
        {/* Minutes */}
        <div ref={minRef} style={{ flex: 1, ...colStyle }}>
          {MINUTES.map(m => (
            <div key={m} onClick={() => pickM(m)} style={item(m === selM)}
              onMouseEnter={e => { if (m !== selM) (e.currentTarget as HTMLDivElement).style.backgroundColor = `${accentColor}18`; }}
              onMouseLeave={e => { if (m !== selM) (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}>
              {String(m).padStart(2,"0")}
            </div>
          ))}
        </div>
        {/* AM/PM */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 2 }}>
          {(["AM","PM"] as const).map(ap => (
            <button key={ap} onClick={() => pickAP(ap)} style={{
              width: 38, height: 30, borderRadius: 8, border: "1.5px solid",
              borderColor: ap === selAP ? accentColor : "var(--color-border)",
              backgroundColor: ap === selAP ? accentColor : "transparent",
              color: ap === selAP ? "#fff" : "var(--color-secondary)",
              fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-roboto)",
            }}>{ap}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
        <button onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--color-secondary)", padding: "4px 6px", borderRadius: 6, fontFamily: "var(--font-roboto)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-body)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--color-secondary)"; }}>
          Clear
        </button>
        <button onClick={onClose} style={{ background: `${accentColor}18`, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: accentColor, padding: "4px 10px", borderRadius: 6, fontFamily: "var(--font-roboto)" }}>
          Done
        </button>
      </div>
    </div>
  );
}

// ── DateTimeFields ────────────────────────────────────────────────────────────

function DateTimeFields({ selDate, selTime, showTime, accentColor, onDateChange, onTimeChange, onToggleTime }: {
  selDate: string | undefined; selTime: string; showTime: boolean; accentColor: string;
  onDateChange: (d: string | undefined) => void; onTimeChange: (t: string) => void; onToggleTime: () => void;
}) {
  const [showCal, setShowCal] = useState(false);
  const [calPos, setCalPos] = useState<{ top: number; left: number } | null>(null);
  const [showTP, setShowTP] = useState(false);
  const [tpPos, setTpPos] = useState<{ top: number; left: number } | null>(null);
  const dateRef = useRef<HTMLButtonElement>(null);
  const timeRef = useRef<HTMLButtonElement>(null);

  function openCal() {
    if (!dateRef.current) return;
    const r = dateRef.current.getBoundingClientRect();
    setCalPos({ top: r.bottom+6, left: r.left });
    setShowCal(v => !v); setShowTP(false);
  }
  function openTP() {
    if (!timeRef.current) return;
    const r = timeRef.current.getBoundingClientRect();
    setTpPos({ top: r.bottom+6, left: r.left });
    setShowTP(v => !v); setShowCal(false);
    if (!showTime) onToggleTime();
  }

  const pill = (active: boolean): React.CSSProperties => ({
    height: 26, paddingInline: 10, borderRadius: 20, border: "1.5px solid",
    borderColor: active ? accentColor : "var(--color-border)",
    backgroundColor: active ? `${accentColor}18` : "transparent",
    color: active ? accentColor : "var(--color-secondary)",
    fontSize: 12, cursor: "pointer", fontFamily: "var(--font-roboto)",
    display: "flex", alignItems: "center", gap: 4,
  });

  return (
    <>
      <button ref={dateRef} onClick={openCal} style={pill(!!selDate)}>
        <CalendarDays size={11} />
        {selDate ? formatDateLabel(selDate) : "Date"}
      </button>

      {selDate && (
        <button ref={timeRef} onClick={openTP} style={{ ...pill(showTime && !!selTime), fontSize: showTime && selTime ? 12 : 11 }}>
          <Clock size={11} />
          {showTime && selTime ? formatTimeDisplay(selTime) : "+ time"}
        </button>
      )}

      {showCal && calPos && (
        <CalendarPicker value={selDate} accentColor={accentColor} pos={calPos}
          onSelect={d => { onDateChange(d); setShowCal(false); }}
          onClear={() => { onDateChange(undefined); onTimeChange(""); if (showTime) onToggleTime(); setShowCal(false); }}
          onClose={() => setShowCal(false)} />
      )}

      {showTP && tpPos && (
        <TimePicker value={selTime || "09:00"} accentColor={accentColor} pos={tpPos}
          onChange={t => onTimeChange(t)}
          onClear={() => { onTimeChange(""); if (showTime) onToggleTime(); setShowTP(false); }}
          onClose={() => setShowTP(false)} />
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
  // Any project member can complete lab reminders
  const canCheck = reminder.scope === "lab" ? true : isCreator;
  const overdue = isOverdue(reminder.dueAt);
  const creator = reminder.scope === "lab" ? teamMembers.find(m => m.id === reminder.userId) : undefined;
  const circleColor = reminder.scope === "lab" ? LIST_COLORS.lab : LIST_COLORS.personal;

  function handleCheck() {
    if (!canCheck || completing) return;
    setCompleting(true);
    timerRef.current = setTimeout(() => onComplete(reminder.id), 340);
  }

  return (
    <div style={{ maxHeight: completing ? 0 : 100, opacity: completing ? 0 : 1, overflow: "hidden", transform: completing ? "translateY(-2px)" : "none", transition: completing ? "opacity 0.2s, max-height 0.35s ease 0.06s, transform 0.2s" : "none", pointerEvents: completing ? "none" : undefined }}>
      <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={onEdit}
        style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--color-border)", minHeight: 44, backgroundColor: hovered ? "rgba(0,0,0,0.02)" : "transparent", transition: "background-color 0.1s", cursor: "text" }}>
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
  // Lab members can also restore lab reminders
  const canRestore = reminder.scope === "lab" ? true : isCreator;
  const circleColor = reminder.scope === "lab" ? LIST_COLORS.lab : LIST_COLORS.personal;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 16px", borderBottom: "1px solid var(--color-border)", opacity: 0.5 }}>
      <button onClick={() => canRestore && onUncomplete(reminder.id)} disabled={!canRestore} aria-label="Restore reminder"
        style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: `2px solid ${circleColor}`, backgroundColor: circleColor, display: "flex", alignItems: "center", justifyContent: "center", cursor: canRestore ? "pointer" : "default" }}>
        <Check size={11} color="#fff" strokeWidth={3} />
      </button>
      <span style={{ fontSize: 14, color: "var(--color-secondary)", fontFamily: "var(--font-roboto)", textDecoration: "line-through", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {reminder.title}
      </span>
    </div>
  );
}

// ── ReminderEditRow — blur saves, Escape cancels, no Done/Cancel buttons ──────

function ReminderEditRow({ reminder, onSave, onCancel }: {
  reminder: Reminder;
  onSave: (id: string, updates: { title: string; priority?: ReminderPriority; dueAt?: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(reminder.title);
  const [priority, setPriority] = useState<ReminderPriority | undefined>(reminder.priority);
  const [selDate, setSelDate] = useState<string | undefined>(reminder.dueAt ? isoToLocalDate(reminder.dueAt) : undefined);
  const [selTime, setSelTime] = useState(reminder.dueAt && hasExplicitTime(reminder.dueAt) ? isoToLocalTime(reminder.dueAt) : "");
  const [showTime, setShowTime] = useState(!!reminder.dueAt && hasExplicitTime(reminder.dueAt));
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const accentColor = reminder.scope === "lab" ? LIST_COLORS.lab : LIST_COLORS.personal;
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  function save() {
    if (!title.trim()) { onCancel(); return; }
    onSave(reminder.id, { title: title.trim(), priority, dueAt: selDate ? makeDueAt(selDate, selTime) : undefined });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
  }

  function handleContainerBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (rowRef.current?.contains(e.relatedTarget as Node)) return;
    save();
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
        {(["low","medium","high"] as ReminderPriority[]).map(p => (
          <button key={p} onClick={() => setPriority(priority === p ? undefined : p)}
            style={{ ...pillBase(priority === p, accentColor), fontWeight: 800, letterSpacing: "-0.5px" }}>
            {PRIORITY_MARKS[p]}
          </button>
        ))}
        <div style={{ width: 1, height: 16, backgroundColor: "var(--color-border)" }} />
        <DateTimeFields selDate={selDate} selTime={selTime} showTime={showTime} accentColor={accentColor}
          onDateChange={setSelDate} onTimeChange={setSelTime} onToggleTime={() => setShowTime(v => !v)} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--color-secondary)", fontFamily: "var(--font-roboto)", opacity: 0.6, userSelect: "none" }}>Enter to save · Esc to cancel</span>
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

  // When no date chosen, default to today with no time (midnight sentinel)
  function resolveDueAt() {
    return selDate ? makeDueAt(selDate, selTime) : makeTodayDueAt();
  }

  function commit() {
    if (!title.trim()) return;
    onAdd(title.trim(), scope, priority, resolveDueAt());
    setTitle(""); setPriority(undefined); setSelDate(undefined); setSelTime(""); setShowTime(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { if (title) setTitle(""); else onClose(); }
  }

  function handleContainerBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (rowRef.current?.contains(e.relatedTarget as Node)) return;
    if (title.trim()) onAdd(title.trim(), scope, priority, resolveDueAt());
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
        {(["personal","lab"] as ReminderScope[]).map(s => (
          <button key={s} onClick={() => setScope(s)} style={{ ...pillBase(scope === s, LIST_COLORS[s]), fontWeight: scope === s ? 700 : 400 }}>
            {s === "personal" ? "Personal" : "Lab"}
          </button>
        ))}
        <div style={{ width: 1, height: 16, backgroundColor: "var(--color-border)" }} />
        {(["low","medium","high"] as ReminderPriority[]).map(p => (
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

function MyListRow({ id, count, selected, onClick }: { id: "personal"|"lab"; count: number; selected: boolean; onClick: () => void }) {
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

// ── Shared props type ─────────────────────────────────────────────────────────

type ReminderRowRendererProps = {
  visible: Reminder[]; completedVisible: Reminder[]; showCompleted: boolean;
  currentUserId: string; teamMembers: User[]; editingId: string | null;
  panelColor: string; isAdding: boolean; selectedList: ListType;
  onComplete: (id: string) => void; onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onSave: (id: string, u: { title: string; priority?: ReminderPriority; dueAt?: string }) => void;
  onCancelEdit: () => void;
  onAdd: (title: string, scope: ReminderScope, priority?: ReminderPriority, dueAt?: string) => void;
  onCloseAdd: () => void; onToggleCompleted: () => void;
  onUncomplete: (id: string) => void;
  hideAddRow?: boolean;
};

// ── ReminderCardContent ───────────────────────────────────────────────────────

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

      {completedVisible.length > 0 && (
        <div style={{ borderTop: "1px solid var(--color-border)" }}>
          <button onClick={onToggleCompleted}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 16px", background: "none", border: "none", cursor: "pointer" }}>
            <span style={{ fontSize: 13, color: "var(--color-secondary)", fontFamily: "var(--font-roboto)" }}>{completedVisible.length} Completed</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: panelColor, fontFamily: "var(--font-roboto)" }}>{showCompleted ? "Hide" : "Show"}</span>
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

function ScheduledView(props: ReminderRowRendererProps) {
  const { visible, panelColor } = props;
  const groups = useMemo(() => groupScheduled(visible), [visible]);

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

      <div style={{ margin: "0 24px 24px" }}>
        <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden" }}>
          {props.isAdding ? (
            <InlineAddRow defaultScope={getDefaultScope(props.selectedList)} accentColor={panelColor}
              onAdd={props.onAdd} onClose={props.onCloseAdd} />
          ) : (
            <button onClick={props.onCloseAdd}
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
      <div role="status" aria-live="polite" style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", backgroundColor: "#1B2E4B", color: "#fff", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.22)", zIndex: 200, fontSize: 13, fontFamily: "var(--font-roboto)", whiteSpace: "nowrap", animation: "toastIn 0.18s ease" }}>
        <Check size={13} color="rgba(255,255,255,0.7)" />
        <span style={{ color: "rgba(255,255,255,0.85)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
        <button onClick={onUndo} style={{ background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 6, padding: "4px 10px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-roboto)" }}>Undo</button>
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

      // Fetch personal reminders for this user + all lab reminders for this project
      const filter = projectId
        ? `and(scope.eq.personal,user_id.eq.${currentUserId}),and(scope.eq.lab,project_id.eq.${projectId})`
        : `scope.eq.personal,user_id.eq.${currentUserId}`;

      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .or(filter)
        .order("created_at", { ascending: true }); // insertion order

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
    if (isSupabaseConfigured) supabase.from("reminders").delete().eq("id", id).then(({ error }) => { if (error) console.error("[Reminders] delete:", error); });
  }
  function commitComplete(id: string) {
    if (isSupabaseConfigured) supabase.from("reminders").update({ completed: true }).eq("id", id).then(({ error }) => { if (error) console.error("[Reminders] complete:", error); });
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
    setReminders(prev => [...prev, newReminder]); // append — preserves insertion order

    if (isSupabaseConfigured && currentUserId) {
      const { data, error } = await supabase
        .from("reminders")
        .insert({ user_id: currentUserId, project_id: scope === "lab" ? (projectId ?? null) : null, scope, title, priority: priority ?? null, due_at: dueAt ?? null, email_enabled: false, sent: false, completed: false })
        .select().single();
      if (!error && data) setReminders(prev => prev.map(r => r.id === tempId ? { ...newReminder, id: data.id as string } : r));
      else if (error) console.error("[Reminders] add:", error);
    }
  }

  function handleDelete(id: string) {
    setReminders(prev => prev.filter(r => r.id !== id));
    commitDelete(id);
  }

  async function handleUpdate(id: string, updates: { title: string; priority?: ReminderPriority; dueAt?: string }) {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r)); // no re-sort
    setEditingId(null);
    if (isSupabaseConfigured) {
      const { error } = await supabase.from("reminders").update({ title: updates.title, priority: updates.priority ?? null, due_at: updates.dueAt ?? null }).eq("id", id);
      if (error) console.error("[Reminders] update:", error);
    }
  }

  function handleListSelect(list: ListType) { setSelectedList(list); setIsAdding(false); setEditingId(null); setShowCompleted(false); }

  const allActive = useMemo(() => sortByCreation(reminders.filter(r => !r.completed)), [reminders]);
  const allCompleted = useMemo(() => reminders.filter(r => r.completed), [reminders]);
  const visible = useMemo(() => filterReminders(selectedList, allActive), [selectedList, allActive]);
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

  function toggleAdd() { setIsAdding(v => !v); }

  const sharedProps: ReminderRowRendererProps = {
    visible, completedVisible, showCompleted, currentUserId, teamMembers,
    editingId, panelColor, isAdding, selectedList,
    onComplete: handleComplete, onDelete: handleDelete, onEdit: setEditingId,
    onSave: handleUpdate, onCancelEdit: () => setEditingId(null),
    onAdd: handleAdd, onCloseAdd: toggleAdd,
    onToggleCompleted: () => setShowCompleted(v => !v),
    onUncomplete: handleUncomplete,
  };

  return (
    <ClientOnly>
      <div style={{ display: "flex", height: "100%", overflow: "hidden", backgroundColor: "var(--color-canvas)" }}>

        <div className="hidden md:block" style={{ height: "100%", flexShrink: 0 }}>
          <LeftPanel selected={selectedList} activeReminders={allActive} onSelect={handleListSelect} />
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          <div className="flex md:hidden" style={{ overflowX: "auto", padding: "12px 16px", gap: 8, borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
            {(["today","scheduled","priority","all","personal","lab"] as ListType[]).map(id => {
              const isAct = selectedList === id;
              return (
                <button key={id} onClick={() => handleListSelect(id)} style={{ height: 32, paddingInline: 14, borderRadius: 20, flexShrink: 0, border: "none", backgroundColor: isAct ? LIST_COLORS[id] : "rgba(0,0,0,0.06)", color: isAct ? "#fff" : "var(--color-secondary)", fontSize: 13, fontWeight: isAct ? 700 : 400, cursor: "pointer", fontFamily: "var(--font-roboto)" }}>{LIST_LABELS[id]}</button>
              );
            })}
          </div>

          <div style={{ padding: "22px 24px 14px", flexShrink: 0 }}>
            <h1 style={{ fontSize: 30, fontWeight: 700, color: panelColor, margin: 0, fontFamily: "var(--font-roboto)", lineHeight: 1 }}>{panelLabel}</h1>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {selectedList === "scheduled" ? (
              visible.length > 0 || isAdding || completedVisible.length > 0 ? (
                <ScheduledView {...sharedProps} />
              ) : (
                <EmptyState panelColor={panelColor} onAdd={() => setIsAdding(true)} />
              )
            ) : visible.length > 0 || isAdding || completedVisible.length > 0 ? (
              <div style={{ margin: "0 24px 24px" }}>
                <ReminderCardContent {...sharedProps} />
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
