"use client";

import { Fragment, type ReactNode, useState, useRef, useCallback, useEffect } from "react";
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
  storageKey?: string;
}

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const SNAP_COLLAPSED_BELOW = 140;
const DEFAULT_WIDTH = 210;

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
  storageKey,
}: Props) {
  const [width, setWidth] = useState(() => {
    if (!storageKey) return DEFAULT_WIDTH;
    try {
      const stored = localStorage.getItem(storageKey + "_width");
      if (stored) return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parseInt(stored, 10)));
    } catch { /* ignore */ }
    return DEFAULT_WIDTH;
  });

  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startWidth: width };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, [width]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragState.current) return;
      const delta = e.clientX - dragState.current.startX;
      const next = dragState.current.startWidth + delta;
      if (next < SNAP_COLLAPSED_BELOW) {
        // snap to collapsed
        if (!collapsed) onToggleCollapse();
        dragState.current = null;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        return;
      }
      const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, next));
      setWidth(clamped);
    }
    function onMouseUp() {
      if (!dragState.current) return;
      dragState.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (storageKey) {
        try { localStorage.setItem(storageKey + "_width", String(width)); } catch { /* ignore */ }
      }
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [collapsed, onToggleCollapse, storageKey, width]);

  // Persist width when it changes
  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey + "_width", String(width)); } catch { /* ignore */ }
  }, [storageKey, width]);

  function onHandleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setWidth(w => Math.min(MAX_WIDTH, w + 10));
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = width - 10;
      if (next < SNAP_COLLAPSED_BELOW) { onToggleCollapse(); return; }
      setWidth(Math.max(MIN_WIDTH, next));
    }
  }

  const effectiveWidth = collapsed ? 52 : width;

  return (
    <div
      className="group/scopesidebar flex flex-col h-full"
      style={{
        width: effectiveWidth,
        flexShrink: 0,
        backgroundColor: "var(--color-canvas)",
        borderRight: "1px solid var(--color-border)",
        transition: collapsed ? "width 200ms ease" : "none",
        overflow: "hidden",
        position: "relative",
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
          <div style={{ padding: "4px 8px 20px", overflowY: "auto", flex: 1 }}>
            {sections.map((s, i) => (
              <Fragment key={s.id}>
                <NavRow color={s.color} label={s.label} count={s.count} selected={s.isActive} onClick={s.onClick} />
                {i === 0 && <div style={{ height: 1, backgroundColor: "var(--color-border)", margin: "5px 2px" }} />}
              </Fragment>
            ))}
            {extraContent}
          </div>

          {/* Drag handle — right edge */}
          <div
            role="separator"
            aria-label="Resize sidebar"
            aria-orientation="vertical"
            tabIndex={0}
            onMouseDown={onDragMouseDown}
            onKeyDown={onHandleKeyDown}
            title="Drag to resize · ← → to adjust"
            style={{
              position: "absolute", top: 0, right: 0, bottom: 0, width: 5,
              cursor: "col-resize", zIndex: 10,
              backgroundColor: "transparent",
              transition: "background-color 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--color-navy-dim)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
            onFocus={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--color-navy-dim)"; }}
            onBlur={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
          />
        </>
      )}
    </div>
  );
}
