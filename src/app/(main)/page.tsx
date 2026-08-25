"use client";

import { useState, useCallback, useEffect } from "react";
import {
  TASKS, DASHBOARD_POSTS, SCHEDULE_EVENTS,
  getUser, CURRENT_USER_ID, getStoredProject,
} from "@/lib/mock-data";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Task, CalendarEvent, DashboardPost, TaskStatus, User } from "@/types";
import { useProject } from "@/context/ProjectContext";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import TaskModal from "@/components/tasks/TaskModal";
import Toast from "@/components/ui/Toast";
import type { ActivityRow } from "./_components/TeamActivityWidget";
import type { OverdueReminder } from "./_components/NeedsAttentionWidget";
import type { AssignedPaper } from "./_components/LiteratureWidget";
import { TodayWidget } from "./_components/TodayWidget";
import { LabPulseWidget } from "./_components/LabPulseWidget";
import { RailWidget } from "./_components/RailWidget";

// ── Dashboard page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { activeScope, subProjectId, subProjects } = useProject();
  const [tasks, setTasks]             = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalStatus, setModalStatus] = useState<TaskStatus | null>(null);
  const [projectName, setProjectName]           = useState("");
  const [projectId, setProjectId]               = useState("");
  const [userId, setUserId]                     = useState("");
  const [currentUserFirstName, setCurrentUserFirstName] = useState("");
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [dashEvents, setDashEvents]   = useState<CalendarEvent[]>([]);
  const [dashActivity, setDashActivity] = useState<ActivityRow[]>([]);
  const [dashPosts, setDashPosts]     = useState<DashboardPost[]>([]);
  const [overdueReminders, setOverdueReminders] = useState<OverdueReminder[]>([]);
  const [assignedPapers, setAssignedPapers]     = useState<AssignedPaper[]>([]);
  const [lastJournalAt, setLastJournalAt]       = useState<string | null>(null);
  const [journalNudgeDismissed, setJournalNudgeDismissed] = useState(false);
  const [loading, setLoading]         = useState(isSupabaseConfigured);

  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        const user = session?.user ?? null;
        if (!user) { setLoading(false); return; }
        setUserId(user.id);

        const { data: up } = await supabase
          .from("user_profiles")
          .select("project_id, name, projects(name)")
          .eq("id", user.id)
          .maybeSingle();

        if (!up?.project_id) { setLoading(false); return; }
        const pid = up.project_id as string;
        setProjectId(pid);

        if (up.name) setCurrentUserFirstName((up.name as string).trim().split(/\s+/)[0]);

        const proj = Array.isArray(up.projects) ? up.projects[0] : up.projects;
        if (proj) setProjectName((proj as Record<string, string>).name ?? "");

        // Fetch team members for avatar display
        const { data: members } = await supabase
          .from("team_members")
          .select("*, user_profiles(name, avatar_color, avatar_initials, avatar_url, role)")
          .eq("project_id", pid);

        if (members) {
          setTeamMembers(members.map((row) => {
            const p = Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles;
            const profile = p as Record<string, string> | null;
            return {
              id: row.user_id as string,
              name: profile?.name ?? "Team Member",
              email: "",
              role: (row.role ?? "researcher") as User["role"],
              avatarColor: profile?.avatar_color ?? "#B4D4E3",
              avatarInitials: profile?.avatar_initials ?? "??",
              avatarUrl: profile?.avatar_url ?? undefined,
            } as User;
          }));
        }

        // Fetch tasks (exclude archived)
        const { data: taskData, error: taskError } = await supabase
          .from("tasks")
          .select("*, task_assignees(user_id)")
          .eq("project_id", pid)
          .is("parent_id", null)
          .or("archived.is.null,archived.eq.false")
          .order("created_at", { ascending: false });
        if (taskError) console.error("[Dashboard] tasks error:", taskError);
        if (!taskError && taskData) {
          setTasks(taskData.map((row) => ({
            id: row.id as string,
            projectId: row.project_id as string,
            title: row.title as string,
            description: (row.description as string) ?? "",
            status: row.status as TaskStatus,
            priority: row.priority as Task["priority"],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            assigneeIds: ((row.task_assignees as any[]) ?? []).map((ta) => ta.user_id as string),
            dueDate: row.due_date as string | undefined,
            createdAt: row.created_at as string,
            updatedAt: row.updated_at as string,
            comments: (row.comments as Task["comments"]) ?? [],
            files: (row.files as Task["files"]) ?? [],
            links: (row.links as Task["links"]) ?? [],
            scope: (row.scope as Task["scope"]) ?? undefined,
            subProjectId: (row.sub_project_id as string | null) ?? undefined,
          })));
        }

        // Fetch events
        const { data: evData, error: evError } = await supabase
          .from("events")
          .select("*")
          .eq("project_id", pid)
          .order("date", { ascending: true });
        if (evError) console.error("[Dashboard] events error:", evError);
        if (!evError && evData) {
          setDashEvents(evData.map((row) => ({
            id: row.id as string,
            title: row.title as string,
            date: row.date as string,
            time: (row.time as string) ?? undefined,
            projectId: row.project_id as string,
          })));
        }

        // Fetch lab wins
        const { data: winsData, error: winsError } = await supabase
          .from("lab_wins")
          .select("*")
          .eq("project_id", pid)
          .order("created_at", { ascending: false });
        if (winsError) console.error("[Dashboard] lab_wins error:", winsError);
        if (!winsError && winsData) {
          setDashPosts((prev) => [
            ...prev.filter((p) => p.type !== "lab_win"),
            ...winsData.map((row) => ({
              id: row.id as string,
              authorId: row.author_id as string,
              content: row.content as string,
              createdAt: row.created_at as string,
              type: "lab_win" as const,
            })),
          ]);
        }

        // Fetch opportunities
        const { data: oppsData, error: oppsError } = await supabase
          .from("opportunities")
          .select("*")
          .eq("project_id", pid)
          .order("created_at", { ascending: false });
        if (oppsError) console.error("[Dashboard] opportunities error:", oppsError);
        if (!oppsError && oppsData) {
          setDashPosts((prev) => [
            ...prev.filter((p) => p.type !== "opportunity"),
            ...oppsData.map((row) => ({
              id: row.id as string,
              authorId: row.author_id as string,
              content: row.content as string,
              createdAt: row.created_at as string,
              type: "opportunity" as const,
            })),
          ]);
        }

        // Fetch activity feed
        const { data: actData, error: actError } = await supabase
          .from("activity_feed")
          .select("*")
          .eq("project_id", pid)
          .order("created_at", { ascending: false })
          .limit(10);
        if (actError) console.error("[Dashboard] activity_feed error:", actError);
        if (!actError && actData) {
          setDashActivity(actData as ActivityRow[]);
        }

        // Fetch overdue reminders for the current user, scoped to the active project
        const now = new Date().toISOString();
        const remProjectFilter = pid ? `,and(scope.eq.lab,project_id.eq.${pid})` : "";
        const { data: remData } = await supabase
          .from("reminders")
          .select("id, title, due_at, scope, assignee_id")
          .or(`user_id.eq.${user.id},assignee_id.eq.${user.id}${remProjectFilter}`)
          .eq("completed", false)
          .lt("due_at", now);
        if (remData) {
          setOverdueReminders(remData.map((r) => ({
            id: r.id as string,
            title: r.title as string,
            dueAt: r.due_at as string,
            scope: (r.scope as "personal" | "lab") ?? "personal",
            assigneeId: (r.assignee_id as string) ?? undefined,
          })));
        }

        // Fetch papers assigned to the current user for the reading widget
        const { data: litData } = await supabase
          .from("lit_assigned_readings")
          .select("id, item_id, reading_status, literature_items(title)")
          .eq("project_id", pid)
          .eq("assignee_id", user.id);
        if (litData) {
          setAssignedPapers(litData.map((r) => {
            const li = Array.isArray(r.literature_items) ? r.literature_items[0] : r.literature_items;
            const item = li as Record<string, string> | null;
            return {
              id: r.id as string,
              itemId: r.item_id as string,
              title: item?.title ?? "Untitled",
              readingStatus: (r.reading_status as AssignedPaper["readingStatus"]) ?? "not_started",
            };
          }));
        }

        // Fetch last journal entry date for gentle nudge
        const { data: jData } = await supabase
          .from("journal_entries")
          .select("created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (jData?.created_at) setLastJournalAt(jData.created_at as string);

        setLoading(false);
      });
      return;
    }

    // Demo mode fallback (no Supabase)
    const sp = getStoredProject();
    setProjectName(sp.name);
    const mockUser = getUser(CURRENT_USER_ID);
    if (mockUser?.name) setCurrentUserFirstName(mockUser.name.trim().split(/\s+/)[0]);
    if (!localStorage.getItem("canopy_project")) {
      setTasks(TASKS);
      setDashPosts(DASHBOARD_POSTS);
      // Seed upcoming with lab schedule events
      setDashEvents(
        SCHEDULE_EVENTS
          .filter((e) => e.scope === "lab")
          .map((e) => ({ id: e.id, title: e.title, date: e.date, time: e.time, projectId: e.projectId }))
      );
    }
  }, []);

  // Realtime subscription: push new activity_feed rows into state as they arrive
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`activity_feed:${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_feed", filter: `project_id=eq.${projectId}` },
        (payload) => {
          setDashActivity((prev) => [payload.new as ActivityRow, ...prev].slice(0, 10));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeOfDay = (() => { const h = new Date().getHours(); return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"; })();

  const isLabHome = activeScope === "lab";
  const isPersonal = activeScope === "personal";
  const activeSubProject = !isLabHome && activeScope === "project"
    ? (subProjects.find((sp) => sp.id === subProjectId) ?? null)
    : null;
  const displayTitle = activeSubProject?.name ?? projectName;
  const visibleTasks = isLabHome
    ? tasks
    : tasks.filter((t) => t.scope === "project" && t.subProjectId === subProjectId);
  // Filter activity by scope. Lab-wide rows (sub_project_id null) only appear in Lab Home.
  // Personal scope shows no team activity (personal work has no shared feed).
  const visibleActivity = isLabHome
    ? dashActivity
    : isPersonal
    ? []
    : dashActivity.filter((a) => a.sub_project_id === subProjectId);

  const moveTask = useCallback((taskId: string, status: TaskStatus) => {
    // Capture the task before the optimistic update so we have the original status
    // for the activity log and for rollback if the DB write fails.
    setTasks((prev) => {
      const task = prev.find((t) => t.id === taskId);
      if (!task || task.status === status) return prev;

      const prevStatus = task.status;
      const taskTitle = task.title;
      const taskSubProjectId = task.subProjectId ?? null;

      // Write to DB first; only log activity after the update is confirmed.
      supabase.from("tasks").update({ status }).eq("id", taskId).then(({ error }) => {
        if (error) {
          console.error("[Dashboard] moveTask error:", error);
          // Roll back the optimistic update
          setTasks((p) => p.map((t) => t.id === taskId ? { ...t, status: prevStatus } : t));
          return;
        }
        if (projectId && userId) {
          supabase.from("activity_feed").insert({
            project_id: projectId,
            user_id: userId,
            action_type: "moved",
            item_name: taskTitle,
            item_type: "task",
            from_status: prevStatus,
            to_status: status,
            sub_project_id: taskSubProjectId,
          }).then(({ error: e }) => { if (e) console.error("[Dashboard] activity insert error:", e); });
        }
      });

      return prev.map((t) => (t.id === taskId ? { ...t, status } : t));
    });
    setSelectedTask((prev) => (prev?.id === taskId ? { ...prev, status } : prev));
  }, [projectId, userId]);

  const addTask = useCallback((task: Task) => {
    setTasks((prev) => [task, ...prev]);
    setModalStatus(null);
  }, []);

  // Design tokens for the dark dashboard wrapper
  const accent = "oklch(0.78 0.13 75)";
  const textMuted = "oklch(0.61 0.008 70)";

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1400, minHeight: "100%" }}>
      {/* Greeting - plain text, no card */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 22, margin: 0, lineHeight: 1.2, color: "var(--color-navy)" }}>
          {isLabHome || isPersonal ? (
            <>
              Good {timeOfDay},{" "}
              {currentUserFirstName
                ? <span style={{ color: accent }}>{currentUserFirstName}</span>
                : null
              }
            </>
          ) : displayTitle}
        </h1>
        <p style={{ fontSize: 13, color: textMuted, marginTop: 4, fontStyle: "italic" }}>
          {todayStr} - a few things whenever you&rsquo;re ready. Nothing urgent.
        </p>
      </div>

      {/* Journal nudge - soft invitation if no entry in 7+ days */}
      {!loading && !journalNudgeDismissed && (() => {
        if (!lastJournalAt) return null;
        const daysSince = (Date.now() - new Date(lastJournalAt).getTime()) / 86_400_000;
        if (daysSince < 7) return null;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, padding: "10px 16px", borderRadius: 8, border: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)" }}>
            <span style={{ fontSize: 13, color: "var(--color-secondary)", flex: 1 }}>
              Whenever you have a moment, your journal is here if you want to check in with yourself.
            </span>
            <a href="/journal" style={{ fontSize: 12, fontWeight: 600, color: "var(--color-navy)", textDecoration: "none", flexShrink: 0 }}>
              Open journal
            </a>
            <button
              onClick={() => setJournalNudgeDismissed(true)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-secondary)", padding: 0, flexShrink: 0, fontSize: 16, lineHeight: 1 }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        );
      })()}

      {/* Two-column layout: left (~62%) / right rail (~300px) */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* Left column */}
        <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Today - open tasks + reminders */}
          <TodayWidget
            tasks={visibleTasks}
            reminders={overdueReminders}
            teamMembers={teamMembers}
            userId={userId}
            loading={loading}
          />

          {/* Lab pulse - Opportunities + Lab Wins (Lab Home only) */}
          {isLabHome && (
            <LabPulseWidget
              posts={dashPosts}
              projectId={projectId}
              userId={userId}
              teamMembers={teamMembers}
              loading={loading}
            />
          )}
        </div>

        {/* Right rail */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <RailWidget
            papers={assignedPapers}
            activityRows={visibleActivity}
            teamMembers={teamMembers}
            loading={loading}
          />
        </div>
      </div>

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdateStatus={(status) => moveTask(selectedTask.id, status)}
          teamMembers={teamMembers}
        />
      )}

      {/* Task add modal (from column + buttons) - scoped to the active project when one is selected */}
      {modalStatus && (
        <TaskModal
          mode="add"
          initialStatus={modalStatus}
          onSave={addTask}
          onClose={() => setModalStatus(null)}
          teamMembers={teamMembers}
          currentUserId={userId}
          projectId={projectId}
          scope={activeSubProject ? "project" : "lab"}
          subProjectId={activeSubProject?.id ?? null}
          subProjects={subProjects}
        />
      )}

      <Toast />
    </div>
  );
}
