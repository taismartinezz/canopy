"use client";

import { Fragment, type ReactNode, useState, useRef, useCallback } from "react";
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
const SNAP_BELOW = 140;
const DEFAULT_WIDTH = 210;

function readStoredWidth(key: string): number {
  try {
    const s = localStorage.getItem(key + "_width");
    if (s) return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parseInt(s, 10)));
  } catch { /* ignore */ }
  return DEFAULT_WIDTH;
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
  storageKey,
}: Props) {
  const [width, setWidth] = useState(() =>
    storageKey ? readStoredWidth(storageKey) : DEFAULT_WIDTH
  );
  const handleRef = useRef<HTMLDivElement | null>(null);
  // Track width in a ref so drag closures always see the latest value
  const widthRef = useRef(width);
  widthRef.current = width;

  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widthRef.current;
    let live = startWidth;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    function onMove(ev: MouseEvent) {
      const next = startWidth + (ev.clientX - startX);
      if (next < SNAP_BELOW) {
        cleanup();
        if (!collapsed) onToggleCollapse();
        return;
      }
      live = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, next));
      setWidth(live);
    }

    function onUp() {
      cleanup();
      if (storageKey) {
        try { localStorage.setItem(storageKey + "_width", String(live)); } catch { /* ignore */ }
      }
    }

    function cleanup() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [collapsed, onToggleCollapse, storageKey]);

  function onHandleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = Math.min(MAX_WIDTH, widthRef.current + 10);
      setWidth(next);
      if (storageKey) try { localStorage.setItem(storageKey + "_width", String(next)); } catch { /* ignore */ }
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = widthRef.current - 10;
      if (next < SNAP_BELOW) { onToggleCollapse(); return; }
      const clamped = Math.max(MIN_WIDTH, next);
      setWidth(clamped);
      if (storageKey) try { localStorage.setItem(storageKey + "_width", String(clamped)); } catch { /* ignore */ }
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

          {/* Resize handle on the right edge */}
          <div
            ref={handleRef}
            role="separator"
            aria-label="Resize sidebar"
            aria-orientation="vertical"
            tabIndex={0}
            title="Drag to resize, or use arrow keys"
            onMouseDown={onDragMouseDown}
            onKeyDown={onHandleKeyDown}
            style={{
              position: "absolute", top: 0, right: 0, bottom: 0, width: 6,
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
