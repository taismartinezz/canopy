"use client";

import Link from "next/link";
import { formatRelativeTime } from "@/lib/mock-data";
import type { User } from "@/types";
import Avatar from "@/components/ui/Avatar";
import type { AssignedPaper } from "./LiteratureWidget";
import type { ActivityRow } from "./TeamActivityWidget";

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  card:        "#1C1C1E",
  border:      "rgba(84,84,88,0.65)",
  textPrimary: "#F5F5F7",
  textMuted:   "#8E8E93",
  accent:      "#0A84FF",
  sage:        "oklch(0.68 0.09 145)",
  radius:      11,
};

const STATUS_LABEL: Record<AssignedPaper["readingStatus"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Read",
};

function activityVerb(row: ActivityRow): string {
  if (row.action_type === "created") return "created";
  if (row.action_type === "added") return "added";
  if (row.action_type === "moved") return "moved";
  return row.action_type;
}

function activitySuffix(row: ActivityRow): string | null {
  if (row.action_type === "moved" && row.to_status) {
    const labels: Record<string, string> = {
      todo: "To Do", in_progress: "In Progress", in_review: "In Review", done: "Done",
    };
    return `→ ${labels[row.to_status] ?? row.to_status}`;
  }
  return null;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skel({ width = "100%", height = 13 }: { width?: string | number; height?: number }) {
  return (
    <div style={{ width, height, borderRadius: 4, backgroundColor: T.border, opacity: 0.5 }}
      className="animate-pulse" />
  );
}

// ── RailWidget ────────────────────────────────────────────────────────────────

export function RailWidget({
  papers,
  activityRows,
  teamMembers,
  loading,
}: {
  papers: AssignedPaper[];
  activityRows: ActivityRow[];
  teamMembers: User[];
  loading?: boolean;
}) {
  const total = papers.length;
  const read = papers.filter((p) => p.readingStatus === "done").length;
  const unread = papers.filter((p) => p.readingStatus !== "done");
  const pct = total > 0 ? Math.round((read / total) * 100) : 0;

  const cardStyle: React.CSSProperties = {
    backgroundColor: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    overflow: "hidden",
  };

  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ padding: "16px 20px 12px" }}>
          <Skel width="40%" height={11} />
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 4, borderRadius: 2, backgroundColor: T.border, marginBottom: 10 }} />
          </div>
          {[1, 2].map((i) => <div key={i} style={{ marginTop: 8 }}><Skel width={`${50 + i * 15}%`} /></div>)}
        </div>
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 20px" }}>
          <Skel width="40%" height={11} />
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: T.border, flexShrink: 0 }} className="animate-pulse" />
              <div style={{ flex: 1 }}><Skel width="70%" /></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      {/* ── Reading section ── */}
      <div style={{ padding: "16px 20px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, letterSpacing: "0.01em" }}>Reading</span>
          <Link href="/literature" style={{ fontSize: 11, color: T.textMuted, textDecoration: "none" }}>
            See all →
          </Link>
        </div>

        {total === 0 ? (
          <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>No papers assigned to you yet.</p>
        ) : (
          <>
            <p style={{ fontSize: 11, color: T.textMuted, margin: "0 0 6px" }}>
              {read} of {total} paper{total !== 1 ? "s" : ""} read
            </p>
            {/* 4px sage progress bar */}
            <div style={{ height: 4, borderRadius: 2, backgroundColor: T.border, marginBottom: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, backgroundColor: T.sage, borderRadius: 2, transition: "width 0.4s" }} />
            </div>
            {unread.slice(0, 3).map((p) => (
              <Link key={p.id} href="/literature" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, textDecoration: "none" }}>
                <span style={{ fontSize: 12, color: T.textPrimary, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.title}
                </span>
                <span style={{ fontSize: 10, color: T.textMuted, flexShrink: 0 }}>
                  {STATUS_LABEL[p.readingStatus]}
                </span>
              </Link>
            ))}
            {unread.length > 3 && (
              <Link href="/literature" style={{ fontSize: 11, color: T.textMuted, textDecoration: "none" }}>
                +{unread.length - 3} more
              </Link>
            )}
          </>
        )}
      </div>

      {/* ── From the team section ── */}
      <div style={{ borderTop: `1px solid ${T.border}` }}>
        <div style={{ padding: "12px 20px 6px" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, letterSpacing: "0.01em" }}>From the team</span>
        </div>

        {activityRows.length === 0 ? (
          <div style={{ padding: "8px 20px 14px" }}>
            <p style={{ fontSize: 12, color: T.textMuted, margin: 0 }}>No recent activity.</p>
          </div>
        ) : (
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {activityRows.slice(0, 8).map((row, i) => {
              const actor = teamMembers.find((u) => u.id === row.user_id);
              const name = actor?.name.split(" ")[0] ?? "Someone";
              const suffix = activitySuffix(row);
              return (
                <div
                  key={row.id}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "10px 20px",
                    borderBottom: i < Math.min(activityRows.length, 8) - 1 ? `1px solid ${T.border}` : undefined,
                  }}
                >
                  {actor && <Avatar user={actor} size={24} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: T.textPrimary, margin: 0, lineHeight: 1.45 }}>
                      <strong style={{ fontWeight: 600 }}>{name}</strong>{" "}
                      {activityVerb(row)}{" "}
                      <span style={{ fontWeight: 500 }}>{row.item_name}</span>
                      {suffix && <span style={{ color: T.textMuted }}> {suffix}</span>}
                    </p>
                    <p style={{ fontSize: 11, color: T.textMuted, margin: "2px 0 0" }}>
                      {formatRelativeTime(row.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
