"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
  useDraggable, useDroppable,
} from "@dnd-kit/core";
import {
  EVENTS, ACTIVITY, TASKS, DASHBOARD_POSTS, USERS,
  formatRelativeTime, formatDate, getUser, CURRENT_USER_ID, getStoredProject,
} from "@/lib/mock-data";
import type { Task, ActivityEvent, CalendarEvent, DashboardPost, TaskStatus } from "@/types";
import Avatar from "@/components/ui/Avatar";
import { Plus, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import TaskDetailPanel, { STATUS_CONFIG, STATUS_ORDER } from "@/components/tasks/TaskDetailPanel";
import TaskModal from "@/components/tasks/TaskModal";
import ClientOnly from "@/components/ui/ClientOnly";
import Toast from "@/components/ui/Toast";

// ── Dashboard-specific priority helpers ───────────────────────────────────────

const PRIORITY_COLORS = { high: "#C0392B", medium: "#A0622A", low: "#2E7D52" };
const PRIORITY_SYMBOLS = { high: "▲", medium: "●", low: "▼" };
const PRIORITY_BG = { high: "#FDDCDC", medium: "#FDEFD4", low: "#D4EDE0" };

// ── Card wrapper ──────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className} style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
      {children}
    </div>
  );
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
      <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 15, color: "var(--color-navy)", margin: 0 }}>{title}</h2>
      {action}
    </div>
  );
}

// ── Shared inline input style ─────────────────────────────────────────────────

const inlineInputStyle: React.CSSProperties = {
  height: 36, border: "1px solid var(--color-border)", borderRadius: 6, padding: "0 10px",
  fontSize: 13, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)",
  color: "var(--color-body)", outline: "none", boxSizing: "border-box",
};

// ── Upcoming widget ───────────────────────────────────────────────────────────

function UpcomingWidget({ events: initialEvents }: { events: CalendarEvent[] }) {
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle]   = useState("");
  const [date, setDate]     = useState("");
  const [time, setTime]     = useState("");

  const upcoming = events
    .filter((e) => new Date(e.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  function handleAdd() {
    if (!title.trim() || !date) return;
    const newEvent: CalendarEvent = {
      id: crypto.randomUUID(),
      title: title.trim(),
      date,
      time: time || undefined,
      projectId: getStoredProject().id,
    };
    setEvents((prev) => [newEvent, ...prev]);
    setTitle(""); setDate(""); setTime("");
    setShowForm(false);
  }

  return (
    <Card>
      <CardHeader
        title="Upcoming"
        action={
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{ fontSize: 12, color: "var(--color-navy)", fontWeight: 600 }}
          >
            <Plus size={13} /> Add event
          </button>
        }
      />
      <div className="px-5 py-3 space-y-3">
        {upcoming.length === 0 && !showForm && (
          <p style={{ color: "var(--color-secondary)", fontSize: 13 }}>No upcoming events.</p>
        )}
        {upcoming.map((event) => {
          const d = new Date(event.date + "T00:00:00");
          const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return (
            <div key={event.id} className="flex items-center gap-3" style={{ minHeight: 36 }}>
              <span className="shrink-0 px-2.5 py-1" style={{ backgroundColor: "var(--color-navy)", color: "#fff", borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                {monthDay}
              </span>
              <span style={{ fontSize: 13, color: "var(--color-body)" }}>{event.title}</span>
              {event.time && <span style={{ fontSize: 11, color: "var(--color-secondary)", marginLeft: "auto" }}>{event.time}</span>}
            </div>
          );
        })}

        {showForm && (
          <div className="pt-2 space-y-2 animate-fade-in">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              style={{ ...inlineInputStyle, width: "100%" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ ...inlineInputStyle, flex: 1 }}
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                style={{ ...inlineInputStyle, width: 100 }}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleAdd}
                style={{ fontSize: 12, fontWeight: 700, color: "#fff", backgroundColor: "var(--color-navy)", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", minHeight: 36, fontFamily: "var(--font-roboto)" }}
              >
                Add
              </button>
              <button
                onClick={() => { setShowForm(false); setTitle(""); setDate(""); setTime(""); }}
                style={{ fontSize: 12, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
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
            <div key={evt.id} className="flex items-start gap-3 px-5 py-3" style={{ borderBottom: i < events.length - 1 ? "1px solid var(--color-border)" : undefined }}>
              <Avatar user={actor} size={26} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600 }}>{actor.name.split(" ")[0]}</span>{" "}
                  {evt.action}{" "}
                  <span style={{ fontWeight: 500 }}>{evt.objectLabel}</span>
                  {evt.destination && <> to <span style={{ fontWeight: 600, color: "var(--color-navy)" }}>{evt.destination}</span></>}
                </p>
                <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 2 }}>{formatRelativeTime(evt.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Mini task card ────────────────────────────────────────────────────────────

function MiniTaskCardContent({ task }: { task: Task }) {
  const priority  = PRIORITY_COLORS[task.priority];
  const priorityBg = PRIORITY_BG[task.priority];
  const symbol    = PRIORITY_SYMBOLS[task.priority];
  const assignees = task.assigneeIds.map((id) => USERS.find((u) => u.id === id)).filter(Boolean);

  return (
    <div className="p-3">
      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-body)", lineHeight: 1.35 }}>{task.title}</p>
      <div className="flex items-center justify-between mt-2">
        <span style={{ fontSize: 12, color: "var(--color-secondary)" }}>{task.dueDate ? formatDate(task.dueDate) : "—"}</span>
        <span className="px-2 py-0.5" style={{ backgroundColor: priorityBg, color: priority, fontSize: 11, fontWeight: 600, borderRadius: 4 }}>
          {symbol} {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
        <div className="flex items-center">
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

// ── Draggable mini task card ──────────────────────────────────────────────────

function DraggableMiniTaskCard({ task, onClick, isMobile }: { task: Task; onClick: () => void; isMobile: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      {...(isMobile ? {} : attributes)}
      {...(isMobile ? {} : listeners)}
      onClick={onClick}
      style={{
        backgroundColor: "var(--color-surface)",
        border: isDragging ? "2px solid #1B2E4B" : "1px solid var(--color-border)",
        borderRadius: 8,
        opacity: isDragging ? 0.5 : 1,
        transform: isDragging ? "rotate(2deg)" : undefined,
        cursor: isMobile ? "pointer" : isDragging ? "grabbing" : "grab",
        transition: isDragging ? undefined : "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => { if (!isDragging) { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#B8C4D4"; el.style.boxShadow = "var(--shadow-card)"; } }}
      onMouseLeave={(e) => { if (!isDragging) { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--color-border)"; el.style.boxShadow = ""; } }}
    >
      <MiniTaskCardContent task={task} />
    </div>
  );
}

// ── Droppable kanban column ───────────────────────────────────────────────────

function DroppableColumn({
  status, displayTasks, total, isMobile, onTaskClick, onAddTask,
}: {
  status: TaskStatus; displayTasks: Task[]; total: number;
  isMobile: boolean; onTaskClick: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
}) {
  const cfg = STATUS_CONFIG[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-body)" }}>
          {cfg.label}
        </span>
        <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", fontSize: 11, fontWeight: 600, color: "var(--color-secondary)" }}>
          {total}
        </span>
      </div>

      <div ref={setNodeRef} className="space-y-2" style={{ border: isOver ? "2px dashed #1B2E4B" : "2px dashed transparent", borderRadius: 8, padding: 4, minHeight: 60, transition: "border-color 0.15s" }}>
        {displayTasks.map((task) => (
          <DraggableMiniTaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} isMobile={isMobile} />
        ))}
        {total > 3 && (
          <Link href="/tasks" style={{ fontSize: 12, color: "var(--color-navy)", textDecoration: "none", display: "block", paddingTop: 4, paddingLeft: 4 }}>
            +{total - 3} more
          </Link>
        )}
      </div>

      <button
        onClick={() => onAddTask(status)}
        className="flex items-center gap-1 mt-3 transition-opacity hover:opacity-70"
        style={{ fontSize: 12, color: "var(--color-navy)", textDecoration: "none", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-roboto)", minHeight: 36, padding: 0 }}
      >
        <Plus size={12} /> Add task
      </button>
    </div>
  );
}

// ── Kanban preview ────────────────────────────────────────────────────────────

function KanbanPreview({
  tasks, onTaskClick, onMoveTask, onAddTask,
}: {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
  onAddTask: (status: TaskStatus) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const tasksByStatus = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, tasks.filter((t) => t.status === s)])
  ) as Record<TaskStatus, Task[]>;

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = e;
      if (!over) return;
      const overId = over.id;
      if (typeof overId !== "string") return;
      const targetStatus = overId as TaskStatus;
      if (!STATUS_ORDER.includes(targetStatus)) return;
      const task = tasks.find((t) => t.id === active.id);
      if (!task || task.status === targetStatus) return;
      onMoveTask(active.id as string, targetStatus);
    },
    [tasks, onMoveTask]
  );

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <Card>
      <CardHeader
        title="Tasks"
        action={
          <Link href="/tasks" className="flex items-center gap-1 transition-opacity hover:opacity-70" style={{ fontSize: 12, color: "var(--color-navy)", fontWeight: 600, textDecoration: "none" }}>
            See all <ChevronRight size={13} />
          </Link>
        }
      />
      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <ClientOnly>
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="p-4 md:p-5 grid gap-4" style={{ gridTemplateColumns: "repeat(4, minmax(240px, 1fr))", minWidth: "min(100%, 960px)" }}>
              {STATUS_ORDER.map((status) => (
                <DroppableColumn
                  key={status}
                  status={status}
                  displayTasks={tasksByStatus[status].slice(0, 3)}
                  total={tasksByStatus[status].length}
                  isMobile={isMobile}
                  onTaskClick={onTaskClick}
                  onAddTask={onAddTask}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask && (
                <div style={{ opacity: 0.9, backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, boxShadow: "0 8px 24px rgba(27,46,75,0.18)" }}>
                  <MiniTaskCardContent task={activeTask} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </ClientOnly>
      </div>
    </Card>
  );
}

// ── Posts card (Opportunities / Lab Wins) ─────────────────────────────────────

function PostsCard({ title, posts: initialPosts, type }: { title: string; posts: DashboardPost[]; type: "opportunity" | "lab_win" }) {
  const [posts, setPosts] = useState<DashboardPost[]>(initialPosts);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");

  const filtered = posts.filter((p) => p.type === type);

  function handlePost() {
    if (!content.trim()) return;
    const author = getUser(CURRENT_USER_ID);
    const newPost: DashboardPost = {
      id: crypto.randomUUID(),
      authorId: CURRENT_USER_ID,
      content: content.trim(),
      createdAt: new Date().toISOString(),
      type,
    };
    setPosts((prev) => [newPost, ...prev]);
    setContent("");
    setShowForm(false);
  }

  const currentUser = getUser(CURRENT_USER_ID);

  return (
    <Card>
      <CardHeader
        title={title}
        action={
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{ fontSize: 12, color: "var(--color-navy)", fontWeight: 600 }}
          >
            <Plus size={13} /> Add
          </button>
        }
      />
      <div className="px-5 py-3 space-y-3">
        {filtered.length === 0 && !showForm && (
          <p style={{ color: "var(--color-secondary)", fontSize: 13 }}>Nothing posted yet. Add the first one.</p>
        )}
        {filtered.map((post) => {
          const author = getUser(post.authorId);
          return (
            <div key={post.id} className="flex gap-3">
              {author && <Avatar user={author} size={24} className="mt-0.5 shrink-0" />}
              <div>
                <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.45 }}>{post.content}</p>
                <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 3 }}>
                  {author?.name.split(" ")[0]} · {formatRelativeTime(post.createdAt)}
                </p>
              </div>
            </div>
          );
        })}

        {showForm && (
          <div className="animate-fade-in space-y-2 pt-1">
            <div className="flex gap-2">
              {currentUser && <Avatar user={currentUser} size={26} className="shrink-0 mt-1" />}
              <textarea
                autoFocus
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={type === "opportunity" ? "Share an opportunity with your team..." : "Share a lab win with your team..."}
                rows={3}
                style={{ flex: 1, fontSize: 13, color: "var(--color-body)", fontFamily: "var(--font-roboto)", border: "1px solid var(--color-border)", borderRadius: 7, padding: "8px 10px", resize: "vertical", backgroundColor: "var(--color-canvas)", outline: "none" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => { setShowForm(false); setContent(""); }}
                style={{ fontSize: 12, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handlePost}
                style={{ fontSize: 12, fontWeight: 700, color: "#fff", backgroundColor: "var(--color-navy)", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", minHeight: 36, fontFamily: "var(--font-roboto)" }}
              >
                Post
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Dashboard page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [tasks, setTasks]             = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalStatus, setModalStatus] = useState<TaskStatus | null>(null);
  const [projectName, setProjectName] = useState("");
  const [dashEvents, setDashEvents]   = useState<CalendarEvent[]>([]);
  const [dashActivity, setDashActivity] = useState<ActivityEvent[]>([]);
  const [dashPosts, setDashPosts]     = useState<DashboardPost[]>([]);

  useEffect(() => {
    const sp = getStoredProject();
    console.log("[Canopy] getStoredProject():", sp);
    console.log("[Canopy] raw localStorage canopy_project:", localStorage.getItem("canopy_project"));
    setProjectName(sp.name);

    // Only pre-populate with demo data when no real project has been stored
    if (!localStorage.getItem("canopy_project")) {
      setTasks(TASKS);
      setDashEvents(EVENTS);
      setDashActivity(ACTIVITY);
      setDashPosts(DASHBOARD_POSTS);
    }
  }, []);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const moveTask = useCallback((taskId: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    setSelectedTask((prev) => (prev?.id === taskId ? { ...prev, status } : prev));
  }, []);

  const addTask = useCallback((task: Task) => {
    setTasks((prev) => [task, ...prev]);
    setModalStatus(null);
  }, []);

  return (
    <div className="p-4 md:p-6" style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div className="mb-5 md:mb-6">
        <h1 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 26, color: "var(--color-navy)", margin: 0, lineHeight: 1.2 }}>
          {projectName}
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 4 }}>{today}</p>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-4 md:mb-5">
        <UpcomingWidget events={dashEvents} />
        <TeamActivityWidget events={dashActivity} />
      </div>

      {/* Row 2: Kanban preview */}
      <div className="mb-4 md:mb-5">
        <KanbanPreview
          tasks={tasks}
          onTaskClick={setSelectedTask}
          onMoveTask={moveTask}
          onAddTask={(status) => setModalStatus(status)}
        />
      </div>

      {/* Row 3: Opportunities + Lab Wins */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <PostsCard title="Opportunities" posts={dashPosts} type="opportunity" />
        <PostsCard title="Lab Wins" posts={dashPosts} type="lab_win" />
      </div>

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdateStatus={(status) => moveTask(selectedTask.id, status)}
        />
      )}

      {/* Task add modal (from column + buttons) */}
      {modalStatus && (
        <TaskModal
          mode="add"
          initialStatus={modalStatus}
          onSave={addTask}
          onClose={() => setModalStatus(null)}
        />
      )}

      <Toast />
    </div>
  );
}
