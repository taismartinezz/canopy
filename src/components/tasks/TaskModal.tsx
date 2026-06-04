"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Task, TaskStatus, TaskPriority, User } from "@/types";
import Avatar from "@/components/ui/Avatar";
import { STATUS_CONFIG, STATUS_ORDER } from "@/components/tasks/TaskDetailPanel";
import { supabase } from "@/lib/supabase";

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
  teamMembers?: User[];
  currentUserId?: string;
  projectId?: string;
}

export default function TaskModal({
  mode,
  initialStatus = "todo",
  task,
  onSave,
  onClose,
  teamMembers = [],
  currentUserId = "",
  projectId = "",
}: TaskModalProps) {
  const [title, setTitle]             = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority]       = useState<TaskPriority>(task?.priority ?? "medium");
  const [dueDate, setDueDate]         = useState(task?.dueDate ?? "");
  const [status, setStatus]           = useState<TaskStatus>(task?.status ?? initialStatus);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    task?.assigneeIds ?? (currentUserId ? [currentUserId] : [])
  );
  const [error, setError]   = useState("");
  const [saving, setSaving] = useState(false);

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    if (!title.trim()) { setError("Title is required."); return; }
    setError("");
    setSaving(true);

    const now = new Date().toISOString();

    if (mode === "add") {
      const { data, error: insertError } = await supabase
        .from("tasks")
        .insert({
          project_id: projectId,
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          assignee_ids: assigneeIds,
          due_date: dueDate || null,
          comments: [],
          files: [],
          links: [],
        })
        .select()
        .single();

      if (insertError) {
        console.error("[TaskModal] insert error:", insertError);
        setError("Failed to save task. Please try again.");
        setSaving(false);
        return;
      }

      const saved: Task = {
        id: data.id as string,
        projectId: data.project_id as string,
        title: data.title as string,
        description: (data.description as string) ?? undefined,
        status: data.status as TaskStatus,
        priority: data.priority as TaskPriority,
        assigneeIds: (data.assignee_ids as string[]) ?? [],
        dueDate: (data.due_date as string) ?? undefined,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
        comments: [],
        files: [],
        links: [],
      };

      // Notify assignees (not the creator)
      const toNotify = assigneeIds.filter((id) => id !== currentUserId);
      if (toNotify.length > 0) {
        const notifs = toNotify.map((userId) => ({
          user_id: userId,
          type: "task_assigned",
          title: "You were assigned to a task",
          body: `"${title.trim()}" was assigned to you`,
          related_id: saved.id,
          read: false,
        }));
        const { error: notifError } = await supabase.from("notifications").insert(notifs);
        if (notifError) console.error("[TaskModal] notification insert error:", notifError);
      }

      onSave(saved);
    } else if (mode === "edit" && task) {
      const { data, error: updateError } = await supabase
        .from("tasks")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          due_date: dueDate || null,
          status,
          assignee_ids: assigneeIds,
          updated_at: now,
        })
        .eq("id", task.id)
        .select()
        .single();

      if (updateError) {
        console.error("[TaskModal] update error:", updateError);
        setError("Failed to save changes. Please try again.");
        setSaving(false);
        return;
      }

      // Notify newly added assignees
      const prevIds = task.assigneeIds ?? [];
      const newlyAdded = assigneeIds.filter(
        (id) => !prevIds.includes(id) && id !== currentUserId
      );
      if (newlyAdded.length > 0) {
        const notifs = newlyAdded.map((userId) => ({
          user_id: userId,
          type: "task_assigned",
          title: "You were assigned to a task",
          body: `"${title.trim()}" was assigned to you`,
          related_id: task.id,
          read: false,
        }));
        const { error: notifError } = await supabase.from("notifications").insert(notifs);
        if (notifError) console.error("[TaskModal] notification insert error:", notifError);
      }

      const saved: Task = {
        ...task,
        title: data.title as string,
        description: (data.description as string) ?? undefined,
        priority: data.priority as TaskPriority,
        dueDate: (data.due_date as string) ?? undefined,
        status: data.status as TaskStatus,
        assigneeIds: (data.assignee_ids as string[]) ?? [],
        updatedAt: data.updated_at as string,
      };

      onSave(saved);
    }

    setSaving(false);
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
              {teamMembers.map((user) => {
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
            disabled={saving}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              backgroundColor: "var(--color-navy)",
              border: "none",
              borderRadius: 7,
              padding: "8px 20px",
              cursor: saving ? "default" : "pointer",
              minHeight: 44,
              fontFamily: "var(--font-roboto)",
              opacity: saving ? 0.7 : 1,
            }}
            onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-navy-hover)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-navy)"; }}
          >
            {saving ? "Saving…" : mode === "add" ? "Add task" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
