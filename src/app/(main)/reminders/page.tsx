"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Check, Sun, CalendarDays, List, Trash2 } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";
import Avatar from "@/components/ui/Avatar";
import ClientOnly from "@/components/ui/ClientOnly";
import type { Reminder, ReminderScope, ReminderPriority, User } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

type ListType = "today" | "scheduled" | "priority" | "all" | "personal" | "lab";

const PRIORITY_MARKS: Record<ReminderPriority, string> = { high: "!!!", medium: "!!", low: "!" };
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

const LIST_COLORS: Record<ListType, string> = {
  today:     "#3478F6",
  scheduled: "#FF3B30",
  priority:  "#FF9500",
  all:       "#636366",
  personal:  "#5856D6",
  lab:       "#1B2E4B",
};

const LIST_LABELS: Record<ListType, string> = {
  today:     "Today",
  scheduled: "Scheduled",
  priority:  "Priority",
  all:       "All",
  personal:  "Personal",
  lab:       "Lab",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function tomorrowStart(): Date {
  const d = todayStart();
  d.setDate(d.getDate() + 1);
  return d;
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
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
}

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today, ${timeStr}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${timeStr}`;
  if (d < now) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + `, ${timeStr}`;
  const daysDiff = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (daysDiff < 7) return d.toLocaleDateString("en-US", { weekday: "short" }) + `, ${timeStr}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(iso?: string): boolean {
  return !!iso && new Date(iso) < new Date();
}

function getDefaultScope(list: ListType): ReminderScope {
  return list === "lab" ? "lab" : "personal";
}

// ── CompletionCircle ──────────────────────────────────────────────────────────

function CompletionCircle({ completing, disabled, color, onClick }: {
  completing: boolean; disabled: boolean; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Mark complete"
      style={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${completing ? color : "var(--color-border)"}`,
        backgroundColor: completing ? color : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        transition: "background-color 0.12s, border-color 0.12s",
        opacity: disabled ? 0.3 : 1,
      }}
      onMouseEnter={e => {
        if (!completing && !disabled)
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${color}22`;
      }}
      onMouseLeave={e => {
        if (!completing && !disabled)
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
      }}
    >
      {completing && <Check size={11} color="#fff" strokeWidth={3} />}
    </button>
  );
}

// ── ReminderRow ───────────────────────────────────────────────────────────────

function ReminderRow({ reminder, currentUserId, teamMembers, onComplete, onDelete }: {
  reminder: Reminder; currentUserId: string; teamMembers: User[];
  onComplete: (id: string) => void; onDelete: (id: string) => void;
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
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          padding: "10px 16px", borderBottom: "1px solid var(--color-border)",
          backgroundColor: hovered ? "rgba(0,0,0,0.02)" : "transparent",
          transition: "background-color 0.1s", minHeight: 44,
        }}
      >
        <CompletionCircle completing={completing} disabled={!canCheck} color={circleColor} onClick={handleCheck} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {reminder.priority && (
              <span style={{
                fontSize: 12, fontWeight: 800, color: "var(--color-navy)",
                letterSpacing: "-0.5px", flexShrink: 0, userSelect: "none",
              }}>
                {PRIORITY_MARKS[reminder.priority]}
              </span>
            )}
            <span style={{ fontSize: 15, color: "var(--color-body)", fontFamily: "var(--font-roboto)", lineHeight: 1.3 }}>
              {reminder.title}
            </span>
          </div>
          {reminder.dueAt && (
            <div style={{
              fontSize: 12, marginTop: 2,
              color: overdue ? "#FF3B30" : "var(--color-secondary)",
              fontWeight: overdue ? 600 : 400,
            }}>
              {formatDueDate(reminder.dueAt)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginTop: 2 }}>
          {creator && <Avatar user={creator} size={18} />}
          {isCreator && hovered && (
            <button
              onClick={() => onDelete(reminder.id)}
              aria-label="Delete"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", opacity: 0.45 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.45"; }}
            >
              <Trash2 size={13} color="var(--color-secondary)" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── InlineAddRow ──────────────────────────────────────────────────────────────

const dateInputStyle: React.CSSProperties = {
  height: 30, border: "1px solid var(--color-border)", borderRadius: 6,
  padding: "0 8px", fontSize: 12, fontFamily: "var(--font-roboto)",
  backgroundColor: "var(--color-canvas)", color: "var(--color-body)", outline: "none",
};

function InlineAddRow({ defaultScope, onAdd, onCancel }: {
  defaultScope: ReminderScope;
  onAdd: (title: string, scope: ReminderScope, priority?: ReminderPriority, dueAt?: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<ReminderScope>(defaultScope);
  const [priority, setPriority] = useState<ReminderPriority | undefined>();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [showDate, setShowDate] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const circleColor = scope === "lab" ? LIST_COLORS.lab : LIST_COLORS.personal;

  function submit() {
    if (!title.trim()) { onCancel(); return; }
    const dueAt = date ? new Date(time ? `${date}T${time}` : `${date}T09:00`).toISOString() : undefined;
    onAdd(title.trim(), scope, priority, dueAt);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") onCancel();
  }

  return (
    <div style={{ borderTop: "1px solid var(--color-border)", backgroundColor: "rgba(0,0,0,0.015)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px 6px" }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: `2px solid ${circleColor}`, opacity: 0.45 }} />
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New Reminder"
          style={{ flex: 1, border: "none", outline: "none", fontSize: 15, fontFamily: "var(--font-roboto)", backgroundColor: "transparent", color: "var(--color-body)" }}
        />
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px 11px 50px", flexWrap: "wrap" }}>
        {(["personal", "lab"] as ReminderScope[]).map(s => {
          const active = scope === s;
          const c = LIST_COLORS[s];
          return (
            <button key={s} onClick={() => setScope(s)} style={{
              height: 26, paddingInline: 10, borderRadius: 20, border: "1.5px solid",
              borderColor: active ? c : "var(--color-border)",
              backgroundColor: active ? `${c}18` : "transparent",
              color: active ? c : "var(--color-secondary)",
              fontSize: 12, fontWeight: active ? 700 : 400, cursor: "pointer", fontFamily: "var(--font-roboto)",
            }}>
              {s === "personal" ? "Personal" : "Lab"}
            </button>
          );
        })}

        <div style={{ width: 1, height: 16, backgroundColor: "var(--color-border)" }} />

        {(["low", "medium", "high"] as ReminderPriority[]).map(p => {
          const active = priority === p;
          return (
            <button key={p} onClick={() => setPriority(active ? undefined : p)} style={{
              height: 26, paddingInline: 10, borderRadius: 20, border: "1.5px solid",
              borderColor: active ? "var(--color-navy)" : "var(--color-border)",
              backgroundColor: active ? "rgba(27,46,75,0.08)" : "transparent",
              color: active ? "var(--color-navy)" : "var(--color-secondary)",
              fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "var(--font-roboto)", letterSpacing: "-0.5px",
            }}>
              {PRIORITY_MARKS[p]}
            </button>
          );
        })}

        <div style={{ width: 1, height: 16, backgroundColor: "var(--color-border)" }} />

        <button onClick={() => setShowDate(v => !v)} style={{
          height: 26, paddingInline: 10, borderRadius: 20, border: "1.5px solid",
          borderColor: date ? "var(--color-navy)" : "var(--color-border)",
          backgroundColor: date ? "rgba(27,46,75,0.08)" : "transparent",
          color: date ? "var(--color-navy)" : "var(--color-secondary)",
          fontSize: 12, cursor: "pointer", fontFamily: "var(--font-roboto)",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <CalendarDays size={11} />
          {date || "Date"}
        </button>

        <div style={{ flex: 1 }} />

        <button onClick={onCancel} style={{ fontSize: 12, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}>
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!title.trim()}
          style={{
            height: 26, paddingInline: 12, borderRadius: 7, border: "none",
            backgroundColor: title.trim() ? "var(--color-navy)" : "var(--color-border)",
            color: title.trim() ? "#fff" : "var(--color-secondary)",
            fontSize: 12, fontWeight: 700, cursor: title.trim() ? "pointer" : "default",
            fontFamily: "var(--font-roboto)", transition: "background-color 0.1s",
          }}
        >
          Add
        </button>
      </div>

      {showDate && (
        <div style={{ display: "flex", gap: 8, padding: "0 16px 11px 50px" }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={dateInputStyle} />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...dateInputStyle, width: 100 }} />
        </div>
      )}
    </div>
  );
}

// ── SmartListCard ─────────────────────────────────────────────────────────────

function SmartListCard({ id, count, icon, selected, onClick }: {
  id: ListType; count: number; icon: React.ReactNode; selected: boolean; onClick: () => void;
}) {
  const color = LIST_COLORS[id];
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", backgroundColor: color, borderRadius: 13,
        padding: "12px 14px", minHeight: 84,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        border: `2px solid ${selected ? "rgba(0,0,0,0.22)" : "transparent"}`,
        cursor: "pointer", transition: "opacity 0.1s", boxSizing: "border-box",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
    >
      <div style={{ color: "rgba(255,255,255,0.9)", display: "flex" }}>{icon}</div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", lineHeight: 1, marginBottom: 3 }}>{count}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500, fontFamily: "var(--font-roboto)" }}>
          {LIST_LABELS[id]}
        </div>
      </div>
    </button>
  );
}

// ── MyListRow ─────────────────────────────────────────────────────────────────

function MyListRow({ id, count, selected, onClick }: {
  id: "personal" | "lab"; count: number; selected: boolean; onClick: () => void;
}) {
  const color = LIST_COLORS[id];
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
        borderRadius: 9, border: "none", backgroundColor: selected ? "rgba(0,0,0,0.06)" : "transparent",
        cursor: "pointer", textAlign: "left",
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,0,0,0.03)"; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
    >
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

function LeftPanel({ selected, reminders, onSelect }: {
  selected: ListType; reminders: Reminder[]; onSelect: (list: ListType) => void;
}) {
  const tomorrow = tomorrowStart();
  const counts = useMemo(() => ({
    today:     reminders.filter(r => r.dueAt && new Date(r.dueAt) < tomorrow).length,
    scheduled: reminders.filter(r => !!r.dueAt).length,
    priority:  reminders.filter(r => !!r.priority).length,
    all:       reminders.length,
    personal:  reminders.filter(r => r.scope === "personal").length,
    lab:       reminders.filter(r => r.scope === "lab").length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [reminders]);

  return (
    <div style={{
      width: 240, flexShrink: 0, padding: "20px 16px", overflowY: "auto",
      borderRight: "1px solid var(--color-border)", backgroundColor: "var(--color-canvas)",
      height: "100%", boxSizing: "border-box",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        <SmartListCard id="today" count={counts.today} icon={<Sun size={20} />}
          selected={selected === "today"} onClick={() => onSelect("today")} />
        <SmartListCard id="scheduled" count={counts.scheduled} icon={<CalendarDays size={20} />}
          selected={selected === "scheduled"} onClick={() => onSelect("scheduled")} />
        <SmartListCard id="priority" count={counts.priority}
          icon={<span style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-1px", lineHeight: 1 }}>!</span>}
          selected={selected === "priority"} onClick={() => onSelect("priority")} />
        <SmartListCard id="all" count={counts.all} icon={<List size={20} />}
          selected={selected === "all"} onClick={() => onSelect("all")} />
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, paddingLeft: 12 }}>
          My Lists
        </div>
        <MyListRow id="personal" count={counts.personal} selected={selected === "personal"} onClick={() => onSelect("personal")} />
        <MyListRow id="lab" count={counts.lab} selected={selected === "lab"} onClick={() => onSelect("lab")} />
      </div>
    </div>
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
        <button onClick={onUndo} style={{
          background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 6,
          padding: "4px 10px", color: "#fff", fontWeight: 700, fontSize: 12,
          cursor: "pointer", fontFamily: "var(--font-roboto)",
        }}>
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
            return {
              id: row.user_id as string, name, email: "",
              role: (row.role ?? "researcher") as User["role"],
              avatarColor: profile?.avatar_color ?? "#B4D4E3",
              avatarInitials: computeInitials(name) || (profile?.avatar_initials ?? "??"),
              avatarUrl: profile?.avatar_url ?? undefined,
            };
          }));
        }
      }

      const filter = projectId
        ? `and(scope.eq.personal,user_id.eq.${currentUserId}),and(scope.eq.lab,project_id.eq.${projectId})`
        : `scope.eq.personal,user_id.eq.${currentUserId}`;

      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .or(filter)
        .eq("completed", false)
        .order("due_at", { ascending: true, nullsFirst: false });

      if (error) console.error("[Reminders] fetch:", error);
      if (data) {
        setReminders(data.map(row => ({
          id: row.id as string,
          userId: row.user_id as string,
          projectId: (row.project_id as string) ?? undefined,
          scope: (row.scope as ReminderScope) ?? "personal",
          title: row.title as string,
          dueAt: (row.due_at as string) ?? undefined,
          linkedTaskId: (row.linked_task_id as string) ?? undefined,
          linkedEventId: (row.linked_event_id as string) ?? undefined,
          emailEnabled: (row.email_enabled as boolean) ?? false,
          sent: (row.sent as boolean) ?? false,
          completed: false,
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

  function handleComplete(id: string) {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;
    if (pendingUndo) { clearTimeout(pendingUndo.timerId); commitDelete(pendingUndo.reminder.id); }
    setReminders(prev => prev.filter(r => r.id !== id));
    const timerId = setTimeout(() => { commitDelete(id); setPendingUndo(null); }, 4000);
    setPendingUndo({ reminder, timerId });
  }

  function handleUndo() {
    if (!pendingUndo) return;
    clearTimeout(pendingUndo.timerId);
    setReminders(prev => sortReminders([pendingUndo!.reminder, ...prev]));
    setPendingUndo(null);
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
    setIsAdding(false);

    if (isSupabaseConfigured && currentUserId) {
      const { data, error } = await supabase
        .from("reminders")
        .insert({
          user_id: currentUserId,
          project_id: scope === "lab" ? (projectId ?? null) : null,
          scope, title, priority: priority ?? null, due_at: dueAt ?? null,
          email_enabled: false, sent: false, completed: false,
        })
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

  function handleListSelect(list: ListType) {
    setSelectedList(list);
    setIsAdding(false);
  }

  const active = reminders.filter(r => !r.completed);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => sortReminders(filterReminders(selectedList, active)), [selectedList, reminders]);
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

  return (
    <ClientOnly>
      <div style={{ display: "flex", height: "100%", overflow: "hidden", backgroundColor: "var(--color-canvas)" }}>

        {/* Left panel — desktop only */}
        <div className="hidden md:block" style={{ height: "100%", flexShrink: 0 }}>
          <LeftPanel selected={selectedList} reminders={active} onSelect={handleListSelect} />
        </div>

        {/* Right content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Mobile: horizontal list picker */}
          <div className="flex md:hidden" style={{ overflowX: "auto", padding: "12px 16px", gap: 8, borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
            {(["today", "scheduled", "priority", "all", "personal", "lab"] as ListType[]).map(id => {
              const isActive = selectedList === id;
              return (
                <button key={id} onClick={() => handleListSelect(id)} style={{
                  height: 32, paddingInline: 14, borderRadius: 20, flexShrink: 0, border: "none",
                  backgroundColor: isActive ? LIST_COLORS[id] : "rgba(0,0,0,0.06)",
                  color: isActive ? "#fff" : "var(--color-secondary)",
                  fontSize: 13, fontWeight: isActive ? 700 : 400,
                  cursor: "pointer", fontFamily: "var(--font-roboto)",
                }}>
                  {LIST_LABELS[id]}
                </button>
              );
            })}
          </div>

          {/* Header */}
          <div style={{ padding: "22px 24px 14px", flexShrink: 0 }}>
            <h1 style={{ fontSize: 30, fontWeight: 700, color: panelColor, margin: 0, fontFamily: "var(--font-roboto)", lineHeight: 1 }}>
              {panelLabel}
            </h1>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {visible.length > 0 || isAdding ? (
              <div style={{
                margin: "0 24px 24px",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 12, overflow: "hidden",
              }}>
                {visible.map(reminder => (
                  <ReminderRow
                    key={reminder.id}
                    reminder={reminder}
                    currentUserId={currentUserId}
                    teamMembers={teamMembers}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                  />
                ))}

                {isAdding ? (
                  <InlineAddRow
                    defaultScope={getDefaultScope(selectedList)}
                    onAdd={handleAdd}
                    onCancel={() => setIsAdding(false)}
                  />
                ) : (
                  <button
                    onClick={() => setIsAdding(true)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 16px", background: "none", border: "none",
                      cursor: "pointer", fontSize: 14, fontFamily: "var(--font-roboto)",
                      borderTop: "1px solid var(--color-border)",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,0,0,0.02)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                  >
                    <Plus size={15} color={panelColor} />
                    <span style={{ color: panelColor, fontWeight: 500 }}>New Reminder</span>
                  </button>
                )}
              </div>
            ) : (
              <div style={{ margin: "0 24px" }}>
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", padding: "56px 0", textAlign: "center",
                  backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12,
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: `${panelColor}18`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <Check size={20} color={panelColor} />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-body)", margin: "0 0 4px" }}>No Reminders</p>
                  <p style={{ fontSize: 13, color: "var(--color-secondary)", margin: "0 0 20px" }}>Nothing here.</p>
                  <button
                    onClick={() => setIsAdding(true)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      height: 34, paddingInline: 16, backgroundColor: panelColor, color: "#fff",
                      border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: "pointer", fontFamily: "var(--font-roboto)",
                    }}
                  >
                    <Plus size={14} /> New Reminder
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {pendingUndo && <UndoToast title={pendingUndo.reminder.title} onUndo={handleUndo} />}
    </ClientOnly>
  );
}
