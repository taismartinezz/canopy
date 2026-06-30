"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, ExternalLink, Trash2, Bookmark, X, Check } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BookmarkRow {
  id: string;
  project_id: string;
  url: string;
  title: string;
  added_by: string | null;
  added_at: string;
  adder_name?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
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

async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddForm({ onAdd, onCancel }: {
  onAdd: (url: string, title: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [url, setUrl]         = useState("");
  const [title, setTitle]     = useState("");
  const [urlError, setUrlError] = useState("");
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving]   = useState(false);
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
      className="mb-6 rounded-xl p-5"
      style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-navy)", boxShadow: "0 2px 12px rgba(27,46,75,0.08)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 15, color: "var(--color-navy)" }}>
          Add bookmark
        </span>
        <button type="button" onClick={onCancel} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 36, height: 36 }} aria-label="Cancel">
          <X size={16} color="var(--color-secondary)" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-secondary)", display: "block", marginBottom: 5 }}>
            URL *
          </label>
          <input
            ref={urlRef}
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setUrlError(""); }}
            onBlur={handleUrlBlur}
            placeholder="https://example.com"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "9px 12px", fontSize: 13,
              border: `1px solid ${urlError ? "#C0392B" : "var(--color-border)"}`,
              borderRadius: 7, outline: "none",
              fontFamily: "var(--font-roboto)",
              color: "var(--color-body)",
              backgroundColor: "var(--color-canvas)",
            }}
          />
          {urlError && <p style={{ fontSize: 12, color: "#C0392B", marginTop: 4 }}>{urlError}</p>}
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-secondary)", display: "block", marginBottom: 5 }}>
            Title <span style={{ fontWeight: 400 }}>(auto-filled from URL if left blank)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={fetching ? "Fetching title…" : "Page title"}
            disabled={fetching}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "9px 12px", fontSize: 13,
              border: "1px solid var(--color-border)",
              borderRadius: 7, outline: "none",
              fontFamily: "var(--font-roboto)",
              color: "var(--color-body)",
              backgroundColor: fetching ? "var(--color-canvas)" : "var(--color-canvas)",
              opacity: fetching ? 0.6 : 1,
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          type="submit"
          disabled={saving || fetching}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg"
          style={{
            backgroundColor: "var(--color-navy)", color: "#fff",
            fontSize: 13, fontWeight: 700, border: "none",
            borderRadius: 7, cursor: saving ? "not-allowed" : "pointer",
            minHeight: 40, opacity: saving ? 0.7 : 1,
          }}
        >
          <Check size={14} /> {saving ? "Saving…" : "Add bookmark"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{ fontSize: 13, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer", padding: "0 8px", minHeight: 40 }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Bookmark row ──────────────────────────────────────────────────────────────

function BookmarkItem({ bm, canDelete, onDelete }: {
  bm: BookmarkRow;
  canDelete: boolean;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await onDelete(bm.id);
    setDeleting(false);
  }

  return (
    <div
      className="flex items-start justify-between gap-3 px-4 py-3 rounded-lg"
      style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
    >
      <div className="flex items-start gap-3 min-w-0">
        <Bookmark size={15} color="var(--color-secondary)" style={{ marginTop: 2, flexShrink: 0 }} />
        <div className="min-w-0">
          <a
            href={bm.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1"
            style={{ fontSize: 14, fontWeight: 600, color: "var(--color-navy)", textDecoration: "none", wordBreak: "break-word" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
          >
            {bm.title}
            <ExternalLink size={11} style={{ flexShrink: 0 }} />
          </a>
          <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 2, wordBreak: "break-all" }}>
            {hostname(bm.url)}
          </p>
          <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 4 }}>
            {bm.adder_name ? `Added by ${bm.adder_name}` : "Added"} · {relTime(bm.added_at)}
          </p>
        </div>
      </div>
      {canDelete && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center justify-center rounded-lg hover:bg-[rgba(192,57,43,0.08)] shrink-0"
          style={{ width: 36, height: 36, border: "none", background: "none", cursor: deleting ? "not-allowed" : "pointer" }}
          aria-label="Delete bookmark"
        >
          <Trash2 size={14} color={deleting ? "var(--color-secondary)" : "#C0392B"} />
        </button>
      )}
    </div>
  );
}

// ── Demo-mode stub data ───────────────────────────────────────────────────────

const DEMO_BOOKMARKS: BookmarkRow[] = [
  {
    id: "demo-1",
    project_id: "demo",
    url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7523697/",
    title: "Moral Injury in Healthcare Workers — PMC",
    added_by: null,
    added_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    adder_name: "Dr. Yara Osei",
  },
  {
    id: "demo-2",
    project_id: "demo",
    url: "https://psycnet.apa.org/record/2009-05485-004",
    title: "Moral Injury and Moral Repair in War Veterans — APA PsycNet",
    added_by: null,
    added_at: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    adder_name: "Tais Martinez",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BookmarksPage() {
  const { projectId } = useProject();
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col h-full overflow-auto" style={{ fontFamily: "var(--font-roboto)" }}>
      <div className="p-4 md:p-6" style={{ maxWidth: 720 }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 26, color: "var(--color-navy)", margin: 0, lineHeight: 1.2 }}>
              Bookmarks
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 4 }}>
              Links shared across your lab
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--color-navy)", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", borderRadius: 7, cursor: "pointer", minHeight: 44 }}
            >
              <Plus size={14} /> Add bookmark
            </button>
          )}
        </div>

        {/* Add form */}
        {showForm && (
          <AddForm onAdd={handleAdd} onCancel={() => setShowForm(false)} />
        )}

        {/* List */}
        {loading && (
          <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>Loading bookmarks…</p>
        )}

        {!loading && bookmarks.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-xl"
            style={{ border: "1px dashed var(--color-border)", color: "var(--color-secondary)" }}
          >
            <Bookmark size={28} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-body)", marginBottom: 4 }}>
              No bookmarks yet
            </p>
            <p style={{ fontSize: 13 }}>
              Add one to share a useful link with your lab.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 mt-5 px-4 py-2 rounded-lg"
              style={{ backgroundColor: "var(--color-navy)", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 7, cursor: "pointer", minHeight: 40 }}
            >
              <Plus size={14} /> Add bookmark
            </button>
          </div>
        )}

        {!loading && bookmarks.length > 0 && (
          <div className="space-y-2">
            {bookmarks.map((bm) => (
              <BookmarkItem
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
  );
}
