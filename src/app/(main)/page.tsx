"use client";

import {
  EVENTS, ACTIVITY, TASKS, DASHBOARD_POSTS, USERS, PROJECT, CURRENT_USER_ID,
  formatRelativeTime, formatDate, getUser,
} from "@/lib/mock-data";
import type { Task, ActivityEvent, CalendarEvent, DashboardPost, TaskStatus } from "@/types";
import Avatar from "@/components/ui/Avatar";
import { Plus, Calendar, ChevronRight } from "lucide-react";
import Link from "next/link";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; dot: string }> = {
  todo:        { label: "To Do",      color: "#64748B", dot: "#64748B" },
  in_progress: { label: "In Progress", color: "#1B2E4B", dot: "#1B2E4B" },
  in_review:   { label: "In Review",  color: "#A0622A", dot: "#A0622A" },
  done:        { label: "Done",       color: "#2E7D52", dot: "#2E7D52" },
};

const PRIORITY_COLORS = { high: "#C0392B", medium: "#A0622A", low: "#2E7D52" };
const PRIORITY_SYMBOLS = { high: "▲", medium: "●", low: "▼" };
const PRIORITY_BG = { high: "#FDDCDC", medium: "#FDEFD4", low: "#D4EDE0" };

// ── Card wrapper ──────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <h2
        style={{
          fontFamily: "var(--font-lora)",
          fontWeight: 600,
          fontSize: 15,
          color: "var(--color-navy)",
          margin: 0,
        }}
      >
        {title}
      </h2>
      {action}
    </div>
  );
}

// ── Upcoming widget ───────────────────────────────────────────────────────────

function UpcomingWidget({ events }: { events: CalendarEvent[] }) {
  const upcoming = events
    .filter((e) => new Date(e.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  return (
    <Card>
      <CardHeader
        title="Upcoming"
        action={
          <button
            className="flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{ fontSize: 12, color: "var(--color-navy)", fontWeight: 600 }}
          >
            <Plus size={13} />
            Add event
          </button>
        }
      />
      <div className="px-5 py-3 space-y-3">
        {upcoming.length === 0 && (
          <p style={{ color: "var(--color-secondary)", fontSize: 13 }}>No upcoming events.</p>
        )}
        {upcoming.map((event) => {
          const d = new Date(event.date + "T00:00:00");
          const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return (
            <div key={event.id} className="flex items-center gap-3" style={{ minHeight: 36 }}>
              <span
                className="shrink-0 px-2.5 py-1"
                style={{
                  backgroundColor: "var(--color-navy)",
                  color: "#fff",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "var(--font-roboto)",
                  whiteSpace: "nowrap",
                }}
              >
                {monthDay}
              </span>
              <span style={{ fontSize: 13, color: "var(--color-body)" }}>{event.title}</span>
              {event.time && (
                <span style={{ fontSize: 11, color: "var(--color-secondary)", marginLeft: "auto" }}>
                  {event.time}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Team activity widget ──────────────────────────────────────────────────────

function TeamActivityWidget({ events }: { events: ActivityEvent[] }) {
  return (
    <Card>
      <CardHeader title="Team Activity" />
      <div>
        {events.map((evt, i) => {
          const actor = getUser(evt.actorId);
          if (!actor) return null;
          return (
            <div
              key={evt.id}
              className="flex items-start gap-3 px-5 py-3"
              style={{
                borderBottom: i < events.length - 1 ? "1px solid var(--color-border)" : undefined,
              }}
            >
              <Avatar user={actor} size={26} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600 }}>{actor.name.split(" ")[0]}</span>{" "}
                  {evt.action}{" "}
                  <span style={{ fontWeight: 500 }}>{evt.objectLabel}</span>
                  {evt.destination && (
                    <>
                      {" "}to{" "}
                      <span style={{ fontWeight: 600, color: "var(--color-navy)" }}>
                        {evt.destination}
                      </span>
                    </>
                  )}
                </p>
                <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 2 }}>
                  {formatRelativeTime(evt.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Task card (mini) ──────────────────────────────────────────────────────────

function MiniTaskCard({ task }: { task: Task }) {
  const priority = PRIORITY_COLORS[task.priority];
  const priorityBg = PRIORITY_BG[task.priority];
  const symbol = PRIORITY_SYMBOLS[task.priority];
  const assignees = task.assigneeIds.map((id) => USERS.find((u) => u.id === id)).filter(Boolean);

  return (
    <div
      className="p-3 rounded-lg cursor-pointer group transition-shadow"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "#B8C4D4";
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-body)", lineHeight: 1.35 }}>
        {task.title}
      </p>
      <div className="flex items-center justify-between mt-2">
        <span style={{ fontSize: 12, color: "var(--color-secondary)" }}>
          {task.dueDate ? formatDate(task.dueDate) : "—"}
        </span>
        <span
          className="px-2 py-0.5"
          style={{
            backgroundColor: priorityBg,
            color: priority,
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 4,
          }}
        >
          {symbol} {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
        <div className="flex items-center" style={{ gap: -8 }}>
          {assignees.slice(0, 3).map((user, i) => (
            <div key={user!.id} style={{ marginLeft: i > 0 ? -6 : 0, position: "relative", zIndex: 3 - i }}>
              <Avatar user={user!} size={20} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Kanban preview ────────────────────────────────────────────────────────────

function KanbanPreview() {
  const columns: TaskStatus[] = ["todo", "in_progress", "in_review", "done"];
  const tasksByStatus = Object.fromEntries(
    columns.map((s) => [s, TASKS.filter((t) => t.status === s).slice(0, 3)])
  ) as Record<TaskStatus, Task[]>;
  const totalByStatus = Object.fromEntries(
    columns.map((s) => [s, TASKS.filter((t) => t.status === s).length])
  ) as Record<TaskStatus, number>;

  return (
    <Card>
      <CardHeader
        title="Tasks"
        action={
          <Link
            href="/tasks"
            className="flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{ fontSize: 12, color: "var(--color-navy)", fontWeight: 600, textDecoration: "none" }}
          >
            See all <ChevronRight size={13} />
          </Link>
        }
      />
      {/* Scroll wrapper: horizontal scroll on mobile, grid on desktop */}
      <div
        className="overflow-x-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
      <div className="p-4 md:p-5 grid gap-4" style={{ gridTemplateColumns: "repeat(4, minmax(240px, 1fr))", minWidth: "min(100%, 960px)" }}>
        {columns.map((status) => {
          const cfg = STATUS_CONFIG[status];
          const tasks = tasksByStatus[status];
          const total = totalByStatus[status];
          return (
            <div key={status}>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: cfg.dot }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "var(--color-body)",
                  }}
                >
                  {cfg.label}
                </span>
                <span
                  className="ml-auto flex items-center justify-center w-5 h-5 rounded-full"
                  style={{
                    backgroundColor: "var(--color-canvas)",
                    border: "1px solid var(--color-border)",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--color-secondary)",
                  }}
                >
                  {total}
                </span>
              </div>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <MiniTaskCard key={task.id} task={task} />
                ))}
                {total > 3 && (
                  <Link
                    href="/tasks"
                    style={{ fontSize: 12, color: "var(--color-navy)", textDecoration: "none", display: "block", paddingTop: 4 }}
                  >
                    +{total - 3} more
                  </Link>
                )}
              </div>
              <Link
                href="/tasks"
                className="flex items-center gap-1 mt-3 transition-opacity hover:opacity-70"
                style={{ fontSize: 12, color: "var(--color-navy)", textDecoration: "none" }}
              >
                <Plus size={12} /> Add task
              </Link>
            </div>
          );
        })}
      </div>
      </div>{/* end scroll wrapper */}
    </Card>
  );
}

// ── Opportunities / Lab Wins ──────────────────────────────────────────────────

function PostsCard({
  title,
  posts,
  type,
}: {
  title: string;
  posts: DashboardPost[];
  type: "opportunity" | "lab_win";
}) {
  const filtered = posts.filter((p) => p.type === type);

  return (
    <Card>
      <CardHeader
        title={title}
        action={
          <button
            className="flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{ fontSize: 12, color: "var(--color-navy)", fontWeight: 600 }}
          >
            <Plus size={13} />
            Add
          </button>
        }
      />
      <div className="px-5 py-3 space-y-3">
        {filtered.length === 0 && (
          <p style={{ color: "var(--color-secondary)", fontSize: 13 }}>
            Nothing posted yet. Add the first one.
          </p>
        )}
        {filtered.map((post) => {
          const author = getUser(post.authorId);
          return (
            <div key={post.id} className="flex gap-3">
              {author && <Avatar user={author} size={24} className="mt-0.5 shrink-0" />}
              <div>
                <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.45 }}>
                  {post.content}
                </p>
                <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 3 }}>
                  {author?.name.split(" ")[0]} · {formatRelativeTime(post.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Dashboard page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="p-4 md:p-6" style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div className="mb-5 md:mb-6">
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
          {PROJECT.name}
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 4 }}>{today}</p>
      </div>

      {/* Row 1: Upcoming + Team Activity — stack on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-4 md:mb-5">
        <UpcomingWidget events={EVENTS} />
        <TeamActivityWidget events={ACTIVITY} />
      </div>

      {/* Row 2: Kanban preview — horizontal scroll on mobile */}
      <div className="mb-4 md:mb-5">
        <KanbanPreview />
      </div>

      {/* Row 3: Opportunities + Lab Wins — stack on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <PostsCard title="Opportunities" posts={DASHBOARD_POSTS} type="opportunity" />
        <PostsCard title="Lab Wins" posts={DASHBOARD_POSTS} type="lab_win" />
      </div>
    </div>
  );
}
