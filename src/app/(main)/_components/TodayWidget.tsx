"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import type { Task, CalendarEvent, User } from "@/types";
import Avatar from "@/components/ui/Avatar";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useUndoToast } from "@/context/UndoToastContext";
import type { OverdueReminder } from "./NeedsAttentionWidget";

// ── Types ─────────────────────────────────────────────────────────────────────

type AgendaItem = {
  id: string;
  title: string;
  kind: "task" | "reminder" | "event";
  dateIso: string;
  href: string;
  assigneeIds: string[];
  canComplete: boolean;
};

// ── Kind chip config ───────────────────────────────────────────────────────────

const KIND_CFG = {
  task:     { label: "Task",     color: "#0A84FF", bg: "rgba(10,132,255,0.10)" },
  reminder: { label: "Reminder", color: "#FF9F0A", bg: "rgba(255,159,10,0.12)" },
  event:    { label: "Event",    color: "#30D158", bg: "rgba(48,209,88,0.10)"  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function overdueLabel(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `from ${month}`;
}

function upcomingLabel(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const tomorrowEnd = new Date(tomorrow); tomorrowEnd.setDate(tomorrow.getDate() + 1);
  if (d >= tomorrow && d < tomorrowEnd) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ── Categorizer ───────────────────────────────────────────────────────────────

function categorize(
  tasks: Task[],
  reminders: OverdueReminder[],
  events: CalendarEvent[],
  userId: string,
): { overdue: AgendaItem[]; today: AgendaItem[]; upcoming: AgendaItem[] } {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const weekEnd    = new Date(todayEnd); weekEnd.setDate(weekEnd.getDate() + 7);

  const overdue: AgendaItem[] = [];
  const today:   AgendaItem[] = [];
  const upcoming: AgendaItem[] = [];

  const push = (bucket: AgendaItem[], item: AgendaItem) => bucket.push(item);

  for (const t of tasks) {
    if (!t.dueDate || t.status === "done" || !t.assigneeIds.includes(userId)) continue;
    const due = new Date(t.dueDate + "T23:59:59");
    const item: AgendaItem = { id: t.id, title: t.title, kind: "task", dateIso: t.dueDate, href: "/tasks", assigneeIds: t.assigneeIds, canComplete: true };
    if (due < todayStart)    push(overdue, item);
    else if (due <= todayEnd) push(today, item);
    else if (due <= weekEnd)  push(upcoming, item);
  }

  for (const r of reminders) {
    const due = new Date(r.dueAt);
    const item: AgendaItem = { id: r.id, title: r.title, kind: "reminder", dateIso: r.dueAt, href: "/reminders", assigneeIds: r.assigneeId ? [r.assigneeId] : [], canComplete: true };
    if (due < todayStart)    push(overdue, item);
    else if (due <= todayEnd) push(today, item);
    else if (due <= weekEnd)  push(upcoming, item);
  }

  for (const ev of events) {
    const evDate = new Date(ev.date + "T00:00:00");
    if (evDate < todayStart) continue;
    const item: AgendaItem = { id: ev.id, title: ev.title, kind: "event", dateIso: ev.date, href: "/scheduling", assigneeIds: [], canComplete: false };
    if (evDate <= todayEnd) push(today, item);
    else if (evDate <= weekEnd) push(upcoming, item);
  }

  const byDate = (a: AgendaItem, b: AgendaItem) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime();
  return { overdue: overdue.sort(byDate), today: today.sort(byDate), upcoming: upcoming.sort(byDate) };
}

// ── AgendaSection ─────────────────────────────────────────────────────────────

function AgendaSection({
  label, accentColor, items, teamMembers, emptyMsg, onDone, divider,
}: {
  label: string;
  accentColor: string;
  items: AgendaItem[];
  teamMembers: User[];
  emptyMsg: string;
  onDone?: (item: AgendaItem) => void;
  divider?: boolean;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 160,
      padding: "14px 16px",
      borderRight: divider ? "1px solid var(--color-border)" : undefined,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: accentColor, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
        {items.length > 0 && (
          <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: accentColor }}>
            {items.length}
          </span>
        )}
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--color-secondary)", margin: 0, lineHeight: 1.5 }}>{emptyMsg}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {items.slice(0, 5).map((item) => {
            const kCfg = KIND_CFG[item.kind];
            const assignees = item.assigneeIds
              .map((id) => teamMembers.find((u) => u.id === id))
              .filter(Boolean) as User[];
            const dateLabel = label === "Overdue" ? overdueLabel(item.dateIso)
              : label === "Upcoming" ? upcomingLabel(item.dateIso)
              : "";
            return (
              <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={item.href} style={{ textDecoration: "none" }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-body)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.4 }}>
                      {item.title}
                    </span>
                  </Link>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: kCfg.color, backgroundColor: kCfg.bg, borderRadius: 3, padding: "1px 5px", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                      {kCfg.label}
                    </span>
                    {dateLabel && (
                      <span style={{ fontSize: 10, color: "var(--color-secondary)" }}>{dateLabel}</span>
                    )}
                    {assignees.length > 0 && (
                      <div style={{ display: "flex", marginLeft: "auto" }}>
                        {assignees.slice(0, 2).map((u, i) => (
                          <div key={u.id} style={{ marginLeft: i > 0 ? -4 : 0 }}>
                            <Avatar user={u} size={16} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {item.canComplete && onDone && (
                  <button
                    onClick={() => onDone(item)}
                    aria-label={`Mark "${item.title}" as done`}
                    style={{ width: 22, height: 22, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 5, border: "1px solid var(--color-border)", background: "none", cursor: "pointer", color: "var(--color-secondary)", marginTop: 1, transition: "border-color 120ms, color 120ms" }}
                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#30D158"; el.style.color = "#30D158"; }}
                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--color-border)"; el.style.color = "var(--color-secondary)"; }}
                  >
                    <Check size={11} />
                  </button>
                )}
              </div>
            );
          })}
          {items.length > 5 && (
            <p style={{ fontSize: 11, color: "var(--color-secondary)", margin: 0 }}>
              +{items.length - 5} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── TodayWidget ────────────────────────────────────────────────────────────────

export function TodayWidget({
  tasks,
  reminders,
  events,
  userId,
  teamMembers,
  loading,
}: {
  tasks: Task[];
  reminders: OverdueReminder[];
  events: CalendarEvent[];
  userId: string;
  teamMembers: User[];
  loading?: boolean;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const { show: showUndo } = useUndoToast();

  const { overdue, today, upcoming } = categorize(tasks, reminders, events, userId);
  const overdueItems   = overdue.filter((i) => !dismissed.has(i.id));
  const todayItems     = today.filter((i) => !dismissed.has(i.id));
  const upcomingItems  = upcoming.filter((i) => !dismissed.has(i.id));

  function markDone(item: AgendaItem) {
    setDismissed((prev) => new Set(prev).add(item.id));
    showUndo(
      `Marked "${item.title}" as done`,
      () => setDismissed((prev) => { const s = new Set(prev); s.delete(item.id); return s; }),
      async () => {
        if (!isSupabaseConfigured) return;
        if (item.kind === "reminder") {
          await supabase.from("reminders").update({ completed: true }).eq("id", item.id);
        } else if (item.kind === "task") {
          await supabase.from("tasks").update({ status: "done" }).eq("id", item.id);
        }
      },
    );
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: 11,
    overflow: "hidden",
  };

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ display: "flex" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ flex: 1, padding: "14px 16px", borderRight: i < 2 ? "1px solid var(--color-border)" : undefined }}>
              <div style={{ width: 60, height: 9, borderRadius: 4, backgroundColor: "var(--color-border)", opacity: 0.5, marginBottom: 12 }} className="animate-pulse" />
              {[1, 2].map((j) => (
                <div key={j} style={{ marginBottom: 9 }}>
                  <div style={{ width: "85%", height: 12, borderRadius: 4, backgroundColor: "var(--color-border)", opacity: 0.4, marginBottom: 4 }} className="animate-pulse" />
                  <div style={{ width: "45%", height: 9, borderRadius: 4, backgroundColor: "var(--color-border)", opacity: 0.25 }} className="animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        <AgendaSection
          label="Overdue"
          accentColor="var(--color-error)"
          items={overdueItems}
          teamMembers={teamMembers}
          emptyMsg="Nothing overdue."
          onDone={markDone}
          divider
        />
        <AgendaSection
          label="Today"
          accentColor="var(--color-navy)"
          items={todayItems}
          teamMembers={teamMembers}
          emptyMsg="Nothing scheduled for today."
          onDone={markDone}
          divider
        />
        <AgendaSection
          label="Upcoming"
          accentColor="var(--color-secondary)"
          items={upcomingItems}
          teamMembers={teamMembers}
          emptyMsg="Nothing in the next 7 days."
        />
      </div>
    </div>
  );
}
