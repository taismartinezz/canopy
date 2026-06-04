"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, GraduationCap, BookOpen, Globe,
  Link as LinkIcon, Settings, Lock, X,
} from "lucide-react";

function LinkedinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" fill="#0A66C2"/>
      <rect x="2" y="9" width="4" height="12" fill="#0A66C2"/>
      <circle cx="4" cy="4" r="2" fill="#0A66C2"/>
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#000000"/>
    </svg>
  );
}
import {
  CURRENT_USER_ID, getUser, PROJECT,
  JOURNAL_PROMPTS, ACTIVE_PROMPT_IDS,
  getStoredUser, getStoredProject,
} from "@/lib/mock-data";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { showToast } from "@/components/ui/Toast";
import type { TaskStatus, PromptCategory } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do", in_progress: "In Progress", in_review: "In Review", done: "Done",
};
const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "#64748B", in_progress: "#1B2E4B", in_review: "#A0622A", done: "#2E7D52",
};
const PROMPT_CATEGORY_LABELS: Record<PromptCategory, string> = {
  emotional_processing: "Emotional Processing",
  research_reflection: "Research Reflection",
  team_support: "Team & Support",
  boundaries_workload: "Boundaries & Workload",
  looking_forward: "Looking Forward",
};
const RESEARCH_TYPE_OPTIONS = [
  { value: "trauma", label: "Trauma" },
  { value: "oncology", label: "Oncology" },
  { value: "conflict_zone", label: "Conflict Zone" },
  { value: "forensic", label: "Forensic" },
  { value: "crisis_response", label: "Crisis Response" },
  { value: "other", label: "Other" },
];
const RESEARCH_PARTICIPATION_OPTIONS = [
  { value: "both_publications", label: "Participate in both publications" },
  { value: "wellbeing_only", label: "Well-being research only" },
  { value: "private", label: "Keep data private" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: "var(--font-roboto)", fontWeight: 700, fontSize: 12,
      textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B6B6B",
      margin: "0 0 10px",
    }}>
      {children}
    </p>
  );
}

function FieldInput({
  value, onChange, placeholder, multiline, minHeight,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  multiline?: boolean; minHeight?: number;
}) {
  const style: React.CSSProperties = {
    width: "100%", border: "1px solid #DDE1E7", borderRadius: 8,
    fontFamily: "var(--font-roboto)", fontWeight: 400, fontSize: 14,
    color: "#2D2D2D", outline: "none", boxSizing: "border-box",
    padding: multiline ? "10px 14px" : "0 14px",
    resize: multiline ? "vertical" : undefined,
    minHeight: multiline ? (minHeight ?? 120) : 36,
    height: multiline ? undefined : 36,
  };
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={style}
        onFocus={(e) => { e.currentTarget.style.borderColor = "#1B2E4B"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "#DDE1E7"; }}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={style}
      onFocus={(e) => { e.currentTarget.style.borderColor = "#1B2E4B"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "#DDE1E7"; }}
    />
  );
}

function TagPill({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 10px", borderRadius: 20,
      border: "1px solid #1B2E4B", color: "#1B2E4B",
      fontFamily: "var(--font-roboto)", fontWeight: 400, fontSize: 13,
    }}>
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", color: "#1B2E4B", minWidth: 16, minHeight: 16 }}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}

function StatCard({ label, count }: { label: string; count: number }) {
  return (
    <div style={{
      backgroundColor: "#fff", borderRadius: 10, border: "1px solid #DDE1E7",
      padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <span style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 24, color: "#1B2E4B", lineHeight: 1 }}>
        {count}
      </span>
      <span style={{ fontFamily: "var(--font-roboto)", fontWeight: 400, fontSize: 12, color: "#6B6B6B" }}>
        {label}
      </span>
    </div>
  );
}

// ── Prompts Modal ─────────────────────────────────────────────────────────────

function PromptsModal({
  activeIds, onSave, onClose,
}: {
  activeIds: string[]; onSave: (ids: string[]) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<string[]>(activeIds);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const togglePrompt = (id: string) => {
    setDraft((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const categories = Array.from(new Set(JOURNAL_PROMPTS.map((p) => p.category)));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: "rgba(27,46,75,0.35)" }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff", maxWidth: 560, width: "100%", borderRadius: 10,
          border: "1px solid #DDE1E7", boxShadow: "0 8px 32px rgba(27,46,75,0.14)",
          maxHeight: "85vh", display: "flex", flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompts-modal-title"
      >
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #DDE1E7", flexShrink: 0 }}>
          <h2 id="prompts-modal-title" style={{
            fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 16,
            color: "#1B2E4B", margin: 0,
          }}>
            Manage Journal Prompts
          </h2>
          <p style={{ fontFamily: "var(--font-roboto)", fontSize: 13, color: "#6B6B6B", marginTop: 4 }}>
            Select which prompts are available to your team.
          </p>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "16px 24px" }}>
          {categories.map((cat) => (
            <div key={cat} style={{ marginBottom: 20 }}>
              <p style={{
                fontFamily: "var(--font-roboto)", fontWeight: 700, fontSize: 11,
                textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B6B6B",
                marginBottom: 8,
              }}>
                {PROMPT_CATEGORY_LABELS[cat]}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {JOURNAL_PROMPTS.filter((p) => p.category === cat).map((prompt) => {
                  const active = draft.includes(prompt.id);
                  return (
                    <button
                      key={prompt.id}
                      onClick={() => togglePrompt(prompt.id)}
                      style={{
                        textAlign: "left", padding: "10px 14px",
                        borderRadius: 8, cursor: "pointer",
                        fontFamily: "var(--font-roboto)", fontSize: 13, color: "#2D2D2D",
                        backgroundColor: active ? "rgba(27,46,75,0.04)" : "#fff",
                        border: active ? "1px solid #1B2E4B" : "1px solid #DDE1E7",
                        transition: "border-color 120ms ease",
                      }}
                    >
                      {prompt.text}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #DDE1E7", display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => { onSave(draft); onClose(); }}
            style={{
              height: 44, padding: "0 24px", backgroundColor: "#1B2E4B", color: "#fff",
              border: "none", borderRadius: 8, fontFamily: "var(--font-roboto)",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#2E4A6F"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#1B2E4B"; }}
          >
            Save
          </button>
          <button
            onClick={onClose}
            style={{
              height: 44, padding: "0 16px", backgroundColor: "#fff", color: "#6B6B6B",
              border: "1px solid #DDE1E7", borderRadius: 8, fontFamily: "var(--font-roboto)",
              fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Archive Confirm Modal ─────────────────────────────────────────────────────

function ArchiveModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: "rgba(27,46,75,0.35)" }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff", maxWidth: 400, width: "100%", borderRadius: 10,
          border: "1px solid #DDE1E7", boxShadow: "0 8px 32px rgba(27,46,75,0.14)",
          padding: 28,
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-modal-title"
      >
        <h2 id="archive-modal-title" style={{
          fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 16,
          color: "#1B2E4B", margin: "0 0 8px",
        }}>
          Archive this project?
        </h2>
        <p style={{
          fontFamily: "var(--font-roboto)", fontSize: 13, color: "#6B6B6B",
          lineHeight: 1.6, margin: "0 0 24px",
        }}>
          Team members will lose access. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, height: 44, backgroundColor: "#fff", color: "#2D2D2D",
              border: "1px solid #DDE1E7", borderRadius: 8,
              fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, height: 44, backgroundColor: "#C0392B", color: "#fff",
              border: "none", borderRadius: 8,
              fontFamily: "var(--font-roboto)", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#A93226"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#C0392B"; }}
          >
            Archive
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Profile Page ──────────────────────────────────────────────────────────────

type LinkFields = {
  scholar: string; linkedin: string; researchgate: string;
  twitter: string; website: string; orcid: string;
};

const EMPTY_LINKS: LinkFields = {
  scholar: "", linkedin: "", researchgate: "", twitter: "", website: "", orcid: "",
};

type TabId = "about" | "links" | "activity" | "lab_settings";

export default function ProfilePage() {
  const router = useRouter();
  const currentUser = getUser(CURRENT_USER_ID)!;
  const [isPi, setIsPi] = useState(false);
  const [avatarInitials, setAvatarInitials] = useState(isSupabaseConfigured ? "" : currentUser.avatarInitials);
  const [avatarColor, setAvatarColor] = useState(isSupabaseConfigured ? "#B4D4E3" : currentUser.avatarColor);
  const [projectCreatedAt, setProjectCreatedAt] = useState(isSupabaseConfigured ? "" : PROJECT.createdAt);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const authInitRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  // ── Persisted profile state ──────────────────────────────────────────────
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState(isSupabaseConfigured ? "" : currentUser.name);
  const [institution, setInstitution] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [department, setDepartment] = useState("");
  const [links, setLinks] = useState<LinkFields>(EMPTY_LINKS);

  // ── Edit mode ────────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [draftBio, setDraftBio] = useState("");
  const [draftInterests, setDraftInterests] = useState<string[]>([]);
  const [draftDepartment, setDraftDepartment] = useState("");
  const [draftLinks, setDraftLinks] = useState<LinkFields>(EMPTY_LINKS);
  const [interestInput, setInterestInput] = useState("");

  // ── Inline header editing ────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [editingInstitution, setEditingInstitution] = useState(false);
  const [institutionInput, setInstitutionInput] = useState("");

  // ── UI state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>("about");
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);

  // ── PI / Lab Settings state ───────────────────────────────────────────────
  const [projectName, setProjectName] = useState(isSupabaseConfigured ? "" : PROJECT.name);
  const [projectInstitution, setProjectInstitution] = useState("");
  const [researchType, setResearchType] = useState<string>(isSupabaseConfigured ? "" : PROJECT.researchType);
  const [researchParticipation, setResearchParticipation] = useState<string>(isSupabaseConfigured ? "" : PROJECT.researchParticipation);
  const [activePromptIds, setActivePromptIds] = useState<string[]>(ACTIVE_PROMPT_IDS);

  // ── Clear stale state when a different user signs in ────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUserId = session?.user?.id ?? null;
      if (!authInitRef.current) {
        authInitRef.current = true;
        lastUserIdRef.current = newUserId;
        return;
      }
      if (newUserId === lastUserIdRef.current) return;
      lastUserIdRef.current = newUserId;
      // Wipe all localStorage user cache so old data never bleeds across sessions
      Object.keys(localStorage).filter(k => k.startsWith("canopy_")).forEach(k => localStorage.removeItem(k));
      // Reset React state for all user-specific fields
      setName(""); setIsPi(false); setAvatarInitials(""); setAvatarColor("#B4D4E3");
      setInstitution(""); setBio(""); setDepartment("");
      setProjectName(""); setProjectInstitution(""); setResearchType(""); setResearchParticipation(""); setProjectCreatedAt("");
      if (newUserId) setReloadCount(c => c + 1);
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load profile on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (isSupabaseConfigured) {
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data, error } = await supabase
            .from("user_profiles")
            .select("name, role, institution, bio, department, avatar_initials, avatar_color, project_id, projects(name, institution, created_at, research_type, research_participation)")
            .eq("id", user.id)
            .maybeSingle();

          if (error) console.error("[ProfilePage] profile query error:", error);

          const resolvedName = (data?.name as string) ?? "";
          const parts = resolvedName.trim().split(/\s+/).filter(Boolean);
          const resolvedInitials = (data?.avatar_initials as string)
            ?? (parts.length === 0 ? "??" : parts.length === 1
              ? parts[0].substring(0, 2).toUpperCase()
              : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase());

          setName(resolvedName);
          setIsPi((data?.role as string) === "pi");
          setAvatarInitials(resolvedInitials);
          setAvatarColor((data?.avatar_color as string) ?? "#B4D4E3");
          setInstitution((data?.institution as string) ?? "");
          if (data?.bio != null)        setBio(data.bio as string);
          if (data?.department != null) setDepartment(data.department as string);

          const proj = Array.isArray(data?.projects) ? data?.projects[0] : data?.projects;
          if (proj) {
            const p = proj as Record<string, string>;
            if (p.name)                   setProjectName(p.name);
            setProjectInstitution(p.institution ?? "");
            if (p.created_at)             setProjectCreatedAt(p.created_at);
            if (p.research_type)          setResearchType(p.research_type);
            if (p.research_participation) setResearchParticipation(p.research_participation);
          }
        } catch (err) {
          console.error("[ProfilePage] failed to load profile:", err);
        }
      })();
      return;
    }

    // Demo mode (no Supabase) — use localStorage / mock defaults
    const onboardUser = getStoredUser();
    const onboardProject = getStoredProject();
    setIsPi(onboardUser.role === "pi");
    setAvatarInitials(onboardUser.avatarInitials);
    setAvatarColor(onboardUser.avatarColor);
    setProjectCreatedAt(onboardProject.createdAt);
    setName(onboardUser.name);
    if (onboardUser.institution) setInstitution(onboardUser.institution);
    else setInstitution(onboardProject.institution);

    const storedPhoto = localStorage.getItem("canopy_profile_photo");
    if (storedPhoto) setPhoto(storedPhoto);
    const storedName = localStorage.getItem("canopy_profile_name");
    if (storedName) setName(storedName);
    const storedInstitution = localStorage.getItem("canopy_profile_institution");
    if (storedInstitution) setInstitution(storedInstitution);
    const storedBio = localStorage.getItem("canopy_profile_bio");
    if (storedBio) setBio(storedBio);
    const storedDepartment = localStorage.getItem("canopy_profile_department");
    if (storedDepartment) setDepartment(storedDepartment);
    try {
      const storedInterests = localStorage.getItem("canopy_profile_interests");
      if (storedInterests) setInterests(JSON.parse(storedInterests));
    } catch { /* ignore */ }
    setLinks({
      scholar: localStorage.getItem("canopy_profile_links_scholar") ?? "",
      linkedin: localStorage.getItem("canopy_profile_links_linkedin") ?? "",
      researchgate: localStorage.getItem("canopy_profile_links_researchgate") ?? "",
      twitter: localStorage.getItem("canopy_profile_links_twitter") ?? "",
      website: localStorage.getItem("canopy_profile_links_website") ?? "",
      orcid: localStorage.getItem("canopy_profile_links_orcid") ?? "",
    });
    try {
      const storedPrompts = localStorage.getItem("canopy_project_active_prompts");
      if (storedPrompts) setActivePromptIds(JSON.parse(storedPrompts));
    } catch { /* ignore */ }

    setProjectName(onboardProject.name);
    setProjectInstitution(onboardProject.institution);
    if (onboardProject.researchType) setResearchType(onboardProject.researchType);
    if (localStorage.getItem("canopy_project_name")) setProjectName(localStorage.getItem("canopy_project_name")!);
    if (localStorage.getItem("canopy_project_institution")) setProjectInstitution(localStorage.getItem("canopy_project_institution")!);
    if (localStorage.getItem("canopy_project_research_type")) setResearchType(localStorage.getItem("canopy_project_research_type")!);
    if (localStorage.getItem("canopy_project_participation")) setResearchParticipation(localStorage.getItem("canopy_project_participation")!);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadCount]);

  // ── Activity stats — loaded from Supabase ────────────────────────────────
  const [taskCounts, setTaskCounts] = useState<Record<TaskStatus, number>>({
    todo: 0, in_progress: 0, in_review: 0, done: 0,
  });
  const [recentTasks, setRecentTasks] = useState<import("@/types").Task[]>([]);
  const [litCount, setLitCount] = useState(0);
  const [journalStreak, setJournalStreak] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      supabase
        .from("user_profiles")
        .select("project_id")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data: up }) => {
          const projectId = up?.project_id as string | undefined;
          if (!projectId) return;

          supabase.from("tasks").select("id,status,title,due_date,updated_at")
            .eq("project_id", projectId)
            .then(({ data }) => {
              if (!data) return;
              const counts = { todo: 0, in_progress: 0, in_review: 0, done: 0 } as Record<TaskStatus, number>;
              data.forEach((t) => { counts[t.status as TaskStatus] = (counts[t.status as TaskStatus] ?? 0) + 1; });
              setTaskCounts(counts);
              const recent = [...data]
                .sort((a, b) => new Date(b.updated_at as string).getTime() - new Date(a.updated_at as string).getTime())
                .slice(0, 5)
                .map((row) => ({
                  id: row.id as string, projectId, title: row.title as string,
                  description: "", status: row.status as TaskStatus,
                  priority: "medium" as const, assigneeIds: [],
                  dueDate: row.due_date as string | undefined,
                  createdAt: row.updated_at as string, updatedAt: row.updated_at as string,
                  comments: [], files: [], links: [],
                }));
              setRecentTasks(recent);
            });

          supabase.from("literature_items").select("id", { count: "exact", head: true })
            .eq("project_id", projectId).eq("added_by", user.id)
            .then(({ count }) => setLitCount(count ?? 0));

          const monthStart = new Date().toISOString().slice(0, 7) + "-01";
          supabase.from("journal_entries").select("id", { count: "exact", head: true })
            .eq("user_id", user.id).gte("date", monthStart)
            .then(({ count }) => setJournalStreak(count ?? 0));
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadCount]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPhoto(dataUrl);
      localStorage.setItem("canopy_profile_photo", dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handleRemovePhoto = useCallback(() => {
    setPhoto(null);
    localStorage.removeItem("canopy_profile_photo");
  }, []);

  const handleSaveName = useCallback(() => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      setName(trimmed);
      localStorage.setItem("canopy_profile_name", trimmed);
    }
    setEditingName(false);
  }, [nameInput]);

  const handleSaveInstitution = useCallback(() => {
    const trimmed = institutionInput.trim();
    if (trimmed) {
      setInstitution(trimmed);
      localStorage.setItem("canopy_profile_institution", trimmed);
    }
    setEditingInstitution(false);
  }, [institutionInput]);

  const handleEnterEditMode = useCallback(() => {
    setDraftBio(bio);
    setDraftInterests([...interests]);
    setDraftDepartment(department);
    setDraftLinks({ ...links });
    setEditMode(true);
  }, [bio, interests, department, links]);

  const handleSaveProfile = useCallback(() => {
    setBio(draftBio);
    setInterests(draftInterests);
    setDepartment(draftDepartment);
    setLinks(draftLinks);

    localStorage.setItem("canopy_profile_bio", draftBio);
    localStorage.setItem("canopy_profile_department", draftDepartment);
    localStorage.setItem("canopy_profile_interests", JSON.stringify(draftInterests));
    localStorage.setItem("canopy_profile_links_scholar", draftLinks.scholar);
    localStorage.setItem("canopy_profile_links_linkedin", draftLinks.linkedin);
    localStorage.setItem("canopy_profile_links_researchgate", draftLinks.researchgate);
    localStorage.setItem("canopy_profile_links_twitter", draftLinks.twitter);
    localStorage.setItem("canopy_profile_links_website", draftLinks.website);
    localStorage.setItem("canopy_profile_links_orcid", draftLinks.orcid);

    setEditMode(false);
    setInterestInput("");
    showToast("Profile updated.", "success");
  }, [draftBio, draftDepartment, draftInterests, draftLinks]);

  const handleCancelEdit = useCallback(() => {
    setEditMode(false);
    setInterestInput("");
  }, []);

  const handleAddInterest = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const val = interestInput.trim();
    if (!val || draftInterests.length >= 8 || draftInterests.includes(val)) return;
    setDraftInterests((prev) => [...prev, val]);
    setInterestInput("");
  }, [interestInput, draftInterests]);

  const handleSaveLabSettings = useCallback(() => {
    localStorage.setItem("canopy_project_name", projectName);
    localStorage.setItem("canopy_project_institution", projectInstitution);
    localStorage.setItem("canopy_project_research_type", researchType);
    localStorage.setItem("canopy_project_participation", researchParticipation);
    showToast("Lab settings saved.", "success");
  }, [projectName, projectInstitution, researchType, researchParticipation]);

  const handleSavePrompts = useCallback((ids: string[]) => {
    setActivePromptIds(ids);
    localStorage.setItem("canopy_project_active_prompts", JSON.stringify(ids));
  }, []);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs: { id: TabId; label: string }[] = [
    { id: "about", label: "About" },
    { id: "links", label: "Links" },
    { id: "activity", label: "Activity" },
    ...(isPi ? [{ id: "lab_settings" as TabId, label: "Lab Settings" }] : []),
  ];

  // ── Link platform definitions ──────────────────────────────────────────────
  const linkPlatforms: {
    key: keyof LinkFields;
    label: string;
    icon: React.ReactNode;
    placeholder: string;
  }[] = [
    {
      key: "scholar", label: "Google Scholar",
      icon: <GraduationCap size={16} color="#4285F4" />,
      placeholder: "https://scholar.google.com/citations?user=...",
    },
    {
      key: "linkedin", label: "LinkedIn",
      icon: <LinkedinIcon />,
      placeholder: "https://linkedin.com/in/yourname",
    },
    {
      key: "researchgate", label: "ResearchGate",
      icon: <BookOpen size={16} color="#00CCBB" />,
      placeholder: "https://researchgate.net/profile/...",
    },
    {
      key: "twitter", label: "Twitter / X",
      icon: <TwitterIcon />,
      placeholder: "https://twitter.com/yourhandle",
    },
    {
      key: "website", label: "Personal website",
      icon: <Globe size={16} color="#6B6B6B" />,
      placeholder: "https://yourname.com",
    },
    {
      key: "orcid", label: "ORCID",
      icon: <LinkIcon size={16} color="#A6CE39" />,
      placeholder: "https://orcid.org/0000-0000-0000-0000",
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  const memberSinceDate = projectCreatedAt
    ? new Date(projectCreatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";
  const roleBadgeLabel = isPi ? "Principal Investigator" : "Researcher";

  return (
    <div style={{ padding: "40px 24px", backgroundColor: "var(--color-canvas)", minHeight: "100%" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Back link */}
        <button
          onClick={() => router.back()}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13,
            color: "#1B2E4B", textDecoration: "none", padding: 0, marginBottom: 24,
            minHeight: 44,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
        >
          <ChevronLeft size={16} />
          Back
        </button>

        {/* ── Header section ─────────────────────────────────────────────── */}
        <div style={{
          backgroundColor: "#fff", borderRadius: 10, border: "1px solid #DDE1E7",
          padding: "28px 28px 24px", marginBottom: 24,
          display: "flex", gap: 28, alignItems: "flex-start",
        }}>
          {/* Avatar column */}
          <div style={{ width: 140, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            {/* Avatar circle */}
            {photo ? (
              <img
                src={photo}
                alt={name}
                style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 96, height: 96, borderRadius: "50%", flexShrink: 0,
                backgroundColor: avatarColor,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 28, color: "#3a3a3a",
                userSelect: "none",
              }}>
                {avatarInitials}
              </div>
            )}

            {/* Change photo button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePhotoChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                height: 36, minHeight: 44, padding: "0 12px",
                backgroundColor: "#fff", border: "1px solid #DDE1E7", borderRadius: 7,
                fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 11,
                color: "#1B2E4B", cursor: "pointer", whiteSpace: "nowrap",
                display: "flex", alignItems: "center",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#B8C4D4"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#DDE1E7"; }}
            >
              Change photo
            </button>

            {photo && (
              <button
                onClick={handleRemovePhoto}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: "var(--font-roboto)", fontWeight: 400, fontSize: 12,
                  color: "#C0392B", padding: 0, minHeight: 44, display: "flex", alignItems: "center",
                }}
              >
                Remove photo
              </button>
            )}
          </div>

          {/* Info column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name row + edit button */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingName ? (
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                    style={{
                      fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 24,
                      color: "#1B2E4B", border: "none", borderBottom: "2px solid #1B2E4B",
                      outline: "none", background: "transparent", width: "100%",
                      padding: "0 0 2px",
                    }}
                  />
                ) : (
                  <h1
                    onClick={() => { setNameInput(name); setEditingName(true); }}
                    title="Click to edit"
                    style={{
                      fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 24,
                      color: name ? "#1B2E4B" : "#9BAFC4", margin: 0, cursor: "text",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}
                  >
                    {name || "Set up your profile"}
                  </h1>
                )}
              </div>

              {/* Edit / Save+Cancel controls */}
              {!editMode ? (
                <button
                  onClick={handleEnterEditMode}
                  style={{
                    height: 36, minHeight: 44, padding: "0 14px", flexShrink: 0,
                    backgroundColor: "#fff", border: "1px solid #DDE1E7", borderRadius: 8,
                    fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 12,
                    color: "#1B2E4B", cursor: "pointer", display: "flex", alignItems: "center",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#B8C4D4"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#DDE1E7"; }}
                >
                  Edit profile
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={handleSaveProfile}
                    style={{
                      height: 36, minHeight: 44, padding: "0 14px",
                      backgroundColor: "#1B2E4B", color: "#fff",
                      border: "none", borderRadius: 8,
                      fontFamily: "var(--font-roboto)", fontWeight: 700, fontSize: 12,
                      cursor: "pointer", display: "flex", alignItems: "center",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#2E4A6F"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#1B2E4B"; }}
                  >
                    Save changes
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    style={{
                      height: 36, minHeight: 44, padding: "0 12px",
                      backgroundColor: "#fff", color: "#6B6B6B",
                      border: "1px solid #DDE1E7", borderRadius: 8,
                      fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 12,
                      cursor: "pointer", display: "flex", alignItems: "center",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Role badge */}
            <div style={{ marginBottom: 8 }}>
              <span style={{
                display: "inline-block", padding: "3px 10px", borderRadius: 20,
                backgroundColor: "#1B2E4B", color: "#fff",
                fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 11,
              }}>
                {roleBadgeLabel}
              </span>
            </div>

            {/* Institution */}
            {editingInstitution ? (
              <input
                autoFocus
                value={institutionInput}
                onChange={(e) => setInstitutionInput(e.target.value)}
                onBlur={handleSaveInstitution}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveInstitution(); if (e.key === "Escape") setEditingInstitution(false); }}
                style={{
                  fontFamily: "var(--font-roboto)", fontWeight: 400, fontSize: 14,
                  color: "#6B6B6B", border: "none", borderBottom: "1px solid #1B2E4B",
                  outline: "none", background: "transparent", width: "100%", padding: "0 0 2px",
                }}
              />
            ) : (
              <p
                onClick={() => { setInstitutionInput(institution); setEditingInstitution(true); }}
                title="Click to edit"
                style={{
                  fontFamily: "var(--font-roboto)", fontWeight: 400, fontSize: 14,
                  color: "#6B6B6B", margin: 0, cursor: "text",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
                }}
              >
                {institution}
              </p>
            )}
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div style={{
          backgroundColor: "#fff", borderRadius: 10, border: "1px solid #DDE1E7",
          overflow: "hidden",
        }}>
          {/* Tab bar */}
          <div style={{
            display: "flex", borderBottom: "1px solid #DDE1E7",
            paddingLeft: 4,
          }}>
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "0 20px", height: 48, minHeight: 44,
                    background: "none", border: "none", cursor: "pointer",
                    fontFamily: "var(--font-roboto)", fontWeight: active ? 600 : 400,
                    fontSize: 14, color: active ? "#1B2E4B" : "#6B6B6B",
                    borderBottom: active ? "2px solid #1B2E4B" : "2px solid transparent",
                    transition: "color 120ms ease, border-color 120ms ease",
                    marginBottom: -1,
                  }}
                >
                  {tab.id === "lab_settings" && <Settings size={14} />}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div style={{ padding: 28 }}>

            {/* ── ABOUT ──────────────────────────────────────────────────── */}
            {activeTab === "about" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                {/* Bio */}
                <div>
                  <SectionLabel>Bio</SectionLabel>
                  {editMode ? (
                    <FieldInput
                      value={draftBio}
                      onChange={setDraftBio}
                      placeholder="Tell your team a bit about your research background and what brought you to this work."
                      multiline
                    />
                  ) : (
                    <p style={{
                      fontFamily: "var(--font-roboto)", fontWeight: 400, fontSize: 14,
                      color: bio ? "#2D2D2D" : "#6B6B6B", lineHeight: 1.7, margin: 0,
                    }}>
                      {bio || "No bio yet."}
                    </p>
                  )}
                </div>

                {/* Research Interests */}
                <div>
                  <SectionLabel>Research Interests</SectionLabel>
                  {editMode ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {draftInterests.map((tag) => (
                          <TagPill
                            key={tag}
                            label={tag}
                            onRemove={() => setDraftInterests((prev) => prev.filter((t) => t !== tag))}
                          />
                        ))}
                      </div>
                      {draftInterests.length < 8 && (
                        <input
                          type="text"
                          value={interestInput}
                          onChange={(e) => setInterestInput(e.target.value)}
                          onKeyDown={handleAddInterest}
                          placeholder="Add a research interest and press Enter"
                          style={{
                            height: 36, border: "1px solid #DDE1E7", borderRadius: 8,
                            padding: "0 14px", fontFamily: "var(--font-roboto)",
                            fontWeight: 400, fontSize: 13, color: "#2D2D2D",
                            outline: "none", boxSizing: "border-box",
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = "#1B2E4B"; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = "#DDE1E7"; }}
                        />
                      )}
                    </div>
                  ) : (
                    interests.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {interests.map((tag) => <TagPill key={tag} label={tag} />)}
                      </div>
                    ) : (
                      <p style={{ fontFamily: "var(--font-roboto)", fontSize: 14, color: "#6B6B6B", margin: 0 }}>
                        No interests added yet.
                      </p>
                    )
                  )}
                </div>

                {/* Department */}
                <div>
                  <SectionLabel>Department</SectionLabel>
                  {editMode ? (
                    <FieldInput
                      value={draftDepartment}
                      onChange={setDraftDepartment}
                      placeholder="e.g. Department of Psychology"
                    />
                  ) : (
                    <p style={{
                      fontFamily: "var(--font-roboto)", fontWeight: 400, fontSize: 14,
                      color: department ? "#2D2D2D" : "#6B6B6B", margin: 0,
                    }}>
                      {department || "Not specified."}
                    </p>
                  )}
                </div>

                {/* Member since */}
                <div>
                  <SectionLabel>Member since</SectionLabel>
                  <p style={{ fontFamily: "var(--font-roboto)", fontWeight: 400, fontSize: 14, color: "#6B6B6B", margin: 0 }}>
                    {memberSinceDate}
                  </p>
                </div>
              </div>
            )}

            {/* ── LINKS ──────────────────────────────────────────────────── */}
            {activeTab === "links" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {linkPlatforms.map(({ key, label, icon, placeholder }) => {
                  const value = editMode ? draftLinks[key] : links[key];
                  return (
                    <div
                      key={key}
                      style={{
                        backgroundColor: "#fff", borderRadius: 10, border: "1px solid #DDE1E7",
                        padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                        {icon}
                      </div>
                      <span style={{
                        fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13,
                        color: "#2D2D2D", width: 120, flexShrink: 0,
                      }}>
                        {label}
                      </span>
                      {editMode ? (
                        <input
                          type="url"
                          value={draftLinks[key]}
                          onChange={(e) => setDraftLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={placeholder}
                          style={{
                            flex: 1, height: 36, border: "1px solid #DDE1E7", borderRadius: 8,
                            padding: "0 14px", fontFamily: "var(--font-roboto)",
                            fontWeight: 400, fontSize: 13, color: "#2D2D2D",
                            outline: "none", boxSizing: "border-box",
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = "#1B2E4B"; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = "#DDE1E7"; }}
                        />
                      ) : value ? (
                        <a
                          href={value}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            flex: 1, fontFamily: "var(--font-roboto)", fontWeight: 400,
                            fontSize: 13, color: "#1B2E4B", textDecoration: "none",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
                        >
                          {value.length > 40 ? value.slice(0, 40) + "…" : value}
                        </a>
                      ) : (
                        <span style={{ flex: 1, fontFamily: "var(--font-roboto)", fontSize: 13, color: "#6B6B6B" }}>
                          Not added
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── ACTIVITY ───────────────────────────────────────────────── */}
            {activeTab === "activity" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                {/* Stat cards 2x2 */}
                <div>
                  <SectionLabel>Task Summary</SectionLabel>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <StatCard label="To Do" count={taskCounts.todo} />
                    <StatCard label="In Progress" count={taskCounts.in_progress} />
                    <StatCard label="In Review" count={taskCounts.in_review} />
                    <StatCard label="Done" count={taskCounts.done} />
                  </div>
                </div>

                {/* Recent tasks */}
                <div>
                  <SectionLabel>Recent Task Activity</SectionLabel>
                  {recentTasks.length === 0 ? (
                    <p style={{ fontFamily: "var(--font-roboto)", fontSize: 14, color: "#6B6B6B", margin: 0 }}>
                      No tasks assigned yet.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {recentTasks.map((task) => (
                        <div
                          key={task.id}
                          style={{
                            backgroundColor: "#fff", borderRadius: 8, border: "1px solid #DDE1E7",
                            padding: "12px 16px", display: "flex", alignItems: "center",
                            gap: 12, flexWrap: "wrap",
                          }}
                        >
                          <span style={{
                            flex: 1, fontFamily: "var(--font-roboto)", fontWeight: 500,
                            fontSize: 13, color: "#2D2D2D", minWidth: 0,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {task.title}
                          </span>
                          <span style={{
                            padding: "3px 10px", borderRadius: 20,
                            backgroundColor: STATUS_COLORS[task.status] + "18",
                            color: STATUS_COLORS[task.status],
                            fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 11,
                            flexShrink: 0,
                          }}>
                            {STATUS_LABELS[task.status]}
                          </span>
                          {task.dueDate && (
                            <span style={{
                              fontFamily: "var(--font-roboto)", fontWeight: 400, fontSize: 12,
                              color: "#6B6B6B", flexShrink: 0,
                            }}>
                              Due {new Date(task.dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Literature contributions */}
                <div>
                  <SectionLabel>Literature Contributions</SectionLabel>
                  <p style={{ fontFamily: "var(--font-roboto)", fontWeight: 400, fontSize: 13, color: "#6B6B6B", margin: 0 }}>
                    {litCount} {litCount === 1 ? "item" : "items"} added to the Lab Library
                  </p>
                </div>

                {/* Journal streak */}
                <div>
                  <SectionLabel>Journal</SectionLabel>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <p style={{ fontFamily: "var(--font-roboto)", fontWeight: 400, fontSize: 13, color: "#6B6B6B", margin: 0 }}>
                      {journalStreak} journal {journalStreak === 1 ? "entry" : "entries"} this month
                    </p>
                    <Lock size={13} color="#6B6B6B" />
                    <span style={{ fontFamily: "var(--font-roboto)", fontSize: 12, color: "#6B6B6B" }}>
                      Only you can see this
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── LAB SETTINGS (PI only) ──────────────────────────────────── */}
            {activeTab === "lab_settings" && isPi && (
              <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                {/* Project name */}
                <div>
                  <SectionLabel>Project Name</SectionLabel>
                  <FieldInput value={projectName} onChange={setProjectName} placeholder="Project name" />
                </div>

                {/* Institution */}
                <div>
                  <SectionLabel>Institution</SectionLabel>
                  <FieldInput value={projectInstitution} onChange={setProjectInstitution} placeholder="Institution name" />
                </div>

                {/* Research type */}
                <div>
                  <SectionLabel>Research Type</SectionLabel>
                  <select
                    value={researchType}
                    onChange={(e) => setResearchType(e.target.value)}
                    style={{
                      height: 40, border: "1px solid #DDE1E7", borderRadius: 8,
                      padding: "0 14px", fontFamily: "var(--font-roboto)",
                      fontWeight: 400, fontSize: 14, color: "#2D2D2D",
                      outline: "none", backgroundColor: "#fff", cursor: "pointer",
                      minWidth: 200,
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#1B2E4B"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#DDE1E7"; }}
                  >
                    {RESEARCH_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Research participation */}
                <div>
                  <SectionLabel>Research Participation</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {RESEARCH_PARTICIPATION_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          fontFamily: "var(--font-roboto)", fontSize: 14, color: "#2D2D2D",
                          cursor: "pointer", minHeight: 44,
                        }}
                      >
                        <input
                          type="radio"
                          name="research_participation"
                          value={opt.value}
                          checked={researchParticipation === opt.value}
                          onChange={() => setResearchParticipation(opt.value)}
                          style={{ accentColor: "#1B2E4B", width: 16, height: 16, flexShrink: 0 }}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <p style={{
                    fontFamily: "var(--font-roboto)", fontWeight: 400, fontSize: 12,
                    color: "#6B6B6B", marginTop: 8,
                  }}>
                    This controls how your lab's anonymized data contributes to Canopy's research publications.
                  </p>
                </div>

                {/* Journal prompt management */}
                <div>
                  <SectionLabel>Journal Prompts</SectionLabel>
                  <button
                    onClick={() => setPromptModalOpen(true)}
                    style={{
                      height: 44, padding: "0 20px",
                      backgroundColor: "#fff", border: "1px solid #DDE1E7", borderRadius: 8,
                      fontFamily: "var(--font-roboto)", fontWeight: 600, fontSize: 13,
                      color: "#1B2E4B", cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#B8C4D4"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#DDE1E7"; }}
                  >
                    Manage prompts ({activePromptIds.length} active)
                  </button>
                </div>

                {/* Save lab settings */}
                <button
                  onClick={handleSaveLabSettings}
                  style={{
                    alignSelf: "flex-start", height: 44, padding: "0 24px",
                    backgroundColor: "#1B2E4B", color: "#fff", border: "none",
                    borderRadius: 8, fontFamily: "var(--font-roboto)", fontWeight: 700,
                    fontSize: 13, cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#2E4A6F"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#1B2E4B"; }}
                >
                  Save lab settings
                </button>

                {/* Danger zone */}
                <div style={{
                  border: "1px solid #C0392B", borderRadius: 10, padding: 16, marginTop: 8,
                }}>
                  <p style={{
                    fontFamily: "var(--font-roboto)", fontWeight: 700, fontSize: 13,
                    color: "#C0392B", margin: "0 0 12px",
                  }}>
                    Danger Zone
                  </p>
                  <button
                    onClick={() => setArchiveModalOpen(true)}
                    style={{
                      height: 44, padding: "0 20px",
                      backgroundColor: "#fff", border: "1px solid #C0392B",
                      borderRadius: 8, fontFamily: "var(--font-roboto)", fontWeight: 600,
                      fontSize: 13, color: "#C0392B", cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "#FDF2F1";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = "#fff";
                    }}
                  >
                    Archive project
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {promptModalOpen && (
        <PromptsModal
          activeIds={activePromptIds}
          onSave={handleSavePrompts}
          onClose={() => setPromptModalOpen(false)}
        />
      )}
      {archiveModalOpen && (
        <ArchiveModal onClose={() => setArchiveModalOpen(false)} />
      )}
    </div>
  );
}
