"use client";

import { useState, useCallback } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LayoutGrid, List, Search, Plus, MoreHorizontal } from "lucide-react";
import { TASKS, formatDate } from "@/lib/mock-data";
import type { Task, TaskStatus } from "@/types";
import Avatar from "@/components/ui/Avatar";
import TaskDetailPanel, {
  STATUS_CONFIG, STATUS_ORDER, PriorityBadge, AssigneeStack,
} from "@/components/tasks/TaskDetailPanel";

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onClick,
  onMoveStatus,
  isDragging = false,
}: {
  task: Task;
  onClick: () => void;
  onMoveStatus: (status: TaskStatus) => void;
  isDragging?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
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
          <AssigneeStack ids={task.assigneeIds} size={20} />
        </div>
      </div>

      {/* ⋯ context menu — appears on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded"
        style={{ backgroundColor: "rgba(255,255,255,0.9)" }}
        aria-label="Task options"
      >
        <MoreHorizontal size={14} color="var(--color-secondary)" />
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 top-8 z-20 animate-fade-in"
          style={{
            width: 180,
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            boxShadow: "var(--shadow-card)",
          }}
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
            className="w-full text-left px-3 py-2 hover:bg-[rgba(27,46,75,0.06)] transition-colors"
            style={{ fontSize: 12, color: "var(--color-body)", minHeight: 36 }}
            onClick={() => setMenuOpen(false)}
          >
            Edit task
          </button>
          <button
            className="w-full text-left px-3 py-2 hover:bg-[rgba(27,46,75,0.06)] transition-colors"
            style={{ fontSize: 12, color: "var(--color-error)", minHeight: 36 }}
            onClick={() => setMenuOpen(false)}
          >
            Delete task
          </button>
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
}: {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
}) {
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="flex flex-col" style={{ minWidth: 0, flex: 1 }}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
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
          {tasks.length}
        </span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 flex-1">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              onMoveStatus={(s) => onMoveTask(task.id, s)}
            />
          ))}
        </div>
      </SortableContext>

      <button
        className="flex items-center gap-1.5 mt-3 px-1 py-1 transition-opacity hover:opacity-70"
        style={{ fontSize: 12, color: "var(--color-navy)", minHeight: 36 }}
      >
        <Plus size={13} /> Add task
      </button>
    </div>
  );
}

// ── List view row ─────────────────────────────────────────────────────────────

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer transition-colors hover:bg-[#F8FAFF]"
      style={{
        opacity: task.status === "done" ? 0.7 : 1,
      }}
    >
      <td className="pl-5 py-2.5 pr-2">
        <input
          type="checkbox"
          checked={task.status === "done"}
          readOnly
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
      <td className="py-2.5 pr-3">
        <PriorityBadge priority={task.priority} />
      </td>
      <td className="py-2.5 pr-3">
        <AssigneeStack ids={task.assigneeIds} size={22} />
      </td>
      <td className="py-2.5 pr-5" style={{ fontSize: "12.4px", color: "var(--color-secondary)", whiteSpace: "nowrap" }}>
        {task.dueDate ? formatDate(task.dueDate) : "—"}
      </td>
      <td className="py-2.5 pr-5">
        <button
          onClick={(e) => e.stopPropagation()}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[rgba(27,46,75,0.06)]"
        >
          <MoreHorizontal size={13} color="var(--color-secondary)" />
        </button>
      </td>
    </tr>
  );
}

// ── Tasks page ────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [view, setView] = useState<"board" | "list">("board");
  const [tasks, setTasks] = useState<Task[]>(TASKS);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

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
      const overTask = prev.find((t) => t.id === over.id);
      if (!activeTask || !overTask) return prev;

      if (activeTask.status !== overTask.status) {
        return prev.map((t) =>
          t.id === active.id ? { ...t, status: overTask.status } : t
        );
      }
      return prev;
    });
  }, []);

  const moveTask = useCallback((taskId: string, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => prev ? { ...prev, status } : null);
    }
  }, [selectedTask]);

  const filteredTasks = tasks.filter((t) =>
    search === "" || t.title.toLowerCase().includes(search.toLowerCase())
  );

  const tasksByStatus = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, filteredTasks.filter((t) => t.status === s)])
  ) as Record<TaskStatus, Task[]>;

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "var(--font-roboto)" }}>

      {/* Toolbar — row 1: title + view toggle + add button */}
      <div
        className="px-4 md:px-6 pt-3 pb-2"
        style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3 mb-2">
          <h1 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 22, color: "var(--color-navy)", margin: 0, flex: 1 }}>
            Tasks
          </h1>
          {/* View toggle */}
          <div
            className="flex items-center rounded-lg p-0.5 shrink-0"
            style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}
          >
            {(["board", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: view === v ? "var(--color-navy)" : "transparent",
                  color: view === v ? "#fff" : "var(--color-secondary)",
                  minHeight: 36,
                  minWidth: 44,
                  justifyContent: "center",
                }}
              >
                {v === "board" ? <LayoutGrid size={14} /> : <List size={14} />}
                <span className="hidden sm:inline">{v === "board" ? "Board" : "List"}</span>
              </button>
            ))}
          </div>
          <button
            className="flex items-center gap-1.5 px-3 md:px-4 py-2 shrink-0 transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--color-navy)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Add Task</span>
          </button>
        </div>
        {/* Toolbar row 2: search (always visible on its own row) */}
        <div className="pb-2 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" color="var(--color-secondary)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            style={{
              width: "100%",
              paddingLeft: 32,
              paddingRight: 12,
              height: 36,
              border: "1px solid var(--color-border)",
              borderRadius: 7,
              fontSize: 13,
              fontFamily: "var(--font-roboto)",
              backgroundColor: "var(--color-canvas)",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {view === "board" ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
          {/* Horizontal scroll on mobile, grid on desktop */}
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="grid gap-4 md:gap-5" style={{ gridTemplateColumns: "repeat(4, minmax(240px, 1fr))", alignItems: "start", minWidth: "min(100%, 960px)" }}>
              {STATUS_ORDER.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={tasksByStatus[status]}
                  onTaskClick={setSelectedTask}
                  onMoveTask={moveTask}
                />
              ))}
            </div>
          </div>{/* end scroll wrapper */}
            <DragOverlay>
              {activeTask && (
                <div style={{ opacity: 0.85, transform: "rotate(2deg)" }}>
                  <TaskCard
                    task={activeTask}
                    onClick={() => {}}
                    onMoveStatus={() => {}}
                    isDragging
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              overflow: "auto",
            }}
          >
            <table className="border-collapse" style={{ width: "100%", minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {["", "Title", "Status", "Priority", "Assignees", "Due Date", ""].map((col, i) => (
                    <th
                      key={i}
                      className={i === 0 ? "pl-5 py-3 pr-2" : i === 6 ? "pr-5 py-3" : "py-3 pr-3"}
                      style={{
                        textAlign: "left",
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--color-secondary)",
                        fontFamily: "var(--font-roboto)",
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task, i) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onClick={() => setSelectedTask(task)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdateStatus={(status) => {
            moveTask(selectedTask.id, status);
            setSelectedTask((prev) => prev ? { ...prev, status } : null);
          }}
        />
      )}
    </div>
  );
}
