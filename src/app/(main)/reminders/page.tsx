"use client";

import { useState, useEffect } from "react";
import { Plus, Check, Trash2, X } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";
import Avatar from "@/components/ui/Avatar";
import ClientOnly from "@/components/ui/ClientOnly";
import type { Reminder, ReminderScope, User } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Scope visual config ───────────────────────────────────────────────────────

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

// ── Completion circle ─────────────────────────────────────────────────────────

function CompletionCircle({
  disabled,
  done,
  completing,
  onClick,
}: {
  disabled: boolean;
  done: boolean;
  completing: boolean;
  onClick: () => void;
}) {
  const filled = done || completing;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={done ? "Completed" : "Mark as complete"}
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        border: `2px solid ${filled ? "var(--color-navy)" : "var(--color-border)"}`,
        backgroundColor: filled ? "var(--color-navy)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
        transition: "background-color 0.15s, border-color 0.15s",
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (!filled && !disabled)
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(27,46,75,0.12)";
      }}
      onMouseLeave={(e) => {
        if (!filled && !disabled)
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
      }}
    >
      {filled && <Check size={10} color="#fff" strokeWidth={3} />}
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
  done,
}: {
  reminder: Reminder;
  currentUserId: string;
  teamMembers: User[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  done: boolean;
}) {
  const [completing, setCompleting] = useState(false);
  const scope = reminder.scope ?? "personal";
  const cfg = SCOPE_CONFIG[scope];
  const overdue = !done && isOverdue(reminder.dueAt);
  const isCreator = reminder.userId === currentUserId;
  const canCheck = scope === "lab" || isCreator;
  const creator = scope === "lab" ? teamMembers.find((m) => m.id === reminder.userId) : undefined;

  function handleComplete() {
    if (!canCheck || done) return;
    setCompleting(true);
    setTimeout(() => onComplete(reminder.id), 360);
  }

  return (
    <div
      style={{
        opacity: completing ? 0 : 1,
        transition: "opacity 0.36s ease",
        borderBottom: "1px solid var(--color-border)",
        borderLeft: `3px solid ${cfg.border}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px 10px 12px",
        minHeight: 46,
      }}
    >
      <CompletionCircle
        disabled={!canCheck || done}
        done={done}
        completing={completing}
        onClick={handleComplete}
      />

      {/* Title */}
      <span
        style={{
          flex: 1,
          fontSize: 14,
          color: done ? "var(--color-secondary)" : "var(--color-body)",
          textDecoration: done ? "line-through" : "none",
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
      <div className="flex items-center gap-2 shrink-0">
        {/* Scope badge */}
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

        {/* Lab: creator avatar */}
        {creator && !done && (
          <Avatar user={creator} size={18} />
        )}

        {/* Due date */}
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

        {/* Delete — creator only */}
        {isCreator && !done && (
          <button
            onClick={() => onDelete(reminder.id)}
            aria-label="Delete reminder"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 2,
              display: "flex",
              opacity: 0.4,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.4"; }}
          >
            <Trash2 size={13} color="var(--color-secondary)" />
          </button>
        )}
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
  onAdd: (title: string, scope: ReminderScope, dueAt?: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [scope, setScope] = useState<ReminderScope>("personal");
  const [error, setError] = useState("");

  function handleSubmit() {
    if (!title.trim()) { setError("Please enter a title."); return; }
    let dueAt: string | undefined;
    if (date) {
      const base = time ? `${date}T${time}` : `${date}T09:00`;
      dueAt = new Date(base).toISOString();
    }
    onAdd(title.trim(), scope, dueAt);
    setTitle(""); setDate(""); setTime(""); setScope("personal"); setError("");
    onClose();
  }

  return (
    <div
      className="space-y-3"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        padding: "16px 16px 14px",
        boxShadow: "0 2px 8px rgba(27,46,75,0.08)",
      }}
    >
      {/* Scope toggle */}
      <div className="flex gap-1.5">
        {(["personal", "lab"] as ReminderScope[]).map((s) => {
          const active = scope === s;
          const cfg = SCOPE_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setScope(s)}
              style={{
                height: 28,
                paddingInline: 12,
                borderRadius: 20,
                border: "1.5px solid",
                borderColor: active ? cfg.border : "var(--color-border)",
                backgroundColor: active ? cfg.badgeBg : "transparent",
                color: active ? cfg.badgeText : "var(--color-secondary)",
                fontSize: 12,
                fontWeight: active ? 700 : 400,
                cursor: "pointer",
                fontFamily: "var(--font-roboto)",
              }}
            >
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

      {/* Due date + time */}
      <div className="flex gap-2">
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

      <div className="flex items-center gap-2">
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RemindersPage() {
  const { projectId, isLoading: projectLoading } = useProject();
  const [currentUserId, setCurrentUserId] = useState("");
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Resolve userId (demo or Supabase)
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

  // Fetch reminders + team members once auth + project resolved
  useEffect(() => {
    if (!currentUserId) return;
    if (isSupabaseConfigured && projectLoading) return;

    async function load() {
      setLoading(true);

      if (!isSupabaseConfigured) {
        // Demo: empty list (no static mock data)
        setLoading(false);
        return;
      }

      // Team members (for creator display on lab reminders)
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

      // Fetch: personal reminders (mine) + lab reminders (project)
      let query = supabase
        .from("reminders")
        .select("*")
        .or(
          projectId
            ? `and(scope.eq.personal,user_id.eq.${currentUserId}),and(scope.eq.lab,project_id.eq.${projectId})`
            : `scope.eq.personal,user_id.eq.${currentUserId}`
        )
        .order("due_at", { ascending: true, nullsFirst: false });

      // Also fetch recently completed (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // We'll fetch both active and recently completed in one query, filter client-side
      const { data, error } = await query;

      if (error) { console.error("[Reminders] fetch:", error); setLoading(false); return; }

      if (data) {
        setReminders(
          data.map((row) => ({
            id: row.id as string,
            userId: row.user_id as string,
            projectId: (row.project_id as string) ?? undefined,
            scope: ((row.scope as ReminderScope) ?? "personal"),
            title: row.title as string,
            dueAt: (row.due_at as string) ?? undefined,
            linkedTaskId: (row.linked_task_id as string) ?? undefined,
            linkedEventId: (row.linked_event_id as string) ?? undefined,
            emailEnabled: row.email_enabled as boolean,
            sent: row.sent as boolean,
            completed: (row.completed as boolean) ?? false,
            completedAt: (row.completed_at as string) ?? undefined,
            priority: (row.priority as Reminder["priority"]) ?? undefined,
            recurrence: (row.recurrence as Reminder["recurrence"]) ?? undefined,
            createdAt: row.created_at as string,
          }))
        );
      }

      setLoading(false);
    }

    load();
  }, [currentUserId, projectId, projectLoading]);

  // Sort: active by dueAt (nulls last), then done by completedAt desc
  const active = reminders
    .filter((r) => !r.completed)
    .sort((a, b) => {
      if (!a.dueAt && !b.dueAt) return 0;
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });

  // Show recently completed (last 7 days, max 5)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const done = reminders
    .filter((r) => r.completed && r.completedAt && new Date(r.completedAt) > weekAgo)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    .slice(0, 5);

  async function handleAdd(title: string, scope: ReminderScope, dueAt?: string) {
    const tempId = crypto.randomUUID();
    const newReminder: Reminder = {
      id: tempId,
      userId: currentUserId,
      projectId: scope === "lab" ? (projectId ?? undefined) : undefined,
      scope,
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
          project_id: scope === "lab" ? (projectId ?? null) : null,
          scope,
          title,
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

  function handleComplete(id: string) {
    const now = new Date().toISOString();
    setReminders((prev) =>
      prev.map((r) => r.id === id ? { ...r, completed: true, completedAt: now } : r)
    );
    if (isSupabaseConfigured) {
      supabase.from("reminders")
        .update({ completed: true, completed_at: now })
        .eq("id", id)
        .then(({ error }) => { if (error) console.error("[Reminders] complete:", error); });
    }
  }

  function handleDelete(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    if (isSupabaseConfigured) {
      supabase.from("reminders").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("[Reminders] delete:", error); });
    }
  }

  if (loading || (isSupabaseConfigured && projectLoading)) {
    return (
      <div className="flex h-full items-center justify-center" style={{ backgroundColor: "var(--color-canvas)" }}>
        <div style={{ width: 28, height: 28, border: "3px solid var(--color-border)", borderTopColor: "var(--color-navy)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const hasAny = active.length > 0 || done.length > 0;

  return (
    <ClientOnly>
      <div className="px-4 md:px-8 py-6 mx-auto" style={{ maxWidth: 620 }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
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
              {active.length === 0 ? "Nothing pending." : `${active.length} active`}
            </p>
          </div>

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5"
              style={{
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
          )}

          {showForm && (
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
          <div className="mb-5">
            <AddReminderForm onAdd={handleAdd} onClose={() => setShowForm(false)} />
          </div>
        )}

        {/* Empty state */}
        {!hasAny && (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            style={{
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

        {/* Reminder list */}
        {hasAny && (
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
                currentUserId={currentUserId}
                teamMembers={teamMembers}
                onComplete={handleComplete}
                onDelete={handleDelete}
                done={false}
              />
            ))}

            {/* Done section — at the bottom */}
            {done.length > 0 && (
              <>
                {active.length > 0 && (
                  <div style={{ height: 1, backgroundColor: "var(--color-border)", opacity: 0.5 }} />
                )}
                {done.map((reminder) => (
                  <ReminderRow
                    key={reminder.id}
                    reminder={reminder}
                    currentUserId={currentUserId}
                    teamMembers={teamMembers}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    done
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* Scope legend */}
        <div className="flex items-center gap-4 mt-4 px-1 flex-wrap">
          {(["personal", "lab"] as ReminderScope[]).map((s) => {
            const cfg = SCOPE_CONFIG[s];
            return (
              <span key={s} className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--color-secondary)" }}>
                <span style={{ display: "inline-block", width: 3, height: 12, borderRadius: 2, backgroundColor: cfg.border }} />
                {cfg.label}
              </span>
            );
          })}
        </div>
      </div>
    </ClientOnly>
  );
}
