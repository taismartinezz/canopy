"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, ExternalLink, Trash2, Bookmark, X, Check,
  FileText, BookOpen, FlaskConical, ClipboardList, Link2, Code2, Play, Table,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";

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
}

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<BookmarkType, {
  label: string;
  badge: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}> = {
  doc:      { label: "Docs",      badge: "doc",      icon: FileText,     color: "#60A5FA", bg: "rgba(96,165,250,0.18)" },
  paper:    { label: "Papers",    badge: "paper",    icon: BookOpen,     color: "#FB923C", bg: "rgba(251,146,60,0.18)" },
  protocol: { label: "Protocols", badge: "protocol", icon: ClipboardList, color: "#A78BFA", bg: "rgba(167,139,250,0.18)" },
  supplies: { label: "Supplies",  badge: "supplier", icon: FlaskConical, color: "#34D399", bg: "rgba(52,211,153,0.18)" },
  code:     { label: "Code",      badge: "code",     icon: Code2,        color: "#94A3B8", bg: "rgba(148,163,184,0.18)" },
  video:    { label: "Videos",    badge: "video",    icon: Play,         color: "#F87171", bg: "rgba(248,113,113,0.18)" },
  sheet:    { label: "Sheets",    badge: "sheet",    icon: Table,        color: "#4ADE80", bg: "rgba(74,222,128,0.18)" },
  link:     { label: "Links",     badge: "link",     icon: Link2,        color: "#9CA3AF", bg: "rgba(156,163,175,0.18)" },
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
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 10px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        backgroundColor: active
          ? "rgba(255,255,255,0.14)"
          : hovered
          ? "rgba(255,255,255,0.07)"
          : "transparent",
        marginBottom: 2,
        transition: "background-color 120ms ease",
        textAlign: "left",
      }}
    >
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: active && typeBg ? typeBg : "rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "background-color 120ms ease",
      }}>
        {icon}
      </div>
      <span style={{
        flex: 1,
        fontSize: 13,
        color: active ? "#fff" : "rgba(255,255,255,0.72)",
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
        color: active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.38)",
        backgroundColor: active ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.07)",
        borderRadius: 10,
        padding: "1px 7px",
        flexShrink: 0,
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
        backgroundColor: "#162235",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 10,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        minHeight: 148,
        boxShadow: hovered ? "0 6px 20px rgba(0,0,0,0.28)" : "none",
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
          color: "#F1F5F9",
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
        color: "rgba(255,255,255,0.33)",
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
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, paddingRight: 8 }}>
          {bm.adder_name ?? "Unknown"} · {relTime(bm.added_at)}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <a
            href={bm.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, color: "rgba(255,255,255,0.35)", textDecoration: "none", transition: "background-color 120ms ease, color 120ms ease" }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(255,255,255,0.8)"; el.style.backgroundColor = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(255,255,255,0.35)"; el.style.backgroundColor = "transparent"; }}
            aria-label="Open link"
          >
            <ExternalLink size={12} />
          </a>
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "none", background: "none", cursor: deleting ? "not-allowed" : "pointer", color: "rgba(255,255,255,0.3)", transition: "background-color 120ms ease, color 120ms ease" }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = "#F87171"; el.style.backgroundColor = "rgba(248,113,113,0.12)"; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(255,255,255,0.3)"; el.style.backgroundColor = "transparent"; }}
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
  const { projectId } = useProject();
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("all");

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
            id:         row.id as string,
            project_id: row.project_id as string,
            url:        row.url as string,
            title:      row.title as string,
            added_by:   row.added_by as string | null,
            added_at:   row.added_at as string,
            adder_name: prof?.name ?? undefined,
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

    const optimistic: BookmarkRow = {
      id:         `optimistic-${Date.now()}`,
      project_id: projectId,
      url,
      title,
      added_by:   currentUserId,
      added_at:   new Date().toISOString(),
      adder_name: "You",
    };
    setBookmarks((prev) => [optimistic, ...prev]);
    setShowForm(false);

    const { data, error } = await supabase
      .from("bookmarks")
      .insert({ project_id: projectId, url, title, added_by: currentUserId })
      .select("*, user_profiles!added_by(name)")
      .single();

    if (error) {
      console.error("[Bookmarks] insert error:", error);
      setBookmarks((prev) => prev.filter((b) => b.id !== optimistic.id));
      return;
    }

    const prof = data.user_profiles as { name?: string } | null;
    const confirmed: BookmarkRow = {
      id:         data.id as string,
      project_id: data.project_id as string,
      url:        data.url as string,
      title:      data.title as string,
      added_by:   data.added_by as string | null,
      added_at:   data.added_at as string,
      adder_name: prof?.name ?? undefined,
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

  // Derive category counts from current bookmarks
  const categoryCounts = Object.entries(
    bookmarks.reduce((acc, bm) => {
      const t = inferType(bm.url);
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {} as Record<BookmarkType, number>)
  )
    .map(([type, count]) => ({ type: type as BookmarkType, count }))
    .sort((a, b) => b.count - a.count);

  // Apply active filter
  const filtered = activeCategory === "all"
    ? bookmarks
    : bookmarks.filter((bm) => inferType(bm.url) === activeCategory);

  const emptyLabel = activeCategory === "all"
    ? "No bookmarks yet"
    : `No ${TYPE_CONFIG[activeCategory as BookmarkType]?.label.toLowerCase() ?? "bookmarks"} yet`;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", fontFamily: "var(--font-roboto)" }}>

      {/* ── Left sidebar ────────────────────────────────────────────────────── */}
      <div style={{
        width: 220,
        flexShrink: 0,
        backgroundColor: "#1B2E4B",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Sidebar header */}
        <div style={{ padding: "24px 16px 14px" }}>
          <h2 style={{
            fontFamily: "var(--font-lora)",
            fontWeight: 700,
            fontSize: 16,
            color: "#fff",
            margin: 0,
            letterSpacing: "-0.01em",
          }}>
            Bookmarks
          </h2>
        </div>

        {/* Thin divider */}
        <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 8, marginLeft: 16, marginRight: 16 }} />

        {/* Category list */}
        <nav style={{ padding: "0 8px 16px", flex: 1 }} aria-label="Filter bookmarks by type">
          {/* All */}
          <SidebarRow
            icon={<Bookmark size={14} color={activeCategory === "all" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)"} />}
            label="All"
            count={bookmarks.length}
            active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          />

          {/* Dynamic type rows */}
          {categoryCounts.map(({ type, count }) => {
            const cfg = TYPE_CONFIG[type];
            const Icon = cfg.icon;
            const active = activeCategory === type;
            return (
              <SidebarRow
                key={type}
                icon={<Icon size={14} color={active ? cfg.color : "rgba(255,255,255,0.55)"} />}
                label={cfg.label}
                count={count}
                active={active}
                typeBg={cfg.bg}
                onClick={() => setActiveCategory(type)}
              />
            );
          })}
        </nav>
      </div>

      {/* ── Right content area ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", backgroundColor: "var(--color-canvas)" }}>
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
