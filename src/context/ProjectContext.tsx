"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { SubProject } from "@/types";

// ── Context shape ─────────────────────────────────────────────────────────────

interface ProjectContextValue {
  /** Lab-level projects.id — null until auth resolves */
  projectId: string | null;
  /** Currently active sub-project filter — null means "All Lab" */
  subProjectId: string | null;
  /** All sub-projects the current user belongs to (excludes archived) */
  subProjects: SubProject[];
  /** Switch the active sub-project; pass null to show all lab tasks */
  setActiveSubProject: (id: string | null) => void;
  /** Optimistically add a newly created sub-project to the list */
  addSubProject: (sp: SubProject) => void;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextValue>({
  projectId: null,
  subProjectId: null,
  subProjects: [],
  setActiveSubProject: () => {},
  addSubProject: () => {},
  isLoading: true,
});

// ── Storage key ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "canopy_active_sub_project";

// ── Provider ──────────────────────────────────────────────────────────────────

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projectId, setProjectId]       = useState<string | null>(null);
  const [subProjectId, setSubProjectId] = useState<string | null>(null);
  const [subProjects, setSubProjects]   = useState<SubProject[]>([]);
  const [isLoading, setIsLoading]       = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) { setIsLoading(false); return; }

        // ── 1. Lab-level project_id from team_members ──────────────────────
        const { data: membership } = await supabase
          .from("team_members")
          .select("project_id")
          .eq("user_id", userId)
          .maybeSingle();

        if (!membership?.project_id) { setIsLoading(false); return; }
        const pid = membership.project_id as string;
        setProjectId(pid);

        // ── 2. Sub-projects this user is a member of ───────────────────────
        const { data: memberRows, error: memberError } = await supabase
          .from("sub_project_members")
          .select(
            "sub_project_id, sub_projects(id, project_id, name, description, created_by, created_at, archived)"
          )
          .eq("user_id", userId);

        if (memberError) {
          console.error("[ProjectContext] sub_project_members error:", memberError);
          setIsLoading(false);
          return;
        }

        if (memberRows) {
          const sps: SubProject[] = memberRows
            .map((row) => {
              const raw = row.sub_projects;
              // Supabase returns a single object (FK → PK join), not an array
              const sp = Array.isArray(raw) ? raw[0] : (raw as Record<string, unknown> | null);
              if (!sp) return null;
              return {
                id:          sp.id          as string,
                projectId:   sp.project_id  as string,
                name:        sp.name        as string,
                description: (sp.description as string | undefined) ?? undefined,
                createdBy:   (sp.created_by  as string | undefined) ?? undefined,
                createdAt:   sp.created_at  as string,
                archived:    (sp.archived   as boolean) ?? false,
              } as SubProject;
            })
            .filter((sp): sp is SubProject => sp !== null && !sp.archived);

          setSubProjects(sps);

          // Restore persisted selection — validate it's still a valid sub-project
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored && sps.some((sp) => sp.id === stored)) {
            setSubProjectId(stored);
          }
        }
      } catch (err) {
        console.error("[ProjectContext] load error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  const setActiveSubProject = useCallback((id: string | null) => {
    setSubProjectId(id);
    if (id === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const addSubProject = useCallback((sp: SubProject) => {
    setSubProjects((prev) => [...prev, sp]);
  }, []);

  return (
    <ProjectContext.Provider
      value={{ projectId, subProjectId, subProjects, setActiveSubProject, addSubProject, isLoading }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useProject(): ProjectContextValue {
  return useContext(ProjectContext);
}
