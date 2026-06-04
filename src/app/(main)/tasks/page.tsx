"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LayoutGrid, List, Search, Plus, MoreHorizontal } from "lucide-react";
import { formatDate, getStoredProject } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import type { Task, TaskStatus, User, UserRole } from "@/types";
import Avatar from "@/components/ui/Avatar";
import Toast from "@/components/ui/Toast";
import TaskDetailPanel, {
  STATUS_CONFIG, STATUS_ORDER, PriorityBadge, AssigneeStack,
} from "@/components/tasks/TaskDetailPanel";
import TaskModal from "@/components/tasks/TaskModal";

// ── Modal state ───────────────────────────────────────────────────────────────

type ModalState =
  | { mode: "add"; status: TaskStatus }
  | { mode: "edit"; task: Task }
  | null;

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onClick,
  onMoveStatus,
  onEdit,
  onDelete,
  isDragging = false,
  teamMembers = [],
}: {
  task: Task;
  onClick: () => void;
  onMoveStatus: (status: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  isDragging?: boolean;
  teamMembers?: User[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const otherStatuses = STATUS_ORDER.filter((s) => s !== task.status);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative cursor-pointer"
      onClick={onClick}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "#B8C4D4";
        el.style.boxShadow = "0 3px 10px rgba(27,46,75,0.09)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--color-border)";
        el.style.boxShadow = "";
      }}
    >
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          padding: "10px 12px",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-body)", lineHeight: 1.35, marginBottom: 8 }}>
          {task.title}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span style={{ fontSize: 12, color: "var(--color-secondary)" }}>
            {task.dueDate ? formatDate(task.dueDate) : "—"}
          </span>
          <PriorityBadge priority={task.priority} />
          <AssigneeStack ids={task.assigneeIds} size={20} users={teamMembers} />
        </div>
      </div>

      {/* ⋯ menu button */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); setDeleteConfirm(false); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded"
        style={{ backgroundColor: "rgba(255,255,255,0.9)" }}
        aria-label="Task options"
      >
        <MoreHorizontal size={14} color="var(--color-secondary)" />
      </button>

      {menuOpen && !deleteConfirm && (
        <div
          className="absolute right-0 top-8 z-20 animate-fade-in"
          style={{ width: 180, backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, boxShadow: "var(--shadow-card)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 4, paddingTop: 4 }}>
            {otherStatuses.map((s) => (
              <button
                key={s}
                onClick={() => { onMoveStatus(s); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-[rgba(27,46,75,0.06)] transition-colors"
                style={{ fontSize: 12, color: "var(--color-body)", minHeight: 36 }}
              >
                Move to {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setMenuOpen(false); onEdit(); }}
            className="w-full text-left px-3 py-2 hover:bg-[rgba(27,46,75,0.06)] transition-colors"
            style={{ fontSize: 12, color: "var(--color-body)", minHeight: 36 }}
          >
            Edit task
          </button>
          <button
            onClick={() => { setDeleteConfirm(true); }}
            className="w-full text-left px-3 py-2 hover:bg-[rgba(27,46,75,0.06)] transition-colors"
            style={{ fontSize: 12, color: "var(--color-error)", minHeight: 36 }}
          >
            Delete task
          </button>
        </div>
      )}

      {/* Inline delete confirm */}
      {deleteConfirm && (
        <div
          className="absolute right-0 top-8 z-20 animate-fade-in"
          style={{ width: 200, backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, boxShadow: "var(--shadow-card)", padding: "12px 12px 10px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <p style={{ fontSize: 12, color: "var(--color-body)", marginBottom: 10 }}>Delete this task?</p>
          <div className="flex gap-2">
            <button
              onClick={() => { setDeleteConfirm(false); setMenuOpen(false); }}
              style={{ flex: 1, fontSize: 12, padding: "5px 0", border: "1px solid var(--color-border)", borderRadius: 5, backgroundColor: "transparent", cursor: "pointer", color: "var(--color-body)" }}
            >
              Cancel
            </button>
            <button
              onClick={() => { onDelete(); setDeleteConfirm(false); setMenuOpen(false); }}
              style={{ flex: 1, fontSize: 12, padding: "5px 0", border: "none", borderRadius: 5, backgroundColor: "var(--color-error)", color: "#fff", cursor: "pointer", fontWeight: 700 }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Kanban column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  onMoveTask,
  onEditTask,
  onDeleteTask,
  onAddTask,
  teamMembers = [],
}: {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (status: TaskStatus) => void;
  teamMembers?: User[];
}) {
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="flex flex-col" style={{ minWidth: 0, flex: 1 }}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-body)" }}>
          {cfg.label}
        </span>
        <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", fontSize: 11, fontWeight: 600, color: "var(--color-secondary)" }}>
          {tasks.length}
        </span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1">
          {tasks.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--color-secondary)", padding: "8px 4px" }}>
              No tasks yet. Add your first one.
            </p>
          )}
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              onMoveStatus={(s) => onMoveTask(task.id, s)}
              onEdit={() => onEditTask(task)}
              onDelete={() => onDeleteTask(task.id)}
              teamMembers={teamMembers}
            />
          ))}
        </div>
      </SortableContext>

      <button
        onClick={() => onAddTask(status)}
        className="flex items-center gap-1.5 mt-3 px-1 py-1 transition-opacity hover:opacity-70"
        style={{ fontSize: 12, color: "var(--color-navy)", minHeight: 36, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-roboto)" }}
      >
        <Plus size={13} /> Add task
      </button>
    </div>
  );
}

// ── List view row ─────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onClick,
  onToggleDone,
  teamMembers = [],
}: {
  task: Task;
  onClick: () => void;
  onToggleDone: () => void;
  teamMembers?: User[];
}) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer transition-colors hover:bg-[#F8FAFF]"
      style={{ opacity: task.status === "done" ? 0.7 : 1 }}
    >
      <td className="pl-5 py-2.5 pr-2">
        <input
          type="checkbox"
          checked={task.status === "done"}
          onChange={(e) => { e.stopPropagation(); onToggleDone(); }}
          className="w-4 h-4 cursor-pointer"
          style={{ accentColor: "var(--color-navy)" }}
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td className="py-2.5 pr-3" style={{ maxWidth: 280 }}>
        <span
          style={{
            fontSize: "12.4px",
            fontWeight: 500,
            color: "var(--color-body)",
            textDecoration: task.status === "done" ? "line-through" : undefined,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "block",
          }}
        >
          {task.title}
        </span>
      </td>
      <td className="py-2.5 pr-3">
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5"
          style={{
            backgroundColor: `${STATUS_CONFIG[task.status].dot}18`,
            color: STATUS_CONFIG[task.status].dot,
            borderRadius: 5,
            fontSize: "12.4px",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_CONFIG[task.status].dot }} />
          {STATUS_CONFIG[task.status].label}
        </span>
      </td>
      <td className="py-2.5 pr-3"><PriorityBadge priority={task.priority} /></td>
      <td className="py-2.5 pr-3"><AssigneeStack ids={task.assigneeIds} size={22} users={teamMembers} /></td>
      <td className="py-2.5 pr-5" style={{ fontSize: "12.4px", color: "var(--color-secondary)", whiteSpace: "nowrap" }}>
        {task.dueDate ? formatDate(task.dueDate) : "—"}
      </td>
      <td className="py-2.5 pr-5">
        <button onClick={(e) => e.stopPropagation()} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[rgba(27,46,75,0.06)]">
          <MoreHorizontal size={13} color="var(--color-secondary)" />
        </button>
      </td>
    </tr>
  );
}

// ── Tasks page ────────────────────────────────────────────────────────────────

function avatarColorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360}, 55%, 80%)`;
}

export default function TasksPage() {
  const [view, setView] = useState<"board" | "list">("board");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    const projectId = getStoredProject().id;
    if (!projectId || projectId === "p1") { setLoading(false); return; }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });

    supabase
      .from("team_members")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select("user_id, user_profiles(name, avatar_initials, role)" as any)
      .eq("project_id", projectId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any[] | null }) => {
        if (data) {
          setTeamMembers(data.map((row) => {
            const profile = Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles;
            const id = row.user_id as string;
            return {
              id,
              name: profile?.name ?? "Team Member",
              email: "",
              role: (profile?.role ?? "researcher") as UserRole,
              avatarColor: avatarColorFromId(id),
              avatarInitials: profile?.avatar_initials ?? "??",
            } as User;
          }));
        }
      });

    supabase
      .from("tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setTasks(data.map((row) => ({
          id: row.id as string,
          projectId: row.project_id as string,
          title: row.title as string,
          description: row.description as string,
          status: row.status as TaskStatus,
          priority: row.priority as Task["priority"],
          assigneeIds: (row.assignee_ids as string[]) ?? [],
          dueDate: row.due_date as string | undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
          comments: (row.comments as Task["comments"]) ?? [],
          files: (row.files as Task["files"]) ?? [],
          links: (row.links as Task["links"]) ?? [],
        })));
        setLoading(false);
      });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setTasks((prev) => {
      const activeTask = prev.find((t) => t.id === active.id);
      const overTask   = prev.find((t) => t.id === over.id);
      if (!activeTask || !overTask || activeTask.status === overTask.status) return prev;
      return prev.map((t) => t.id === active.id ? { ...t, status: overTask.status } : t);
    });
  }, []);

  const moveTask = useCallback((taskId: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
    setSelectedTask((prev) => prev?.id === taskId ? { ...prev, status } : prev);
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...updates } : t));
    setSelectedTask((prev) => prev?.id === taskId ? { ...prev, ...updates } as Task : prev);
  }, []);

  const addTask = useCallback((task: Task) => {
    setTasks((prev) => [task, ...prev]);
    setModalState(null);
  }, []);

  const editTask = useCallback((task: Task) => {
    setTasks((prev) => prev.map((t) => t.id === task.id ? task : t));
    setSelectedTask((prev) => prev?.id === task.id ? task : prev);
    setModalState(null);
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTask((prev) => prev?.id === taskId ? null : prev);
  }, []);

  const filteredTasks = tasks.filter((t) =>
    search === "" || t.title.toLowerCase().includes(search.toLowerCase())
  );

  const tasksByStatus = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, filteredTasks.filter((t) => t.status === s)])
  ) as Record<TaskStatus, Task[]>;

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "var(--font-roboto)" }}>

      {/* Toolbar */}
      <div className="px-4 md:px-6 pt-3 pb-2" style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-3 mb-2">
          <h1 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 22, color: "var(--color-navy)", margin: 0, flex: 1 }}>Tasks</h1>
          <div className="flex items-center rounded-lg p-0.5 shrink-0" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
            {(["board", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all"
                style={{ fontSize: 12, fontWeight: 600, backgroundColor: view === v ? "var(--color-navy)" : "transparent", color: view === v ? "#fff" : "var(--color-secondary)", minHeight: 36, minWidth: 44, justifyContent: "center" }}
              >
                {v === "board" ? <LayoutGrid size={14} /> : <List size={14} />}
                <span className="hidden sm:inline">{v === "board" ? "Board" : "List"}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setModalState({ mode: "add", status: "todo" })}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2 shrink-0 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-navy)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 7, border: "none", cursor: "pointer", minHeight: 44 }}
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Add Task</span>
          </button>
        </div>
        <div className="pb-2 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" color="var(--color-secondary)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            style={{ width: "100%", paddingLeft: 32, paddingRight: 12, height: 36, border: "1px solid var(--color-border)", borderRadius: 7, fontSize: 13, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)", outline: "none" }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading && (
          <p style={{ fontSize: 13, color: "var(--color-secondary)", padding: 8 }}>Loading tasks…</p>
        )}
        {!loading && view === "board" ? (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="grid gap-4 md:gap-5" style={{ gridTemplateColumns: "repeat(4, minmax(240px, 1fr))", alignItems: "start", minWidth: "min(100%, 960px)" }}>
                {STATUS_ORDER.map((status) => (
                  <KanbanColumn
                    key={status}
                    status={status}
                    tasks={tasksByStatus[status]}
                    onTaskClick={setSelectedTask}
                    onMoveTask={moveTask}
                    onEditTask={(t) => setModalState({ mode: "edit", task: t })}
                    onDeleteTask={deleteTask}
                    onAddTask={(s) => setModalState({ mode: "add", status: s })}
                    teamMembers={teamMembers}
                  />
                ))}
              </div>
            </div>
            <DragOverlay>
              {activeTask && (
                <div style={{ opacity: 0.85, transform: "rotate(2deg)" }}>
                  <TaskCard
                    task={activeTask}
                    onClick={() => {}}
                    onMoveStatus={() => {}}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    isDragging
                    teamMembers={teamMembers}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : !loading ? (
          <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, overflow: "auto" }}>
            <table className="border-collapse" style={{ width: "100%", minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {["", "Title", "Status", "Priority", "Assignees", "Due Date", ""].map((col, i) => (
                    <th key={i} className={i === 0 ? "pl-5 py-3 pr-2" : i === 6 ? "pr-5 py-3" : "py-3 pr-3"}
                      style={{ textAlign: "left", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", fontFamily: "var(--font-roboto)" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onClick={() => setSelectedTask(task)}
                    onToggleDone={() => moveTask(task.id, task.status === "done" ? "in_progress" : "done")}
                    teamMembers={teamMembers}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdateStatus={(status) => moveTask(selectedTask.id, status)}
          onUpdateTask={(updates) => updateTask(selectedTask.id, updates)}
          teamMembers={teamMembers}
          currentUserId={currentUserId}
        />
      )}

      {/* Task modal */}
      {modalState && (
        <TaskModal
          mode={modalState.mode}
          initialStatus={modalState.mode === "add" ? modalState.status : undefined}
          task={modalState.mode === "edit" ? modalState.task : undefined}
          onSave={modalState.mode === "add" ? addTask : editTask}
          onClose={() => setModalState(null)}
          teamMembers={teamMembers}
          currentUserId={currentUserId}
        />
      )}

      <Toast />
    </div>
  );
}
