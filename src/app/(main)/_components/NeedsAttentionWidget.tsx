"use client";

import Link from "next/link";
import { CheckCircle, AlertCircle } from "lucide-react";
import type { Task, User } from "@/types";
import Avatar from "@/components/ui/Avatar";
import { Card, CardHeader } from "./DashboardCard";
import { SkeletonLine } from "./TeamActivityWidget";

// ── Shared overdue label ───────────────────────────────────────────────────────

export function overdueLabel(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return "due today";
  if (days === 1) return "1 day overdue";
  if (days < 7) return `${days} days overdue`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? "1 week overdue" : `${weeks} weeks overdue`;
  const months = Math.round(days / 30);
  return months === 1 ? "1 month overdue" : `${months} months overdue`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OverdueReminder {
  id: string;
  title: string;
  dueAt: string;
  scope: "personal" | "lab";
  assigneeId?: string;
}

interface OverdueItem {
  id: string;
  title: string;
  dueIso: string;
  kind: "task" | "reminder";
  href: string;
  assigneeIds: string[];
}

// ── NeedsAttentionWidget ──────────────────────────────────────────────────────

export function NeedsAttentionWidget({
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Overdue tasks: due date in the past, not Done, assigned to current user
  const overdueTasks: OverdueItem[] = tasks
    .filter((t) =>
      t.dueDate &&
      new Date(t.dueDate) < today &&
      t.status !== "done" &&
      t.assigneeIds.includes(userId)
    )
    .map((t) => ({
      id: t.id,
      title: t.title,
      dueIso: t.dueDate!,
      kind: "task" as const,
      href: "/tasks",
      assigneeIds: t.assigneeIds,
    }));

  // Overdue reminders: already filtered server-side (due_at < now, not completed)
  const overdueRems: OverdueItem[] = reminders.map((r) => ({
    id: r.id,
    title: r.title,
    dueIso: r.dueAt,
    kind: "reminder" as const,
    href: "/reminders",
    assigneeIds: r.assigneeId ? [r.assigneeId] : [],
  }));

  // Sort: most recently overdue first (smallest past-due gap = top)
  const all = [...overdueTasks, ...overdueRems].sort(
    (a, b) => new Date(b.dueIso).getTime() - new Date(a.dueIso).getTime()
  );

  if (loading) {
    return (
      <Card>
        <CardHeader title="Needs attention" />
        <div className="px-5 py-3 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonLine width={36} height={11} />
              <SkeletonLine width="60%" />
              <SkeletonLine width="25%" height={11} />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Needs attention" />
      <div className="px-5 py-3">
        {all.length === 0 ? (
          <div className="flex items-center gap-2 py-2">
            <CheckCircle size={15} color="var(--color-success, #2d7a3a)" />
            <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>
              You&rsquo;re all caught up — nothing overdue right now.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {all.map((item) => {
              const assignees = item.assigneeIds
                .map((id) => teamMembers.find((u) => u.id === id))
                .filter(Boolean) as User[];
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", textDecoration: "none", borderBottom: "1px solid var(--color-border)" }}
                  className="group"
                >
                  <AlertCircle size={14} color="var(--color-error)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: "var(--color-body)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title}
                    </p>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--color-error)", flexShrink: 0, fontWeight: 500 }}>
                    {overdueLabel(item.dueIso)}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                    backgroundColor: item.kind === "task" ? "var(--color-canvas)" : "var(--color-canvas)",
                    color: "var(--color-secondary)", border: "1px solid var(--color-border)",
                    textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0,
                  }}>
                    {item.kind === "task" ? "Task" : "Reminder"}
                  </span>
                  {assignees.length > 0 && (
                    <div className="flex items-center" style={{ flexShrink: 0 }}>
                      {assignees.slice(0, 2).map((u, i) => (
                        <div key={u.id} style={{ marginLeft: i > 0 ? -4 : 0 }}>
                          <Avatar user={u} size={18} />
                        </div>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
