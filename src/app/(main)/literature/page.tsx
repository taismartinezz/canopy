"use client";

import { useState } from "react";
import {
  LITERATURE_ITEMS, LITERATURE_COLLECTIONS, USERS, CURRENT_USER_ID,
  formatFileSize, getUser,
} from "@/lib/mock-data";
import type { LiteratureItem, ReadStatus, LiteratureType, LibraryScope } from "@/types";
import {
  Plus, Search, Download, Trash2, FileText, Book, File,
  Tag, X, Star, ExternalLink, ChevronDown, Copy, Check,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<LiteratureType, React.ReactNode> = {
  article:  <span title="Article"  style={{ fontSize: 15 }}>📄</span>,
  book:     <span title="Book"     style={{ fontSize: 15 }}>📘</span>,
  preprint: <span title="Preprint" style={{ fontSize: 15 }}>📑</span>,
  report:   <span title="Report"   style={{ fontSize: 15 }}>📊</span>,
  thesis:   <span title="Thesis"   style={{ fontSize: 15 }}>🎓</span>,
};

const STATUS_CONFIG: Record<ReadStatus, { label: string; color: string; bg: string }> = {
  read:    { label: "Read",    color: "#2E7D52", bg: "#D4EDE0" },
  reading: { label: "Reading", color: "#A0622A", bg: "#FDEFD4" },
  unread:  { label: "Unread",  color: "#64748B", bg: "#F1F5F9" },
};

function StatusBadge({ status }: { status: ReadStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5"
      style={{
        backgroundColor: cfg.bg,
        color: cfg.color,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: "var(--font-roboto)",
      }}
    >
      {cfg.label}
    </span>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={12}
          fill={n <= rating ? "#D97706" : "none"}
          color={n <= rating ? "#D97706" : "var(--color-border)"}
        />
      ))}
    </div>
  );
}

// ── Citation formatting ───────────────────────────────────────────────────────

function formatAuthors(authors: string[]) {
  if (authors.length === 0) return "—";
  if (authors.length === 1) return authors[0];
  if (authors.length <= 3) return authors.join(", ");
  return `${authors[0]} et al.`;
}

function formatCitation(item: LiteratureItem, style: "apa" | "mla" | "chicago"): string {
  const authors = item.authors.join(", ");
  if (style === "apa") {
    return `${authors} (${item.year}). ${item.title}. ${item.journal ?? item.publisher ?? ""}${item.volume ? `, ${item.volume}` : ""}${item.pages ? `, ${item.pages}` : ""}.${item.doi ? ` https://doi.org/${item.doi}` : ""}`;
  }
  if (style === "mla") {
    return `${authors}. "${item.title}." ${item.journal ?? item.publisher ?? ""} ${item.volume ?? ""} (${item.year})${item.pages ? `: ${item.pages}` : ""}.`;
  }
  return `${authors}. "${item.title}." ${item.journal ?? item.publisher ?? ""} ${item.volume ?? ""} (${item.year}).`;
}

// ── Detail panel ──────────────────────────────────────────────────────────────

const DETAIL_TABS = ["Info", "Abstract", "Notes", "Tags", "Files", "Cite", "Related"] as const;
type DetailTab = typeof DETAIL_TABS[number];

function DetailPanel({
  item,
  onClose,
}: {
  item: LiteratureItem;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("Info");
  const [citationStyle, setCitationStyle] = useState<"apa" | "mla" | "chicago">("apa");
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");

  function handleCopy() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        width: 340,
        backgroundColor: "var(--color-surface)",
        borderLeft: "1px solid var(--color-border)",
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {TYPE_ICONS[item.type]}
              <StatusBadge status={item.status} />
            </div>
            <p
              style={{
                fontFamily: "var(--font-lora)",
                fontWeight: 600,
                fontSize: 13,
                color: "var(--color-body)",
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              {item.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[rgba(27,46,75,0.06)] transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={14} color="var(--color-secondary)" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex overflow-x-auto px-1 gap-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        {DETAIL_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              fontSize: 12,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? "var(--color-navy)" : "var(--color-secondary)",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: tab === t ? "2px solid var(--color-navy)" : "2px solid transparent",
              cursor: "pointer",
              padding: "10px 10px",
              whiteSpace: "nowrap",
              minHeight: 40,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {tab === "Info" && (
          <div className="px-4 py-4 space-y-3">
            {[
              { label: "Authors",    value: item.authors.join("; ") || "—" },
              { label: "Year",       value: String(item.year) },
              { label: "Journal",    value: item.journal ?? item.publisher ?? "—" },
              { label: "Volume",     value: item.volume ?? "—" },
              { label: "Pages",      value: item.pages ?? "—" },
              { label: "DOI",        value: item.doi ?? "—" },
              { label: "Type",       value: item.type.charAt(0).toUpperCase() + item.type.slice(1) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", marginBottom: 3 }}>{label}</p>
                <p style={{ fontSize: 12, color: "var(--color-body)", lineHeight: 1.4, wordBreak: "break-word" }}>{value}</p>
              </div>
            ))}

            {/* Status toggle */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", marginBottom: 6 }}>Status</p>
              <div className="flex gap-1.5">
                {(["unread", "reading", "read"] as ReadStatus[]).map((s) => (
                  <button
                    key={s}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 5,
                      border: `1px solid ${item.status === s ? STATUS_CONFIG[s].color : "var(--color-border)"}`,
                      backgroundColor: item.status === s ? STATUS_CONFIG[s].bg : "transparent",
                      color: item.status === s ? STATUS_CONFIG[s].color : "var(--color-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", marginBottom: 6 }}>Rating</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} className="w-7 h-7 flex items-center justify-center" aria-label={`Rate ${n} stars`}>
                    <Star size={16} fill={n <= item.rating ? "#D97706" : "none"} color={n <= item.rating ? "#D97706" : "var(--color-border)"} />
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--color-navy)", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", borderRadius: 7, cursor: "pointer" }}
              >
                <FileText size={13} /> Open PDF
              </button>
              {item.doi && (
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors hover:bg-[rgba(27,46,75,0.06)]"
                  style={{ backgroundColor: "transparent", color: "var(--color-navy)", fontSize: 12, fontWeight: 700, border: "1px solid var(--color-navy)", borderRadius: 7, cursor: "pointer" }}
                >
                  <ExternalLink size={13} /> DOI Link
                </button>
              )}
            </div>
          </div>
        )}

        {tab === "Abstract" && (
          <div className="px-4 py-4">
            {item.abstract ? (
              <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.75, userSelect: "text" }}>
                {item.abstract}
              </p>
            ) : (
              <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No abstract available.</p>
            )}
          </div>
        )}

        {tab === "Notes" && (
          <div className="px-4 py-4 flex flex-col gap-3">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add your notes here..."
              style={{
                width: "100%",
                minHeight: 180,
                fontSize: 13,
                color: "var(--color-body)",
                fontFamily: "var(--font-roboto)",
                lineHeight: 1.6,
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: "10px 12px",
                resize: "vertical",
                backgroundColor: "var(--color-canvas)",
                outline: "none",
              }}
            />
            <button
              style={{
                alignSelf: "flex-end",
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 14px",
                borderRadius: 7,
                backgroundColor: "var(--color-navy)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Save notes
            </button>
          </div>
        )}

        {tab === "Tags" && (
          <div className="px-4 py-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1"
                  style={{
                    border: "1px solid var(--color-navy)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "var(--color-navy)",
                    backgroundColor: "rgba(27,46,75,0.04)",
                  }}
                >
                  {tag}
                  <button aria-label={`Remove tag ${tag}`}>
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input
                placeholder="Add tag and press Enter"
                style={{
                  width: "100%",
                  height: 34,
                  paddingLeft: 10,
                  paddingRight: 10,
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: "var(--font-roboto)",
                  outline: "none",
                }}
              />
            </div>
          </div>
        )}

        {tab === "Files" && (
          <div className="px-4 py-4">
            {item.files.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-secondary)", marginBottom: 12 }}>No files attached.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {item.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}
                  >
                    <FileText size={14} color="#C0392B" />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-body)" }}>{file.name}</p>
                      <p style={{ fontSize: 10, color: "var(--color-secondary)" }}>
                        {formatFileSize(file.size)}
                        {file.ocrStatus === "ready" && (
                          <span style={{ marginLeft: 6, color: "var(--color-success)" }}>✓ Searchable</span>
                        )}
                        {file.ocrStatus === "pending" && (
                          <span style={{ marginLeft: 6, color: "var(--color-warning)" }}>Processing OCR…</span>
                        )}
                      </p>
                    </div>
                    <button className="w-6 h-6 flex items-center justify-center hover:bg-[rgba(27,46,75,0.06)] rounded">
                      <Download size={12} color="var(--color-navy)" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div
              className="flex flex-col items-center justify-center gap-2 py-6 cursor-pointer hover:bg-[rgba(27,46,75,0.02)] transition-colors rounded-lg"
              style={{ border: "2px dashed var(--color-border)", borderRadius: 8 }}
            >
              <File size={18} color="var(--color-secondary)" />
              <p style={{ fontSize: 12, color: "var(--color-secondary)" }}>Drop files or click to upload</p>
            </div>
          </div>
        )}

        {tab === "Cite" && (
          <div className="px-4 py-4">
            <div className="flex gap-1.5 mb-4">
              {(["apa", "mla", "chicago"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setCitationStyle(s)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 5,
                    border: `1px solid ${citationStyle === s ? "var(--color-navy)" : "var(--color-border)"}`,
                    backgroundColor: citationStyle === s ? "var(--color-navy)" : "transparent",
                    color: citationStyle === s ? "#fff" : "var(--color-secondary)",
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            <div
              className="px-3 py-3 mb-3"
              style={{
                backgroundColor: "var(--color-canvas)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--color-body)",
                lineHeight: 1.65,
                userSelect: "text",
              }}
            >
              {formatCitation(item, citationStyle)}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: copied ? "var(--color-success)" : "var(--color-navy)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 7,
                  cursor: "pointer",
                }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy citation"}
              </button>
            </div>

            <div className="flex gap-2 mt-3">
              {["BibTeX", "RIS", "EndNote"].map((fmt) => (
                <button
                  key={fmt}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 5,
                    border: "1px solid var(--color-border)",
                    backgroundColor: "transparent",
                    color: "var(--color-secondary)",
                    cursor: "pointer",
                  }}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === "Related" && (
          <div className="px-4 py-4">
            {item.relatedIds.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No related items linked.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {item.relatedIds.map((id) => {
                  const rel = LITERATURE_ITEMS.find((i) => i.id === id);
                  if (!rel) return null;
                  return (
                    <button
                      key={id}
                      className="w-full text-left flex items-start gap-2 px-3 py-2.5 rounded-lg hover:bg-[rgba(27,46,75,0.04)] transition-colors"
                      style={{
                        backgroundColor: "var(--color-canvas)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                      }}
                    >
                      {TYPE_ICONS[rel.type]}
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 12, color: "var(--color-body)", lineHeight: 1.35 }}>
                          {rel.title.length > 60 ? rel.title.slice(0, 60) + "…" : rel.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span style={{ fontSize: 10, color: "var(--color-secondary)" }}>{rel.year}</span>
                          <StatusBadge status={rel.status} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-navy)",
                backgroundColor: "transparent",
                border: "1px solid var(--color-border)",
                borderRadius: 7,
                padding: "6px 14px",
                cursor: "pointer",
              }}
            >
              + Link a related item
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Literature page ───────────────────────────────────────────────────────────

export default function LiteraturePage() {
  const [scope, setScope] = useState<LibraryScope>("lab");
  const [activeCollection, setActiveCollection] = useState("lc0");
  const [selectedItem, setSelectedItem] = useState<LiteratureItem | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReadStatus | "all">("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const items = LITERATURE_ITEMS.filter((item) => {
    if (item.scope !== scope && scope !== "my") return item.scope === scope;
    if (scope === "my" && item.scope !== "my") return false;
    return true;
  });

  const filtered = items.filter((item) => {
    if (search && !item.title.toLowerCase().includes(search.toLowerCase()) &&
        !item.authors.some((a) => a.toLowerCase().includes(search.toLowerCase()))) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (activeTag && !item.tags.includes(activeTag)) return false;
    if (activeCollection !== "lc0") {
      const col = LITERATURE_COLLECTIONS.find((c) => c.id === activeCollection);
      if (col && !item.collections.includes(activeCollection)) return false;
    }
    return true;
  });

  const allTags = [...new Set(items.flatMap((i) => i.tags))].sort();

  const totalRead = items.filter((i) => i.status === "read").length;
  const totalUnread = items.filter((i) => i.status === "unread").length;

  return (
    <div className="flex h-full" style={{ fontFamily: "var(--font-roboto)" }}>

      {/* ── Left panel: Collections ── */}
      <div
        className="flex flex-col shrink-0"
        style={{
          width: 220,
          backgroundColor: "var(--color-surface)",
          borderRight: "1px solid var(--color-border)",
        }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 16, color: "var(--color-navy)", margin: 0 }}>
            Literature
          </h2>
          <button
            className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[rgba(27,46,75,0.06)] transition-colors"
            aria-label="Add item"
          >
            <Plus size={14} color="var(--color-navy)" />
          </button>
        </div>

        {/* Library toggle */}
        <div className="px-3 py-2.5" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div
            className="flex rounded-lg p-0.5"
            style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}
          >
            {(["lab", "my"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className="flex-1 py-1 rounded-md transition-all"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: scope === s ? "var(--color-navy)" : "transparent",
                  color: scope === s ? "#fff" : "var(--color-secondary)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {s === "lab" ? "Lab Library" : "My Library"}
              </button>
            ))}
          </div>
        </div>

        {/* Collections */}
        <div className="flex-1 overflow-y-auto py-2">
          {LITERATURE_COLLECTIONS.map((col) => (
            <button
              key={col.id}
              onClick={() => setActiveCollection(col.id)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg mx-1 transition-colors"
              style={{
                width: "calc(100% - 8px)",
                backgroundColor: activeCollection === col.id ? "var(--color-navy)" : "transparent",
                color: activeCollection === col.id ? "#fff" : "var(--color-body)",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                textAlign: "left",
                minHeight: 36,
              }}
            >
              <span className="flex items-center gap-2">
                <span style={{ fontSize: 14 }}>{col.emoji}</span>
                {col.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: activeCollection === col.id ? "rgba(255,255,255,0.7)" : "var(--color-secondary)",
                }}
              >
                {col.itemCount}
              </span>
            </button>
          ))}

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="px-3 mt-4">
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-secondary)", marginBottom: 8 }}>
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 5,
                      border: `1px solid ${activeTag === tag ? "var(--color-navy)" : "var(--color-border)"}`,
                      backgroundColor: activeTag === tag ? "rgba(27,46,75,0.06)" : "transparent",
                      color: activeTag === tag ? "var(--color-navy)" : "var(--color-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div
          className="px-4 py-3 grid grid-cols-3 gap-1"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          {[
            { label: "Total",  value: items.length },
            { label: "Read",   value: totalRead    },
            { label: "Unread", value: totalUnread  },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-navy)" }}>{value}</p>
              <p style={{ fontSize: 10, color: "var(--color-secondary)" }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Center: Item list ── */}
      <div
        className="flex flex-col flex-1 min-w-0"
        style={{ borderRight: selectedItem ? "1px solid var(--color-border)" : undefined }}
      >
        {/* Toolbar */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 flex-wrap"
          style={{
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
            minHeight: 52,
          }}
        >
          <div className="relative" style={{ minWidth: 180, flex: 1 }}>
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="var(--color-secondary)" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              style={{
                width: "100%",
                paddingLeft: 30,
                paddingRight: 8,
                height: 32,
                border: "1px solid var(--color-border)",
                borderRadius: 7,
                fontSize: 12,
                fontFamily: "var(--font-roboto)",
                backgroundColor: "var(--color-canvas)",
                outline: "none",
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReadStatus | "all")}
            style={{
              height: 32,
              paddingLeft: 8,
              paddingRight: 20,
              border: "1px solid var(--color-border)",
              borderRadius: 7,
              fontSize: 12,
              fontFamily: "var(--font-roboto)",
              backgroundColor: "var(--color-canvas)",
              color: "var(--color-body)",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">All</option>
            <option value="read">Read</option>
            <option value="reading">Reading</option>
            <option value="unread">Unread</option>
          </select>

          {activeTag && (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1"
              style={{
                backgroundColor: "rgba(27,46,75,0.06)",
                border: "1px solid var(--color-navy)",
                borderRadius: 5,
                fontSize: 11,
                color: "var(--color-navy)",
              }}
            >
              <Tag size={11} />
              {activeTag}
              <button onClick={() => setActiveTag(null)}>
                <X size={11} />
              </button>
            </span>
          )}

          <span style={{ fontSize: 11, color: "var(--color-secondary)", marginLeft: "auto" }}>
            {filtered.length} item{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Column headers */}
        <div
          className="grid items-center px-4 py-2"
          style={{
            gridTemplateColumns: "28px 1fr 100px 70px 90px",
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
            gap: 8,
          }}
        >
          {["", "Title", "Authors", "Year", "Status"].map((col, i) => (
            <span
              key={i}
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--color-secondary)",
              }}
            >
              {col}
            </span>
          ))}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No items found.</p>
            </div>
          ) : (
            filtered.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(isSelected ? null : item)}
                  className="w-full text-left grid items-center px-4 py-2.5 transition-colors border-b"
                  style={{
                    gridTemplateColumns: "28px 1fr 100px 70px 90px",
                    gap: 8,
                    backgroundColor: isSelected ? "rgba(27,46,75,0.06)" : "transparent",
                    borderLeft: isSelected ? "3px solid var(--color-navy)" : "3px solid transparent",
                    borderBottom: "1px solid var(--color-border)",
                    minHeight: 44,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "#F8FAFF";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "";
                  }}
                >
                  <span>{TYPE_ICONS[item.type]}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--color-body)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.title}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--color-secondary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatAuthors(item.authors)}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--color-secondary)" }}>{item.year}</span>
                  <StatusBadge status={item.status} />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: Detail panel ── */}
      {selectedItem && (
        <DetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
