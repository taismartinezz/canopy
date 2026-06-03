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
import {
  LayoutGrid, List, Search, ChevronDown, Plus, X, Send,
  Paperclip, Download, Trash2, FileText, File, Image, Table,
  ExternalLink, MoreHorizontal,
} from "lucide-react";
import { TASKS, USERS, CURRENT_USER_ID, formatRelativeTime, formatDate, formatFileSize, getUser } from "@/lib/mock-data";
import type { Task, TaskStatus, TaskPriority, User } from "@/types";
import Avatar from "@/components/ui/Avatar";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { label: string; dot: string; pill: string }> = {
  todo:        { label: "To Do",       dot: "#64748B", pill: "#64748B" },
  in_progress: { label: "In Progress", dot: "#1B2E4B", pill: "#1B2E4B" },
  in_review:   { label: "In Review",   dot: "#A0622A", pill: "#A0622A" },
  done:        { label: "Done",        dot: "#2E7D52", pill: "#2E7D52" },
};

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "in_review", "done"];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; symbol: string }> = {
  high:   { label: "High",   color: "#C0392B", bg: "#FDDCDC", symbol: "▲" },
  medium: { label: "Medium", color: "#A0622A", bg: "#FDEFD4", symbol: "●" },
  low:    { label: "Low",    color: "#2E7D52", bg: "#D4EDE0", symbol: "▼" },
};

// ── Priority badge ────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5"
      style={{
        backgroundColor: cfg.bg,
        color: cfg.color,
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 4,
        fontFamily: "var(--font-roboto)",
      }}
    >
      {cfg.symbol} {cfg.label}
    </span>
  );
}

// ── Assignee avatars (stacked) ────────────────────────────────────────────────

function AssigneeStack({ ids, size = 22 }: { ids: string[]; size?: number }) {
  const users = ids.map((id) => USERS.find((u) => u.id === id)).filter(Boolean) as User[];
  if (users.length === 0) return null;
  return (
    <div className="flex items-center">
      {users.slice(0, 4).map((user, i) => (
        <div key={user.id} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: 4 - i, position: "relative" }}>
          <Avatar user={user} size={size} />
        </div>
      ))}
      {users.length > 4 && (
        <span
          style={{
            marginLeft: -6,
            width: size,
            height: size,
            borderRadius: "50%",
            backgroundColor: "var(--color-border)",
            fontSize: 10,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-secondary)",
          }}
        >
          +{users.length - 4}
        </span>
      )}
    </div>
  );
}

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

// ── File type icon ────────────────────────────────────────────────────────────

function FileIcon({ type }: { type: string }) {
  if (type === "pdf") return <FileText size={14} color="#C0392B" />;
  if (type === "image") return <Image size={14} color="#2E7D52" />;
  if (type === "spreadsheet") return <Table size={14} color="#1B2E4B" />;
  return <File size={14} color="var(--color-secondary)" />;
}

// ── Task detail panel ─────────────────────────────────────────────────────────

function TaskDetailPanel({ task, onClose, onUpdateStatus }: {
  task: Task;
  onClose: () => void;
  onUpdateStatus: (status: TaskStatus) => void;
}) {
  const [activeTab, setActiveTab] = useState<"comments" | "files">("comments");
  const [commentText, setCommentText] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const cfg = STATUS_CONFIG[task.status];
  const currentUser = getUser(CURRENT_USER_ID)!;

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30"
        style={{ backgroundColor: "var(--color-navy-scrim)" }}
        onClick={onClose}
      />

      {/* Panel — right drawer on desktop, full-screen slide-up on mobile */}
      <div
        className={isMobile ? "animate-slide-in-bottom" : "animate-slide-in"}
        style={isMobile ? {
          position: "fixed",
          inset: 0,
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--color-surface)",
        } : {
          position: "fixed",
          right: 0,
          top: 0,
          height: "100%",
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          width: 480,
          backgroundColor: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "-4px 0 20px rgba(27,46,75,0.12)",
        }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="px-2.5 py-0.5"
                  style={{
                    backgroundColor: `${cfg.dot}20`,
                    color: cfg.dot,
                    borderRadius: 5,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {cfg.label}
                </span>
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-lora)",
                  fontWeight: 600,
                  fontSize: 17,
                  color: "var(--color-body)",
                  lineHeight: 1.3,
                  margin: 0,
                }}
              >
                {task.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)] transition-colors shrink-0"
              style={{ width: 44, height: 44 }}
              aria-label="Close panel"
            >
              <X size={18} color="var(--color-secondary)" />
            </button>
          </div>

          {/* 2x2 metadata grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4">
            {/* Status */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Status
              </p>
              <select
                value={task.status}
                onChange={(e) => onUpdateStatus(e.target.value as TaskStatus)}
                className="cursor-pointer"
                style={{
                  fontSize: 13,
                  color: cfg.dot,
                  backgroundColor: `${cfg.dot}18`,
                  border: "none",
                  borderRadius: 5,
                  padding: "3px 8px",
                  fontWeight: 600,
                  fontFamily: "var(--font-roboto)",
                }}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Priority
              </p>
              <PriorityBadge priority={task.priority} />
            </div>

            {/* Due date */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Due Date
              </p>
              <p style={{ fontSize: 13, color: "var(--color-body)" }}>
                {task.dueDate ? formatDate(task.dueDate) : "No due date"}
              </p>
            </div>

            {/* Assignees */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Assignees
              </p>
              <div className="flex flex-wrap gap-1.5">
                {task.assigneeIds.length === 0 ? (
                  <span style={{ fontSize: 13, color: "var(--color-secondary)" }}>Unassigned</span>
                ) : (
                  task.assigneeIds.map((id) => {
                    const user = getUser(id);
                    if (!user) return null;
                    return (
                      <span
                        key={id}
                        className="flex items-center gap-1.5 px-2 py-1"
                        style={{
                          backgroundColor: "var(--color-canvas)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 20,
                          fontSize: 12,
                        }}
                      >
                        <Avatar user={user} size={16} />
                        {user.name.split(" ")[0]}
                        <button className="ml-0.5 hover:text-error" style={{ color: "var(--color-secondary)" }}>×</button>
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.6 }}>
              {task.description}
            </p>
          </div>
        )}

        {/* Linked docs */}
        {task.links.length > 0 && (
          <div className="px-6 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Linked Documents
            </p>
            <div className="space-y-2">
              {task.links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[rgba(27,46,75,0.04)] transition-colors"
                  style={{
                    backgroundColor: "var(--color-canvas)",
                    border: "1px solid var(--color-border)",
                    textDecoration: "none",
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.type === "google_doc" ? (
                    <FileText size={14} color="#1B2E4B" />
                  ) : (
                    <Table size={14} color="#1B2E4B" />
                  )}
                  <span style={{ fontSize: 13, color: "var(--color-body)", flex: 1 }}>{link.title}</span>
                  <ExternalLink size={12} color="var(--color-secondary)" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex px-6" style={{ borderBottom: "1px solid var(--color-border)" }}>
          {(["comments", "files"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="py-3 mr-5 transition-colors"
              style={{
                fontSize: 13,
                fontWeight: activeTab === tab ? 600 : 400,
                color: activeTab === tab ? "var(--color-navy)" : "var(--color-secondary)",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid var(--color-navy)" : "2px solid transparent",
                cursor: "pointer",
              }}
            >
              {tab === "comments" ? "Comments" : (
                <>
                  Files
                  {task.files.length > 0 && (
                    <span
                      className="ml-1.5 px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: "var(--color-canvas)",
                        border: "1px solid var(--color-border)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--color-secondary)",
                      }}
                    >
                      {task.files.length}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "comments" && (
            <div className="flex flex-col h-full">
              <div className="flex-1 px-6 py-4 space-y-4">
                {task.comments.length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No comments yet.</p>
                )}
                {task.comments.map((comment) => {
                  const author = getUser(comment.authorId);
                  if (!author) return null;
                  return (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar user={author} size={26} className="mt-1 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)" }}>
                            {author.name}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--color-secondary)" }}>
                            {formatRelativeTime(comment.createdAt)}
                          </span>
                        </div>
                        <div
                          style={{
                            backgroundColor: "var(--color-canvas)",
                            border: "1px solid var(--color-border)",
                            borderRadius: "4px 12px 12px 12px",
                            padding: "10px 14px",
                            fontSize: 13,
                            color: "var(--color-body)",
                            lineHeight: 1.5,
                          }}
                        >
                          {comment.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comment input */}
              <div
                className="px-4 py-3 flex gap-3 items-end"
                style={{ borderTop: "1px solid var(--color-border)" }}
              >
                <Avatar user={currentUser} size={26} className="mb-0.5 shrink-0" />
                <div className="flex-1 relative">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Leave a comment..."
                    rows={2}
                    className="w-full resize-none"
                    style={{
                      fontSize: 13,
                      color: "var(--color-body)",
                      backgroundColor: "var(--color-canvas)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontFamily: "var(--font-roboto)",
                      outline: "none",
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        setCommentText("");
                      }
                    }}
                  />
                </div>
                <button
                  disabled={!commentText.trim()}
                  className="px-3 py-2 flex items-center gap-1.5 rounded-lg transition-opacity disabled:opacity-40"
                  style={{
                    backgroundColor: "var(--color-navy)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 7,
                    border: "none",
                    cursor: commentText.trim() ? "pointer" : "default",
                    minHeight: 36,
                  }}
                >
                  <Send size={13} /> Send
                </button>
              </div>
            </div>
          )}

          {activeTab === "files" && (
            <div className="px-6 py-4">
              {task.files.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-secondary)", marginBottom: 16 }}>
                  No files attached yet.
                </p>
              ) : (
                <div className="space-y-2 mb-4">
                  {task.files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                      style={{
                        backgroundColor: "var(--color-canvas)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <FileIcon type={file.type} />
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 13, color: "var(--color-body)", fontWeight: 500 }}>
                          {file.name}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--color-secondary)" }}>
                          {formatFileSize(file.size)} · uploaded by{" "}
                          {getUser(file.uploaderId)?.name.split(" ")[0]}
                        </p>
                      </div>
                      <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-[rgba(27,46,75,0.06)] transition-colors">
                        <Download size={13} color="var(--color-navy)" />
                      </button>
                      {(file.uploaderId === CURRENT_USER_ID) && (
                        <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-[rgba(27,46,75,0.06)] transition-colors">
                          <Trash2 size={13} color="var(--color-error)" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Upload area */}
              <div
                className="flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer transition-colors hover:bg-[rgba(27,46,75,0.03)]"
                style={{
                  border: "2px dashed var(--color-border)",
                  borderRadius: 8,
                  padding: "24px 16px",
                  textAlign: "center",
                }}
              >
                <Paperclip size={18} color="var(--color-secondary)" />
                <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>
                  Drop files here or click to upload
                </p>
                <p style={{ fontSize: 11, color: "var(--color-secondary)" }}>
                  PDF, DOCX, images, spreadsheets
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
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
