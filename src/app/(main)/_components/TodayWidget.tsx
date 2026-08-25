"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import type { Task, User } from "@/types";
import Avatar from "@/components/ui/Avatar";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { OverdueReminder } from "./NeedsAttentionWidget";

// ── Design tokens (scoped to this widget) ─────────────────────────────────────

const T = {
  card:        "oklch(0.19 0.006 60)",
  border:      "oklch(0.28 0.006 60)",
  textPrimary: "oklch(0.93 0.006 70)",
  textMuted:   "oklch(0.61 0.008 70)",
  accent:      "oklch(0.78 0.13 75)",
  radius:      11,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "from Aug 15" / "from last month" - never "X days overdue" */
function softLabel(iso: string): string {
  const due = new Date(iso);
  const now = new Date();
  const dueMonth = due.getMonth();
  const nowMonth = now.getMonth();
  const dueYear = due.getFullYear();
  const nowYear = now.getFullYear();

  if (dueYear === nowYear && dueMonth === nowMonth) {
    return `from ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  if (dueYear === nowYear && nowMonth - dueMonth === 1) {
    return "from last month";
  }
  return `from ${due.toLocaleDateString("en-US", { month: "long" })}`;
}

// ── TodayWidget ───────────────────────────────────────────────────────────────

interface OpenItem {
  id: string;
  title: string;
  dueIso: string;
  kind: "task" | "reminder";
  href: string;
  assigneeIds: string[];
}

export function TodayWidget({
  tasks,
  reminders,
  teamMembers,
  userId,
  loading,
}: {
  tasks: Task[];
  reminders: OverdueReminder[];
  teamMembers: User[];
  userId: string;
  loading?: boolean;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueTasks: OpenItem[] = tasks
    .filter((t) =>
      t.dueDate &&
      new Date(t.dueDate) < today &&
      t.status !== "done" &&
      t.assigneeIds.includes(userId)
    )
    .map((t) => ({
      id: t.id, title: t.title, dueIso: t.dueDate!, kind: "task",
      href: "/tasks", assigneeIds: t.assigneeIds,
    }));

  const overdueRems: OpenItem[] = reminders.map((r) => ({
    id: r.id, title: r.title, dueIso: r.dueAt, kind: "reminder",
    href: "/reminders", assigneeIds: r.assigneeId ? [r.assigneeId] : [],
  }));

  const all = [...overdueTasks, ...overdueRems]
    .filter((item) => !dismissed.has(item.id) && !snoozed.has(item.id))
    // chronological: most-recent first (least-overdue at top)
    .sort((a, b) => new Date(b.dueIso).getTime() - new Date(a.dueIso).getTime());

  async function markDone(item: OpenItem) {
    setDismissed((prev) => new Set(prev).add(item.id));
    if (!isSupabaseConfigured) return;
    if (item.kind === "reminder") {
      await supabase.from("reminders").update({ completed: true }).eq("id", item.id);
    } else {
      await supabase.from("tasks").update({ status: "done" }).eq("id", item.id);
    }
  }

  async function snooze(item: OpenItem) {
    setSnoozed((prev) => new Set(prev).add(item.id));
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 3);
    if (!isSupabaseConfigured) return;
    if (item.kind === "reminder") {
      await supabase.from("reminders").update({ due_at: newDate.toISOString() }).eq("id", item.id);
    } else {
      await supabase.from("tasks").update({ due_date: newDate.toISOString().split("T")[0] }).eq("id", item.id);
    }
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    overflow: "hidden",
  };

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Today</span>
        </div>
        <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: T.border, flexShrink: 0 }} />
              <div style={{ flex: 1, height: 13, borderRadius: 4, backgroundColor: T.border, opacity: 0.5 }} />
              <div style={{ width: 60, height: 11, borderRadius: 4, backgroundColor: T.border, opacity: 0.4 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ padding: "16px 20px 12px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, letterSpacing: "0.01em" }}>Today</span>
      </div>

      <div style={{ padding: "8px 0" }}>
        {all.length === 0 ? (
          <div style={{ padding: "14px 20px" }}>
            <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>Nothing waiting on you right now.</p>
          </div>
        ) : (
          all.map((item) => {
            const assignees = item.assigneeIds
              .map((id) => teamMembers.find((u) => u.id === id))
              .filter(Boolean) as User[];

            return (
              <div
                key={item.id}
                className="today-row"
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 20px", borderBottom: `1px solid ${T.border}`, position: "relative" }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: T.textMuted, flexShrink: 0 }} />

                {/* Title */}
                <Link
                  href={item.href}
                  style={{ flex: 1, minWidth: 0, textDecoration: "none" }}
                >
                  <span style={{ fontSize: 13, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                    {item.title}
                  </span>
                </Link>

                {/* Soft date label */}
                <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>
                  {softLabel(item.dueIso)}
                </span>

                {/* Type tag */}
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, flexShrink: 0,
                  border: `1px solid ${T.border}`, color: T.textMuted,
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {item.kind === "task" ? "Task" : "Reminder"}
                </span>

                {/* Assignee avatars */}
                {assignees.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    {assignees.slice(0, 2).map((u, i) => (
                      <div key={u.id} style={{ marginLeft: i > 0 ? -4 : 0 }}>
                        <Avatar user={u} size={18} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Snooze + Done - fade in on row hover */}
                <div className="today-row-actions" style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, opacity: 0, transition: "opacity 0.15s" }}>
                  <button
                    onClick={() => snooze(item)}
                    title="Snooze 3 days"
                    style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: T.textMuted, background: "none", border: `1px solid ${T.border}`, borderRadius: 5, padding: "2px 7px", cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    Later <ChevronDown size={10} />
                  </button>
                  <button
                    onClick={() => markDone(item)}
                    title="Mark done"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 5, border: `1px solid ${T.border}`, background: "none", cursor: "pointer", color: T.textMuted }}
                  >
                    <Check size={11} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Hover CSS injected once */}
      <style>{`
        .today-row:hover .today-row-actions { opacity: 1 !important; }
        .today-row:last-child { border-bottom: none; }
      `}</style>
    </div>
  );
}
