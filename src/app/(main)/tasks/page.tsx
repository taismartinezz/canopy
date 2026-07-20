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
import { LayoutGrid, List, Search, Plus, MoreHorizontal, ChevronDown, Bookmark, X as XIcon, User as UserIcon, Users } from "lucide-react";
import { formatDate, TASKS as MOCK_TASKS, USERS, getStoredProject } from "@/lib/mock-data";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";
import type { Task, TaskStatus, TaskPriority, User, UserRole } from "@/types";
import Avatar from "@/components/ui/Avatar";
import Toast, { showToast } from "@/components/ui/Toast";
import TaskDetailPanel, {
  STATUS_CONFIG, STATUS_ORDER, PriorityBadge, AssigneeStack,
} from "@/components/tasks/TaskDetailPanel";
import TaskModal from "@/components/tasks/TaskModal";
import ScopeSidebar, { type ScopeSection } from "@/components/ui/ScopeSidebar";
import EmptyState from "@/components/ui/EmptyState";
import { CalendarPicker } from "@/components/ui/DateTimePicker";

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
  subtaskProgress,
  showLabBadge = false,
}: {
  task: Task;
  onClick: () => void;
  onMoveStatus: (status: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  isDragging?: boolean;
  teamMembers?: User[];
  subtaskProgress?: { total: number; done: number };
  showLabBadge?: boolean;
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
          <div className="flex items-center gap-1.5">
            {showLabBadge && task.scope === "lab" && (
              <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: "rgba(27,46,75,0.08)", color: "var(--color-navy)", padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>
                Lab
              </span>
            )}
            <PriorityBadge priority={task.priority} />
          </div>
          <AssigneeStack ids={task.assigneeIds} size={20} users={teamMembers} />
        </div>
        {subtaskProgress && subtaskProgress.total > 0 && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(27,46,75,0.07)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-secondary)", letterSpacing: "0.03em", textTransform: "uppercase" }}>Subtasks</span>
              <span style={{ fontSize: 10, color: "var(--color-secondary)" }}>{subtaskProgress.done}/{subtaskProgress.total}</span>
            </div>
            <div style={{ height: 3, backgroundColor: "rgba(27,46,75,0.08)", borderRadius: 2 }}>
              <div style={{
                height: "100%",
                width: `${(subtaskProgress.done / subtaskProgress.total) * 100}%`,
                backgroundColor: subtaskProgress.done === subtaskProgress.total ? "#2E7D52" : "var(--color-navy)",
                borderRadius: 2, transition: "width 0.3s ease",
              }} />
            </div>
          </div>
        )}
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
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 flex items-center justify-center rounded"
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
  subtaskCounts = {},
  showLabBadge = false,
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
  subtaskCounts?: Record<string, { total: number; done: number }>;
  showLabBadge?: boolean;
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
              <EmptyState
                variant="column"
                title="No tasks yet"
                compact
              />
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
                subtaskProgress={subtaskCounts[task.id]}
                showLabBadge={showLabBadge}
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

// ── List view row — with inline status, assignee, and due-date editing ────────

function TaskRow({
  task,
  onClick,
  onToggleDone,
  onMoveStatus,
  onUpdateAssignees,
  onUpdateDueDate,
  teamMembers = [],
  subtaskProgress,
  showLabBadge = false,
}: {
  task: Task;
  onClick: () => void;
  onToggleDone: () => void;
  onMoveStatus: (status: TaskStatus) => void;
  onUpdateAssignees: (ids: string[]) => void;
  onUpdateDueDate: (date: string | undefined) => void;
  teamMembers?: User[];
  subtaskProgress?: { total: number; done: number };
  showLabBadge?: boolean;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [calPos, setCalPos] = useState({ top: 0, left: 0 });
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const assigneeBtnRef = useRef<HTMLButtonElement>(null);
  const assigneeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!statusOpen && !assigneeOpen) return;
    function onDown(e: MouseEvent) {
      const inStatus = statusBtnRef.current?.contains(e.target as Node) || statusMenuRef.current?.contains(e.target as Node);
      const inAssignee = assigneeBtnRef.current?.contains(e.target as Node) || assigneeMenuRef.current?.contains(e.target as Node);
      if (!inStatus) setStatusOpen(false);
      if (!inAssignee) setAssigneeOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [statusOpen, assigneeOpen]);

  const cfg = STATUS_CONFIG[task.status];

  function openCal(e: React.MouseEvent) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCalPos({ top: rect.bottom + 4, left: rect.left });
    setCalOpen(true);
  }

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer transition-colors hover:bg-[#F8FAFF]"
      style={{ opacity: task.status === "done" ? 0.7 : 1, height: "var(--density-row)" }}
    >
      {/* Checkbox */}
      <td className="pl-5 pr-2" style={{ width: 36 }}>
        <input
          type="checkbox"
          checked={task.status === "done"}
          onChange={(e) => { e.stopPropagation(); onToggleDone(); }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 cursor-pointer"
          style={{ accentColor: "var(--color-navy)" }}
        />
      </td>

      {/* Title */}
      <td className="pr-3" style={{ maxWidth: 280 }}>
        <div className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
          <span style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-body)",
            textDecoration: task.status === "done" ? "line-through" : undefined,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: "1 1 0",
            minWidth: 0,
          }}>
            {task.title}
          </span>
          {showLabBadge && task.scope === "lab" && (
            <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, backgroundColor: "rgba(27,46,75,0.08)", color: "var(--color-navy)", padding: "1px 6px", borderRadius: 4 }}>
              Lab
            </span>
          )}
        </div>
      </td>

      {/* Status — inline dropdown */}
      <td className="pr-3" style={{ position: "relative" }}>
        <button
          ref={statusBtnRef}
          onClick={(e) => { e.stopPropagation(); setStatusOpen((o) => !o); setAssigneeOpen(false); setCalOpen(false); }}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 hover:opacity-80 transition-opacity"
          style={{
            backgroundColor: `${cfg.dot}18`,
            color: cfg.dot,
            borderRadius: 5,
            fontSize: 12,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          aria-label={`Status: ${cfg.label}`}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
          {cfg.label}
        </button>
        {statusOpen && createPortal(
          <div
            ref={statusMenuRef}
            className="animate-fade-in"
            style={{
              position: "fixed",
              top: (statusBtnRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
              left: statusBtnRef.current?.getBoundingClientRect().left ?? 0,
              zIndex: 9999,
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              boxShadow: "0 4px 16px rgba(27,46,75,0.12)",
              padding: "4px 0",
              minWidth: 148,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {STATUS_ORDER.map((s) => {
              const sc = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => { onMoveStatus(s); setStatusOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[rgba(27,46,75,0.06)] transition-colors"
                  style={{ fontSize: 12, color: "var(--color-body)", border: "none", background: "none", cursor: "pointer" }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sc.dot }} />
                  {sc.label}
                  {s === task.status && <span style={{ marginLeft: "auto", color: "var(--color-navy)", fontSize: 10 }}>✓</span>}
                </button>
              );
            })}
          </div>,
          document.body
        )}
      </td>

      {/* Priority */}
      <td className="pr-3"><PriorityBadge priority={task.priority} /></td>

      {/* Assignees — inline picker */}
      <td className="pr-3" style={{ position: "relative" }}>
        <button
          ref={assigneeBtnRef}
          onClick={(e) => { e.stopPropagation(); setAssigneeOpen((o) => !o); setStatusOpen(false); setCalOpen(false); }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          aria-label="Edit assignees"
        >
          {task.assigneeIds.length === 0
            ? <span style={{ fontSize: 12, color: "var(--color-secondary)" }}>—</span>
            : <AssigneeStack ids={task.assigneeIds} size={22} users={teamMembers} />}
        </button>
        {assigneeOpen && createPortal(
          <div
            ref={assigneeMenuRef}
            className="animate-fade-in"
            style={{
              position: "fixed",
              top: (assigneeBtnRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
              left: assigneeBtnRef.current?.getBoundingClientRect().left ?? 0,
              zIndex: 9999,
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              boxShadow: "0 4px 16px rgba(27,46,75,0.12)",
              padding: "4px 0",
              minWidth: 180,
              maxHeight: 240,
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {teamMembers.map((u) => {
              const checked = task.assigneeIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    const newIds = checked
                      ? task.assigneeIds.filter((id) => id !== u.id)
                      : [...task.assigneeIds, u.id];
                    onUpdateAssignees(newIds);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[rgba(27,46,75,0.06)] transition-colors"
                  style={{ fontSize: 12, color: "var(--color-body)", border: "none", background: "none", cursor: "pointer" }}
                >
                  <Avatar user={u} size={18} />
                  <span style={{ flex: 1, textAlign: "left" }}>{u.name.split(" ")[0]}</span>
                  {checked && <span style={{ color: "var(--color-navy)", fontSize: 11 }}>✓</span>}
                </button>
              );
            })}
            {teamMembers.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--color-secondary)", padding: "8px 12px" }}>No team members</p>
            )}
          </div>,
          document.body
        )}
      </td>

      {/* Due date — inline date picker */}
      <td className="pr-3">
        <button
          onClick={openCal}
          className="hover:bg-[rgba(27,46,75,0.06)] transition-colors"
          style={{
            fontSize: 12,
            color: task.dueDate ? "var(--color-body)" : "var(--color-secondary)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px 4px",
            borderRadius: 4,
            whiteSpace: "nowrap",
          }}
          aria-label="Edit due date"
        >
          {task.dueDate ? formatDate(task.dueDate) : "—"}
        </button>
        {calOpen && createPortal(
          <div onClick={(e) => e.stopPropagation()}>
            <CalendarPicker
              value={task.dueDate}
              accentColor="var(--color-navy)"
              pos={calPos}
              onSelect={(d) => { onUpdateDueDate(d); setCalOpen(false); }}
              onClear={() => { onUpdateDueDate(undefined); setCalOpen(false); }}
              onClose={() => setCalOpen(false)}
            />
          </div>,
          document.body
        )}
      </td>

      {/* Subtask progress */}
      <td className="pr-3">
        {subtaskProgress && subtaskProgress.total > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 40, height: 3, backgroundColor: "var(--status-todo-bg)", borderRadius: 2, flexShrink: 0 }}>
              <div style={{
                height: "100%",
                width: `${(subtaskProgress.done / subtaskProgress.total) * 100}%`,
                backgroundColor: subtaskProgress.done === subtaskProgress.total ? "var(--status-done-dot)" : "var(--color-navy)",
                borderRadius: 2,
              }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--color-secondary)", whiteSpace: "nowrap" }}>
              {subtaskProgress.done}/{subtaskProgress.total}
            </span>
          </div>
        ) : null}
      </td>

      {/* Actions */}
      <td className="pr-3">
        <button
          onClick={(e) => e.stopPropagation()}
          className="w-9 h-9 flex items-center justify-center rounded hover:bg-[rgba(27,46,75,0.06)]"
          aria-label="Task options"
        >
          <MoreHorizontal size={14} color="var(--color-secondary)" />
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
  const { subProjects } = useProject();
  const [taskScope, setTaskScope] = useState<string>("all"); // "all" | "personal" | "lab" | subProjectId
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("canopy_tasks_sidebar_collapsed") === "true"; } catch { return false; }
  });
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [subtaskCounts, setSubtaskCounts] = useState<Record<string, { total: number; done: number }>>({});
  const [taskNavStack, setTaskNavStack] = useState<Task[]>([]);

  // ── Saved views (localStorage) ────────────────────────────────────────────────
  type SavedView = { id: string; name: string; filters: { member: string; priority: string; search: string } };
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [namingView, setNamingView] = useState(false);
  const [viewNameInput, setViewNameInput] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("canopy_saved_views_tasks");
      if (stored) setSavedViews(JSON.parse(stored) as SavedView[]);
    } catch { /* ignore */ }
  }, []);

  function saveCurrentView() {
    if (!viewNameInput.trim()) return;
    const view: SavedView = {
      id: crypto.randomUUID(),
      name: viewNameInput.trim(),
      filters: { member: filterMember, priority: filterPriority, search },
    };
    const next = [...savedViews, view];
    setSavedViews(next);
    localStorage.setItem("canopy_saved_views_tasks", JSON.stringify(next));
    setNamedView(view.id);
    setNamingView(false);
    setViewNameInput("");
  }

  function setNamedView(id: string | null) {
    setActiveViewId(id);
    if (id === null) { return; }
    const v = savedViews.find((sv) => sv.id === id);
    if (!v) return;
    setFilterMember(v.filters.member);
    setFilterPriority(v.filters.priority);
    setSearch(v.filters.search);
  }

  function deleteView(id: string) {
    const next = savedViews.filter((v) => v.id !== id);
    setSavedViews(next);
    localStorage.setItem("canopy_saved_views_tasks", JSON.stringify(next));
    if (activeViewId === id) setActiveViewId(null);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Demo mode — use mock data, restoring any in-session mutations from sessionStorage
      const sp = getStoredProject();
      setProjectId(sp.id);
      setTeamMembers(USERS);
      try {
        const saved = sessionStorage.getItem("canopy_demo_tasks");
        setTasks(saved ? (JSON.parse(saved) as Task[]) : MOCK_TASKS);
      } catch {
        setTasks(MOCK_TASKS);
      }
      setLoading(false);
      return;
    }

    // Stale-fetch guard: if scope/subProjectId changes while a fetch is in flight,
    // the earlier response must not overwrite the later one.
    let cancelled = false;

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
        .select("*, user_profiles(name, avatar_initials, avatar_color, avatar_url, role)")
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
            avatarUrl: p?.avatar_url ?? undefined,
          } as User;
        }));
      }

      const { data, error } = await supabase
        .from("tasks")
        .select("*, task_assignees(user_id)")
        .eq("project_id", pid)
        .is("parent_id", null)
        .or("archived.is.null,archived.eq.false")
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) console.error("[Tasks] fetch error:", error);
      if (!error && data) {
        // Fetch subtask counts for progress bars
        const { data: scData } = await supabase
          .from("tasks")
          .select("parent_id, status")
          .eq("project_id", pid)
          .not("parent_id", "is", null)
          .or("archived.is.null,archived.eq.false");
        if (!cancelled && scData) {
          const counts: Record<string, { total: number; done: number }> = {};
          for (const r of scData) {
            const parentId = r.parent_id as string;
            if (!counts[parentId]) counts[parentId] = { total: 0, done: 0 };
            counts[parentId].total++;
            if (r.status === "done") counts[parentId].done++;
          }
          setSubtaskCounts(counts);
        }
        setTasks(data.map((row) => ({
          id: row.id as string,
          projectId: row.project_id as string,
          parentId: (row.parent_id as string | null) ?? undefined,
          title: row.title as string,
          description: row.description as string,
          status: row.status as TaskStatus,
          priority: row.priority as Task["priority"],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          assigneeIds: ((row.task_assignees as any[]) ?? []).map((ta) => ta.user_id as string),
          dueDate: row.due_date as string | undefined,
          scope: (row.scope as Task["scope"]) ?? "lab",
          subProjectId: (row.sub_project_id as string | null) ?? undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
          comments: (row.comments as Task["comments"]) ?? [],
          files: (row.files as Task["files"]) ?? [],
          links: (row.links as Task["links"]) ?? [],
        })));
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: reflect task INSERTs/UPDATEs/DELETEs from other users
  useEffect(() => {
    if (!projectId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel(`tasks:${projectId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (row.archived) return;
        if (row.parent_id) return; // subtasks are not shown on the board
        setTasks((prev) => {
          if (prev.find((t) => t.id === row.id)) return prev;
          return [{
            id: row.id as string, projectId: row.project_id as string,
            title: row.title as string, description: (row.description as string) ?? "",
            status: row.status as TaskStatus, priority: row.priority as Task["priority"],
            assigneeIds: [], dueDate: row.due_date as string | undefined,
            scope: (row.scope as Task["scope"]) ?? "lab",
            subProjectId: (row.sub_project_id as string | null) ?? undefined,
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

  // Persist task mutations (e.g. file uploads) across page navigations in demo mode
  useEffect(() => {
    if (!isSupabaseConfigured && !loading) {
      try { sessionStorage.setItem("canopy_demo_tasks", JSON.stringify(tasks)); } catch {}
    }
  }, [tasks, loading]);

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

  // ── Subtask navigation & promotion ───────────────────────────────────────────

  const handleOpenSubtask = useCallback((subtask: Task) => {
    setTaskNavStack(prev => [...prev, selectedTask!]);
    setSelectedTask(subtask);
  }, [selectedTask]);

  const handleNavigateBack = useCallback(() => {
    setTaskNavStack(prev => {
      const parent = prev[prev.length - 1] ?? null;
      setSelectedTask(parent);
      return prev.slice(0, -1);
    });
  }, []);

  const handlePromoteSubtask = useCallback((subtask: Task) => {
    setTasks(prev => {
      if (prev.find(t => t.id === subtask.id)) return prev;
      return [{ ...subtask, parentId: undefined }, ...prev];
    });
    setSubtaskCounts(prev => {
      if (!subtask.parentId) return prev;
      const curr = prev[subtask.parentId] ?? { total: 0, done: 0 };
      return {
        ...prev,
        [subtask.parentId]: {
          total: Math.max(0, curr.total - 1),
          done: subtask.status === "done" ? Math.max(0, curr.done - 1) : curr.done,
        },
      };
    });
  }, []);

  const handleUpdateTaskAssignees = useCallback(async (taskId: string, ids: string[]) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, assigneeIds: ids } : t));
    if (!isSupabaseConfigured) return;
    const { error: delErr } = await supabase.from("task_assignees").delete().eq("task_id", taskId);
    if (delErr) { console.error("[Tasks] assignee delete:", delErr); showToast("Failed to update assignees.", "error"); return; }
    if (ids.length > 0) {
      const { error: insErr } = await supabase.from("task_assignees").insert(ids.map((uid) => ({ task_id: taskId, user_id: uid })));
      if (insErr) { console.error("[Tasks] assignee insert:", insErr); showToast("Failed to update assignees.", "error"); }
    }
  }, []);

  const handleUpdateTaskDueDate = useCallback((taskId: string, date: string | undefined) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, dueDate: date } : t));
    if (!isSupabaseConfigured) return;
    supabase.from("tasks").update({ due_date: date ?? null }).eq("id", taskId)
      .then(({ error }) => { if (error) { console.error("[Tasks] due_date update:", error); showToast("Failed to update due date.", "error"); } });
  }, []);

  // Scope counts for sidebar (computed from full unfiltered task list)
  const scopeCounts = {
    all: tasks.length,
    personal: tasks.filter(t => t.scope === "personal").length,
    lab: tasks.filter(t => t.scope === "lab" || !t.scope).length,
  };
  const projectTaskCounts: Record<string, number> = {};
  for (const sp of subProjects) {
    projectTaskCounts[sp.id] = tasks.filter(t => t.scope === "project" && t.subProjectId === sp.id).length;
  }

  const isSubProjectScope = taskScope !== "all" && taskScope !== "personal" && taskScope !== "lab";

  const sidebarSections: ScopeSection[] = [
    { id: "all", label: "All", color: "#1B2E4B", icon: <LayoutGrid size={17} />, count: scopeCounts.all, isActive: taskScope === "all", onClick: () => setTaskScope("all") },
    { id: "personal", label: "Personal", color: "#6366f1", icon: <UserIcon size={17} />, count: scopeCounts.personal, isActive: taskScope === "personal", onClick: () => setTaskScope("personal") },
    { id: "lab", label: "Lab", color: "#0ea5e9", icon: <Users size={17} />, count: scopeCounts.lab, isActive: taskScope === "lab", onClick: () => setTaskScope("lab") },
  ];

  const scopedTasks = tasks.filter(t => {
    if (taskScope === "all") return true;
    if (taskScope === "personal") return t.scope === "personal";
    if (taskScope === "lab") return t.scope === "lab" || !t.scope;
    return t.scope === "project" && t.subProjectId === taskScope;
  });

  const filteredTasks = scopedTasks.filter((t) => {
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
      <div className="px-4 md:px-6 pt-3 pb-0" style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-3 mb-2">
          <h1 style={{ fontWeight: 700, fontSize: 20, color: "var(--color-navy)", margin: 0, flex: 1 }}>Tasks</h1>
          <div className="flex items-center rounded-lg p-0.5 shrink-0" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
            {(["board", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setView(v); setSelectedTask(null); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all"
                style={{ fontSize: 12, fontWeight: 600, backgroundColor: view === v ? "var(--color-navy)" : "transparent", color: view === v ? "#fff" : "var(--color-secondary)", minHeight: 32, minWidth: 40, justifyContent: "center" }}
              >
                {v === "board" ? <LayoutGrid size={13} /> : <List size={13} />}
                <span className="hidden sm:inline">{v === "board" ? "Board" : "List"}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setModalState({ mode: "add", status: "todo" })}
            className="flex items-center gap-1.5 px-3 md:px-4 shrink-0 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-navy)", color: "#fff", fontSize: 12, fontWeight: 600, borderRadius: 7, border: "none", cursor: "pointer", height: 36 }}
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Add Task</span>
          </button>
        </div>

        {/* Saved views strip */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => { setActiveViewId(null); setSearch(""); setFilterMember("all"); setFilterPriority("all"); }}
            style={{
              fontSize: 12, fontWeight: activeViewId === null ? 600 : 400,
              color: activeViewId === null ? "var(--color-navy)" : "var(--color-secondary)",
              padding: "4px 10px", border: "none", background: "none", cursor: "pointer",
              borderBottom: activeViewId === null ? "2px solid var(--color-navy)" : "2px solid transparent",
              marginBottom: -1, whiteSpace: "nowrap",
            }}
          >
            Default
          </button>
          {savedViews.map((v) => (
            <div key={v.id} className="relative group/viewtab flex items-center" style={{ marginBottom: -1 }}>
              <button
                onClick={() => setNamedView(v.id)}
                style={{
                  fontSize: 12, fontWeight: activeViewId === v.id ? 600 : 400,
                  color: activeViewId === v.id ? "var(--color-navy)" : "var(--color-secondary)",
                  padding: "4px 10px", border: "none", background: "none", cursor: "pointer",
                  borderBottom: activeViewId === v.id ? "2px solid var(--color-navy)" : "2px solid transparent",
                  whiteSpace: "nowrap",
                  paddingRight: 22,
                }}
              >
                {v.name}
              </button>
              <button
                onClick={() => deleteView(v.id)}
                className="absolute right-1 opacity-0 group-hover/viewtab:opacity-100 transition-opacity"
                style={{ padding: 2, border: "none", background: "none", cursor: "pointer", lineHeight: 1 }}
                aria-label="Delete view"
              >
                <XIcon size={10} color="var(--color-secondary)" />
              </button>
            </div>
          ))}
          {namingView ? (
            <form
              onSubmit={(e) => { e.preventDefault(); saveCurrentView(); }}
              className="flex items-center gap-1"
            >
              <input
                autoFocus
                value={viewNameInput}
                onChange={(e) => setViewNameInput(e.target.value)}
                placeholder="View name…"
                onKeyDown={(e) => { if (e.key === "Escape") { setNamingView(false); setViewNameInput(""); } }}
                style={{ fontSize: 12, height: 26, padding: "0 8px", border: "1px solid var(--color-border)", borderRadius: 5, outline: "none", width: 120 }}
              />
              <button type="submit" style={{ fontSize: 11, fontWeight: 600, color: "var(--color-navy)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>Save</button>
              <button type="button" onClick={() => { setNamingView(false); setViewNameInput(""); }} style={{ fontSize: 11, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}>Cancel</button>
            </form>
          ) : (
            <button
              onClick={() => setNamingView(true)}
              style={{ fontSize: 12, color: "var(--color-secondary)", padding: "4px 8px", border: "none", background: "none", cursor: "pointer", whiteSpace: "nowrap", marginBottom: -1 }}
              title="Save current filters as a view"
            >
              + Save view
            </button>
          )}
        </div>

        {/* Search + filters row */}
        <div className="flex items-center gap-2 py-2 flex-wrap">
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

      {/* Content = ScopeSidebar + Board/List */}
      <div className="flex flex-1 overflow-hidden">
        <ScopeSidebar
          sections={sidebarSections}
          subProjects={subProjects}
          selectedSubProjectId={isSubProjectScope ? taskScope : null}
          projectCounts={projectTaskCounts}
          onSelectSubProject={(id) => setTaskScope(id)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(c => {
            const next = !c;
            try { localStorage.setItem("canopy_tasks_sidebar_collapsed", String(next)); } catch {}
            return next;
          })}
        />
        <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading && (
          <p style={{ fontSize: 13, color: "var(--color-secondary)", padding: 8 }}>Loading tasks…</p>
        )}
        {!loading && view === "board" ? (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="grid gap-4 md:gap-5" style={{ gridTemplateColumns: "repeat(4, minmax(210px, 1fr))", alignItems: "start", minWidth: 880 }}>
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
                    subtaskCounts={subtaskCounts}
                    showLabBadge={false}
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
                    showLabBadge={false}
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
                  {["", "Title", "Status", "Priority", "Assignees", "Due Date", "Subtasks", ""].map((col, i) => (
                    <th key={i} className={i === 0 ? "pl-5 py-3 pr-2" : i === 7 ? "pr-5 py-3" : "py-3 pr-3"}
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
                    onToggleDone={() => moveTask(task.id, task.status === "done" ? "todo" : "done")}
                    onMoveStatus={(s) => moveTask(task.id, s)}
                    onUpdateAssignees={(ids) => handleUpdateTaskAssignees(task.id, ids)}
                    onUpdateDueDate={(d) => handleUpdateTaskDueDate(task.id, d)}
                    teamMembers={teamMembers}
                    subtaskProgress={subtaskCounts[task.id]}
                    showLabBadge={false}
                  />
                ))}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: "8px 0" }}>
                      <EmptyState
                        variant="tasks"
                        title="No tasks match your filters"
                        description="Try adjusting the search or filter options above."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}
        </div>
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          parentTask={taskNavStack.length > 0 ? taskNavStack[taskNavStack.length - 1] : undefined}
          onClose={() => { setSelectedTask(null); setTaskNavStack([]); }}
          onNavigateBack={taskNavStack.length > 0 ? handleNavigateBack : undefined}
          onUpdateStatus={(status) => moveTask(selectedTask.id, status)}
          onUpdateTask={(updates) => updateTask(selectedTask.id, updates)}
          onDeleteTask={deleteTask}
          onOpenSubtask={handleOpenSubtask}
          onPromoteSubtask={handlePromoteSubtask}
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
          scope={taskScope === "personal" ? "personal" : isSubProjectScope ? "project" : "lab"}
          subProjectId={isSubProjectScope ? taskScope : null}
        />
      )}

      <Toast />
    </div>
  );
}
