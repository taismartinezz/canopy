"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { USERS, CURRENT_USER_ID } from "@/lib/mock-data";
import type { Task, TaskStatus, TaskPriority } from "@/types";
import Avatar from "@/components/ui/Avatar";
import { STATUS_CONFIG, STATUS_ORDER } from "@/components/tasks/TaskDetailPanel";

// ── Shared input style ────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 38,
  border: "1px solid var(--color-border)",
  borderRadius: 7,
  padding: "0 10px",
  fontSize: 13,
  fontFamily: "var(--font-roboto)",
  backgroundColor: "var(--color-canvas)",
  color: "var(--color-body)",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--color-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
  display: "block",
};

// ── TaskModal ─────────────────────────────────────────────────────────────────

export interface TaskModalProps {
  mode: "add" | "edit";
  initialStatus?: TaskStatus;
  task?: Task;
  onSave: (task: Task) => void;
  onClose: () => void;
}

export default function TaskModal({ mode, initialStatus = "todo", task, onSave, onClose }: TaskModalProps) {
  const [title, setTitle]           = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority]     = useState<TaskPriority>(task?.priority ?? "medium");
  const [dueDate, setDueDate]       = useState(task?.dueDate ?? "");
  const [status, setStatus]         = useState<TaskStatus>(task?.status ?? initialStatus);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assigneeIds ?? [CURRENT_USER_ID]);
  const [error, setError]           = useState("");

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSave() {
    if (!title.trim()) { setError("Title is required."); return; }
    setError("");

    const now = new Date().toISOString();
    const saved: Task = task
      ? {
          ...task,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate || undefined,
          status,
          assigneeIds,
          updatedAt: now,
        }
      : {
          id: crypto.randomUUID(),
          projectId: "p1",
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          assigneeIds,
          dueDate: dueDate || undefined,
          createdAt: now,
          updatedAt: now,
          comments: [],
          files: [],
          links: [],
        };

    onSave(saved);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: "rgba(27,46,75,0.35)" }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          maxWidth: 520,
          width: "100%",
          borderRadius: 10,
          padding: 28,
          boxShadow: "0 8px 40px rgba(27,46,75,0.18)",
          maxHeight: "90dvh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2
            style={{
              fontFamily: "var(--font-lora)",
              fontWeight: 600,
              fontSize: 16,
              color: "var(--color-navy)",
              margin: 0,
            }}
          >
            {mode === "add" ? "Add task" : "Edit task"}
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)] transition-colors"
            style={{ width: 36, height: 36 }}
            aria-label="Close"
          >
            <X size={16} color="var(--color-secondary)" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label style={labelStyle}>Title *</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              placeholder="Task title"
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
            />
            {error && <p style={{ fontSize: 12, color: "var(--color-error)", marginTop: 4 }}>{error}</p>}
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
              style={{
                ...inputStyle,
                height: "auto",
                padding: "8px 10px",
                resize: "vertical",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
            />
          </div>

          {/* Priority + Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Due date */}
          <div>
            <label style={labelStyle}>Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
            />
          </div>

          {/* Assignees */}
          <div>
            <label style={labelStyle}>Assignees</label>
            <div className="flex flex-wrap gap-2">
              {USERS.map((user) => {
                const selected = assigneeIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => toggleAssignee(user.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all"
                    style={{
                      border: `1px solid ${selected ? "var(--color-navy)" : "var(--color-border)"}`,
                      backgroundColor: selected ? "rgba(27,46,75,0.07)" : "transparent",
                      fontSize: 12,
                      color: selected ? "var(--color-navy)" : "var(--color-secondary)",
                      cursor: "pointer",
                      fontFamily: "var(--font-roboto)",
                      minHeight: 36,
                    }}
                  >
                    <Avatar user={user} size={18} />
                    {user.name.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-body)",
              border: "1px solid var(--color-border)",
              borderRadius: 7,
              padding: "8px 16px",
              backgroundColor: "transparent",
              cursor: "pointer",
              minHeight: 44,
              fontFamily: "var(--font-roboto)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              backgroundColor: "var(--color-navy)",
              border: "none",
              borderRadius: 7,
              padding: "8px 20px",
              cursor: "pointer",
              minHeight: 44,
              fontFamily: "var(--font-roboto)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-navy-hover)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-navy)"; }}
          >
            {mode === "add" ? "Add task" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
