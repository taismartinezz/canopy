"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";
import type { SubProject } from "@/types";

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

export default function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const { projectId, addSubProject, setActiveSubProject } = useProject();
  const [name, setName]             = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit() {
    if (!name.trim()) { setError("Project name is required."); return; }
    if (!projectId) { setError("No lab context found. Please refresh."); return; }
    setError("");
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;

      // Insert sub-project row
      const { data, error: insertError } = await supabase
        .from("sub_projects")
        .insert({
          project_id:  projectId,
          name:        name.trim(),
          description: description.trim() || null,
          created_by:  userId,
          archived:    false,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[CreateProjectModal] insert error:", insertError);
        setError("Failed to create project. Please try again.");
        setSaving(false);
        return;
      }

      // Add creator to sub_project_members
      if (userId) {
        const { error: memberError } = await supabase
          .from("sub_project_members")
          .insert({ sub_project_id: data.id, user_id: userId });
        if (memberError) {
          console.error("[CreateProjectModal] sub_project_members insert error:", memberError);
        }
      }

      // Optimistically update context — no re-fetch needed
      const newSp: SubProject = {
        id:          data.id          as string,
        projectId:   data.project_id  as string,
        name:        data.name        as string,
        description: (data.description as string | null) ?? undefined,
        createdBy:   (data.created_by  as string | null) ?? undefined,
        createdAt:   data.created_at  as string,
        archived:    false,
      };
      addSubProject(newSp);
      setActiveSubProject(newSp.id);
      onClose();
    } catch (err) {
      console.error("[CreateProjectModal] unexpected error:", err);
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
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
          maxWidth: 440,
          width: "100%",
          borderRadius: 10,
          padding: 28,
          boxShadow: "0 8px 40px rgba(27,46,75,0.18)",
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
            New project
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
          {/* Name */}
          <div>
            <label style={labelStyle}>Project name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              placeholder="e.g. Phase 2 Interviews"
              style={inputStyle}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
            />
            {error && (
              <p style={{ fontSize: 12, color: "var(--color-error)", marginTop: 4 }}>{error}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
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
            onClick={handleSubmit}
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
            {saving ? "Creating…" : "Create project"}
          </button>
        </div>
      </div>
    </div>
  );
}
