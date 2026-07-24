"use client";

import { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { LitAnnotation, AnnotationBbox } from "@/types";
import PDFAnnotationLayer from "./PDFAnnotationLayer";

// Worker — evaluated once client-side when the module loads
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

const ANNOT_COLORS_LABEL: Record<string, string> = {
  "#FBBF24": "Yellow",
  "#34D399": "Green",
  "#60A5FA": "Blue",
  "#F87171": "Red",
  "#A78BFA": "Purple",
};

export default function PDFViewer({
  url,
  itemId,
  currentUserId,
  annotations,
  onAnnotationAdded,
  onClose,
  initialPage = 1,
}: {
  url: string;
  itemId: string;
  currentUserId: string;
  annotations: LitAnnotation[];
  onAnnotationAdded: (a: LitAnnotation) => void;
  onClose: () => void;
  initialPage?: number;
}) {
  const [numPages, setNumPages] = useState<number>(0);
  const [page, setPage] = useState(initialPage);
  const [scale, setScale] = useState(1.0);
  const [pageWidth, setPageWidth] = useState(700);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // Measure available width for the PDF pane
  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        // PDF pane is ~65% of modal, minus padding
        const available = Math.floor(containerRef.current.offsetWidth * 0.65 - 32);
        setPageWidth(Math.max(400, Math.min(available, 820)));
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") setPage((p) => Math.min(p + 1, numPages));
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   setPage((p) => Math.max(p - 1, 1));
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [numPages, onClose]);

  async function handleSaveAnnotation({
    bbox,
    comment,
    text,
    color,
  }: {
    bbox: AnnotationBbox;
    comment: string;
    text: string;
    color?: string;
  }) {
    setSaving(true);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const { error } = await supabase.from("lit_annotations").insert({
      id,
      item_id: itemId,
      author_id: currentUserId,
      text: text ?? "",
      comment,
      page_number: page,
      bbox: bbox,
      ...(color ? { color } : {}),
    });
    if (error) {
      console.error("[PDFViewer] annotation insert error:", error.message);
    } else {
      const newAnnot: LitAnnotation = {
        id,
        itemId,
        authorId: currentUserId,
        text: text ?? "",
        comment,
        createdAt: now,
        color,
        pageNumber: page,
        bbox,
      };
      onAnnotationAdded(newAnnot);
    }
    setSaving(false);
  }

  const currentPageAnnotations = annotations.filter(
    (a) => a.pageNumber === page && a.bbox,
  );

  // Rendered page pixel dimensions (approximate — actual comes from onRenderSuccess but we need it for overlay)
  const renderedWidth = Math.round(pageWidth * scale);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        backgroundColor: "rgba(0,0,0,0.88)",
        display: "flex",
        flexDirection: "column",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="PDF Viewer"
    >
      {/* Top bar */}
      <div
        style={{
          height: 52,
          flexShrink: 0,
          backgroundColor: "#1b2e4b",
          display: "flex",
          alignItems: "center",
          paddingInline: 16,
          gap: 12,
        }}
      >
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "#fff", fontSize: 13, fontWeight: 600 }}
        >
          <X size={16} /> Close
        </button>

        <div style={{ flex: 1 }} />

        {/* Page nav */}
        <button
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
          disabled={page <= 1}
          style={{ background: "none", border: "none", cursor: page > 1 ? "pointer" : "not-allowed", color: page > 1 ? "#fff" : "#ffffff55", display: "flex", alignItems: "center" }}
          aria-label="Previous page"
        >
          <ChevronLeft size={20} />
        </button>
        <span style={{ color: "#fff", fontSize: 13, whiteSpace: "nowrap", minWidth: 90, textAlign: "center" }}>
          {numPages > 0 ? `Page ${page} / ${numPages}` : "Loading…"}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(p + 1, numPages))}
          disabled={page >= numPages}
          style={{ background: "none", border: "none", cursor: page < numPages ? "pointer" : "not-allowed", color: page < numPages ? "#fff" : "#ffffff55", display: "flex", alignItems: "center" }}
          aria-label="Next page"
        >
          <ChevronRight size={20} />
        </button>

        <div style={{ width: 1, height: 24, backgroundColor: "#ffffff33", marginInline: 4 }} />

        {/* Zoom */}
        <button
          onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))}
          disabled={scale <= 0.5}
          style={{ background: "none", border: "none", cursor: "pointer", color: scale > 0.5 ? "#fff" : "#ffffff55", display: "flex" }}
          aria-label="Zoom out"
        >
          <ZoomOut size={18} />
        </button>
        <span style={{ color: "#fff", fontSize: 12, minWidth: 44, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale((s) => Math.min(2.0, +(s + 0.25).toFixed(2)))}
          disabled={scale >= 2.0}
          style={{ background: "none", border: "none", cursor: "pointer", color: scale < 2.0 ? "#fff" : "#ffffff55", display: "flex" }}
          aria-label="Zoom in"
        >
          <ZoomIn size={18} />
        </button>
      </div>

      {/* Body: PDF pane + annotation sidebar */}
      <div ref={containerRef} style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* PDF pane */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "24px 16px",
          }}
        >
          {loadError && (
            <p style={{ color: "#F87171", fontSize: 13, marginTop: 40 }}>{loadError}</p>
          )}

          <Document
            file={url}
            onLoadSuccess={({ numPages: n }) => { setNumPages(n); setLoadError(""); }}
            onLoadError={(err) => setLoadError(`Could not load PDF: ${err.message}`)}
            loading={<span style={{ color: "#ffffff99", fontSize: 13 }}>Loading PDF…</span>}
          >
            {/* Wrapper gives us a relative positioned context for the annotation overlay */}
            <div ref={pageContainerRef} style={{ position: "relative", display: "inline-block" }}>
              <Page
                pageNumber={page}
                width={renderedWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
              <PDFAnnotationLayer
                pageNumber={page}
                annotations={annotations}
                onSave={handleSaveAnnotation}
                saving={saving}
              />
            </div>
          </Document>
        </div>

        {/* Annotation sidebar */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            backgroundColor: "#f8fafc",
            borderLeft: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", margin: 0 }}>
              Highlights · p.{page}
            </p>
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, marginBottom: 0 }}>
              Drag on the page to add a highlight
            </p>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>
            {currentPageAnnotations.length === 0 ? (
              <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 20 }}>
                No highlights on this page yet.
              </p>
            ) : (
              currentPageAnnotations.map((a) => (
                <div
                  key={a.id}
                  style={{
                    marginBottom: 10,
                    borderRadius: 8,
                    border: `1px solid ${a.color ?? "#e2e8f0"}`,
                    borderLeft: `3px solid ${a.color ?? "#FBBF24"}`,
                    backgroundColor: "#fff",
                    padding: "8px 10px",
                    fontSize: 12,
                  }}
                >
                  {a.text && (
                    <p style={{ fontSize: 11, color: "#64748b", fontStyle: "italic", marginBottom: 4, marginTop: 0, lineHeight: 1.5 }}>
                      "{a.text}"
                    </p>
                  )}
                  <p style={{ color: "#1e293b", lineHeight: 1.5, margin: 0 }}>{a.comment}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                    {a.color && (
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: a.color, flexShrink: 0 }} />
                    )}
                    {a.color && (
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>{ANNOT_COLORS_LABEL[a.color] ?? ""}</span>
                    )}
                    <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>
                      {new Date(a.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}

            {/* All-pages thread annotations (no bbox) listed at bottom for reference */}
            {(() => {
              const threads = annotations.filter((a) => !a.bbox && !a.parentId);
              if (!threads.length) return null;
              return (
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", margin: "0 0 8px" }}>
                    <MessageSquare size={10} style={{ display: "inline", marginRight: 4 }} />
                    All comments ({threads.length})
                  </p>
                  {threads.map((a) => (
                    <div key={a.id} style={{ marginBottom: 8, fontSize: 11, color: "#64748b", borderLeft: "2px solid #e2e8f0", paddingLeft: 8, lineHeight: 1.5 }}>
                      {a.text && <span style={{ fontStyle: "italic", display: "block" }}>"{a.text}"</span>}
                      <span>{a.comment}</span>
                      {a.pageRef && <span style={{ display: "block", fontSize: 10, color: "#94a3b8" }}>ref: {a.pageRef}</span>}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
