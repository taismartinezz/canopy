"use client";

import { useState, useEffect } from "react";
import { TEAM_MEMBERS, TASKS, CURRENT_USER_ID, formatRelativeTime, getUser } from "@/lib/mock-data";
import type { TeamMember, TaskStatus } from "@/types";
import Avatar from "@/components/ui/Avatar";
import { Video, Calendar, X, Edit3, Check, TrendingUp, TrendingDown, Minus } from "lucide-react";

// ── Status labels ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo:        "To Do",
  in_progress: "In Progress",
  in_review:   "In Review",
  done:        "Done",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo:        "#64748B",
  in_progress: "#1B2E4B",
  in_review:   "#A0622A",
  done:        "#2E7D52",
};

// ── Member profile panel ──────────────────────────────────────────────────────

function MemberPanel({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const [isMobile, setIsMobile] = useState(false);

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
      {/* Backdrop — desktop only */}
      {!isMobile && (
        <div className="fixed inset-0 z-30" style={{ backgroundColor: "rgba(27,46,75,0.15)" }} onClick={onClose} />
      )}

      {/* Panel */}
      <div
        className={isMobile ? "animate-slide-in-bottom" : "animate-slide-in"}
        style={isMobile ? {
          position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column",
          backgroundColor: "var(--color-surface)",
        } : {
          position: "fixed", top: 0, right: 0, height: "100%", zIndex: 40,
          display: "flex", flexDirection: "column", width: 340,
          backgroundColor: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "-4px 0 20px rgba(27,46,75,0.1)",
        }}
      >
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar user={member} size={48} />
              <div>
                <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 17, color: "var(--color-body)", margin: 0 }}>{member.name}</h2>
                <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 3, textTransform: "capitalize" }}>
                  {member.role === "pi" ? "Principal Investigator" : "Researcher"}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)] transition-colors" style={{ width: 44, height: 44 }} aria-label="Close">
              <X size={18} color="var(--color-secondary)" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Task counts */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", marginBottom: 10 }}>
              Tasks
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(member.taskCounts) as [TaskStatus, number][]).map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor: "var(--color-canvas)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[status] }}
                  />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-body)", lineHeight: 1 }}>{count}</p>
                    <p style={{ fontSize: 10, color: "var(--color-secondary)", marginTop: 1 }}>{STATUS_LABELS[status]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly update */}
          {member.weeklyUpdate && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", marginBottom: 8 }}>
                This Week
              </p>
              <div
                className="px-3 py-3 rounded-lg"
                style={{
                  backgroundColor: "var(--color-canvas)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.5 }}>{member.weeklyUpdate}</p>
                {member.weeklyUpdatedAt && (
                  <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 5 }}>
                    Updated {formatRelativeTime(member.weeklyUpdatedAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Meeting scheduler */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", marginBottom: 8 }}>
              Connect
            </p>
            <button
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:shadow-sm"
              style={{
                backgroundColor: "var(--color-canvas)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Calendar size={16} color="var(--color-navy)" />
              <span style={{ fontSize: 13, color: "var(--color-body)", fontWeight: 500 }}>
                Schedule a meeting with {member.name.split(" ")[0]}
              </span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Team member card ──────────────────────────────────────────────────────────

function MemberCard({
  member,
  onClick,
  isCurrentUser,
}: {
  member: TeamMember;
  onClick: () => void;
  isCurrentUser: boolean;
}) {
  const totalTasks = Object.values(member.taskCounts).reduce((a, b) => a + b, 0);

  return (
    <button
      onClick={onClick}
      className="text-left w-full transition-shadow"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        padding: "20px 20px 16px",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <Avatar user={member} size={44} />
        <div>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-body)",
              lineHeight: 1.2,
            }}
          >
            {member.name}
            {isCurrentUser && (
              <span style={{ fontSize: 11, fontWeight: 400, color: "var(--color-secondary)", marginLeft: 6 }}>
                (you)
              </span>
            )}
          </p>
          <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 2, textTransform: "capitalize" }}>
            {member.role === "pi" ? "PI" : "Researcher"}
          </p>
        </div>
      </div>

      {/* Task breakdown */}
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {(Object.entries(member.taskCounts) as [TaskStatus, number][]).map(([status, count]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
            <span style={{ fontSize: 11, color: "var(--color-secondary)" }}>
              {STATUS_LABELS[status]}: <span style={{ fontWeight: 600, color: "var(--color-body)" }}>{count}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Weekly update */}
      {member.weeklyUpdate && (
        <div
          className="px-3 py-2 rounded-lg"
          style={{
            backgroundColor: "var(--color-canvas)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 3 }}>This week</p>
          <p style={{ fontSize: 12, color: "var(--color-body)", lineHeight: 1.45 }}>
            {member.weeklyUpdate.length > 72
              ? member.weeklyUpdate.slice(0, 72) + "…"
              : member.weeklyUpdate}
          </p>
        </div>
      )}
    </button>
  );
}

// ── Weekly update form ────────────────────────────────────────────────────────

function WeeklyUpdateBar({ current, onSave }: { current?: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current ?? "");

  if (!editing) {
    return (
      <div
        className="flex items-center gap-3 px-5 py-3 mb-6 rounded-lg"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
        }}
      >
        <p style={{ fontSize: 13, color: current ? "var(--color-body)" : "var(--color-secondary)", flex: 1 }}>
          {current ? `This week: ${current}` : "What are you working on this week? (optional — visible to your team)"}
        </p>
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[rgba(27,46,75,0.06)] transition-colors"
          style={{ fontSize: 12, color: "var(--color-navy)", fontWeight: 600, border: "1px solid var(--color-border)", borderRadius: 7, cursor: "pointer", minHeight: 36 }}
        >
          <Edit3 size={12} />
          {current ? "Edit" : "Add update"}
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 mb-6 rounded-lg"
      style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-navy)", borderRadius: 8 }}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="What are you working on this week?"
        style={{
          flex: 1,
          fontSize: 13,
          color: "var(--color-body)",
          fontFamily: "var(--font-roboto)",
          backgroundColor: "transparent",
          border: "none",
          outline: "none",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(value); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        onClick={() => { onSave(value); setEditing(false); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
        style={{
          fontSize: 12,
          fontWeight: 700,
          backgroundColor: "var(--color-navy)",
          color: "#fff",
          border: "none",
          borderRadius: 7,
          cursor: "pointer",
          minHeight: 36,
        }}
      >
        <Check size={12} /> Save
      </button>
    </div>
  );
}

// ── Team page ─────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [weeklyUpdate, setWeeklyUpdate] = useState(
    TEAM_MEMBERS.find((m) => m.id === CURRENT_USER_ID)?.weeklyUpdate
  );

  const currentUser = TEAM_MEMBERS.find((m) => m.id === CURRENT_USER_ID)!;

  return (
    <div
      className="flex flex-col h-full overflow-auto"
      style={{ fontFamily: "var(--font-roboto)" }}
    >
      <div className="p-4 md:p-6" style={{ maxWidth: 1200 }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5 md:mb-6">
          <div>
            <h1
              style={{
                fontFamily: "var(--font-lora)",
                fontWeight: 700,
                fontSize: 26,
                color: "var(--color-navy)",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Team
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 4 }}>
              {TEAM_MEMBERS.length} members · Moral Injury & Resilience Study
            </p>
          </div>

          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--color-navy)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              border: "none",
              borderRadius: 7,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            <Video size={14} /> Start Meeting
          </button>
        </div>

        {/* Your weekly update */}
        <WeeklyUpdateBar current={weeklyUpdate} onSave={setWeeklyUpdate} />

        {/* PI aggregate signal (PI would see this — shown for prototype) */}
        <div
          className="flex items-center gap-3 px-5 py-3 mb-6 rounded-lg"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
          }}
        >
          <Minus size={16} color="#64748B" />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)" }}>
              Team well-being trend this week: stable
            </p>
            <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 2 }}>
              Aggregate trend from team check-ins · Visible to PI only
            </p>
          </div>
        </div>

        {/* Team grid — 1 column on mobile, auto-fill on desktop */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))" }}>
          {TEAM_MEMBERS.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onClick={() => setSelectedMember(member)}
              isCurrentUser={member.id === CURRENT_USER_ID}
            />
          ))}
        </div>

        {/* Meeting scheduler section */}
        <div className="mt-8">
          <h2
            style={{
              fontFamily: "var(--font-lora)",
              fontWeight: 600,
              fontSize: 16,
              color: "var(--color-navy)",
              marginBottom: 16,
            }}
          >
            Schedule a Team Meeting
          </h2>
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              padding: "24px 28px",
            }}
          >
            <div className="flex flex-col md:flex-row items-start gap-4 md:gap-6">
              <div className="flex-1 w-full">
                <p style={{ fontSize: 13, color: "var(--color-secondary)", marginBottom: 16 }}>
                  Propose a time and invite your team to vote on availability.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {["Mon Jun 8", "Tue Jun 9", "Wed Jun 10"].map((day) => (
                    <button
                      key={day}
                      className="flex flex-col gap-2"
                      style={{
                        backgroundColor: "var(--color-canvas)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        padding: "12px",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-navy)" }}>{day}</span>
                      {["10:00 AM", "2:00 PM", "4:00 PM"].map((time) => (
                        <span
                          key={time}
                          style={{
                            fontSize: 11,
                            color: "var(--color-secondary)",
                            padding: "3px 8px",
                            borderRadius: 4,
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          {time}
                        </span>
                      ))}
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="w-full md:w-auto"
                style={{
                  backgroundColor: "var(--color-navy)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 7,
                  padding: "10px 20px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  alignSelf: "flex-end",
                  minHeight: 44,
                }}
              >
                Send to team
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedMember && (
        <MemberPanel member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </div>
  );
}
