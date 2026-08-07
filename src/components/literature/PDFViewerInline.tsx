"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import type { LitAnnotation, AnnotationBbox } from "@/types";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

const ANNOT_COLORS = [
  { hex: "#FBBF24", label: "Yellow" },
  { hex: "#34D399", label: "Green" },
  { hex: "#60A5FA", label: "Blue" },
  { hex: "#F87171", label: "Red" },
  { hex: "#A78BFA", label: "Purple" },
];

interface SelectionPopover {
  text: string;
  bbox: AnnotationBbox;
  anchorTop: number;
  anchorLeft: number;
  pageNumber: number;
}

function HighlightOverlay({
  annotations,
  pageNumber,
}: {
  annotations: LitAnnotation[];
  pageNumber: number;
}) {
  const hits = annotations.filter((a) => a.pageNumber === pageNumber && a.bbox);
  if (!hits.length) return null;
  return (
    <>
      {hits.map((a) => {
        const b = a.bbox!;
        return (
          <div
            key={a.id}
            title={a.text || a.comment}
            style={{
              position: "absolute",
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.w * 100}%`,
              height: `${b.h * 100}%`,
              backgroundColor: a.color ? `${a.color}44` : "rgba(251,191,36,0.35)",
              borderBottom: `2px solid ${a.color ?? "#FBBF24"}`,
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        );
      })}
    </>
  );
}

export default function PDFViewerInline({
  url,
  itemId,
  currentUserId,
  annotations,
  onAnnotationAdded,
  onOpenFullscreen,
}: {
  url: string;
  itemId: string;
  currentUserId: string;
  annotations: LitAnnotation[];
  onAnnotationAdded: (a: LitAnnotation) => void;
  onOpenFullscreen?: () => void;
}) {
  const [numPages, setNumPages]     = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale]           = useState(1.0);
  const [containerWidth, setContainerWidth] = useState(500);
  const [loadError, setLoadError]   = useState("");
  const [saving, setSaving]         = useState(false);
  const [popover, setPopover]       = useState<SelectionPopover | null>(null);
  const [popComment, setPopComment] = useState("");
  const [popColor, setPopColor]     = useState<string>(ANNOT_COLORS[0].hex);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth - 2);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const renderedWidth = Math.round(containerWidth * scale);

  const handleTextSelect = useCallback((e: React.MouseEvent, pageNumber: number) => {
    // Ignore if we're saving or popover is open
    if (saving || popover) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

    const selectedText = selection.toString().trim();
    const range = selection.getRangeAt(0);
    const rects = Array.from(range.getClientRects());
    if (!rects.length) return;

    const pageEl = pageWrapperRef.current;
    if (!pageEl) return;
    const pageRect = pageEl.getBoundingClientRect();

    const unionLeft   = Math.min(...rects.map((r) => r.left));
    const unionTop    = Math.min(...rects.map((r) => r.top));
    const unionRight  = Math.max(...rects.map((r) => r.right));
    const unionBottom = Math.max(...rects.map((r) => r.bottom));

    const bbox: AnnotationBbox = {
      x: Math.max(0, (unionLeft - pageRect.left) / pageRect.width),
      y: Math.max(0, (unionTop  - pageRect.top)  / pageRect.height),
      w: Math.min(1, (unionRight - unionLeft)     / pageRect.width),
      h: Math.min(1, (unionBottom - unionTop)     / pageRect.height),
    };

    if (bbox.w < 0.005 || bbox.h < 0.002) return;

    // Position popover below the selection, within the container
    const containerRect = containerRef.current!.getBoundingClientRect();
    const anchorTop  = unionBottom - containerRect.top + 8;
    const anchorLeft = Math.max(8, Math.min(
      unionLeft - containerRect.left,
      containerRect.width - 280,
    ));

    setPopover({ text: selectedText, bbox, anchorTop, anchorLeft, pageNumber });
    selection.removeAllRanges();
  }, [saving, popover]);

  const handleSave = useCallback(async () => {
    if (!popover || !popComment.trim() || saving) return;
    setSaving(true);
    const id  = crypto.randomUUID();
    const now = new Date().toISOString();
    const { supabase } = await import("@/lib/supabase");
    const { error } = await supabase.from("lit_annotations").insert({
      id,
      item_id:     itemId,
      author_id:   currentUserId,
      text:        popover.text,
      comment:     popComment.trim(),
      page_number: popover.pageNumber,
      bbox:        popover.bbox,
      color:       popColor,
    });
    if (!error) {
      onAnnotationAdded({
        id, itemId, authorId: currentUserId,
        text: popover.text, comment: popComment.trim(),
        createdAt: now, color: popColor,
        pageNumber: popover.pageNumber, bbox: popover.bbox,
      });
    }
    setSaving(false);
    setPopover(null);
    setPopComment("");
    setPopColor(ANNOT_COLORS[0].hex);
  }, [popover, popComment, popColor, saving, itemId, currentUserId, onAnnotationAdded]);

  function go(delta: number) {
    setCurrentPage((p) => Math.max(1, Math.min(numPages, p + delta)));
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#1a1a2e" }}
    >
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", backgroundColor: "#1b2e4b", flexShrink: 0, flexWrap: "wrap" }}>
        <button onClick={() => go(-1)} disabled={currentPage <= 1}
          style={{ background: "none", border: "none", cursor: currentPage > 1 ? "pointer" : "not-allowed", color: currentPage > 1 ? "#fff" : "#ffffff44", display: "flex" }}
          aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <span style={{ color: "#fff", fontSize: 12, minWidth: 64, textAlign: "center", userSelect: "none" }}>
          {numPages > 0 ? `${currentPage} / ${numPages}` : "…"}
        </span>
        <button onClick={() => go(1)} disabled={currentPage >= numPages}
          style={{ background: "none", border: "none", cursor: currentPage < numPages ? "pointer" : "not-allowed", color: currentPage < numPages ? "#fff" : "#ffffff44", display: "flex" }}
          aria-label="Next page">
          <ChevronRight size={16} />
        </button>

        <div style={{ flex: 1 }} />

        <button onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))} disabled={scale <= 0.5}
          style={{ background: "none", border: "none", cursor: scale > 0.5 ? "pointer" : "not-allowed", color: scale > 0.5 ? "#fff" : "#ffffff44", display: "flex" }}
          aria-label="Zoom out">
          <ZoomOut size={15} />
        </button>
        <span style={{ color: "#fff", fontSize: 11, minWidth: 36, textAlign: "center", userSelect: "none" }}>
          {Math.round(scale * 100)}%
        </span>
        <button onClick={() => setScale((s) => Math.min(2.0, +(s + 0.25).toFixed(2)))} disabled={scale >= 2.0}
          style={{ background: "none", border: "none", cursor: scale < 2.0 ? "pointer" : "not-allowed", color: scale < 2.0 ? "#fff" : "#ffffff44", display: "flex" }}
          aria-label="Zoom in">
          <ZoomIn size={15} />
        </button>

        {onOpenFullscreen && (
          <button onClick={onOpenFullscreen}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#ffffff99", display: "flex", marginLeft: 4 }}
            aria-label="Open full-screen PDF viewer"
            title="Full-screen viewer">
            <Maximize2 size={14} />
          </button>
        )}
      </div>

      {/* Hint */}
      <div style={{ textAlign: "center", padding: "4px 0", fontSize: 10, color: "#ffffff55", flexShrink: 0, userSelect: "none" }}>
        Select text to highlight · switch pages with ← →
      </div>

      {/* PDF scroll area */}
      <div
        style={{ flex: 1, overflowY: "auto", overflowX: "auto", display: "flex", justifyContent: "center", padding: "12px 8px" }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") go(1);
          if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   go(-1);
        }}
        tabIndex={0}
      >
        {loadError ? (
          <div style={{ color: "#F87171", fontSize: 13, marginTop: 32, textAlign: "center", maxWidth: 300, lineHeight: 1.6 }}>
            {loadError}
          </div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={({ numPages: n }) => { setNumPages(n); setLoadError(""); }}
            onLoadError={(err) => setLoadError(`Could not load PDF: ${err.message}`)}
            loading={<span style={{ color: "#ffffff66", fontSize: 13, marginTop: 40, display: "block" }}>Loading…</span>}
          >
            {/* One page at a time */}
            <div
              ref={pageWrapperRef}
              style={{ position: "relative", display: "inline-block", userSelect: "text", cursor: "text" }}
              onMouseUp={(e) => handleTextSelect(e, currentPage)}
            >
              <Page
                pageNumber={currentPage}
                width={renderedWidth}
                renderTextLayer={true}
                renderAnnotationLayer={false}
              />
              {/* Existing highlight overlays */}
              <HighlightOverlay annotations={annotations} pageNumber={currentPage} />
            </div>
          </Document>
        )}
      </div>

      {/* Selection popover */}
      {popover && (
        <div
          style={{
            position: "absolute",
            top: Math.min(popover.anchorTop, (containerRef.current?.offsetHeight ?? 600) - 180),
            left: popover.anchorLeft,
            zIndex: 50,
            backgroundColor: "var(--color-surface, #fff)",
            border: "1px solid var(--color-border, #e2e8f0)",
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
            padding: "12px 14px",
            width: 264,
          }}
        >
          {popover.text && (
            <p style={{ fontSize: 11, color: "var(--color-secondary, #64748b)", fontStyle: "italic", marginBottom: 8, lineHeight: 1.4, maxHeight: 48, overflow: "hidden", textOverflow: "ellipsis" }}>
              "{popover.text.length > 80 ? popover.text.slice(0, 80) + "…" : popover.text}"
            </p>
          )}
          <textarea
            autoFocus
            value={popComment}
            onChange={(e) => setPopComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); } if (e.key === "Escape") { setPopover(null); setPopComment(""); } }}
            placeholder="Add a comment… (Enter to save)"
            style={{ width: "100%", minHeight: 52, fontSize: 12, fontFamily: "var(--font-roboto)", border: "1px solid var(--color-border, #e2e8f0)", borderRadius: 6, padding: "6px 8px", resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--color-secondary, #64748b)", flexShrink: 0 }}>Color:</span>
            {ANNOT_COLORS.map((c) => (
              <button key={c.hex} title={c.label} onClick={() => setPopColor(c.hex)}
                style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: c.hex, border: popColor === c.hex ? "2px solid #1b2e4b" : "2px solid transparent", cursor: "pointer", flexShrink: 0, outline: "none" }} />
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={() => { setPopover(null); setPopComment(""); }}
              style={{ fontSize: 11, color: "var(--color-secondary, #64748b)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={!popComment.trim() || saving}
              style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 6, backgroundColor: "#1b2e4b", color: "#fff", border: "none", cursor: "pointer", opacity: !popComment.trim() || saving ? 0.5 : 1 }}>
              {saving ? "…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
