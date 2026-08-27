"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal } from "lucide-react";
import { formatDate } from "@/lib/mock-data";
import type { Task, TaskStatus, User } from "@/types";
import {
  PriorityBadge, AssigneeStack, STATUS_CONFIG, STATUS_ORDER,
} from "@/components/tasks/TaskDetailPanel";

export function TaskCard({
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
      style={{ ...style, overflow: "hidden", borderRadius: 8 }}
      {...attributes}
      {...listeners}
      className="group relative cursor-pointer"
      onClick={onClick}
    >
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          padding: "10px 12px",
          overflow: "hidden",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-body)", lineHeight: 1.35, marginBottom: 8 }}>
          {task.title}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span style={{ fontSize: 12, color: "var(--color-secondary)", flexShrink: 0 }}>
            {task.dueDate ? formatDate(task.dueDate) : "-"}
          </span>
          <div className="flex items-center gap-1.5" style={{ overflow: "hidden" }}>
            {showLabBadge && task.scope === "lab" && (
              <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: "rgba(27,46,75,0.08)", color: "var(--color-navy)", padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap" }}>
                Lab
              </span>
            )}
            <PriorityBadge priority={task.priority} />
            <AssigneeStack ids={task.assigneeIds} size={20} users={teamMembers} />
          </div>
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
