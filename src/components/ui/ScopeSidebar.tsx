"use client";

import { Fragment, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SubProject } from "@/types";

export interface ScopeSection {
  id: string;
  label: string;
  color: string;
  icon: ReactNode;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

interface Props {
  sections: ScopeSection[];
  subProjects?: SubProject[];
  selectedSubProjectId?: string | null;
  projectCounts?: Record<string, number>;
  onSelectSubProject?: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  extraContent?: ReactNode;
}

function NavRow({ color, label, count, selected, onClick }: {
  color: string; label: string; count: number; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "6px 10px 6px 11px", borderRadius: 7,
        border: "none", borderLeft: `3px solid ${selected ? color : "transparent"}`,
        cursor: "pointer", backgroundColor: selected ? `${color}18` : "transparent",
        marginBottom: 1, transition: "background-color 120ms ease, border-left-color 120ms ease",
        textAlign: "left", boxSizing: "border-box", fontFamily: "var(--font-roboto)",
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,0,0,0.04)"; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
    >
      <span style={{ flex: 1, fontSize: 13, color: selected ? color : "var(--color-body)", fontWeight: selected ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      <span style={{ fontSize: 11, fontWeight: 600, color: selected ? color : "var(--color-secondary)", backgroundColor: selected ? `${color}20` : "rgba(0,0,0,0.06)", borderRadius: 10, padding: "1px 7px", flexShrink: 0, minWidth: 20, textAlign: "center" }}>
        {count}
      </span>
    </button>
  );
}

function IconRailBtn({ isActive, color, icon, label, onClick }: {
  isActive: boolean; color: string; icon: ReactNode; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex items-center justify-center rounded-lg"
      style={{
        width: 36, height: 36,
        backgroundColor: isActive ? color : "transparent",
        color: isActive ? "#fff" : "var(--color-body)",
        border: "none", cursor: "pointer",
        transition: "background-color 0.12s",
      }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(27,46,75,0.06)"; }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
    >
      {icon}
    </button>
  );
}

export default function ScopeSidebar({
  sections,
  subProjects = [],
  selectedSubProjectId = null,
  projectCounts = {},
  onSelectSubProject,
  collapsed,
  onToggleCollapse,
  extraContent,
}: Props) {
  return (
    <div
      className="group/scopesidebar flex flex-col h-full overflow-hidden"
      style={{
        width: collapsed ? 52 : 210,
        flexShrink: 0,
        backgroundColor: "var(--color-canvas)",
        borderRight: "1px solid var(--color-border)",
        transition: "width 200ms ease",
      }}
    >
      {collapsed ? (
        <>
          <div className="flex items-center justify-center" style={{ borderBottom: "1px solid var(--color-border)", padding: "8px 0" }}>
            <button
              onClick={onToggleCollapse}
              className="flex items-center justify-center rounded-lg transition-colors hover:bg-[rgba(27,46,75,0.06)]"
              style={{ width: 36, height: 36 }}
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight size={15} color="var(--color-secondary)" />
            </button>
          </div>
          <div className="flex flex-col items-center px-1.5 py-2 gap-0.5">
            {sections.map(s => (
              <IconRailBtn key={s.id} isActive={s.isActive} color={s.color} icon={s.icon} label={s.label} onClick={s.onClick} />
            ))}
            {subProjects.map(sp => (
              <IconRailBtn
                key={sp.id}
                isActive={selectedSubProjectId === sp.id}
                color={sp.color ?? "#34A853"}
                icon={<span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: "currentColor" }} />}
                label={sp.name}
                onClick={() => onSelectSubProject?.(sp.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-end" style={{ padding: "10px 10px 4px" }}>
            <button
              onClick={onToggleCollapse}
              className="opacity-0 group-hover/scopesidebar:opacity-100 transition-opacity flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]"
              style={{ width: 32, height: 32 }}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={15} color="var(--color-secondary)" />
            </button>
          </div>
          <div style={{ padding: "4px 8px 20px", overflowY: "auto" }}>
            {sections.map((s, i) => (
              <Fragment key={s.id}>
                <NavRow color={s.color} label={s.label} count={s.count} selected={s.isActive} onClick={s.onClick} />
                {i === 0 && <div style={{ height: 1, backgroundColor: "var(--color-border)", margin: "5px 2px" }} />}
              </Fragment>
            ))}
            {subProjects.length > 0 && (
              <>
                <div style={{ height: 1, backgroundColor: "var(--color-border)", margin: "5px 2px" }} />
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 11px 4px", margin: 0 }}>Projects</p>
                {subProjects.map(sp => (
                  <NavRow
                    key={sp.id}
                    color={sp.color ?? "#34A853"}
                    label={sp.name}
                    count={projectCounts[sp.id] ?? 0}
                    selected={selectedSubProjectId === sp.id}
                    onClick={() => onSelectSubProject?.(sp.id)}
                  />
                ))}
              </>
            )}
            {extraContent}
          </div>
        </>
      )}
    </div>
  );
}
