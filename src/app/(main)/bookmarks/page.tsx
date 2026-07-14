"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, ExternalLink, Trash2, Bookmark, X, Check,
  FileText, BookOpen, FlaskConical, ClipboardList, Link2, Code2, Play, Table,
  ChevronLeft, ChevronRight, Users, User as UserIcon,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";
import type { SubProject } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type BookmarkType = "doc" | "paper" | "protocol" | "supplies" | "code" | "video" | "sheet" | "link";
type FilterCategory = "all" | BookmarkType;

interface BookmarkRow {
  id: string;
  project_id: string;
  url: string;
  title: string;
  added_by: string | null;
  added_at: string;
  adder_name?: string;
  scope?: string;
  sub_project_id?: string | null;
}

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<BookmarkType, {
  label: string;
  badge: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}> = {
  doc:      { label: "Docs",      badge: "doc",      icon: FileText,     color: "#2563EB", bg: "rgba(37,99,235,0.10)" },
  paper:    { label: "Papers",    badge: "paper",    icon: BookOpen,     color: "#B45309", bg: "rgba(180,83,9,0.10)" },
  protocol: { label: "Protocols", badge: "protocol", icon: ClipboardList, color: "#6D28D9", bg: "rgba(109,40,217,0.10)" },
  supplies: { label: "Supplies",  badge: "supplier", icon: FlaskConical, color: "#0D7A5F", bg: "rgba(13,122,95,0.10)" },
  code:     { label: "Code",      badge: "code",     icon: Code2,        color: "#334155", bg: "rgba(51,65,85,0.10)" },
  video:    { label: "Videos",    badge: "video",    icon: Play,         color: "#B91C1C", bg: "rgba(185,28,28,0.10)" },
  sheet:    { label: "Sheets",    badge: "sheet",    icon: Table,        color: "#15803D", bg: "rgba(21,128,61,0.10)" },
  link:     { label: "Links",     badge: "link",     icon: Link2,        color: "#475569", bg: "rgba(71,85,105,0.10)" },
};

type BmScope = "all" | "personal" | "lab" | "project";

const SCOPE_CONFIG: Record<"all" | "personal" | "lab", { label: string; color: string; icon: React.ElementType }> = {
  all:      { label: "All",      color: "#475569", icon: Bookmark  },
  personal: { label: "Personal", color: "#0EA5E9", icon: UserIcon  },
  lab:      { label: "Lab",      color: "#0F2544", icon: Users     },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferType(url: string): BookmarkType {
  try {
    const { hostname: h, pathname: p } = new URL(url);
    const host = h.replace(/^www\./, "");
    if (host === "docs.google.com") return "doc";
    if (host === "sheets.google.com") return "sheet";
    if (host.includes("notion.so") || host.includes("confluence") || host.includes("sharepoint.com")) return "doc";
    if (host.includes("protocols.io") || p.toLowerCase().includes("protocol")) return "protocol";
    if (
      host.includes("ncbi.nlm") || host.includes("pubmed") ||
      host.includes("psycnet.apa.org") || host.includes("scholar.google") ||
      host.includes("biorxiv.org") || host.includes("medrxiv.org") ||
      host.includes("semanticscholar.org") || host.includes("nature.com") ||
      host.includes("nejm.org") || host.includes("cell.com") ||
      host.includes("apa.org") || host.includes("tandfonline.com") ||
      host.includes("wiley.com") || host.includes("jstor.org")
    ) return "paper";
    if (host === "github.com" || host.includes("gitlab.com")) return "code";
    if (host === "youtube.com" || host === "youtu.be" || host.includes("vimeo.com")) return "video";
    if (
      host.includes("thermofisher") || host.includes("sigmaaldrich") ||
      host.includes("fishersci") || host.includes("grainger") ||
      host.includes("vwr.com") || host.includes("biolegend") ||
      host.includes("addgene.org") || host.includes("millipore") ||
      host.includes("qiagen.com") || host.includes("abcam.com")
    ) return "supplies";
    return "link";
  } catch { return "link"; }
}

function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function relTime(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : null;
  } catch { return null; }
}

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_BOOKMARKS: BookmarkRow[] = [
  { id: "d1", project_id: "demo", url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7523697/", title: "Moral Injury in Healthcare Workers — PMC", added_by: null, added_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), adder_name: "Dr. Yara Osei" },
  { id: "d2", project_id: "demo", url: "https://psycnet.apa.org/record/2009-05485-004", title: "Moral Injury and Moral Repair in War Veterans", added_by: null, added_at: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(), adder_name: "Tais Martinez" },
  { id: "d3", project_id: "demo", url: "https://docs.google.com/document/d/1/edit", title: "Interview Protocol — Wave 2", added_by: null, added_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), adder_name: "Dana Kim" },
  { id: "d4", project_id: "demo", url: "https://docs.google.com/document/d/2/edit", title: "Consent Form Template v3", added_by: null, added_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), adder_name: "Dr. Yara Osei" },
  { id: "d5", project_id: "demo", url: "https://www.sigmaaldrich.com/US/en/product/sigma/m3148", title: "Morphine Sulfate Salt — Sigma-Aldrich", added_by: null, added_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), adder_name: "Dr. Yara Osei" },
  { id: "d6", project_id: "demo", url: "https://www.protocols.io/view/interview-guide-bwcjhau", title: "Structured Interview Guide for Moral Injury", added_by: null, added_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), adder_name: "Tais Martinez" },
  { id: "d7", project_id: "demo", url: "https://sheets.google.com/spreadsheets/d/1/edit", title: "Participant Tracking — Spring 2025", added_by: null, added_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), adder_name: "Dana Kim" },
  { id: "d8", project_id: "demo", url: "https://github.com/osei-lab/interview-analysis", title: "interview-analysis — GitHub", added_by: null, added_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), adder_name: "Tais Martinez" },
];

// ── Sidebar row ───────────────────────────────────────────────────────────────

function SidebarRow({
  icon, label, count, active, typeBg, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  typeBg?: string;
  onClick: () => void;
}) {
  const color = typeBg ?? "var(--color-navy)";
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px 6px 11px",
        borderRadius: 7,
        border: "none",
        borderLeft: `3px solid ${active ? color : "transparent"}`,
        cursor: "pointer",
        backgroundColor: active ? `${color}18` : "transparent",
        marginBottom: 1,
        transition: "background-color 120ms ease, border-left-color 120ms ease",
        textAlign: "left",
        boxSizing: "border-box",
        fontFamily: "var(--font-roboto)",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,0,0,0.04)"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
    >
      <span style={{ flexShrink: 0, display: "flex", alignItems: "center", color: active ? color : "var(--color-secondary)", opacity: active ? 1 : 0.7, transition: "color 120ms ease" }}>
        {icon}
      </span>
      <span style={{
        flex: 1,
        fontSize: 13,
        color: active ? color : "var(--color-body)",
        fontWeight: active ? 600 : 400,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontFamily: "var(--font-roboto)",
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: active ? color : "var(--color-secondary)",
        backgroundColor: active ? `${color}20` : "rgba(0,0,0,0.06)",
        borderRadius: 10,
        padding: "1px 7px",
        flexShrink: 0,
        minWidth: 20,
        textAlign: "center",
        transition: "all 120ms ease",
      }}>
        {count}
      </span>
    </button>
  );
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddForm({ onAdd, onCancel }: {
  onAdd: (url: string, title: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [urlError, setUrlError] = useState("");
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => { urlRef.current?.focus(); }, []);

  async function handleUrlBlur() {
    if (!url || !isValidUrl(url) || title) return;
    setFetching(true);
    const fetched = await fetchPageTitle(url);
    setTitle(fetched ?? hostname(url));
    setFetching(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidUrl(url)) { setUrlError("Enter a valid URL (https://…)"); return; }
    setSaving(true);
    const finalTitle = title.trim() || hostname(url);
    await onAdd(url.trim(), finalTitle);
    setSaving(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-fade-in"
      style={{
        marginBottom: 24,
        borderRadius: 10,
        padding: 20,
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-navy)",
        boxShadow: "0 4px 20px rgba(27,46,75,0.10)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 15, color: "var(--color-navy)" }}>
          Add bookmark
        </span>
        <button
          type="button"
          onClick={onCancel}
          style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", background: "none", cursor: "pointer" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(27,46,75,0.06)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
          aria-label="Cancel"
        >
          <X size={16} color="var(--color-secondary)" />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-secondary)", display: "block", marginBottom: 5 }}>URL *</label>
          <input
            ref={urlRef}
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setUrlError(""); }}
            onBlur={handleUrlBlur}
            placeholder="https://example.com"
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", fontSize: 13, border: `1px solid ${urlError ? "#C0392B" : "var(--color-border)"}`, borderRadius: 7, outline: "none", fontFamily: "var(--font-roboto)", color: "var(--color-body)", backgroundColor: "var(--color-canvas)" }}
          />
          {urlError && <p style={{ fontSize: 12, color: "#C0392B", marginTop: 4 }}>{urlError}</p>}
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-secondary)", display: "block", marginBottom: 5 }}>
            Title <span style={{ fontWeight: 400 }}>(auto-filled from URL if blank)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={fetching ? "Fetching title…" : "Page title"}
            disabled={fetching}
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", fontSize: 13, border: "1px solid var(--color-border)", borderRadius: 7, outline: "none", fontFamily: "var(--font-roboto)", color: "var(--color-body)", backgroundColor: "var(--color-canvas)", opacity: fetching ? 0.6 : 1 }}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
        <button
          type="submit"
          disabled={saving || fetching}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", height: 40, backgroundColor: "var(--color-navy)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 7, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
        >
          <Check size={14} />
          {saving ? "Saving…" : "Add bookmark"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ fontSize: 13, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer", padding: "0 8px", height: 40 }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Bookmark card ─────────────────────────────────────────────────────────────

function BookmarkCard({ bm, canDelete, onDelete }: {
  bm: BookmarkRow;
  canDelete: boolean;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [hovered, setHovered] = useState(false);
  const type = inferType(bm.url);
  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.icon;

  async function handleDelete() {
    setDeleting(true);
    await onDelete(bm.id);
    setDeleting(false);
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "var(--color-surface)",
        border: `1px solid ${hovered ? "#C0CBD8" : "var(--color-border)"}`,
        borderRadius: 10,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        minHeight: 148,
        boxShadow: hovered ? "var(--shadow-card)" : "none",
        transition: "border-color 150ms ease, box-shadow 150ms ease",
      }}
    >
      {/* Top row: type icon + badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: cfg.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon size={16} color={cfg.color} />
        </div>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: cfg.color,
          backgroundColor: cfg.bg,
          borderRadius: 5,
          padding: "3px 8px",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          flexShrink: 0,
        }}>
          {cfg.badge}
        </span>
      </div>

      {/* Title */}
      <a
        href={bm.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--color-body)",
          textDecoration: "none",
          lineHeight: 1.45,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const,
          overflow: "hidden",
          marginBottom: 5,
        }}
      >
        {bm.title}
      </a>

      {/* Domain */}
      <p style={{
        fontSize: 11,
        color: "var(--color-secondary)",
        marginBottom: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {hostname(bm.url)}
      </p>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Bottom row: contributor · time + actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
        <span style={{ fontSize: 11, color: "var(--color-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, paddingRight: 8 }}>
          {bm.adder_name ?? "Unknown"} · {relTime(bm.added_at)}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <a
            href={bm.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, color: "var(--color-secondary)", textDecoration: "none", transition: "background-color 120ms ease, color 120ms ease" }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-navy)"; el.style.backgroundColor = "rgba(27,46,75,0.06)"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-secondary)"; el.style.backgroundColor = "transparent"; }}
            aria-label="Open link"
          >
            <ExternalLink size={12} />
          </a>
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "none", background: "none", cursor: deleting ? "not-allowed" : "pointer", color: "var(--color-secondary)", transition: "background-color 120ms ease, color 120ms ease" }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-error)"; el.style.backgroundColor = "rgba(192,57,43,0.08)"; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = "var(--color-secondary)"; el.style.backgroundColor = "transparent"; }}
              aria-label="Delete bookmark"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BookmarksPage() {
  const { projectId, subProjectId, subProjects } = useProject();
  const [bmScope, setBmScope] = useState<BmScope>("all");
  const [selectedSubProjectId, setSelectedSubProjectId] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  function handleScopeSelect(scope: BmScope, spId?: string) {
    setBmScope(scope);
    setSelectedSubProjectId(spId ?? null);
    setShowForm(false);
    setActiveCategory("all");
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setBookmarks(DEMO_BOOKMARKS);
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setCurrentUserId(session.user.id);
    });
  }, []);

  const fetchBookmarks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bookmarks")
      .select("*, user_profiles!added_by(name)")
      .eq("project_id", projectId)
      .order("added_at", { ascending: false });

    if (error) {
      console.error("[Bookmarks] fetch error:", error);
    } else if (data) {
      setBookmarks(
        data.map((row) => {
          const prof = row.user_profiles as { name?: string } | null;
          return {
            id:             row.id as string,
            project_id:     row.project_id as string,
            url:            row.url as string,
            title:          row.title as string,
            added_by:       row.added_by as string | null,
            added_at:       row.added_at as string,
            adder_name:     prof?.name ?? undefined,
            scope:          (row.scope as string | undefined) ?? "lab",
            sub_project_id: (row.sub_project_id as string | null | undefined) ?? null,
          };
        })
      );
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (isSupabaseConfigured && projectId) fetchBookmarks();
  }, [projectId, fetchBookmarks]);

  async function handleAdd(url: string, title: string) {
    if (!projectId) return;

    const effectiveScope = bmScope === "all" ? "lab" : bmScope;
    const effectiveSubProjectId = bmScope === "project" ? (selectedSubProjectId ?? subProjectId ?? null) : null;

    const optimistic: BookmarkRow = {
      id:             `optimistic-${Date.now()}`,
      project_id:     projectId,
      url,
      title,
      added_by:       currentUserId,
      added_at:       new Date().toISOString(),
      adder_name:     "You",
      scope:          effectiveScope,
      sub_project_id: effectiveSubProjectId,
    };
    setBookmarks((prev) => [optimistic, ...prev]);
    setShowForm(false);

    const { data, error } = await supabase
      .from("bookmarks")
      .insert({
        project_id:     projectId,
        url,
        title,
        added_by:       currentUserId,
        scope:          effectiveScope,
        sub_project_id: effectiveSubProjectId,
      })
      .select("*, user_profiles!added_by(name)")
      .single();

    if (error) {
      console.error("[Bookmarks] insert error:", error);
      setBookmarks((prev) => prev.filter((b) => b.id !== optimistic.id));
      return;
    }

    const prof = data.user_profiles as { name?: string } | null;
    const confirmed: BookmarkRow = {
      id:             data.id as string,
      project_id:     data.project_id as string,
      url:            data.url as string,
      title:          data.title as string,
      added_by:       data.added_by as string | null,
      added_at:       data.added_at as string,
      adder_name:     prof?.name ?? undefined,
      scope:          effectiveScope,
      sub_project_id: effectiveSubProjectId,
    };
    setBookmarks((prev) => prev.map((b) => b.id === optimistic.id ? confirmed : b));
  }

  async function handleDelete(id: string) {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    const { error } = await supabase.from("bookmarks").delete().eq("id", id);
    if (error) {
      console.error("[Bookmarks] delete error:", error);
      fetchBookmarks();
    }
  }

  // Local scope filter (runs in-memory — no extra network calls)
  const scopedBookmarks = bookmarks.filter((bm) => {
    if (bmScope === "all") return true;
    if (bmScope === "project") return bm.scope === "project" && (!selectedSubProjectId || bm.sub_project_id === selectedSubProjectId);
    return bm.scope === bmScope;
  });

  // Scope counts for sidebar
  const scopeCounts = {
    all:      bookmarks.length,
    personal: bookmarks.filter((b) => b.scope === "personal").length,
    lab:      bookmarks.filter((b) => b.scope === "lab").length,
  };
  const projectCounts: Record<string, number> = {};
  for (const sp of subProjects) {
    projectCounts[sp.id] = bookmarks.filter((b) => b.scope === "project" && b.sub_project_id === sp.id).length;
  }

  // Derive category counts from scoped bookmarks
  const categoryCounts = Object.entries(
    scopedBookmarks.reduce((acc, bm) => {
      const t = inferType(bm.url);
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {} as Record<BookmarkType, number>)
  )
    .map(([type, count]) => ({ type: type as BookmarkType, count }))
    .sort((a, b) => b.count - a.count);

  // Apply category filter on top of scoped list
  const filtered = activeCategory === "all"
    ? scopedBookmarks
    : scopedBookmarks.filter((bm) => inferType(bm.url) === activeCategory);

  const emptyLabel = activeCategory === "all"
    ? "No bookmarks yet"
    : `No ${TYPE_CONFIG[activeCategory as BookmarkType]?.label.toLowerCase() ?? "bookmarks"} yet`;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", fontFamily: "var(--font-roboto)" }}>

      {/* ── Left sidebar — desktop only, animated ───────────────────────────── */}
      <div
        className="hidden md:flex group/bkpanel"
        style={{
          width: sidebarCollapsed ? 0 : 220,
          flexShrink: 0,
          backgroundColor: "var(--color-sidebar)",
          flexDirection: "column",
          overflowY: "auto",
          borderRight: sidebarCollapsed ? "none" : "1px solid var(--color-border)",
          overflow: "hidden",
          transition: "width 200ms ease",
        }}
      >
        {/* Sidebar header */}
        <div style={{ padding: "24px 16px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{
            fontFamily: "var(--font-lora)",
            fontWeight: 700,
            fontSize: 16,
            color: "var(--color-navy)",
            margin: 0,
            letterSpacing: "-0.01em",
          }}>
            Bookmarks
          </h2>
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="opacity-0 group-hover/bkpanel:opacity-100 transition-opacity flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]"
            style={{ width: 32, height: 32, border: "none", background: "none", cursor: "pointer", flexShrink: 0 }}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={15} color="var(--color-secondary)" />
          </button>
        </div>

        {/* Nav list */}
        <nav style={{ padding: "4px 8px 16px", flex: 1, minWidth: 220, overflowY: "auto" }} aria-label="Filter bookmarks">

          {/* Scope rows */}
          {(["all", "personal", "lab"] as const).map((s) => {
            const cfg = SCOPE_CONFIG[s];
            const Icon = cfg.icon;
            const isActive = bmScope === s;
            return (
              <SidebarRow
                key={s}
                icon={<Icon size={14} />}
                label={cfg.label}
                count={scopeCounts[s]}
                active={isActive}
                typeBg={cfg.color}
                onClick={() => handleScopeSelect(s)}
              />
            );
          })}

          {/* Per-project rows */}
          {subProjects.length > 0 && (
            <>
              <div style={{ height: 1, backgroundColor: "var(--color-border)", margin: "5px 2px" }} />
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 11px 4px", margin: 0 }}>Projects</p>
              {subProjects.map((sp) => (
                <SidebarRow
                  key={sp.id}
                  icon={<Bookmark size={14} />}
                  label={sp.name}
                  count={projectCounts[sp.id] ?? 0}
                  active={bmScope === "project" && selectedSubProjectId === sp.id}
                  typeBg={sp.color ?? "#34A853"}
                  onClick={() => handleScopeSelect("project", sp.id)}
                />
              ))}
            </>
          )}

          {/* Type filter rows */}
          {categoryCounts.length > 0 && (
            <>
              <div style={{ height: 1, backgroundColor: "var(--color-border)", margin: "5px 2px" }} />
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 11px 4px", margin: 0 }}>Types</p>
              {categoryCounts.map(({ type, count }) => {
                const cfg = TYPE_CONFIG[type];
                const Icon = cfg.icon;
                const active = activeCategory === type;
                return (
                  <SidebarRow
                    key={type}
                    icon={<Icon size={14} />}
                    label={cfg.label}
                    count={count}
                    active={active}
                    typeBg={cfg.color}
                    onClick={() => setActiveCategory(active ? "all" : type)}
                  />
                );
              })}
            </>
          )}
        </nav>
      </div>

      {/* Peek strip — desktop only, when sidebar is collapsed */}
      {sidebarCollapsed && (
        <button
          className="hidden md:flex shrink-0 items-center justify-center transition-colors hover:bg-[rgba(27,46,75,0.04)]"
          style={{ width: 16, border: "none", borderRight: "1px solid var(--color-border)", backgroundColor: "var(--color-sidebar)", cursor: "pointer", padding: 0 }}
          onClick={() => setSidebarCollapsed(false)}
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <ChevronRight size={10} color="var(--color-secondary)" />
        </button>
      )}

      {/* ── Right content area ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", backgroundColor: "var(--color-canvas)" }}>

        {/* Mobile scope + type chips */}
        <div className="md:hidden flex items-center gap-2 px-4 pt-4 pb-2 overflow-x-auto" style={{ borderBottom: "1px solid var(--color-border)", scrollbarWidth: "none" }}>
          {(["all", "personal", "lab"] as const).map((s) => {
            const cfg = SCOPE_CONFIG[s];
            const isAct = bmScope === s && !selectedSubProjectId;
            return (
              <button key={s} onClick={() => handleScopeSelect(s)} style={{ flexShrink: 0, fontSize: 12, fontWeight: isAct ? 700 : 500, padding: "5px 12px", borderRadius: 20, border: `1px solid ${isAct ? cfg.color : "var(--color-border)"}`, backgroundColor: isAct ? `${cfg.color}18` : "transparent", color: isAct ? cfg.color : "var(--color-secondary)", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "var(--font-roboto)" }}>
                {cfg.label} {scopeCounts[s]}
              </button>
            );
          })}
          {subProjects.map((sp) => {
            const isAct = bmScope === "project" && selectedSubProjectId === sp.id;
            const color = sp.color ?? "#34A853";
            return (
              <button key={sp.id} onClick={() => handleScopeSelect("project", sp.id)} style={{ flexShrink: 0, fontSize: 12, fontWeight: isAct ? 700 : 500, padding: "5px 12px", borderRadius: 20, border: `1px solid ${isAct ? color : "var(--color-border)"}`, backgroundColor: isAct ? `${color}18` : "transparent", color: isAct ? color : "var(--color-secondary)", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "var(--font-roboto)" }}>
                {sp.name} {projectCounts[sp.id] ?? 0}
              </button>
            );
          })}
        </div>

        <div style={{ padding: "28px 28px 40px" }}>

          {/* Content header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 20 }}>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "0 16px",
                  height: 40,
                  backgroundColor: "var(--color-navy)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 7,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-navy-hover)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-navy)"; }}
              >
                <Plus size={14} />
                Add
              </button>
            )}
          </div>

          {/* Add form */}
          {showForm && (
            <AddForm onAdd={handleAdd} onCancel={() => setShowForm(false)} />
          )}

          {/* Loading */}
          {loading && (
            <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>Loading bookmarks…</p>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "64px 16px",
              border: "1px dashed var(--color-border)",
              borderRadius: 12,
            }}>
              <Bookmark size={28} color="var(--color-secondary)" style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-body)", marginBottom: 4 }}>
                {emptyLabel}
              </p>
              <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>
                Add one to share a useful link with your lab.
              </p>
              {activeCategory === "all" && (
                <button
                  onClick={() => setShowForm(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 20, padding: "0 16px", height: 40, backgroundColor: "var(--color-navy)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 7, cursor: "pointer" }}
                >
                  <Plus size={14} />
                  Add bookmark
                </button>
              )}
            </div>
          )}

          {/* Card grid */}
          {!loading && filtered.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}>
              {filtered.map((bm) => (
                <BookmarkCard
                  key={bm.id}
                  bm={bm}
                  canDelete={bm.added_by === currentUserId}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
