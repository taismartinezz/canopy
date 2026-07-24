"use client";

import { useState, useRef } from "react";
import type { LitAnnotation, AnnotationBbox } from "@/types";

const ANNOT_COLORS = [
  { hex: "#FBBF24", label: "Yellow" },
  { hex: "#34D399", label: "Green" },
  { hex: "#60A5FA", label: "Blue" },
  { hex: "#F87171", label: "Red" },
  { hex: "#A78BFA", label: "Purple" },
];

interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface PopoverState {
  bbox: AnnotationBbox;
  // position in px within the overlay for the popover anchor
  anchorX: number;
  anchorY: number;
}

export default function PDFAnnotationLayer({
  pageNumber,
  annotations,
  onSave,
  saving,
}: {
  pageNumber: number;
  annotations: LitAnnotation[];
  onSave: (params: { bbox: AnnotationBbox; comment: string; text: string; color?: string }) => Promise<void>;
  saving: boolean;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [comment, setComment] = useState("");
  const [text, setText] = useState("");
  const [color, setColor] = useState<string | undefined>(undefined);

  const pageAnnotations = annotations.filter(
    (a) => a.pageNumber === pageNumber && a.bbox,
  );

  function relPos(e: React.MouseEvent): { x: number; y: number } {
    const rect = overlayRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onMouseDown(e: React.MouseEvent) {
    if (popover) return;
    const { x, y } = relPos(e);
    setDrag({ startX: x, startY: y, currentX: x, currentY: y });
    e.preventDefault();
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drag || popover) return;
    const { x, y } = relPos(e);
    setDrag((d) => d ? { ...d, currentX: x, currentY: y } : null);
  }

  function onMouseUp(e: React.MouseEvent) {
    if (!drag || popover) return;
    const { x, y } = relPos(e);
    const rect = overlayRef.current!.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    const rx = (Math.min(drag.startX, x) / W);
    const ry = (Math.min(drag.startY, y) / H);
    const rw = (Math.abs(x - drag.startX) / W);
    const rh = (Math.abs(y - drag.startY) / H);

    setDrag(null);

    if (rw < 0.01 || rh < 0.005) return; // ignore tiny accidental drags

    const bbox: AnnotationBbox = { x: rx, y: ry, w: rw, h: rh };
    setPopover({
      bbox,
      anchorX: Math.min(drag.startX, x) + Math.abs(x - drag.startX) / 2,
      anchorY: Math.min(drag.startY, y),
    });
  }

  async function handleSave() {
    if (!popover || !comment.trim()) return;
    await onSave({ bbox: popover.bbox, comment: comment.trim(), text: text.trim(), color });
    setPopover(null);
    setComment("");
    setText("");
    setColor(undefined);
  }

  function cancelPopover() {
    setPopover(null);
    setComment("");
    setText("");
    setColor(undefined);
  }

  // Preview rect while dragging
  const previewRect = drag
    ? {
        left: Math.min(drag.startX, drag.currentX),
        top: Math.min(drag.startY, drag.currentY),
        width: Math.abs(drag.currentX - drag.startX),
        height: Math.abs(drag.currentY - drag.startY),
      }
    : null;

  return (
    <div
      ref={overlayRef}
      style={{
        position: "absolute",
        inset: 0,
        cursor: drag ? "crosshair" : "crosshair",
        userSelect: "none",
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {/* Existing annotation rects */}
      {pageAnnotations.map((a) => (
        <div
          key={a.id}
          title={a.comment}
          style={{
            position: "absolute",
            left: `${(a.bbox!.x * 100).toFixed(3)}%`,
            top: `${(a.bbox!.y * 100).toFixed(3)}%`,
            width: `${(a.bbox!.w * 100).toFixed(3)}%`,
            height: `${(a.bbox!.h * 100).toFixed(3)}%`,
            backgroundColor: a.color ? `${a.color}55` : "#FBBF2455",
            border: `1.5px solid ${a.color ?? "#FBBF24"}`,
            borderRadius: 2,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Drag preview rect */}
      {previewRect && (
        <div
          style={{
            position: "absolute",
            left: previewRect.left,
            top: previewRect.top,
            width: previewRect.width,
            height: previewRect.height,
            backgroundColor: "#FBBF2433",
            border: "1.5px dashed #FBBF24",
            borderRadius: 2,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Annotation popover */}
      {popover && (
        <div
          style={{
            position: "absolute",
            left: Math.min(popover.anchorX, overlayRef.current ? overlayRef.current.offsetWidth - 260 : popover.anchorX),
            top: Math.max(0, popover.anchorY - 8),
            width: 250,
            backgroundColor: "var(--color-surface, #fff)",
            border: "1px solid var(--color-border, #e2e8f0)",
            borderRadius: 10,
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
            padding: 12,
            zIndex: 10,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-secondary, #64748b)", marginBottom: 6, marginTop: 0 }}>
            New highlight · p.{pageNumber}
          </p>
          <input
            placeholder="Quoted text (optional)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ width: "100%", height: 30, border: "1px solid var(--color-border, #e2e8f0)", borderRadius: 6, padding: "0 8px", fontSize: 12, boxSizing: "border-box", marginBottom: 6, fontFamily: "inherit", backgroundColor: "var(--color-canvas, #f8fafc)", color: "var(--color-body, #1e293b)" }}
          />
          <textarea
            placeholder="Comment *"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            style={{ width: "100%", border: "1px solid var(--color-border, #e2e8f0)", borderRadius: 6, padding: "6px 8px", fontSize: 12, resize: "none", boxSizing: "border-box", marginBottom: 8, fontFamily: "inherit", backgroundColor: "var(--color-canvas, #f8fafc)", color: "var(--color-body, #1e293b)" }}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); } }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "var(--color-secondary, #64748b)" }}>Color:</span>
            {ANNOT_COLORS.map((c) => (
              <button
                key={c.hex}
                title={c.label}
                onClick={() => setColor(color === c.hex ? undefined : c.hex)}
                style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: c.hex, border: color === c.hex ? "2px solid var(--color-navy, #1b2e4b)" : "2px solid transparent", cursor: "pointer", padding: 0, flexShrink: 0 }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={handleSave}
              disabled={!comment.trim() || saving}
              style={{ flex: 1, height: 30, borderRadius: 6, backgroundColor: "var(--color-navy, #1b2e4b)", color: "#fff", border: "none", cursor: comment.trim() && !saving ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 700, opacity: comment.trim() && !saving ? 1 : 0.5 }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={cancelPopover}
              style={{ height: 30, paddingInline: 10, borderRadius: 6, backgroundColor: "transparent", color: "var(--color-secondary, #64748b)", border: "1px solid var(--color-border, #e2e8f0)", cursor: "pointer", fontSize: 12 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
