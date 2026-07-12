"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CURRENT_USER_ID, TEAM_MEMBERS, formatRelativeTime, getStoredUser, getStoredProject } from "@/lib/mock-data";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";
import type { TeamMember, TaskStatus } from "@/types";
import Avatar from "@/components/ui/Avatar";
import { Video, X, Edit3, Check, Minus, Users } from "lucide-react";
import ProjectMembersModal from "@/components/projects/ProjectMembersModal";

// ── Status labels ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do", in_progress: "In Progress", in_review: "In Review", done: "Done",
};
const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "#64748B", in_progress: "#1B2E4B", in_review: "#A0622A", done: "#2E7D52",
};

// ── Start Meeting modal ───────────────────────────────────────────────────────

function MeetingModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: "rgba(27,46,75,0.35)" }} onClick={onClose}>
      <div style={{ backgroundColor: "var(--color-surface)", maxWidth: 360, width: "100%", borderRadius: 10, padding: 28, boxShadow: "0 8px 32px rgba(27,46,75,0.18)" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 17, color: "var(--color-navy)", margin: "0 0 8px" }}>Starting a Zoom meeting…</h2>
        <p style={{ fontSize: 13, color: "var(--color-secondary)", lineHeight: 1.5, marginBottom: 24 }}>
          Your team will receive a Zoom link via Canopy notifications.
        </p>
        <div className="flex gap-2">
          <a
            href="https://zoom.us"
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#fff", backgroundColor: "var(--color-navy)", border: "none", borderRadius: 7, padding: "10px 0", cursor: "pointer", textDecoration: "none", minHeight: 44, fontFamily: "var(--font-roboto)" }}
          >
            <Video size={15} /> Open Zoom
          </a>
          <button onClick={onClose} style={{ fontSize: 13, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer", padding: "0 8px" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

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
      {!isMobile && (
        <div className="fixed inset-0 z-30" style={{ backgroundColor: "rgba(27,46,75,0.15)" }} onClick={onClose} />
      )}
      <div
        className={isMobile ? "animate-slide-in-bottom" : "animate-slide-in"}
        style={isMobile
          ? { position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", backgroundColor: "var(--color-surface)" }
          : { position: "fixed", top: 0, right: 0, height: "100%", zIndex: 40, display: "flex", flexDirection: "column", width: 340, backgroundColor: "var(--color-surface)", borderLeft: "1px solid var(--color-border)", boxShadow: "-4px 0 20px rgba(27,46,75,0.1)" }
        }
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
            <button onClick={onClose} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 44, height: 44 }} aria-label="Close">
              <X size={18} color="var(--color-secondary)" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", marginBottom: 10 }}>Tasks</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(member.taskCounts) as [TaskStatus, number][]).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[status] }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-body)", lineHeight: 1 }}>{count}</p>
                    <p style={{ fontSize: 10, color: "var(--color-secondary)", marginTop: 1 }}>{STATUS_LABELS[status]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {member.weeklyUpdate && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", marginBottom: 8 }}>This Week</p>
              <div className="px-3 py-3 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
                <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.5 }}>{member.weeklyUpdate}</p>
                {member.weeklyUpdatedAt && (
                  <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 5 }}>Updated {formatRelativeTime(member.weeklyUpdatedAt)}</p>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

// ── Member card ───────────────────────────────────────────────────────────────

function MemberCard({ member, onClick, isCurrentUser }: { member: TeamMember; onClick: () => void; isCurrentUser: boolean }) {
  const totalTasks = Object.values(member.taskCounts).reduce((a, b) => a + b, 0);

  return (
    <button onClick={onClick} className="text-left w-full transition-shadow"
      style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "20px 20px 16px", cursor: "pointer" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
    >
      <div className="flex items-center gap-3 mb-4">
        <Avatar user={member} size={44} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-body)", lineHeight: 1.2 }}>
            {member.name}
            {isCurrentUser && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--color-secondary)", marginLeft: 6 }}>(you)</span>}
          </p>
          <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 2, textTransform: "capitalize" }}>
            {member.role === "pi" ? "PI" : "Researcher"}
          </p>
        </div>
      </div>
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
      {member.weeklyUpdate && (
        <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
          <p style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 3 }}>This week</p>
          <p style={{ fontSize: 12, color: "var(--color-body)", lineHeight: 1.45 }}>
            {member.weeklyUpdate.length > 72 ? member.weeklyUpdate.slice(0, 72) + "…" : member.weeklyUpdate}
          </p>
        </div>
      )}
    </button>
  );
}

// ── Weekly update bar ─────────────────────────────────────────────────────────

function WeeklyUpdateBar({ current, onSave }: { current?: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue]     = useState(current ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <div className="flex items-center gap-3 px-5 py-3 mb-6 rounded-lg" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8 }}>
        <p style={{ fontSize: 13, color: current ? "var(--color-body)" : "var(--color-secondary)", flex: 1 }}>
          {current ? `This week: ${current}` : "What are you working on this week? (optional — visible to your team)"}
        </p>
        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[rgba(27,46,75,0.06)]"
          style={{ fontSize: 12, color: "var(--color-navy)", fontWeight: 600, border: "1px solid var(--color-border)", borderRadius: 7, cursor: "pointer", minHeight: 36 }}>
          <Edit3 size={12} />{current ? "Edit" : "Add update"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 mb-6 rounded-lg" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-navy)", borderRadius: 8 }}>
      <input
        ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)}
        placeholder="What are you working on this week?"
        style={{ flex: 1, fontSize: 13, color: "var(--color-body)", fontFamily: "var(--font-roboto)", backgroundColor: "transparent", border: "none", outline: "none" }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(value); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button onClick={() => { onSave(value); setEditing(false); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
        style={{ fontSize: 12, fontWeight: 700, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", minHeight: 36 }}>
        <Check size={12} /> Save
      </button>
    </div>
  );
}

// ── Team page ─────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { activeScope, subProjectId, subProjects, projectId } = useProject();
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [meetingModalOpen, setMeetingModalOpen] = useState(false);
  const [weeklyUpdate, setWeeklyUpdate] = useState<string | undefined>(undefined);
  const [isPi, setIsPi] = useState(false);
  const [storedProjectName, setStoredProjectName] = useState("");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    isSupabaseConfigured ? null : CURRENT_USER_ID
  );
  const [subProjectMemberIds, setSubProjectMemberIds] = useState<Set<string> | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const closeMemberPanel = useCallback(() => setSelectedMember(null), []);
  const closeMeetingModal = useCallback(() => setMeetingModalOpen(false), []);

  // Initialize UI state and resolve userId from auth session.
  useEffect(() => {
    const su = getStoredUser();
    const sp = getStoredProject();
    setIsPi(su.role === "pi");
    setStoredProjectName(sp.name);

    if (!isSupabaseConfigured) { setTeam(TEAM_MEMBERS); setLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setCurrentUserId(session.user.id);
      else setLoading(false);
    });
  }, []);

  // Query team_members only once we have a confirmed userId.
  useEffect(() => {
    if (!currentUserId) return;

    supabase
      .from("user_profiles")
      .select("project_id")
      .eq("id", currentUserId)
      .maybeSingle()
      .then(async ({ data: profileData }) => {
        const projectId = profileData?.project_id as string | undefined;
        if (!projectId) { setLoading(false); return; }

        const [{ data: memberData }, { data: taskRows, error: taskError }] = await Promise.all([
          supabase
            .from("team_members")
            .select("*, user_profiles(name, avatar_color, avatar_initials, avatar_url, institution)")
            .eq("project_id", projectId),
          supabase
            .from("tasks")
            .select("id, status, task_assignees(user_id)")
            .eq("project_id", projectId)
            .or("archived.is.null,archived.eq.false"),
        ]);

        if (taskError) console.error("[Team] task count query error:", taskError);

        // Build per-user task count map from tasks → task_assignees
        const countMap: Record<string, Record<TaskStatus, number>> = {};
        if (taskRows) {
          for (const task of taskRows) {
            const taskStatus = task.status as TaskStatus;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const assignees = (task.task_assignees as any[]) ?? [];
            for (const ta of assignees) {
              const uid = ta.user_id as string;
              if (!countMap[uid]) countMap[uid] = { todo: 0, in_progress: 0, in_review: 0, done: 0 };
              countMap[uid][taskStatus] = (countMap[uid][taskStatus] ?? 0) + 1;
            }
          }
        }

        const members: TeamMember[] = (memberData ?? []).map((row) => {
          const profiles = row.user_profiles as unknown as Record<string, string>[] | Record<string, string> | null;
          const profile = Array.isArray(profiles) ? profiles[0] : (profiles as Record<string, string> | null);
          const uid = row.user_id as string;
          return {
            id: uid,
            name: profile?.name ?? "Unknown",
            email: "",
            role: row.role as TeamMember["role"],
            avatarColor: profile?.avatar_color ?? "#B4D4E3",
            avatarInitials: profile?.avatar_initials ?? "??",
            avatarUrl: profile?.avatar_url ?? undefined,
            institution: profile?.institution,
            taskCounts: countMap[uid] ?? { todo: 0, in_progress: 0, in_review: 0, done: 0 },
            weeklyUpdate: undefined,
            weeklyUpdatedAt: undefined,
          };
        });

        // Ensure the current user always appears, even if not yet in team_members.
        if (currentUserId && !members.some((m) => m.id === currentUserId)) {
          const { data: myProfile } = await supabase
            .from("user_profiles")
            .select("name, avatar_color, avatar_initials, avatar_url, institution, role")
            .eq("id", currentUserId)
            .maybeSingle();
          if (myProfile) {
            members.unshift({
              id: currentUserId,
              name: myProfile.name ?? "Unknown",
              email: "",
              role: (myProfile.role as TeamMember["role"]) ?? "researcher",
              avatarColor: myProfile.avatar_color ?? "#B4D4E3",
              avatarInitials: myProfile.avatar_initials ?? "??",
              avatarUrl: myProfile.avatar_url ?? undefined,
              institution: myProfile.institution,
              taskCounts: countMap[currentUserId] ?? { todo: 0, in_progress: 0, in_review: 0, done: 0 },
              weeklyUpdate: undefined,
              weeklyUpdatedAt: undefined,
            });
          }
        }

        setTeam(members);
        setLoading(false);
      });
  }, [currentUserId]);

  // Fetch sub-project member ids when in project scope.
  useEffect(() => {
    if (activeScope !== "project" || !subProjectId || !isSupabaseConfigured) {
      setSubProjectMemberIds(null);
      return;
    }
    supabase
      .from("sub_project_members")
      .select("user_id")
      .eq("sub_project_id", subProjectId)
      .then(({ data }) => {
        if (data) setSubProjectMemberIds(new Set(data.map((r) => r.user_id as string)));
      });
  }, [activeScope, subProjectId]);

  // Effective team: filter by sub-project membership when in project scope.
  // Personal scope falls back to full lab roster (team has no personal mode).
  const visibleTeam = activeScope === "project" && subProjectMemberIds !== null
    ? team.filter((m) => subProjectMemberIds.has(m.id))
    : team;

  return (
    <div className="flex flex-col h-full overflow-auto" style={{ fontFamily: "var(--font-roboto)" }}>
      <div className="p-4 md:p-6" style={{ maxWidth: 1200 }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5 md:mb-6">
          <div>
            <h1 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 26, color: "var(--color-navy)", margin: 0, lineHeight: 1.2 }}>Team</h1>
            <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 4 }}>
              {visibleTeam.length} member{visibleTeam.length !== 1 ? "s" : ""}{(() => {
                const displayName = activeScope === "project"
                  ? (subProjects.find((sp) => sp.id === subProjectId)?.name ?? storedProjectName)
                  : storedProjectName;
                return displayName ? ` · ${displayName}` : "";
              })()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Manage project members — visible to PI or project creator when in project scope */}
            {activeScope === "project" && subProjectId && projectId && (() => {
              const activeSp = subProjects.find((sp) => sp.id === subProjectId);
              const canManage = isPi || (activeSp?.createdBy != null && activeSp.createdBy === currentUserId);
              if (!canManage) return null;
              return (
                <button
                  onClick={() => setShowMembersModal(true)}
                  className="flex items-center gap-2 transition-opacity hover:opacity-80"
                  style={{
                    border: "1px solid var(--color-border)", borderRadius: 7,
                    backgroundColor: "var(--color-surface)", color: "var(--color-navy)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 44,
                    padding: "0 14px",
                  }}
                >
                  <Users size={13} /> Manage Members
                </button>
              );
            })()}
            <button
              onClick={() => setMeetingModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--color-navy)", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", borderRadius: 7, cursor: "pointer", minHeight: 44 }}
            >
              <Video size={14} /> Start Meeting
            </button>
          </div>
        </div>

        <WeeklyUpdateBar current={weeklyUpdate} onSave={setWeeklyUpdate} />

        {/* PI aggregate signal — only shown to PI */}
        {isPi && (
          <div className="flex items-center gap-3 px-5 py-3 mb-6 rounded-lg" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8 }}>
            <Minus size={16} color="#64748B" />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)" }}>Team well-being trend this week: stable</p>
              <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 2 }}>Aggregate trend from team check-ins · Visible to PI only</p>
            </div>
          </div>
        )}

        {/* Team grid */}
        {loading && <p style={{ fontSize: 13, color: "var(--color-secondary)", marginBottom: 16 }}>Loading team…</p>}
        {!loading && visibleTeam.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--color-secondary)", marginBottom: 16 }}>
            {activeScope === "project" ? "No members in this project yet." : "Your team will appear here once collaborators join."}
          </p>
        )}
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))" }}>
          {visibleTeam.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              onClick={() => setSelectedMember(member)}
              isCurrentUser={member.id === currentUserId}
            />
          ))}
        </div>

      </div>

      {selectedMember && <MemberPanel member={selectedMember} onClose={closeMemberPanel} />}
      {meetingModalOpen && <MeetingModal onClose={closeMeetingModal} />}
      {showMembersModal && activeScope === "project" && subProjectId && projectId && (() => {
        const activeSp = subProjects.find((sp) => sp.id === subProjectId);
        const canManage = isPi || (activeSp?.createdBy != null && activeSp.createdBy === currentUserId);
        return (
          <ProjectMembersModal
            subProjectId={subProjectId}
            subProjectName={activeSp?.name ?? "Project"}
            labProjectId={projectId}
            currentUserId={currentUserId ?? ""}
            canManage={canManage}
            onClose={() => setShowMembersModal(false)}
          />
        );
      })()}
    </div>
  );
}
