"use client";

import { useState, useEffect } from "react";
import { Plus, Sparkles, Trophy } from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { CURRENT_USER_ID, getUser } from "@/lib/mock-data";
import type { DashboardPost, User } from "@/types";
import Avatar from "@/components/ui/Avatar";

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

// ── Column card ────────────────────────────────────────────────────────────────

function PostColumn({
  label,
  accent,
  Icon,
  posts,
  type,
  projectId,
  userId,
  teamMembers,
  emptyPrompt,
}: {
  label: string;
  accent: string;
  Icon: React.ElementType;
  posts: DashboardPost[];
  type: "opportunity" | "lab_win";
  projectId: string;
  userId: string;
  teamMembers: User[];
  emptyPrompt: string;
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
  const filtered = items.filter((p) => p.type === type).slice(0, 4);
  const total    = items.filter((p) => p.type === type).length;

  return (
    <div className="lab-card" style={{
      flex: 1, minWidth: 200,
      backgroundColor: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
    }}>
      {/* Accent stripe */}
      <div style={{ height: 3, backgroundColor: accent }} />

      {/* Header */}
      <div style={{ padding: "12px 14px 10px", display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={12} style={{ color: accent, flexShrink: 0 }} />
        <span style={{
          fontSize: 10, fontWeight: 700, color: accent,
          textTransform: "uppercase", letterSpacing: "0.09em", flex: 1,
        }}>
          {label}
        </span>
        {total > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: "#fff",
            backgroundColor: accent,
            borderRadius: 20, padding: "2px 8px", lineHeight: "16px",
          }}>
            {total}
          </span>
        )}
        <button
          onClick={() => setShowForm((s) => !s)}
          aria-label={`Add ${label.toLowerCase()}`}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 22, height: 22, borderRadius: 5,
            border: "1px solid var(--color-border)",
            background: "none", cursor: "pointer", color: "var(--color-secondary)",
            transition: "border-color 120ms, color 120ms",
          }}
          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = accent; el.style.color = accent; }}
          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--color-border)"; el.style.color = "var(--color-secondary)"; }}
        >
          <Plus size={11} />
        </button>
      </div>

      {/* Items or empty */}
      {filtered.length === 0 && !showForm ? (
        <div style={{ padding: "12px 14px 16px" }}>
          <p style={{ fontSize: 12, color: "var(--color-secondary)", margin: 0, lineHeight: 1.5 }}>
            {emptyPrompt}
          </p>
        </div>
      ) : (
        <>
          {filtered.map((post, i) => {
            const author = teamMembers.find((u) => u.id === post.authorId) ?? getUser(post.authorId);
            return (
              <div key={post.id} style={{
                padding: "10px 12px",
                borderTop: "1px solid var(--color-border)",
              }}>
                <p style={{
                  fontSize: 13, fontWeight: 500, color: "var(--color-body)",
                  lineHeight: 1.35, marginBottom: 8,
                  overflow: "hidden", display: "-webkit-box",
                  WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                }}>
                  {post.content}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--color-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {author?.name.split(" ")[0] ?? "Someone"} · {relTime(post.createdAt)}
                  </span>
                  {author && <Avatar user={author} size={20} />}
                </div>
              </div>
            );
          })}
          {total > 4 && !showForm && (
            <div style={{ padding: "8px 12px", borderTop: "1px solid var(--color-border)" }}>
              <span style={{ fontSize: 11, color: "var(--color-secondary)" }}>+{total - 4} more</span>
            </div>
          )}
        </>
      )}

      {/* Compose form */}
      {showForm && (
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {currentUser && <Avatar user={currentUser} size={22} />}
            <textarea
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={type === "opportunity" ? "Share an opportunity..." : "Share a lab win..."}
              rows={2}
              style={{
                flex: 1, fontSize: 12, color: "var(--color-body)",
                border: "1px solid var(--color-border)", borderRadius: 6, padding: "6px 8px",
                resize: "vertical", backgroundColor: "var(--color-surface-2)",
                fontFamily: "inherit", outline: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
            <button
              onClick={() => { setShowForm(false); setContent(""); }}
              style={{ fontSize: 11, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={handlePost}
              style={{ fontSize: 11, fontWeight: 700, color: "#fff", backgroundColor: "var(--color-btn-primary)", border: "none", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}
            >
              Post
            </button>
          </div>
        </div>
      )}
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
  if (loading) {
    return (
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {["var(--color-navy)", "#30D158"].map((accent, i) => (
          <div key={i} style={{ flex: 1, minWidth: 200, backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div style={{ height: 3, backgroundColor: accent, opacity: 0.3 }} />
            <div style={{ padding: "12px 14px 10px" }}>
              <div style={{ width: 70, height: 9, borderRadius: 4, backgroundColor: "var(--color-border)", opacity: 0.5 }} className="animate-pulse" />
            </div>
            {[1, 2].map((j) => (
              <div key={j} style={{ padding: "10px 12px", borderTop: "1px solid var(--color-border)" }}>
                <div style={{ width: "90%", height: 12, borderRadius: 4, backgroundColor: "var(--color-border)", opacity: 0.4, marginBottom: 6 }} className="animate-pulse" />
                <div style={{ width: "60%", height: 12, borderRadius: 4, backgroundColor: "var(--color-border)", opacity: 0.3, marginBottom: 8 }} className="animate-pulse" />
                <div style={{ width: "40%", height: 9, borderRadius: 4, backgroundColor: "var(--color-border)", opacity: 0.25 }} className="animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <PostColumn
          label="Opportunities"
          accent="var(--color-navy)"
          Icon={Sparkles}
          posts={posts}
          type="opportunity"
          projectId={projectId}
          userId={userId}
          teamMembers={teamMembers}
          emptyPrompt="Spot something worth pursuing? Share it."
        />
        <PostColumn
          label="Wins"
          accent="#30D158"
          Icon={Trophy}
          posts={posts}
          type="lab_win"
          projectId={projectId}
          userId={userId}
          teamMembers={teamMembers}
          emptyPrompt="Got a win? Big or small, add it here."
        />
      </div>
      <style>{`
        .lab-card { transition: box-shadow 180ms ease, border-color 180ms ease; }
        .lab-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.05) !important; border-color: rgba(0,0,0,0.12) !important; }
      `}</style>
    </>
  );
}
