"use client";

import { useState, useEffect, useRef } from "react";
import {
  X, Send, Paperclip, Download, Trash2, FileText, File, Image, Table,
  ExternalLink, Plus, Copy, MoreHorizontal,
} from "lucide-react";
import {
  CURRENT_USER_ID, formatRelativeTime, formatDate, formatFileSize, getUser,
} from "@/lib/mock-data";
import type { Task, TaskStatus, TaskPriority, User, TaskComment, TaskFile } from "@/types";
import Avatar from "@/components/ui/Avatar";
import { showToast } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase";

// ── Shared config ─────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<TaskStatus, { label: string; dot: string }> = {
  todo:        { label: "To Do",       dot: "#64748B" },
  in_progress: { label: "In Progress", dot: "#1B2E4B" },
  in_review:   { label: "In Review",   dot: "#A0622A" },
  done:        { label: "Done",        dot: "#2E7D52" },
};

export const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "in_review", "done"];

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; symbol: string }> = {
  high:   { label: "High",   color: "#C0392B", bg: "#FDDCDC", symbol: "▲" },
  medium: { label: "Medium", color: "#A0622A", bg: "#FDEFD4", symbol: "●" },
  low:    { label: "Low",    color: "#2E7D52", bg: "#D4EDE0", symbol: "▼" },
};

// ── Shared sub-components ─────────────────────────────────────────────────────

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
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

export function AssigneeStack({ ids, size = 22, users = [] }: { ids: string[]; size?: number; users?: User[] }) {
  const resolved = ids.map((id) => users.find((u: User) => u.id === id)).filter(Boolean) as User[];
  if (resolved.length === 0) return null;
  return (
    <div className="flex items-center">
      {resolved.slice(0, 4).map((user, i) => (
        <div key={user.id} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: 4 - i, position: "relative" }}>
          <Avatar user={user} size={size} />
        </div>
      ))}
      {resolved.length > 4 && (
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
          +{resolved.length - 4}
        </span>
      )}
    </div>
  );
}

export function FileIcon({ type }: { type: string }) {
  if (type === "pdf") return <FileText size={14} color="#C0392B" />;
  if (type === "image") return <Image size={14} color="#2E7D52" />;
  if (type === "spreadsheet") return <Table size={14} color="#1B2E4B" />;
  return <File size={14} color="var(--color-secondary)" />;
}

function guessFileType(name: string): TaskFile["type"] {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "svg", "webp", "avif"].includes(ext)) return "image";
  if (["xlsx", "xls", "csv"].includes(ext)) return "spreadsheet";
  if (["docx", "doc"].includes(ext)) return "docx";
  return "other";
}

// ── Task detail panel ─────────────────────────────────────────────────────────

export default function TaskDetailPanel({
  task,
  onClose,
  onUpdateStatus,
  onUpdateTask,
  onDeleteTask,
  onDuplicateTask,
  teamMembers = [],
  currentUserId = "",
}: {
  task: Task;
  onClose: () => void;
  onUpdateStatus: (status: TaskStatus) => void;
  onUpdateTask?: (updates: Partial<Task>) => void;
  onDeleteTask?: (taskId: string) => void;
  onDuplicateTask?: (task: Task) => void;
  teamMembers?: User[];
  currentUserId?: string;
}) {
  const [activeTab, setActiveTab] = useState<"comments" | "files">("comments");
  const [commentText, setCommentText] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [addAssigneeOpen, setAddAssigneeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Local copies — initialized from task, mutated locally & pushed to parent
  const [localComments, setLocalComments] = useState<TaskComment[]>(task.comments);
  const [localFiles, setLocalFiles]       = useState<TaskFile[]>(task.files);
  const [localAssigneeIds, setLocalAssigneeIds] = useState<string[]>(task.assigneeIds);

  // Sync if parent updates the task (e.g. task switched)
  useEffect(() => { setLocalComments(task.comments); }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLocalFiles(task.files); },       [task.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLocalAssigneeIds(task.assigneeIds); }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function lookupUser(id: string): User | undefined {
    return teamMembers.find((u) => u.id === id) ?? getUser(id);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cfg = STATUS_CONFIG[task.status];
  const currentUser = lookupUser(currentUserId || CURRENT_USER_ID) ?? teamMembers[0];

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

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  // ── Comment actions ───────────────────────────────────────────────────────

  function handleSendComment() {
    const text = commentText.trim();
    if (!text) return;
    const newComment: TaskComment = {
      id: crypto.randomUUID(),
      authorId: currentUserId || CURRENT_USER_ID,
      content: text,
      createdAt: new Date().toISOString(),
    };
    const updated = [...localComments, newComment];
    setLocalComments(updated);
    onUpdateTask?.({ comments: updated });
    setCommentText("");
  }

  // ── File actions ──────────────────────────────────────────────────────────

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const newFile: TaskFile = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      uploaderId: currentUserId || CURRENT_USER_ID,
      uploadedAt: new Date().toISOString(),
      url: "",
      type: guessFileType(file.name),
    };
    const updated = [...localFiles, newFile];
    setLocalFiles(updated);
    onUpdateTask?.({ files: updated });
    e.target.value = "";
  }

  function handleDeleteFile(id: string) {
    if (!window.confirm("Remove this file?")) return;
    const updated = localFiles.filter((f) => f.id !== id);
    setLocalFiles(updated);
    onUpdateTask?.({ files: updated });
  }

  // ── Assignee actions ──────────────────────────────────────────────────────

  function removeAssignee(id: string) {
    const updated = localAssigneeIds.filter((x) => x !== id);
    setLocalAssigneeIds(updated);
    onUpdateTask?.({ assigneeIds: updated });
  }

  function addAssignee(id: string) {
    const updated = [...localAssigneeIds, id];
    setLocalAssigneeIds(updated);
    onUpdateTask?.({ assigneeIds: updated });
    setAddAssigneeOpen(false);
  }

  const unassignedUsers = teamMembers.filter((u: User) => !localAssigneeIds.includes(u.id));

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30"
        style={{ backgroundColor: "var(--color-navy-scrim)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={isMobile ? "animate-slide-in-bottom" : "animate-slide-in"}
        style={
          isMobile
            ? { position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", backgroundColor: "var(--color-surface)" }
            : { position: "fixed", right: 0, top: 0, height: "100%", zIndex: 40, display: "flex", flexDirection: "column", width: 480, backgroundColor: "var(--color-surface)", borderLeft: "1px solid var(--color-border)", boxShadow: "-4px 0 20px rgba(27,46,75,0.12)" }
        }
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5" style={{ backgroundColor: `${cfg.dot}20`, color: cfg.dot, borderRadius: 5, fontSize: 11, fontWeight: 700 }}>
                  {cfg.label}
                </span>
              </div>
              <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 17, color: "var(--color-body)", lineHeight: 1.3, margin: 0 }}>
                {task.title}
              </h2>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {/* ⋯ overflow menu */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)] transition-colors"
                  style={{ width: 44, height: 44 }}
                  aria-label="More options"
                  aria-haspopup="true"
                  aria-expanded={menuOpen}
                >
                  <MoreHorizontal size={18} color="var(--color-secondary)" />
                </button>
                {menuOpen && (
                  <div
                    className="absolute right-0 top-12 z-50 animate-fade-in"
                    style={{ width: 192, backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, boxShadow: "var(--shadow-card)", padding: "4px 0" }}
                    role="menu"
                  >
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        if (onDuplicateTask) {
                          onDuplicateTask(task);
                        } else {
                          showToast("Duplicate task coming soon.", "info");
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(27,46,75,0.06)] transition-colors"
                      style={{ fontSize: 13, color: "var(--color-body)", border: "none", background: "none", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-roboto)" }}
                      role="menuitem"
                    >
                      <Copy size={14} color="var(--color-secondary)" />
                      Duplicate task
                    </button>
                    {onDeleteTask && (
                      <button
                        onClick={() => { setMenuOpen(false); onDeleteTask(task.id); onClose(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(27,46,75,0.06)] transition-colors"
                        style={{ fontSize: 13, color: "var(--color-error)", border: "none", background: "none", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-roboto)" }}
                        role="menuitem"
                      >
                        <Trash2 size={14} color="var(--color-error)" />
                        Delete task
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)] transition-colors"
                style={{ width: 44, height: 44 }}
                aria-label="Close panel"
              >
                <X size={18} color="var(--color-secondary)" />
              </button>
            </div>
          </div>

          {/* 2×2 metadata grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4">
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Status</p>
              <select
                value={task.status}
                onChange={(e) => onUpdateStatus(e.target.value as TaskStatus)}
                className="cursor-pointer"
                style={{ fontSize: 13, color: cfg.dot, backgroundColor: `${cfg.dot}18`, border: "none", borderRadius: 5, padding: "3px 8px", fontWeight: 600, fontFamily: "var(--font-roboto)" }}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Priority</p>
              {onUpdateTask ? (
                <select
                  value={task.priority}
                  onChange={(e) => {
                    const p = e.target.value as TaskPriority;
                    onUpdateTask({ priority: p });
                    supabase.from("tasks").update({ priority: p }).eq("id", task.id)
                      .then(({ error }) => { if (error) console.error("[TaskDetail] priority update error:", error); });
                  }}
                  className="cursor-pointer"
                  style={{
                    fontSize: 13,
                    color: PRIORITY_CONFIG[task.priority].color,
                    backgroundColor: PRIORITY_CONFIG[task.priority].bg,
                    border: "none",
                    borderRadius: 5,
                    padding: "3px 8px",
                    fontWeight: 600,
                    fontFamily: "var(--font-roboto)",
                  }}
                >
                  {(["high", "medium", "low"] as TaskPriority[]).map((p) => (
                    <option key={p} value={p}>{PRIORITY_CONFIG[p].symbol} {PRIORITY_CONFIG[p].label}</option>
                  ))}
                </select>
              ) : (
                <PriorityBadge priority={task.priority} />
              )}
            </div>

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Due Date</p>
              <p style={{ fontSize: 13, color: "var(--color-body)" }}>{task.dueDate ? formatDate(task.dueDate) : "No due date"}</p>
            </div>

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Assignees</p>
              <div className="flex flex-wrap gap-1.5 relative">
                {localAssigneeIds.length === 0 ? (
                  <span style={{ fontSize: 13, color: "var(--color-secondary)" }}>Unassigned</span>
                ) : (
                  localAssigneeIds.map((id) => {
                    const user = lookupUser(id);
                    if (!user) return null;
                    return (
                      <span key={id} className="flex items-center gap-1.5 px-2 py-1" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", borderRadius: 20, fontSize: 12 }}>
                        <Avatar user={user} size={16} />
                        {user.name.split(" ")[0]}
                        <button
                          onClick={() => removeAssignee(id)}
                          className="ml-0.5 hover:opacity-70 transition-opacity"
                          style={{ color: "var(--color-secondary)", lineHeight: 1 }}
                          aria-label={`Remove ${user.name}`}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })
                )}
                {/* + Add assignee */}
                {unassignedUsers.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setAddAssigneeOpen((o) => !o)}
                      className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-[rgba(27,46,75,0.06)] transition-colors"
                      style={{ border: "1px dashed var(--color-border)" }}
                      aria-label="Add assignee"
                    >
                      <Plus size={12} color="var(--color-secondary)" />
                    </button>
                    {addAssigneeOpen && (
                      <div
                        className="absolute left-0 top-8 z-20 animate-fade-in"
                        style={{ width: 180, backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, boxShadow: "var(--shadow-card)", padding: "4px 0" }}
                      >
                        {unassignedUsers.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => addAssignee(u.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[rgba(27,46,75,0.06)] transition-colors"
                            style={{ fontSize: 13, color: "var(--color-body)" }}
                          >
                            <Avatar user={u} size={20} />
                            {u.name.split(" ")[0]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.6 }}>{task.description}</p>
          </div>
        )}

        {/* Linked docs */}
        {task.links.length > 0 && (
          <div className="px-6 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Linked Documents</p>
            <div className="space-y-2">
              {task.links.map((link) => (
                <a key={link.id} href={link.url} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[rgba(27,46,75,0.04)] transition-colors" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", textDecoration: "none" }} target="_blank" rel="noopener noreferrer">
                  {link.type === "google_doc" ? <FileText size={14} color="#1B2E4B" /> : <Table size={14} color="#1B2E4B" />}
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
              {tab === "comments" ? (
                <>Comments {localComments.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-secondary)" }}>({localComments.length})</span>}</>
              ) : (
                <>
                  Files
                  {localFiles.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", fontSize: 10, fontWeight: 700, color: "var(--color-secondary)" }}>
                      {localFiles.length}
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
                {localComments.length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No comments yet.</p>
                )}
                {localComments.map((comment) => {
                  const author = lookupUser(comment.authorId);
                  if (!author) return null;
                  const isNew = !task.comments.find((c) => c.id === comment.id);
                  return (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar user={author} size={26} className="mt-1 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)" }}>{author.name}</span>
                          <span style={{ fontSize: 11, color: "var(--color-secondary)" }}>
                            {isNew ? "just now" : formatRelativeTime(comment.createdAt)}
                          </span>
                        </div>
                        <div style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", borderRadius: "4px 12px 12px 12px", padding: "10px 14px", fontSize: 13, color: "var(--color-body)", lineHeight: 1.5 }}>
                          {comment.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-4 py-3 flex gap-3 items-end" style={{ borderTop: "1px solid var(--color-border)" }}>
                <Avatar user={currentUser} size={26} className="mb-0.5 shrink-0" />
                <div className="flex-1 relative">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Leave a comment..."
                    rows={2}
                    className="w-full resize-none"
                    style={{ fontSize: 13, color: "var(--color-body)", backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "8px 12px", fontFamily: "var(--font-roboto)", outline: "none" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendComment(); }
                    }}
                  />
                </div>
                <button
                  onClick={handleSendComment}
                  disabled={!commentText.trim()}
                  className="px-3 py-2 flex items-center gap-1.5 rounded-lg transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: "var(--color-navy)", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 7, border: "none", cursor: commentText.trim() ? "pointer" : "default", minHeight: 36 }}
                >
                  <Send size={13} /> Add
                </button>
              </div>
            </div>
          )}

          {activeTab === "files" && (
            <div className="px-6 py-4">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />

              {localFiles.length > 0 && (
                <div className="space-y-2 mb-4">
                  {localFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
                      <FileIcon type={file.type} />
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 13, color: "var(--color-body)", fontWeight: 500 }}>{file.name}</p>
                        <p style={{ fontSize: 11, color: "var(--color-secondary)" }}>
                          {formatFileSize(file.size)} · uploaded by {lookupUser(file.uploaderId)?.name.split(" ")[0]}
                        </p>
                      </div>
                      <button
                        onClick={() => showToast("Download started", "info")}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-[rgba(27,46,75,0.06)] transition-colors"
                        aria-label="Download"
                      >
                        <Download size={13} color="var(--color-navy)" />
                      </button>
                      {file.uploaderId === (currentUserId || CURRENT_USER_ID) && (
                        <button
                          onClick={() => handleDeleteFile(file.id)}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[rgba(27,46,75,0.06)] transition-colors"
                          aria-label="Delete file"
                        >
                          <Trash2 size={13} color="var(--color-error)" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {localFiles.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--color-secondary)", marginBottom: 16 }}>No files attached yet.</p>
              )}

              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer transition-colors hover:bg-[rgba(27,46,75,0.03)]"
                style={{ border: "2px dashed var(--color-border)", borderRadius: 8, padding: "24px 16px", textAlign: "center" }}
              >
                <Paperclip size={18} color="var(--color-secondary)" />
                <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>Drop files here or click to upload</p>
                <p style={{ fontSize: 11, color: "var(--color-secondary)" }}>PDF, DOCX, images, spreadsheets</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
