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
import { UpcomingWidget } from "./_components/UpcomingWidget";
import { TeamActivityWidget } from "./_components/TeamActivityWidget";
import type { ActivityRow } from "./_components/TeamActivityWidget";
import { KanbanPreview } from "./_components/KanbanPreview";
import { PostsCard } from "./_components/PostsCard";

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

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeOfDay = (() => { const h = new Date().getHours(); return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"; })();
  const greeting = currentUserFirstName ? `Good ${timeOfDay}, ${currentUserFirstName}` : `Good ${timeOfDay}`;

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

  return (
    <div className="p-4 md:p-6" style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div className="mb-5 md:mb-6">
        <h1 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 22, color: "var(--color-navy)", margin: 0, lineHeight: 1.2 }}>
          {isLabHome || isPersonal ? greeting : displayTitle}
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 4 }}>{today}</p>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-4 md:mb-5">
        <UpcomingWidget events={dashEvents} projectId={projectId} />
        <TeamActivityWidget rows={visibleActivity} teamMembers={teamMembers} loading={loading} />
      </div>

      {/* Row 2: Kanban preview */}
      <div className="mb-4 md:mb-5">
        <KanbanPreview
          tasks={visibleTasks}
          onTaskClick={setSelectedTask}
          onMoveTask={moveTask}
          onAddTask={(status) => setModalStatus(status)}
          teamMembers={teamMembers}
          loading={loading}
        />
      </div>

      {/* Row 3: Opportunities + Lab Wins — Lab Home only.
          These are lab-wide announcements with no sub-project granularity.
          Hidden in project views so the project Dashboard stays focused. */}
      {isLabHome && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          <PostsCard
            title="Opportunities"
            posts={dashPosts}
            type="opportunity"
            projectId={projectId}
            userId={userId}
            teamMembers={teamMembers}
          />
          <PostsCard
            title="Lab Wins"
            posts={dashPosts}
            type="lab_win"
            projectId={projectId}
            userId={userId}
            teamMembers={teamMembers}
          />
        </div>
      )}

      {/* Task detail panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdateStatus={(status) => moveTask(selectedTask.id, status)}
          teamMembers={teamMembers}
        />
      )}

      {/* Task add modal (from column + buttons) — scoped to the active project when one is selected */}
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
