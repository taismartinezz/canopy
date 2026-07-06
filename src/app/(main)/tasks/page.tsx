"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LayoutGrid, List, Search, Plus, MoreHorizontal, ChevronDown } from "lucide-react";
import { formatDate, TASKS as MOCK_TASKS, USERS, getStoredProject } from "@/lib/mock-data";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Task, TaskStatus, TaskPriority, User, UserRole } from "@/types";
import Avatar from "@/components/ui/Avatar";
import Toast, { showToast } from "@/components/ui/Toast";
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
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        menuBtnRef.current && !menuBtnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
        setDeleteConfirm(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

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
        ref={menuBtnRef}
        onClick={(e) => {
          e.stopPropagation();
          const rect = menuBtnRef.current?.getBoundingClientRect() ?? null;
          setMenuAnchor(rect);
          setMenuOpen((o) => !o);
          setDeleteConfirm(false);
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded"
        style={{ backgroundColor: "rgba(255,255,255,0.9)" }}
        aria-label="Task options"
      >
        <MoreHorizontal size={14} color="var(--color-secondary)" />
      </button>

      {menuOpen && menuAnchor && createPortal(
        <div
          ref={menuRef}
          className="animate-fade-in"
          style={{
            position: "fixed",
            top: menuAnchor.bottom + 4,
            right: Math.max(8, window.innerWidth - menuAnchor.right),
            zIndex: 9999,
            width: deleteConfirm ? 200 : 180,
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(27,46,75,0.12)",
            ...(deleteConfirm ? { padding: "12px 12px 10px" } : {}),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {!deleteConfirm ? (
            <>
              <div style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: 4, paddingTop: 4 }}>
                {otherStatuses.map((s) => (
                  <button
                    key={s}
                    onClick={() => { onMoveStatus(s); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-[rgba(27,46,75,0.06)] transition-colors"
                    style={{ fontSize: 12, color: "var(--color-body)", minHeight: 36, border: "none", background: "none", cursor: "pointer", display: "block", width: "100%", textAlign: "left" }}
                  >
                    Move to {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setMenuOpen(false); onEdit(); }}
                className="w-full text-left px-3 py-2 hover:bg-[rgba(27,46,75,0.06)] transition-colors"
                style={{ fontSize: 12, color: "var(--color-body)", minHeight: 36, border: "none", background: "none", cursor: "pointer", display: "block", width: "100%", textAlign: "left" }}
              >
                Edit task
              </button>
              <button
                onClick={() => setDeleteConfirm(true)}
                className="w-full text-left px-3 py-2 hover:bg-[rgba(27,46,75,0.06)] transition-colors"
                style={{ fontSize: 12, color: "var(--color-error)", minHeight: 36, border: "none", background: "none", cursor: "pointer", display: "block", width: "100%", textAlign: "left" }}
              >
                Delete task
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "var(--color-body)", marginBottom: 10 }}>Delete this task?</p>
              <div style={{ display: "flex", gap: 8 }}>
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
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Kanban column (droppable + sortable) ──────────────────────────────────────

function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  onMoveTask,
  onEditTask,
  onDeleteTask,
  onAddTask,
  onArchiveDone,
  teamMembers = [],
}: {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (status: TaskStatus) => void;
  onArchiveDone?: () => void;
  teamMembers?: User[];
}) {
  const cfg = STATUS_CONFIG[status];
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col" style={{ minWidth: 0, flex: 1 }}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-body)" }}>
          {cfg.label}
        </span>
        <span className="flex items-center justify-center w-5 h-5 rounded-full" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", fontSize: 11, fontWeight: 600, color: "var(--color-secondary)" }}>
          {tasks.length}
        </span>
        {status === "done" && tasks.length >= 3 && onArchiveDone && (
          <button
            onClick={onArchiveDone}
            title="Archive all done tasks"
            style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, color: "var(--color-secondary)", background: "none", border: "1px solid var(--color-border)", borderRadius: 4, padding: "2px 6px", cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Archive all
          </button>
        )}
      </div>

      <div
        ref={setDropRef}
        style={{
          flex: 1,
          borderRadius: 8,
          border: isOver ? "2px dashed var(--color-navy)" : "2px dashed transparent",
          transition: "border-color 0.15s",
          padding: 2,
          minHeight: 60,
        }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
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
      </div>

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

// ── Filter select ─────────────────────────────────────────────────────────────

function FilterSelect({
  value, onChange, children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex items-center shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pr-6"
        style={{
          height: 36, paddingLeft: 10, paddingRight: 24,
          border: "1px solid var(--color-border)", borderRadius: 7,
          fontSize: 12, fontFamily: "var(--font-roboto)",
          backgroundColor: value !== "all" ? "rgba(27,46,75,0.06)" : "var(--color-canvas)",
          color: value !== "all" ? "var(--color-navy)" : "var(--color-secondary)",
          fontWeight: value !== "all" ? 600 : 400,
          outline: "none", cursor: "pointer",
        }}
      >
        {children}
      </select>
      <ChevronDown size={12} className="absolute right-2 pointer-events-none" color="var(--color-secondary)" />
    </div>
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
  const [filterMember, setFilterMember] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Demo mode — use mock data
      const sp = getStoredProject();
      setProjectId(sp.id);
      setTeamMembers(USERS);
      setTasks(MOCK_TASKS);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user ?? null;
      if (!user) { setLoading(false); return; }
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("project_id")
        .eq("id", user.id)
        .maybeSingle();

      const pid = profile?.project_id as string | undefined;
      if (!pid) { setLoading(false); return; }
      setProjectId(pid);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: members } = await (supabase
        .from("team_members")
        .select("*, user_profiles(name, avatar_initials, avatar_color, role)")
        .eq("project_id", pid) as any);

      if (members) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setTeamMembers((members as any[]).map((row) => {
          const p = Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles;
          const id = row.user_id as string;
          return {
            id,
            name: p?.name ?? "Team Member",
            email: "",
            role: (p?.role ?? "researcher") as UserRole,
            avatarColor: p?.avatar_color ?? avatarColorFromId(id),
            avatarInitials: p?.avatar_initials ?? "??",
          } as User;
        }));
      }

      const { data, error } = await supabase
        .from("tasks")
        .select("*, task_assignees(user_id)")
        .eq("project_id", pid)
        .or("archived.is.null,archived.eq.false")
        .order("created_at", { ascending: false });

      if (error) console.error("[Tasks] fetch error:", error);
      if (!error && data) {
        setTasks(data.map((row) => ({
          id: row.id as string,
          projectId: row.project_id as string,
          title: row.title as string,
          description: row.description as string,
          status: row.status as TaskStatus,
          priority: row.priority as Task["priority"],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          assigneeIds: ((row.task_assignees as any[]) ?? []).map((ta) => ta.user_id as string),
          dueDate: row.due_date as string | undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
          comments: (row.comments as Task["comments"]) ?? [],
          files: (row.files as Task["files"]) ?? [],
          links: (row.links as Task["links"]) ?? [],
        })));
      }
      setLoading(false);
    });
  }, []);

  // Realtime: reflect task INSERTs/UPDATEs/DELETEs from other users
  useEffect(() => {
    if (!projectId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel(`tasks:${projectId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (row.archived) return;
        setTasks((prev) => {
          if (prev.find((t) => t.id === row.id)) return prev;
          return [{
            id: row.id as string, projectId: row.project_id as string,
            title: row.title as string, description: (row.description as string) ?? "",
            status: row.status as TaskStatus, priority: row.priority as Task["priority"],
            assigneeIds: [], dueDate: row.due_date as string | undefined,
            createdAt: row.created_at as string, updatedAt: row.updated_at as string,
            comments: [], files: [], links: [],
          }, ...prev];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (row.archived) { setTasks((prev) => prev.filter((t) => t.id !== row.id)); return; }
        setTasks((prev) => prev.map((t) => t.id === row.id ? { ...t, status: row.status as TaskStatus, priority: row.priority as Task["priority"], title: row.title as string, dueDate: row.due_date as string | undefined } : t));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tasks" }, (payload) => {
        setTasks((prev) => prev.filter((t) => t.id !== (payload.old as Record<string, unknown>).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    // Resolve target status outside setTasks so the Supabase call is a clean side-effect
    setTasks((prev) => {
      const activeTask = prev.find((t) => t.id === activeTaskId);
      if (!activeTask) return prev;

      let targetStatus: TaskStatus | undefined;
      if ((STATUS_ORDER as string[]).includes(overId)) {
        targetStatus = overId as TaskStatus;
      } else {
        const overTask = prev.find((t) => t.id === overId);
        if (overTask && overTask.status !== activeTask.status) {
          targetStatus = overTask.status;
        }
      }

      if (!targetStatus || targetStatus === activeTask.status) return prev;

      // Persist outside the updater to avoid double-fire in StrictMode
      setTimeout(() => {
        supabase.from("tasks").update({ status: targetStatus }).eq("id", activeTaskId)
          .then(({ error }) => {
            if (error) console.error("[Tasks] drag status error:", error);
          });
      }, 0);

      return prev.map((t) => t.id === activeTaskId ? { ...t, status: targetStatus! } : t);
    });
  }, []);

  const moveTask = useCallback((taskId: string, status: TaskStatus) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === taskId);
      if (task && task.status !== status && projectId && currentUserId) {
        supabase.from("activity_feed").insert({
          project_id: projectId,
          user_id: currentUserId,
          action_type: "moved",
          item_name: task.title,
          item_type: "task",
          from_status: task.status,
          to_status: status,
        }).then(({ error }) => { if (error) console.error("[Tasks] activity insert error:", error); });
      }
      return prev.map((t) => t.id === taskId ? { ...t, status } : t);
    });
    setSelectedTask((prev) => prev?.id === taskId ? { ...prev, status } : prev);
    supabase.from("tasks").update({ status }).eq("id", taskId)
      .then(({ error }) => { if (error) console.error("[Tasks] moveTask error:", error); });
  }, [projectId, currentUserId]);

  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...updates } : t));
    setSelectedTask((prev) => prev?.id === taskId ? { ...prev, ...updates } as Task : prev);
    if (!isSupabaseConfigured) return;
    const db: Record<string, unknown> = {};
    if (updates.title       !== undefined) db.title        = updates.title;
    if (updates.description !== undefined) db.description  = updates.description;
    if (updates.priority    !== undefined) db.priority     = updates.priority;
    if (updates.status      !== undefined) db.status       = updates.status;
    if (updates.dueDate     !== undefined) db.due_date     = updates.dueDate || null;
    if (updates.assigneeIds !== undefined) db.assignee_ids = updates.assigneeIds;
    if (updates.comments    !== undefined) db.comments     = updates.comments;
    if (updates.files       !== undefined) db.files        = updates.files;
    if (Object.keys(db).length > 0)
      supabase.from("tasks").update(db).eq("id", taskId)
        .then(({ error }) => {
          if (error) {
            console.error("[Tasks] update error:", error);
            if (updates.files !== undefined)
              showToast(`File save failed: ${error.message}`, "error");
          }
        });
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
    supabase.from("tasks").delete().eq("id", taskId)
      .then(({ error }) => { if (error) console.error("[Tasks] deleteTask error:", error); });
  }, []);

  const archiveDoneTasks = useCallback(() => {
    setTasks((prev) => {
      const doneIds = prev.filter((t) => t.status === "done").map((t) => t.id);
      if (doneIds.length === 0) return prev;
      supabase.from("tasks").update({ archived: true }).in("id", doneIds)
        .then(({ error }) => { if (error) console.error("[Tasks] archive error:", error); });
      return prev.filter((t) => t.status !== "done");
    });
    setSelectedTask((prev) => prev?.status === "done" ? null : prev);
  }, []);

  const filteredTasks = tasks.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterMember !== "all" && !t.assigneeIds.includes(filterMember)) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  const tasksByStatus = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, filteredTasks.filter((t) => t.status === s)])
  ) as Record<TaskStatus, Task[]>;

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const filterSelectStyle: React.CSSProperties = {
    height: 36, fontSize: 12, fontFamily: "var(--font-roboto)",
    border: "1px solid var(--color-border)", borderRadius: 7,
    backgroundColor: "var(--color-canvas)", color: "var(--color-secondary)",
    outline: "none", cursor: "pointer", paddingLeft: 8, paddingRight: 8,
  };

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

        {/* Search + filters row */}
        <div className="flex items-center gap-2 pb-2 flex-wrap">
          <div className="relative flex-1 min-w-0" style={{ minWidth: 120 }}>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" color="var(--color-secondary)" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              style={{ width: "100%", paddingLeft: 32, paddingRight: 12, height: 36, border: "1px solid var(--color-border)", borderRadius: 7, fontSize: 13, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)", outline: "none" }}
            />
          </div>

          <FilterSelect value={filterMember} onChange={setFilterMember}>
            <option value="all">All Members</option>
            {teamMembers.map((u) => (
              <option key={u.id} value={u.id}>{u.name.split(" ")[0]}</option>
            ))}
          </FilterSelect>

          <FilterSelect value={filterPriority} onChange={setFilterPriority}>
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </FilterSelect>
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
              <div className="grid gap-4 md:gap-5" style={{ gridTemplateColumns: "repeat(4, minmax(240px, 1fr))", alignItems: "start", minWidth: 960 }}>
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
                    onArchiveDone={archiveDoneTasks}
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

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdateStatus={(status) => moveTask(selectedTask.id, status)}
          onUpdateTask={(updates) => updateTask(selectedTask.id, updates)}
          onDeleteTask={deleteTask}
          teamMembers={teamMembers}
          currentUserId={currentUserId}
        />
      )}

      {modalState && (
        <TaskModal
          mode={modalState.mode}
          initialStatus={modalState.mode === "add" ? modalState.status : undefined}
          task={modalState.mode === "edit" ? modalState.task : undefined}
          onSave={modalState.mode === "add" ? addTask : editTask}
          onClose={() => setModalState(null)}
          teamMembers={teamMembers}
          currentUserId={currentUserId}
          projectId={projectId}
        />
      )}

      <Toast />
    </div>
  );
}
