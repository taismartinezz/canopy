"use client";

import { useState, useEffect } from "react";
import {
  LITERATURE_ITEMS, LITERATURE_COLLECTIONS, getUser,
  formatFileSize, CURRENT_USER_ID,
} from "@/lib/mock-data";
import type { LiteratureItem, ReadStatus, LiteratureType, LibraryScope } from "@/types";
import {
  Plus, Search, Download, FileText, File, X,
  Tag, Star, ExternalLink, Copy, Check, ChevronLeft,
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
    <span className="inline-flex items-center px-2 py-0.5" style={{ backgroundColor: cfg.bg, color: cfg.color, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {cfg.label}
    </span>
  );
}

function formatAuthors(authors: string[]) {
  if (!authors.length) return "—";
  if (authors.length <= 2) return authors.join(", ");
  return `${authors[0]} et al.`;
}

function formatCitation(item: LiteratureItem, style: "apa" | "mla" | "chicago"): string {
  const authors = item.authors.join(", ");
  if (style === "apa")
    return `${authors} (${item.year}). ${item.title}. ${item.journal ?? item.publisher ?? ""}${item.volume ? `, ${item.volume}` : ""}${item.pages ? `, ${item.pages}` : ""}.${item.doi ? ` https://doi.org/${item.doi}` : ""}`;
  if (style === "mla")
    return `${authors}. "${item.title}." ${item.journal ?? item.publisher ?? ""} ${item.volume ?? ""} (${item.year})${item.pages ? `: ${item.pages}` : ""}.`;
  return `${authors}. "${item.title}." ${item.journal ?? item.publisher ?? ""} ${item.volume ?? ""} (${item.year}).`;
}

// ── Left panel content ────────────────────────────────────────────────────────

function CollectionsSidebar({
  scope, setScope, activeCollection, setActiveCollection,
  allTags, activeTag, setActiveTag, items,
  showClose, onClose,
}: {
  scope: LibraryScope; setScope: (s: LibraryScope) => void;
  activeCollection: string; setActiveCollection: (id: string) => void;
  allTags: string[]; activeTag: string | null; setActiveTag: (t: string | null) => void;
  items: LiteratureItem[];
  showClose?: boolean; onClose?: () => void;
}) {
  const totalRead = items.filter((i) => i.status === "read").length;
  const totalUnread = items.filter((i) => i.status === "unread").length;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 16, color: "var(--color-navy)", margin: 0 }}>Literature</h2>
        <div className="flex items-center gap-1">
          {showClose && (
            <button onClick={onClose} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 44, height: 44 }} aria-label="Close collections">
              <X size={16} color="var(--color-secondary)" />
            </button>
          )}
          <button className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)] transition-colors" style={{ width: 44, height: 44 }} aria-label="Add item">
            <Plus size={14} color="var(--color-navy)" />
          </button>
        </div>
      </div>

      {/* Library toggle */}
      <div className="px-3 py-2.5" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex rounded-lg p-0.5" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
          {(["lab", "my"] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)} className="flex-1 py-1.5 rounded-md transition-all"
              style={{ fontSize: 11, fontWeight: 600, backgroundColor: scope === s ? "var(--color-navy)" : "transparent", color: scope === s ? "#fff" : "var(--color-secondary)", border: "none", cursor: "pointer", minHeight: 36 }}>
              {s === "lab" ? "Lab Library" : "My Library"}
            </button>
          ))}
        </div>
      </div>

      {/* Collections */}
      <div className="flex-1 overflow-y-auto py-2">
        {LITERATURE_COLLECTIONS.map((col) => (
          <button key={col.id} onClick={() => { setActiveCollection(col.id); onClose?.(); }}
            className="w-full flex items-center justify-between px-3 py-2 transition-colors"
            style={{
              backgroundColor: activeCollection === col.id ? "var(--color-navy)" : "transparent",
              color: activeCollection === col.id ? "#fff" : "var(--color-body)",
              border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, textAlign: "left", minHeight: 44,
              margin: "0 4px", width: "calc(100% - 8px)",
            }}>
            <span className="flex items-center gap-2"><span style={{ fontSize: 14 }}>{col.emoji}</span>{col.name}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: activeCollection === col.id ? "rgba(255,255,255,0.7)" : "var(--color-secondary)" }}>{col.itemCount}</span>
          </button>
        ))}
        {allTags.length > 0 && (
          <div className="px-3 mt-4">
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-secondary)", marginBottom: 8 }}>Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => (
                <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: `1px solid ${activeTag === tag ? "var(--color-navy)" : "var(--color-border)"}`, backgroundColor: activeTag === tag ? "rgba(27,46,75,0.06)" : "transparent", color: activeTag === tag ? "var(--color-navy)" : "var(--color-secondary)", cursor: "pointer", minHeight: 30 }}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="px-4 py-3 grid grid-cols-3 gap-1" style={{ borderTop: "1px solid var(--color-border)" }}>
        {[{ label: "Total", value: items.length }, { label: "Read", value: totalRead }, { label: "Unread", value: totalUnread }].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-navy)" }}>{value}</p>
            <p style={{ fontSize: 10, color: "var(--color-secondary)" }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Detail panel tabs ─────────────────────────────────────────────────────────

const DETAIL_TABS = ["Info", "Abstract", "Notes", "Tags", "Files", "Cite", "Related"] as const;
type DetailTab = typeof DETAIL_TABS[number];

function DetailPanelContent({
  item, onClose, isMobileFullscreen = false,
}: {
  item: LiteratureItem;
  onClose: () => void;
  isMobileFullscreen?: boolean;
}) {
  const [tab, setTab] = useState<DetailTab>("Info");
  const [citationStyle, setCitationStyle] = useState<"apa" | "mla" | "chicago">("apa");
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");

  function handleCopy() { setCopied(true); setTimeout(() => setCopied(false), 2000); }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--color-surface)" }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {TYPE_ICONS[item.type]}
              <StatusBadge status={item.status} />
            </div>
            <p style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 13, color: "var(--color-body)", lineHeight: 1.4, margin: 0 }}>
              {item.title}
            </p>
          </div>
          <button onClick={onClose} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)] transition-colors shrink-0" style={{ width: 44, height: 44 }} aria-label="Close">
            <X size={15} color="var(--color-secondary)" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto px-1" style={{ borderBottom: "1px solid var(--color-border)", WebkitOverflowScrolling: "touch" }}>
        {DETAIL_TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ fontSize: 12, fontWeight: tab === t ? 600 : 400, color: tab === t ? "var(--color-navy)" : "var(--color-secondary)", backgroundColor: "transparent", border: "none", borderBottom: tab === t ? "2px solid var(--color-navy)" : "2px solid transparent", cursor: "pointer", padding: "10px 10px", whiteSpace: "nowrap", minHeight: 44 }}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "Info" && (
          <div className="px-4 py-4 space-y-3">
            {[["Authors", item.authors.join("; ") || "—"], ["Year", String(item.year)], ["Journal", item.journal ?? item.publisher ?? "—"], ["Volume", item.volume ?? "—"], ["Pages", item.pages ?? "—"], ["DOI", item.doi ?? "—"], ["Type", item.type.charAt(0).toUpperCase() + item.type.slice(1)]].map(([label, value]) => (
              <div key={label}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", marginBottom: 3 }}>{label}</p>
                <p style={{ fontSize: 12, color: "var(--color-body)", lineHeight: 1.4, wordBreak: "break-word" }}>{value}</p>
              </div>
            ))}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", marginBottom: 6 }}>Status</p>
              <div className="flex gap-1.5">
                {(["unread", "reading", "read"] as ReadStatus[]).map((s) => (
                  <button key={s} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 5, border: `1px solid ${item.status === s ? STATUS_CONFIG[s].color : "var(--color-border)"}`, backgroundColor: item.status === s ? STATUS_CONFIG[s].bg : "transparent", color: item.status === s ? STATUS_CONFIG[s].color : "var(--color-secondary)", cursor: "pointer", minHeight: 36 }}>
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg" style={{ backgroundColor: "var(--color-navy)", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", borderRadius: 7, cursor: "pointer", minHeight: 44 }}>
                <FileText size={13} /> Open PDF
              </button>
              {item.doi && (
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg" style={{ backgroundColor: "transparent", color: "var(--color-navy)", fontSize: 12, fontWeight: 700, border: "1px solid var(--color-navy)", borderRadius: 7, cursor: "pointer", minHeight: 44 }}>
                  <ExternalLink size={13} /> DOI
                </button>
              )}
            </div>
          </div>
        )}
        {tab === "Abstract" && (
          <div className="px-4 py-4">
            {item.abstract ? <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.75 }}>{item.abstract}</p> : <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No abstract available.</p>}
          </div>
        )}
        {tab === "Notes" && (
          <div className="px-4 py-4 flex flex-col gap-3">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add your notes here..."
              style={{ width: "100%", minHeight: 180, fontSize: 13, color: "var(--color-body)", fontFamily: "var(--font-roboto)", lineHeight: 1.6, border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 12px", resize: "vertical", backgroundColor: "var(--color-canvas)", outline: "none" }} />
            <button style={{ alignSelf: "flex-end", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 7, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", cursor: "pointer", minHeight: 44 }}>Save notes</button>
          </div>
        )}
        {tab === "Tags" && (
          <div className="px-4 py-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {item.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1"
                  style={{ border: "1px solid var(--color-navy)", borderRadius: 6, fontSize: 12, color: "var(--color-navy)", backgroundColor: "rgba(27,46,75,0.04)" }}>
                  {tag}<button aria-label={`Remove ${tag}`}><X size={11} /></button>
                </span>
              ))}
            </div>
            <input placeholder="Add tag and press Enter" style={{ width: "100%", height: 36, paddingLeft: 10, border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12, fontFamily: "var(--font-roboto)", outline: "none" }} />
          </div>
        )}
        {tab === "Files" && (
          <div className="px-4 py-4">
            {item.files.length === 0 ? <p style={{ fontSize: 13, color: "var(--color-secondary)", marginBottom: 12 }}>No files attached.</p> : (
              <div className="space-y-2 mb-4">
                {item.files.map((file) => (
                  <div key={file.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
                    <FileText size={14} color="#C0392B" />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-body)" }}>{file.name}</p>
                      <p style={{ fontSize: 10, color: "var(--color-secondary)" }}>
                        {formatFileSize(file.size)}
                        {file.ocrStatus === "ready" && <span style={{ marginLeft: 6, color: "var(--color-success)" }}>✓ Searchable</span>}
                      </p>
                    </div>
                    <button className="flex items-center justify-center rounded hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 44, height: 44 }}>
                      <Download size={12} color="var(--color-navy)" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-col items-center justify-center gap-2 py-6 cursor-pointer" style={{ border: "2px dashed var(--color-border)", borderRadius: 8 }}>
              <File size={18} color="var(--color-secondary)" />
              <p style={{ fontSize: 12, color: "var(--color-secondary)" }}>Drop files or click to upload</p>
            </div>
          </div>
        )}
        {tab === "Cite" && (
          <div className="px-4 py-4">
            <div className="flex gap-1.5 mb-4">
              {(["apa", "mla", "chicago"] as const).map((s) => (
                <button key={s} onClick={() => setCitationStyle(s)}
                  style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 5, border: `1px solid ${citationStyle === s ? "var(--color-navy)" : "var(--color-border)"}`, backgroundColor: citationStyle === s ? "var(--color-navy)" : "transparent", color: citationStyle === s ? "#fff" : "var(--color-secondary)", cursor: "pointer", textTransform: "uppercase", minHeight: 36 }}>
                  {s}
                </button>
              ))}
            </div>
            <div className="px-3 py-3 mb-3" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12, color: "var(--color-body)", lineHeight: 1.65 }}>
              {formatCitation(item, citationStyle)}
            </div>
            <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg" style={{ fontSize: 12, fontWeight: 600, backgroundColor: copied ? "var(--color-success)" : "var(--color-navy)", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", minHeight: 44 }}>
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied!" : "Copy citation"}
            </button>
            <div className="flex gap-2 mt-3">
              {["BibTeX", "RIS", "EndNote"].map((fmt) => (
                <button key={fmt} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 5, border: "1px solid var(--color-border)", backgroundColor: "transparent", color: "var(--color-secondary)", cursor: "pointer", minHeight: 36 }}>{fmt}</button>
              ))}
            </div>
          </div>
        )}
        {tab === "Related" && (
          <div className="px-4 py-4">
            {item.relatedIds.length === 0 ? <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No related items linked.</p> : (
              <div className="space-y-2 mb-4">
                {item.relatedIds.map((id) => {
                  const rel = LITERATURE_ITEMS.find((i) => i.id === id);
                  if (!rel) return null;
                  return (
                    <button key={id} className="w-full text-left flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", borderRadius: 8, minHeight: 44 }}>
                      {TYPE_ICONS[rel.type]}
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 12, color: "var(--color-body)", lineHeight: 1.35 }}>{rel.title.length > 60 ? rel.title.slice(0, 60) + "…" : rel.title}</p>
                        <div className="flex items-center gap-2 mt-1"><span style={{ fontSize: 10, color: "var(--color-secondary)" }}>{rel.year}</span><StatusBadge status={rel.status} /></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <button style={{ fontSize: 12, fontWeight: 600, color: "var(--color-navy)", backgroundColor: "transparent", border: "1px solid var(--color-border)", borderRadius: 7, padding: "6px 14px", cursor: "pointer", minHeight: 44 }}>
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
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (collectionsOpen) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [collectionsOpen]);

  const items = LITERATURE_ITEMS.filter((item) => {
    if (scope === "my") return item.scope === "my";
    return item.scope === "lab";
  });

  const filtered = items.filter((item) => {
    if (search && !item.title.toLowerCase().includes(search.toLowerCase()) &&
        !item.authors.some((a) => a.toLowerCase().includes(search.toLowerCase()))) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (activeTag && !item.tags.includes(activeTag)) return false;
    if (activeCollection !== "lc0" && !item.collections.includes(activeCollection)) return false;
    return true;
  });

  const allTags = [...new Set(items.flatMap((i) => i.tags))].sort();

  // Mobile: on detail view, show detail full screen
  const showingDetailMobile = isMobile && selectedItem !== null;

  return (
    <div className="flex h-full" style={{ fontFamily: "var(--font-roboto)" }}>

      {/* Mobile collections backdrop */}
      {collectionsOpen && (
        <div className="fixed inset-0 z-20 md:hidden" style={{ backgroundColor: "rgba(0,0,0,0.3)" }} onClick={() => setCollectionsOpen(false)} aria-hidden="true" />
      )}

      {/* ── Left panel — static on desktop, drawer on mobile ── */}
      <div className="hidden md:flex flex-col shrink-0" style={{ width: 220, borderRight: "1px solid var(--color-border)" }}>
        <CollectionsSidebar
          scope={scope} setScope={setScope}
          activeCollection={activeCollection} setActiveCollection={setActiveCollection}
          allTags={allTags} activeTag={activeTag} setActiveTag={setActiveTag}
          items={items}
        />
      </div>

      {/* Mobile collections drawer */}
      <div
        className="md:hidden fixed top-0 left-0 h-full z-30"
        style={{ width: 260, transform: collectionsOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.22s ease-out", borderRight: "1px solid var(--color-border)" }}
        aria-hidden={!collectionsOpen}
      >
        <CollectionsSidebar
          scope={scope} setScope={setScope}
          activeCollection={activeCollection} setActiveCollection={(id) => { setActiveCollection(id); setCollectionsOpen(false); }}
          allTags={allTags} activeTag={activeTag} setActiveTag={(t) => { setActiveTag(t); setCollectionsOpen(false); }}
          items={items} showClose onClose={() => setCollectionsOpen(false)}
        />
      </div>

      {/* ── Center: Item list — hidden on mobile when viewing detail ── */}
      {!showingDetailMobile && (
        <div className="flex flex-col flex-1 min-w-0" style={{ borderRight: selectedItem && !isMobile ? "1px solid var(--color-border)" : undefined }}>
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 md:px-4 py-2.5 flex-wrap" style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", minHeight: 52 }}>
            {/* Mobile: ← Collections button */}
            <button
              onClick={() => setCollectionsOpen(true)}
              className="md:hidden flex items-center gap-1.5 shrink-0"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--color-navy)", border: "1px solid var(--color-border)", borderRadius: 7, padding: "6px 10px", backgroundColor: "transparent", cursor: "pointer", minHeight: 44 }}
            >
              <ChevronLeft size={14} /> Collections
            </button>

            <div className="relative" style={{ minWidth: 0, flex: 1 }}>
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="var(--color-secondary)" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
                style={{ width: "100%", paddingLeft: 30, paddingRight: 8, height: 36, border: "1px solid var(--color-border)", borderRadius: 7, fontSize: 12, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)", outline: "none" }} />
            </div>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ReadStatus | "all")}
              style={{ height: 36, paddingLeft: 8, paddingRight: 16, border: "1px solid var(--color-border)", borderRadius: 7, fontSize: 12, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)", color: "var(--color-body)", outline: "none", cursor: "pointer" }}>
              <option value="all">All</option>
              <option value="read">Read</option>
              <option value="reading">Reading</option>
              <option value="unread">Unread</option>
            </select>

            {activeTag && (
              <span className="flex items-center gap-1.5 px-2.5 py-1" style={{ backgroundColor: "rgba(27,46,75,0.06)", border: "1px solid var(--color-navy)", borderRadius: 5, fontSize: 11, color: "var(--color-navy)" }}>
                <Tag size={11} />{activeTag}
                <button onClick={() => setActiveTag(null)} style={{ display: "flex" }}><X size={11} /></button>
              </span>
            )}
            <span style={{ fontSize: 11, color: "var(--color-secondary)", marginLeft: "auto", whiteSpace: "nowrap" }}>{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Column headers */}
          <div className="hidden md:grid items-center px-4 py-2" style={{ gridTemplateColumns: "28px 1fr 100px 70px 90px", backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", gap: 8 }}>
            {["", "Title", "Authors", "Year", "Status"].map((col, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)" }}>{col}</span>
            ))}
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-40"><p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No items found.</p></div>
            ) : (
              filtered.map((item) => {
                const isSelected = selectedItem?.id === item.id && !isMobile;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(isSelected ? null : item)}
                    className="w-full text-left"
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "28px 1fr 80px" : "28px 1fr 100px 70px 90px",
                      gap: 8,
                      alignItems: "center",
                      padding: "10px 12px md:16px",
                      paddingLeft: isMobile ? 12 : 16,
                      paddingRight: isMobile ? 12 : 16,
                      backgroundColor: isSelected ? "rgba(27,46,75,0.06)" : "transparent",
                      borderLeft: isSelected ? "3px solid var(--color-navy)" : "3px solid transparent",
                      borderBottom: "1px solid var(--color-border)",
                      minHeight: 48,
                    }}
                    onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "#F8FAFF"; }}
                    onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                  >
                    <span>{TYPE_ICONS[item.type]}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                    {!isMobile && <span style={{ fontSize: 12, color: "var(--color-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatAuthors(item.authors)}</span>}
                    {!isMobile && <span style={{ fontSize: 12, color: "var(--color-secondary)" }}>{item.year}</span>}
                    <StatusBadge status={item.status} />
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Right: Detail panel ── */}
      {/* Desktop: static side panel. Mobile: full screen. */}
      {selectedItem && (
        <>
          {isMobile ? (
            // Mobile: full-screen slide-up
            <div
              className="fixed inset-0 z-40 animate-slide-in-bottom"
              style={{ backgroundColor: "var(--color-surface)" }}
            >
              <DetailPanelContent item={selectedItem} onClose={() => setSelectedItem(null)} isMobileFullscreen />
            </div>
          ) : (
            // Desktop: right panel
            <div className="flex flex-col shrink-0" style={{ width: 340, borderLeft: "1px solid var(--color-border)" }}>
              <DetailPanelContent item={selectedItem} onClose={() => setSelectedItem(null)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
