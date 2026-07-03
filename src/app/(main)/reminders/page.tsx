"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Check, Trash2, X, Flag } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";
import Avatar from "@/components/ui/Avatar";
import ClientOnly from "@/components/ui/ClientOnly";
import type { Reminder, ReminderScope, ReminderPriority, User } from "@/types";

// ── Priority config ───────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<ReminderPriority, { label: string; color: string }> = {
  high:   { label: "High",   color: "#EF4444" },
  medium: { label: "Medium", color: "#F97316" },
  low:    { label: "Low",    color: "var(--color-secondary)" },
};

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

// ── Scope config ──────────────────────────────────────────────────────────────

const SCOPE_CONFIG: Record<ReminderScope, { label: string; border: string; badgeBg: string; badgeText: string }> = {
  personal: {
    label:     "Personal",
    border:    "var(--color-border)",
    badgeBg:   "rgba(107,107,107,0.10)",
    badgeText: "var(--color-secondary)",
  },
  lab: {
    label:     "Lab",
    border:    "var(--color-navy)",
    badgeBg:   "rgba(27,46,75,0.10)",
    badgeText: "var(--color-navy)",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const tmrw = new Date(now);
  tmrw.setDate(tmrw.getDate() + 1);
  const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today, ${timeStr}`;
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

function sortReminders(list: Reminder[]): Reminder[] {
  return [...list].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority ?? "low"] ?? 2;
    const pb = PRIORITY_RANK[b.priority ?? "low"] ?? 2;
    if (pa !== pb) return pa - pb;
    if (!a.dueAt && !b.dueAt) return 0;
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
}

// ── Flag button with priority picker ─────────────────────────────────────────

function FlagButton({
  priority,
  canEdit,
  onChange,
}: {
  priority?: ReminderPriority;
  canEdit: boolean;
  onChange: (p: ReminderPriority | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const flagColor = priority ? PRIORITY_CONFIG[priority].color : "var(--color-border)";
  const flagFilled = priority === "high" || priority === "medium";

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={canEdit ? () => setOpen((o) => !o) : undefined}
        aria-label={`Flag: ${priority ?? "none"}`}
        style={{
          background: "none",
          border: "none",
          cursor: canEdit ? "pointer" : "default",
          padding: "2px 3px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Flag
          size={13}
          color={flagColor}
          fill={flagFilled ? flagColor : "none"}
          strokeWidth={flagFilled ? 0 : 1.75}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "calc(100% + 4px)",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            zIndex: 60,
            minWidth: 118,
            overflow: "hidden",
          }}
        >
          {(["high", "medium", "low"] as ReminderPriority[]).map((p) => {
            const cfg = PRIORITY_CONFIG[p];
            return (
              <button
                key={p}
                onClick={() => { onChange(p); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 12px",
                  background: priority === p ? "rgba(27,46,75,0.05)" : "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--color-body)",
                  fontFamily: "var(--font-roboto)",
                  textAlign: "left",
                }}
              >
                <Flag size={11} color={cfg.color} fill={p !== "low" ? cfg.color : "none"} strokeWidth={p === "low" ? 1.75 : 0} />
                {cfg.label}
              </button>
            );
          })}
          {priority && (
            <button
              onClick={() => { onChange(undefined); setOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "7px 12px",
                background: "none",
                border: "none",
                borderTop: "1px solid var(--color-border)",
                cursor: "pointer",
                fontSize: 12,
                color: "var(--color-secondary)",
                fontFamily: "var(--font-roboto)",
              }}
            >
              <X size={11} /> Remove flag
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Completion circle ─────────────────────────────────────────────────────────

function CompletionCircle({
  disabled,
  completing,
  onClick,
}: {
  disabled: boolean;
  completing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Mark as complete"
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        border: `2px solid ${completing ? "var(--color-navy)" : "var(--color-border)"}`,
        backgroundColor: completing ? "var(--color-navy)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
        transition: "background-color 0.12s, border-color 0.12s",
        opacity: disabled ? 0.35 : 1,
      }}
      onMouseEnter={(e) => {
        if (!completing && !disabled)
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(27,46,75,0.12)";
      }}
      onMouseLeave={(e) => {
        if (!completing && !disabled)
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
      }}
    >
      {completing && <Check size={10} color="#fff" strokeWidth={3} />}
    </button>
  );
}

// ── Reminder row ──────────────────────────────────────────────────────────────

function ReminderRow({
  reminder,
  currentUserId,
  teamMembers,
  onComplete,
  onDelete,
  onPriorityChange,
}: {
  reminder: Reminder;
  currentUserId: string;
  teamMembers: User[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onPriorityChange: (id: string, p: ReminderPriority | undefined) => void;
}) {
  const [completing, setCompleting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const scope = reminder.scope ?? "personal";
  const cfg = SCOPE_CONFIG[scope];
  const overdue = isOverdue(reminder.dueAt);
  const isCreator = reminder.userId === currentUserId;
  const canCheck = scope === "lab" || isCreator;
  const creator = scope === "lab" ? teamMembers.find((m) => m.id === reminder.userId) : undefined;

  function handleCheck() {
    if (!canCheck || completing) return;
    setCompleting(true);
    timerRef.current = setTimeout(() => onComplete(reminder.id), 340);
  }

  return (
    <div
      style={{
        maxHeight: completing ? 0 : 120,
        opacity: completing ? 0 : 1,
        overflow: "hidden",
        transform: completing ? "translateY(-3px)" : "translateY(0)",
        transition: completing
          ? "opacity 0.22s ease, max-height 0.38s ease 0.08s, transform 0.22s ease"
          : "none",
        pointerEvents: completing ? "none" : undefined,
      }}
    >
      <div
        style={{
          borderBottom: "1px solid var(--color-border)",
          borderLeft: `3px solid ${cfg.border}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px 10px 11px",
          minHeight: 46,
        }}
      >
        <CompletionCircle
          disabled={!canCheck}
          completing={completing}
          onClick={handleCheck}
        />

        {/* Flag */}
        <FlagButton
          priority={reminder.priority}
          canEdit={isCreator}
          onChange={(p) => onPriorityChange(reminder.id, p)}
        />

        {/* Title */}
        <span
          style={{
            flex: 1,
            fontSize: 14,
            color: "var(--color-body)",
            lineHeight: 1.4,
            fontFamily: "var(--font-roboto)",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {reminder.title}
        </span>

        {/* Trailing meta */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.03em",
              padding: "2px 7px",
              borderRadius: 20,
              backgroundColor: cfg.badgeBg,
              color: cfg.badgeText,
              whiteSpace: "nowrap",
            }}
          >
            {cfg.label}
          </span>

          {creator && <Avatar user={creator} size={18} />}

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

          {isCreator && (
            <button
              onClick={() => onDelete(reminder.id)}
              aria-label="Delete reminder"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 2,
                display: "flex",
                opacity: 0.35,
                flexShrink: 0,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.35"; }}
            >
              <Trash2 size={13} color="var(--color-secondary)" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add reminder form ─────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  height: 36,
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  padding: "0 10px",
  fontSize: 13,
  fontFamily: "var(--font-roboto)",
  backgroundColor: "var(--color-canvas)",
  color: "var(--color-body)",
  outline: "none",
  boxSizing: "border-box",
};

function AddReminderForm({
  onAdd,
  onClose,
}: {
  onAdd: (title: string, scope: ReminderScope, priority?: ReminderPriority, dueAt?: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [scope, setScope] = useState<ReminderScope>("personal");
  const [priority, setPriority] = useState<ReminderPriority | undefined>();
  const [error, setError] = useState("");

  function handleSubmit() {
    if (!title.trim()) { setError("Please enter a title."); return; }
    let dueAt: string | undefined;
    if (date) {
      dueAt = new Date(time ? `${date}T${time}` : `${date}T09:00`).toISOString();
    }
    onAdd(title.trim(), scope, priority, dueAt);
  }

  return (
    <div
      className="space-y-3"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        padding: "16px 16px 14px",
        boxShadow: "0 2px 10px rgba(27,46,75,0.08)",
      }}
    >
      {/* Scope + Priority row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {(["personal", "lab"] as ReminderScope[]).map((s) => {
          const active = scope === s;
          const c = SCOPE_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setScope(s)}
              style={{
                height: 28,
                paddingInline: 12,
                borderRadius: 20,
                border: "1.5px solid",
                borderColor: active ? c.border : "var(--color-border)",
                backgroundColor: active ? c.badgeBg : "transparent",
                color: active ? c.badgeText : "var(--color-secondary)",
                fontSize: 12,
                fontWeight: active ? 700 : 400,
                cursor: "pointer",
                fontFamily: "var(--font-roboto)",
              }}
            >
              {c.label}
            </button>
          );
        })}

        <div style={{ width: 1, height: 18, backgroundColor: "var(--color-border)", margin: "0 2px" }} />

        {(["high", "medium", "low"] as ReminderPriority[]).map((p) => {
          const cfg = PRIORITY_CONFIG[p];
          const active = priority === p;
          return (
            <button
              key={p}
              onClick={() => setPriority(active ? undefined : p)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                height: 28,
                paddingInline: 10,
                borderRadius: 20,
                border: "1.5px solid",
                borderColor: active ? cfg.color : "var(--color-border)",
                backgroundColor: active ? `${cfg.color}18` : "transparent",
                color: active ? cfg.color : "var(--color-secondary)",
                fontSize: 12,
                fontWeight: active ? 700 : 400,
                cursor: "pointer",
                fontFamily: "var(--font-roboto)",
              }}
              title={cfg.label}
            >
              <Flag
                size={11}
                color={active ? cfg.color : "var(--color-secondary)"}
                fill={active && p !== "low" ? cfg.color : "none"}
                strokeWidth={active && p !== "low" ? 0 : 1.75}
              />
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Title */}
      <input
        autoFocus
        value={title}
        onChange={(e) => { setTitle(e.target.value); setError(""); }}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onClose(); }}
        placeholder="Reminder title"
        style={{ ...inputStyle, width: "100%" }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
      />

      {/* Date + time */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          style={{ ...inputStyle, width: 110 }}
        />
      </div>

      {error && <p style={{ fontSize: 11, color: "var(--color-error)", margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSubmit}
          style={{
            height: 34,
            paddingInline: 16,
            backgroundColor: "var(--color-navy)",
            color: "#fff",
            border: "none",
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "var(--font-roboto)",
          }}
        >
          Add Reminder
        </button>
        <button
          onClick={onClose}
          style={{ height: 34, paddingInline: 12, background: "none", border: "none", fontSize: 12, color: "var(--color-secondary)", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Undo toast ────────────────────────────────────────────────────────────────

function UndoToast({ title, onUndo }: { title: string; onUndo: () => void }) {
  return (
    <>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: 28,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#1B2E4B",
          color: "#fff",
          borderRadius: 10,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
          zIndex: 200,
          fontSize: 13,
          fontFamily: "var(--font-roboto)",
          whiteSpace: "nowrap",
          animation: "toastIn 0.18s ease",
        }}
      >
        <Check size={13} color="rgba(255,255,255,0.7)" />
        <span style={{ color: "rgba(255,255,255,0.85)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </span>
        <button
          onClick={onUndo}
          style={{
            background: "rgba(255,255,255,0.18)",
            border: "none",
            borderRadius: 6,
            padding: "4px 10px",
            color: "#fff",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "var(--font-roboto)",
          }}
        >
          Undo
        </button>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface PendingUndo {
  reminder: Reminder;
  timerId: ReturnType<typeof setTimeout>;
}

export default function RemindersPage() {
  const { projectId, isLoading: projectLoading } = useProject();
  const [currentUserId, setCurrentUserId] = useState("");
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);

  // Resolve userId
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

  // Fetch reminders + team
  useEffect(() => {
    if (!currentUserId) return;
    if (isSupabaseConfigured && projectLoading) return;

    async function load() {
      setLoading(true);

      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      if (projectId) {
        const { data: members } = await supabase
          .from("team_members")
          .select("user_id, role, user_profiles(name, avatar_color, avatar_initials, avatar_url)")
          .eq("project_id", projectId);

        if (members) {
          const { computeInitials } = await import("@/lib/utils");
          setTeamMembers(
            members.map((row) => {
              const p = Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles;
              const profile = p as Record<string, string> | null;
              const name = profile?.name ?? "Team Member";
              return {
                id: row.user_id as string,
                name,
                email: "",
                role: (row.role ?? "researcher") as User["role"],
                avatarColor: profile?.avatar_color ?? "#B4D4E3",
                avatarInitials: computeInitials(name) || (profile?.avatar_initials ?? "??"),
                avatarUrl: profile?.avatar_url ?? undefined,
              };
            })
          );
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

      if (error) { console.error("[Reminders] fetch:", error); }
      if (data) {
        setReminders(
          data.map((row) => ({
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
          }))
        );
      }

      setLoading(false);
    }

    load();
  }, [currentUserId, projectId, projectLoading]);

  // Commit to DB (delete permanently)
  function commitDelete(id: string) {
    if (isSupabaseConfigured) {
      supabase.from("reminders").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("[Reminders] delete:", error); });
    }
  }

  function handleComplete(id: string) {
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder) return;

    // Commit any previous undo immediately before starting a new one
    if (pendingUndo) {
      clearTimeout(pendingUndo.timerId);
      commitDelete(pendingUndo.reminder.id);
    }

    // Remove from list
    setReminders((prev) => prev.filter((r) => r.id !== id));

    // 4s undo window — then permanently delete from DB
    const timerId = setTimeout(() => {
      commitDelete(id);
      setPendingUndo(null);
    }, 4000);

    setPendingUndo({ reminder, timerId });
  }

  function handleUndo() {
    if (!pendingUndo) return;
    clearTimeout(pendingUndo.timerId);
    setReminders((prev) => sortReminders([pendingUndo!.reminder, ...prev]));
    setPendingUndo(null);
  }

  async function handleAdd(
    title: string,
    scope: ReminderScope,
    priority?: ReminderPriority,
    dueAt?: string
  ) {
    const tempId = crypto.randomUUID();
    const newReminder: Reminder = {
      id: tempId,
      userId: currentUserId,
      projectId: scope === "lab" ? (projectId ?? undefined) : undefined,
      scope,
      title,
      priority,
      dueAt,
      emailEnabled: false,
      sent: false,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setReminders((prev) => sortReminders([newReminder, ...prev]));
    setShowForm(false);

    if (isSupabaseConfigured && currentUserId) {
      const { data, error } = await supabase
        .from("reminders")
        .insert({
          user_id: currentUserId,
          project_id: scope === "lab" ? (projectId ?? null) : null,
          scope,
          title,
          priority: priority ?? null,
          due_at: dueAt ?? null,
          email_enabled: false,
          sent: false,
          completed: false,
        })
        .select()
        .single();
      if (!error && data) {
        setReminders((prev) =>
          prev.map((r) => r.id === tempId ? { ...newReminder, id: data.id as string } : r)
        );
      } else if (error) {
        console.error("[Reminders] add:", error);
      }
    }
  }

  function handleDelete(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    commitDelete(id);
  }

  function handlePriorityChange(id: string, priority: ReminderPriority | undefined) {
    setReminders((prev) =>
      sortReminders(prev.map((r) => r.id === id ? { ...r, priority } : r))
    );
    if (isSupabaseConfigured) {
      supabase.from("reminders")
        .update({ priority: priority ?? null })
        .eq("id", id)
        .then(({ error }) => { if (error) console.error("[Reminders] priority:", error); });
    }
  }

  if (loading || (isSupabaseConfigured && projectLoading)) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: "var(--color-canvas)" }}>
        <div style={{ width: 28, height: 28, border: "3px solid var(--color-border)", borderTopColor: "var(--color-navy)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const sorted = sortReminders(reminders.filter((r) => !r.completed));

  return (
    <ClientOnly>
      <div style={{ padding: "24px 32px", maxWidth: 620, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 22, color: "var(--color-navy)", margin: 0 }}>
              Reminders
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 3 }}>
              {sorted.length === 0 ? "Nothing pending." : `${sorted.length} active`}
            </p>
          </div>

          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                height: 36,
                paddingInline: 14,
                backgroundColor: "var(--color-navy)",
                color: "#fff",
                border: "none",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-roboto)",
              }}
            >
              <Plus size={14} /> Add Reminder
            </button>
          ) : (
            <button
              onClick={() => setShowForm(false)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
              aria-label="Cancel"
            >
              <X size={18} color="var(--color-secondary)" />
            </button>
          )}
        </div>

        {/* Add form */}
        {showForm && (
          <div style={{ marginBottom: 20 }}>
            <AddReminderForm onAdd={handleAdd} onClose={() => setShowForm(false)} />
          </div>
        )}

        {/* Empty state */}
        {sorted.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "64px 0",
              textAlign: "center",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
            }}
          >
            <Check size={32} style={{ color: "var(--color-border)", marginBottom: 10 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-body)", margin: 0 }}>
              No reminders yet
            </p>
            <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 4 }}>
              Add one to stay on top of deadlines.
            </p>
          </div>
        )}

        {/* List */}
        {sorted.length > 0 && (
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {sorted.map((reminder) => (
              <ReminderRow
                key={reminder.id}
                reminder={reminder}
                currentUserId={currentUserId}
                teamMembers={teamMembers}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onPriorityChange={handlePriorityChange}
              />
            ))}
          </div>
        )}

        {/* Scope legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          {(["personal", "lab"] as ReminderScope[]).map((s) => {
            const c = SCOPE_CONFIG[s];
            return (
              <span key={s} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-secondary)" }}>
                <span style={{ display: "inline-block", width: 3, height: 12, borderRadius: 2, backgroundColor: c.border }} />
                {c.label}
              </span>
            );
          })}
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-secondary)" }}>
            <Flag size={10} color="#EF4444" fill="#EF4444" strokeWidth={0} />
            High priority
          </span>
        </div>
      </div>

      {/* Undo toast */}
      {pendingUndo && (
        <UndoToast title={pendingUndo.reminder.title} onUndo={handleUndo} />
      )}
    </ClientOnly>
  );
}
