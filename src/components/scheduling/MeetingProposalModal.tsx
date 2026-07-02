"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { User, MeetingProposal } from "@/types";
import Avatar from "@/components/ui/Avatar";

interface Props {
  currentUserId: string;
  teamMembers: User[];
  onSubmit: (proposal: Omit<MeetingProposal, "id" | "createdAt" | "responses">) => void;
  onClose: () => void;
}

const DURATION_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 hour", value: 60 },
  { label: "1.5 hours", value: 90 },
  { label: "2 hours", value: 120 },
];

const inputStyle: React.CSSProperties = {
  height: 38,
  border: "1px solid var(--color-border)",
  borderRadius: 7,
  padding: "0 10px",
  fontSize: 13,
  fontFamily: "var(--font-roboto)",
  backgroundColor: "var(--color-canvas)",
  color: "var(--color-body)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export default function MeetingProposalModal({ currentUserId, teamMembers, onSubmit, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [invitees, setInvitees] = useState<string[]>([]);
  const [error, setError] = useState("");

  const invitableMembers = teamMembers.filter((m) => m.id !== currentUserId);

  function toggleInvitee(id: string) {
    setInvitees((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function handleSubmit() {
    if (!title.trim()) { setError("Please enter a meeting title."); return; }
    if (!date) { setError("Please select a date."); return; }
    if (!time) { setError("Please select a time."); return; }
    if (invitees.length === 0) { setError("Please invite at least one person."); return; }
    setError("");

    onSubmit({
      projectId: "",
      proposerId: currentUserId,
      title: title.trim(),
      description: description.trim() || undefined,
      proposedDate: date,
      proposedTime: time,
      durationMinutes: duration,
      inviteeIds: invitees,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(27,46,75,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="animate-slide-up-fade"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(27,46,75,0.18)",
          width: "100%",
          maxWidth: 480,
          margin: "0 16px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <h2
            style={{
              fontFamily: "var(--font-lora)",
              fontWeight: 600,
              fontSize: 16,
              color: "var(--color-navy)",
              margin: 0,
            }}
          >
            Propose a Meeting
          </h2>
          <button
            onClick={onClose}
            style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "none", cursor: "pointer", borderRadius: 7 }}
          >
            <X size={16} color="var(--color-secondary)" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-secondary)", display: "block", marginBottom: 5, letterSpacing: "0.03em" }}>
              MEETING TITLE
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              placeholder="e.g. Consent Form Review"
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
            />
          </div>

          {/* Date + Time */}
          <div className="flex gap-3">
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-secondary)", display: "block", marginBottom: 5, letterSpacing: "0.03em" }}>
                DATE
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setError(""); }}
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-secondary)", display: "block", marginBottom: 5, letterSpacing: "0.03em" }}>
                TIME
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => { setTime(e.target.value); setError(""); }}
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-secondary)", display: "block", marginBottom: 5, letterSpacing: "0.03em" }}>
              DURATION
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDuration(opt.value)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    border: "1px solid",
                    borderColor: duration === opt.value ? "var(--color-navy)" : "var(--color-border)",
                    backgroundColor: duration === opt.value ? "var(--color-navy)" : "transparent",
                    color: duration === opt.value ? "#fff" : "var(--color-body)",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "var(--font-roboto)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Invite */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-secondary)", display: "block", marginBottom: 5, letterSpacing: "0.03em" }}>
              INVITE
            </label>
            {invitableMembers.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-secondary)", padding: "8px 0" }}>
                No teammates yet — invite someone to your lab first.
              </p>
            ) : null}
          <div className="space-y-1">
              {invitableMembers.map((member) => {
                const isChecked = invitees.includes(member.id);
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleInvitee(member.id)}
                    className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-left transition-colors"
                    style={{
                      border: "1px solid",
                      borderColor: isChecked ? "var(--color-navy)" : "var(--color-border)",
                      backgroundColor: isChecked ? "rgba(27,46,75,0.05)" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <Avatar user={member} size={26} />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-body)", margin: 0 }}>
                        {member.name}
                        {member.role === "pi" && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: "var(--color-secondary)" }}>PI</span>
                        )}
                      </p>
                    </div>
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        border: "2px solid",
                        borderColor: isChecked ? "var(--color-navy)" : "var(--color-border)",
                        backgroundColor: isChecked ? "var(--color-navy)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isChecked && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description (optional) */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-secondary)", display: "block", marginBottom: 5, letterSpacing: "0.03em" }}>
              DESCRIPTION (OPTIONAL)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this meeting about?"
              rows={3}
              style={{
                ...inputStyle,
                height: "auto",
                padding: "8px 10px",
                resize: "none",
                lineHeight: 1.5,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: "var(--color-error)", margin: 0 }} role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <button
            onClick={onClose}
            style={{ fontSize: 13, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer", padding: "8px 12px" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={invitableMembers.length === 0}
            style={{
              backgroundColor: invitableMembers.length === 0 ? "var(--color-border)" : "var(--color-navy)",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 600,
              padding: "8px 20px",
              cursor: invitableMembers.length === 0 ? "not-allowed" : "pointer",
              fontFamily: "var(--font-roboto)",
            }}
          >
            Send Proposal
          </button>
        </div>
      </div>
    </div>
  );
}
