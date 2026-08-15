"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
  useDraggable, useDroppable,
} from "@dnd-kit/core";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { formatDate, getUser } from "@/lib/mock-data";
import type { Task, TaskStatus, User } from "@/types";
import { STATUS_CONFIG, STATUS_ORDER, AssigneeStack } from "@/components/tasks/TaskDetailPanel";
import ClientOnly from "@/components/ui/ClientOnly";
import { Card, CardHeader } from "./DashboardCard";
import { SkeletonLine } from "./TeamActivityWidget";

const PRIORITY_COLORS = { high: "#C0392B", medium: "#A0622A", low: "#2E7D52" };
const PRIORITY_SYMBOLS = { high: "▲", medium: "●", low: "▼" };
const PRIORITY_BG = { high: "#FDDCDC", medium: "#FDEFD4", low: "#D4EDE0" };

function MiniTaskCardContent({ task, teamMembers }: { task: Task; teamMembers: User[] }) {
  const priority   = PRIORITY_COLORS[task.priority];
  const priorityBg = PRIORITY_BG[task.priority];
  const symbol     = PRIORITY_SYMBOLS[task.priority];
  const assignees  = task.assigneeIds
    .map((id) => teamMembers.find((u) => u.id === id) ?? getUser(id))
    .filter(Boolean) as User[];

  void assignees;

  return (
    <div className="p-3">
      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-body)", lineHeight: 1.35 }}>{task.title}</p>
      <div className="flex items-center justify-between mt-2">
        <span style={{ fontSize: 12, color: "var(--color-secondary)" }}>{task.dueDate ? formatDate(task.dueDate) : "-"}</span>
        <span className="px-2 py-0.5" style={{ backgroundColor: priorityBg, color: priority, fontSize: 11, fontWeight: 600, borderRadius: 4 }}>
          {symbol} {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
        <AssigneeStack ids={task.assigneeIds} size={20} users={teamMembers} />
      </div>
    </div>
  );
}

function DraggableMiniTaskCard({ task, onClick, isMobile, teamMembers }: { task: Task; onClick: () => void; isMobile: boolean; teamMembers: User[] }) {
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
      <MiniTaskCardContent task={task} teamMembers={teamMembers} />
    </div>
  );
}

function DroppableColumn({ status, displayTasks, total, isMobile, onTaskClick, onAddTask, teamMembers }: {
  status: TaskStatus; displayTasks: Task[]; total: number;
  isMobile: boolean; onTaskClick: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
  teamMembers: User[];
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
          <DraggableMiniTaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} isMobile={isMobile} teamMembers={teamMembers} />
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

export function KanbanPreview({
  tasks, onTaskClick, onMoveTask, onAddTask, teamMembers, loading,
}: {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onMoveTask: (taskId: string, status: TaskStatus) => void;
  onAddTask: (status: TaskStatus) => void;
  teamMembers: User[];
  loading?: boolean;
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

  if (loading) {
    return (
      <Card>
        <CardHeader title="Tasks" action={
          <Link href="/tasks" className="flex items-center gap-1 transition-opacity hover:opacity-70" style={{ fontSize: 12, color: "var(--color-navy)", fontWeight: 600, textDecoration: "none" }}>
            See all <ChevronRight size={13} />
          </Link>
        } />
        <div className="p-4 md:p-5 grid gap-4" style={{ gridTemplateColumns: "repeat(4, minmax(240px, 1fr))", overflowX: "auto" }}>
          {STATUS_ORDER.map((status) => {
            const cfg = STATUS_CONFIG[status];
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-body)" }}>{cfg.label}</span>
                </div>
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="p-3 rounded-lg animate-pulse" style={{ border: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)" }}>
                      <SkeletonLine width="80%" height={13} />
                      <div className="flex items-center justify-between mt-2">
                        <SkeletonLine width="40%" height={11} />
                        <SkeletonLine width="25%" height={11} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

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
      <div style={{ overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch" }}>
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
                  teamMembers={teamMembers}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask && (
                <div style={{ opacity: 0.9, backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, boxShadow: "0 8px 24px rgba(27,46,75,0.18)" }}>
                  <MiniTaskCardContent task={activeTask} teamMembers={teamMembers} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </ClientOnly>
      </div>
    </Card>
  );
}
