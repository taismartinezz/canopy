"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { CURRENT_USER_ID, getUser } from "@/lib/mock-data";
import type { DashboardPost, User } from "@/types";
import Avatar from "@/components/ui/Avatar";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  card:        "oklch(0.19 0.006 60)",
  border:      "oklch(0.28 0.006 60)",
  textPrimary: "oklch(0.93 0.006 70)",
  textMuted:   "oklch(0.61 0.008 70)",
  accent:      "oklch(0.78 0.13 75)",
  radius:      11,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1mo ago" : `${months}mo ago`;
}

// ── Column ────────────────────────────────────────────────────────────────────

function PostColumn({
  label,
  posts,
  type,
  projectId,
  userId,
  teamMembers,
  borderRight,
}: {
  label: string;
  posts: DashboardPost[];
  type: "opportunity" | "lab_win";
  projectId: string;
  userId: string;
  teamMembers: User[];
  borderRight?: boolean;
}) {
  const [items, setItems] = useState<DashboardPost[]>(posts);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const table = type === "lab_win" ? "lab_wins" : "opportunities";

  useEffect(() => { setItems(posts); }, [posts]);

  async function handlePost() {
    if (!content.trim()) return;
    if (isSupabaseConfigured && projectId && userId) {
      const { data, error } = await supabase
        .from(table)
        .insert({ project_id: projectId, author_id: userId, content: content.trim() })
        .select().single();
      if (!error && data) {
        setItems((prev) => [{
          id: data.id as string,
          authorId: data.author_id as string,
          content: data.content as string,
          createdAt: data.created_at as string,
          type,
        }, ...prev]);
      }
    } else {
      setItems((prev) => [{
        id: crypto.randomUUID(), authorId: CURRENT_USER_ID,
        content: content.trim(), createdAt: new Date().toISOString(), type,
      }, ...prev]);
    }
    setContent(""); setShowForm(false);
  }

  const currentUser = teamMembers.find((u) => u.id === userId) ?? getUser(CURRENT_USER_ID);
  const filtered = items.filter((p) => p.type === type).slice(0, 3);

  return (
    <div style={{ flex: 1, minWidth: 0, padding: "12px 16px", borderRight: borderRight ? `1px solid ${T.border}` : undefined }}>
      {/* Column label + add button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
        <button
          onClick={() => setShowForm((s) => !s)}
          style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: T.textMuted, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Posts */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 && !showForm && (
          <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>Nothing posted yet.</p>
        )}
        {filtered.map((post) => {
          const author = teamMembers.find((u) => u.id === post.authorId) ?? getUser(post.authorId);
          return (
            <div key={post.id} style={{ display: "flex", gap: 8 }}>
              {author && <Avatar user={author} size={20} />}
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, color: T.textPrimary, margin: 0, lineHeight: 1.45 }}>
                  {post.content}
                </p>
                <p style={{ fontSize: 11, color: T.textMuted, margin: "2px 0 0" }}>
                  shared by {author?.name.split(" ")[0] ?? "Someone"} · {relTime(post.createdAt)}
                </p>
              </div>
            </div>
          );
        })}

        {showForm && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {currentUser && <Avatar user={currentUser} size={20} />}
              <textarea
                autoFocus
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={type === "opportunity" ? "Share an opportunity…" : "Share a lab win…"}
                rows={2}
                style={{
                  flex: 1, fontSize: 12, color: T.textPrimary,
                  border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 8px",
                  resize: "vertical", backgroundColor: "oklch(0.15 0.006 60)",
                  fontFamily: "inherit", outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowForm(false); setContent(""); }}
                style={{ fontSize: 11, color: T.textMuted, background: "none", border: "none", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handlePost}
                style={{ fontSize: 11, fontWeight: 700, color: "oklch(0.15 0.006 60)", backgroundColor: T.accent, border: "none", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}
              >
                Post
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── LabPulseWidget ─────────────────────────────────────────────────────────────

export function LabPulseWidget({
  posts,
  projectId,
  userId,
  teamMembers,
  loading,
}: {
  posts: DashboardPost[];
  projectId: string;
  userId: string;
  teamMembers: User[];
  loading?: boolean;
}) {
  const cardStyle: React.CSSProperties = {
    backgroundColor: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    overflow: "hidden",
  };

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ padding: "14px 20px 12px", borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Lab pulse</span>
        </div>
        <div style={{ display: "flex" }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ flex: 1, padding: "12px 16px", borderRight: i === 0 ? `1px solid ${T.border}` : undefined }}>
              <div style={{ width: 70, height: 10, borderRadius: 4, backgroundColor: T.border, opacity: 0.5, marginBottom: 10 }} />
              <div style={{ width: "80%", height: 12, borderRadius: 4, backgroundColor: T.border, opacity: 0.4, marginBottom: 6 }} />
              <div style={{ width: "60%", height: 12, borderRadius: 4, backgroundColor: T.border, opacity: 0.3 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ padding: "14px 20px 12px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, letterSpacing: "0.01em" }}>Lab pulse</span>
      </div>

      {/* Two columns */}
      <div style={{ display: "flex" }}>
        <PostColumn
          label="Opportunity"
          posts={posts}
          type="opportunity"
          projectId={projectId}
          userId={userId}
          teamMembers={teamMembers}
          borderRight
        />
        <PostColumn
          label="Lab Win"
          posts={posts}
          type="lab_win"
          projectId={projectId}
          userId={userId}
          teamMembers={teamMembers}
        />
      </div>
    </div>
  );
}
