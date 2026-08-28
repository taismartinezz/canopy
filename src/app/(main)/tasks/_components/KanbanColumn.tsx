"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import type { Task, TaskStatus, User } from "@/types";
import { STATUS_CONFIG } from "@/components/tasks/TaskDetailPanel";
import EmptyState from "@/components/ui/EmptyState";
import { TaskCard } from "./TaskCard";

export function KanbanColumn({
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
  subtaskData = {},
  onToggleSubtask,
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
  subtaskData?: Record<string, Task[]>;
  onToggleSubtask?: (taskId: string, subtaskId: string, done: boolean) => void;
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
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-secondary)" }}>
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
                variant={status === "done" ? "done" : "column"}
                title={status === "done" ? "No completed tasks" : "No tasks yet"}
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
                subtasks={subtaskData[task.id]}
                onToggleSubtask={onToggleSubtask ? (subId, done) => onToggleSubtask(task.id, subId, done) : undefined}
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
