"use client";

import { useState } from "react";
import { formatRelativeTime } from "@/lib/mock-data";
import type { User } from "@/types";
import Avatar from "@/components/ui/Avatar";
import { Card, CardHeader } from "./DashboardCard";

export type ActivityRow = {
  id: string;
  user_id: string;
  action_type: string;
  item_name: string;
  item_type: string;
  from_status?: string;
  to_status?: string;
  created_at: string;
  sub_project_id?: string | null;
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
    return `to ${labels[row.to_status] ?? row.to_status}`;
  }
  return null;
}

export function SkeletonLine({ width = "100%", height = 13 }: { width?: string | number; height?: number }) {
  return (
    <div style={{ width, height, borderRadius: 4, backgroundColor: "var(--color-border)", opacity: 0.6 }}
      className="animate-pulse" />
  );
}

export function TeamActivityWidget({ rows, teamMembers, loading }: { rows: ActivityRow[]; teamMembers: User[]; loading?: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? rows : rows.slice(0, 5);
  const hasMore = rows.length > 5;

  if (loading) {
    return (
      <Card>
        <CardHeader title="Team Activity" />
        <div className="px-5 py-3 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <div style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: "var(--color-border)", flexShrink: 0 }} className="animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <SkeletonLine width="70%" />
                <SkeletonLine width="35%" height={11} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader title="Team Activity" />
        <div className="px-5 py-4">
          <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No activity yet.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Team Activity" onTitleClick={hasMore ? () => setShowAll(v => !v) : undefined} />
      <div>
        {displayed.map((row, i) => {
          const actor = teamMembers.find((u) => u.id === row.user_id);
          const name = actor?.name.split(" ")[0] ?? "Someone";
          const suffix = activitySuffix(row);
          return (
            <div key={row.id} className="flex items-start gap-3 px-5 py-3" style={{ borderBottom: i < displayed.length - 1 ? "1px solid var(--color-border)" : undefined }}>
              {actor && <Avatar user={actor} size={26} className="mt-0.5 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600 }}>{name}</span>{" "}
                  {activityVerb(row)}{" "}
                  <span style={{ fontWeight: 500 }}>{row.item_name}</span>
                  {suffix && <> <span style={{ color: "var(--color-navy)", fontWeight: 600 }}>{suffix}</span></>}
                </p>
                <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 2 }}>{formatRelativeTime(row.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
