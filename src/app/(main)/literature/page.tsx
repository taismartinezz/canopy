"use client";

import { useState, useEffect, useRef } from "react";
import {
  formatFileSize,
} from "@/lib/mock-data";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";
import type { LiteratureItem, ReadStatus, LiteratureType, LibraryScope, LiteratureFile, LitAnnotation, LitAssignedReading, LitRecommendation, AssignmentReadingStatus, SubProject } from "@/types";
import {
  Plus, Search, Download, FileText, File, X, Trash2,
  Tag, Star, ExternalLink, Copy, Check, ChevronLeft, ChevronRight,
  Book, BarChart2, GraduationCap,
  Library, ClipboardList, Brain, Microscope, Heart,
  Upload, Link2, MessageSquare, Zap, UserCheck, RefreshCw, Eye, EyeOff, Wifi,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<LiteratureType, React.ReactNode> = {
  article:  <FileText      size={14} color="var(--color-secondary)" aria-label="Article"  />,
  book:     <Book          size={14} color="var(--color-secondary)" aria-label="Book"     />,
  preprint: <FileText      size={14} color="var(--color-secondary)" aria-label="Preprint" />,
  report:   <BarChart2     size={14} color="var(--color-secondary)" aria-label="Report"   />,
  thesis:   <GraduationCap size={14} color="var(--color-secondary)" aria-label="Thesis"  />,
};

function collectionIcon(iconName: string, active: boolean) {
  const color = active ? "#fff" : "var(--color-secondary)";
  const map: Record<string, React.ReactNode> = {
    Library: <Library size={14} color={color} />, ClipboardList: <ClipboardList size={14} color={color} />,
    Brain: <Brain size={14} color={color} />, Microscope: <Microscope size={14} color={color} />,
    Heart: <Heart size={14} color={color} />,
  };
  return map[iconName] ?? <Library size={14} color={color} />;
}

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

function toAuthorsArray(authors: string | string[]): string[] {
  if (Array.isArray(authors)) return authors;
  if (typeof authors !== "string" || !authors.trim()) return [];
  // Handles JSON-array strings stored in the text column e.g. '["Smith","Jones"]'
  if (authors.startsWith("[")) {
    try { return JSON.parse(authors) as string[]; } catch { /* fall through */ }
  }
  return authors.split(",").map((s) => s.trim()).filter(Boolean);
}

function formatAuthors(authors: string | string[]) {
  const arr = toAuthorsArray(authors);
  if (!arr.length) return "—";
  if (arr.length <= 2) return arr.join(", ");
  return `${arr[0]} et al.`;
}

function formatCitation(item: LiteratureItem, style: "apa" | "mla" | "chicago"): string {
  const authors = toAuthorsArray(item.authors).join(", ");
  if (style === "apa")
    return `${authors} (${item.year}). ${item.title}. ${item.journal ?? item.publisher ?? ""}${item.volume ? `, ${item.volume}` : ""}${item.pages ? `, ${item.pages}` : ""}.${item.doi ? ` https://doi.org/${item.doi}` : ""}`;
  if (style === "mla")
    return `${authors}. "${item.title}." ${item.journal ?? item.publisher ?? ""} ${item.volume ?? ""} (${item.year})${item.pages ? `: ${item.pages}` : ""}.`;
  return `${authors}. "${item.title}." ${item.journal ?? item.publisher ?? ""} ${item.volume ?? ""} (${item.year}).`;
}

function guessLitFileType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  return ext || "other";
}

// ── Insert payload builder — single source of truth for real DB schema ────────
// Real columns (confirmed from live DB): id, project_id, user_id, library,
//   title, authors, year, journal, doi, abstract, status, tags, created_at
// Any key not in REAL_LIT_COLS is dropped with a console.warn so drift is
// caught at dev time instead of surfacing as a 400 three rounds later.

const REAL_LIT_COLS = new Set([
  "id", "project_id", "user_id", "library",
  "title", "authors", "year", "journal",
  "doi", "abstract", "status", "tags", "type",
  "sub_project_id",  // added Phase 1 — used for project-scope external member access
]);

function buildLitInsert(
  projectId: string,
  userId: string,
  fields: {
    id?: string;
    library: LibraryScope;
    title: string;
    authors: string | string[];
    year?: number | null;
    journal?: string | null;
    doi?: string | null;
    abstract?: string | null;
    tags?: string[];
    status?: "unread" | "reading" | "read";
    type?: LiteratureType | null;
    sub_project_id?: string | null;
    [extra: string]: unknown;
  }
) {
  // Warn on any key the caller passed that doesn't map to a real column
  for (const key of Object.keys(fields)) {
    if (key !== "id" && !REAL_LIT_COLS.has(key)) {
      console.warn(`[buildLitInsert] Dropping unrecognized field: "${key}"`);
    }
  }
  const payload: Record<string, unknown> = {
    project_id: projectId,
    user_id: userId,
    library: fields.library,
    type: fields.type ?? "article",
    title: fields.title,
    authors: Array.isArray(fields.authors)
      ? fields.authors
      : (fields.authors ?? ""),
    year: fields.year ?? null,
    journal: fields.journal ?? null,
    doi: fields.doi ?? null,
    abstract: fields.abstract ?? null,
    tags: fields.tags ?? [],
    status: fields.status ?? "unread",
  };
  if (fields.id) payload.id = fields.id;
  if (fields.sub_project_id != null) payload.sub_project_id = fields.sub_project_id;
  return payload;
}

// ── Add Item Modal ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", height: 36, border: "1px solid var(--color-border)", borderRadius: 7,
  padding: "0 10px", fontSize: 13, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)",
  color: "var(--color-body)", outline: "none", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase",
  letterSpacing: "0.05em", marginBottom: 5, display: "block",
};

function AddItemModal({
  onSave, onClose, projectId, currentUserId, subProjectId, subProjects,
}: {
  onSave: (item: LiteratureItem) => void;
  onClose: () => void;
  projectId: string;
  currentUserId: string;
  subProjectId: string | null;
  subProjects?: SubProject[];
}) {
  const [type, setType]       = useState<LiteratureType>("article");
  const [title, setTitle]     = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear]       = useState(String(new Date().getFullYear()));
  const [journal, setJournal] = useState("");
  const [doi, setDoi]         = useState("");
  const [tags, setTags]       = useState("");
  const [scope, setScope]     = useState<LibraryScope>("lab");
  const [modalSubProjectId, setModalSubProjectId] = useState<string | null>(subProjectId);
  const [status, setStatus]   = useState<ReadStatus>("unread");
  const [error, setError]     = useState("");
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    const now = new Date().toISOString();

    const { data, error: insertError } = await supabase
      .from("literature_items")
      .insert(buildLitInsert(projectId, currentUserId, {
        library: scope,
        type,
        title: title.trim(),
        authors: authors.split(",").map((a) => a.trim()).filter(Boolean),
        year: parseInt(year) || new Date().getFullYear(),
        journal: journal.trim() || null,
        doi: doi.trim() || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        status,
        sub_project_id: scope === "project" ? (modalSubProjectId ?? subProjectId) : null,
      }))
      .select()
      .single();

    if (insertError) {
      console.error("[Literature] insert error:", insertError.code, insertError.message, insertError.details);
      setError(`Failed to save: ${insertError.message}`);
      setSaving(false);
      return;
    }

    const newItem: LiteratureItem & { subProjectId?: string } = {
      id: data.id as string,
      projectId: data.project_id as string,
      scope: ((data.library ?? data.scope ?? scope) as LiteratureItem["scope"]),
      subProjectId: scope === "project" ? (modalSubProjectId ?? subProjectId ?? undefined) : undefined,
      type: (data.type as LiteratureItem["type"]) ?? type,
      title: data.title as string,
      authors: toAuthorsArray(data.authors as string | string[]),
      year: (data.year as number) ?? 0,
      journal: (data.journal as string | null) ?? undefined,
      doi: (data.doi as string | null) ?? undefined,
      abstract: (data.abstract as string | null) ?? undefined,
      tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
      status: data.status as LiteratureItem["status"],
      rating: 0,
      notes: "",
      files: [],
      addedById: (data.user_id as string) ?? currentUserId,
      addedAt: (data.created_at as string) ?? new Date().toISOString(),
      collections: [],
      relatedIds: [],
    };
    // Log activity
    supabase.from("activity_feed").insert({
      project_id: projectId,
      user_id: currentUserId,
      action_type: "added",
      item_name: newItem.title,
      item_type: "paper",
    }).then(({ error }) => { if (error) console.error("[Literature] activity insert error:", error); });

    onSave(newItem);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: "rgba(27,46,75,0.35)" }} onClick={onClose}>
      <div style={{ backgroundColor: "var(--color-surface)", maxWidth: 520, width: "100%", borderRadius: 10, padding: 28, boxShadow: "0 8px 40px rgba(27,46,75,0.18)", maxHeight: "90dvh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 16, color: "var(--color-navy)", margin: 0 }}>Add item</h2>
          <button onClick={onClose} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 36, height: 36 }} aria-label="Close"><X size={16} color="var(--color-secondary)" /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as LiteratureType)} style={{ ...inputStyle, cursor: "pointer" }}>
                {(["article", "book", "preprint", "report", "thesis"] as LiteratureType[]).map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as ReadStatus)} style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="unread">Unread</option>
                <option value="reading">Reading</option>
                <option value="read">Read</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Title *</label>
            <input autoFocus value={title} onChange={(e) => { setTitle(e.target.value); setError(""); }} placeholder="Title" style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
            {error && <p style={{ fontSize: 12, color: "var(--color-error)", marginTop: 3 }}>{error}</p>}
          </div>

          <div>
            <label style={labelStyle}>Authors (comma-separated)</label>
            <input value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="Last, F., Last, F." style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Year</label>
              <input type="number" value={year} onChange={(e) => setYear(e.target.value)} min={1900} max={2030} style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
            </div>
            <div>
              <label style={labelStyle}>Journal / Publisher</label>
              <input value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="Journal name" style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>DOI</label>
            <input value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="10.xxxx/xxxxx" style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
          </div>

          <div>
            <label style={labelStyle}>Tags (comma-separated)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tag1, tag2" style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
          </div>

          <div>
            <label style={labelStyle}>Library</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(["lab", "personal"] as const).map((s) => (
                <button key={s} onClick={() => { setScope(s); setModalSubProjectId(null); }} style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 6, border: `1px solid ${scope === s && !modalSubProjectId ? "var(--color-navy)" : "var(--color-border)"}`, backgroundColor: scope === s && !modalSubProjectId ? "var(--color-navy)" : "transparent", color: scope === s && !modalSubProjectId ? "#fff" : "var(--color-secondary)", cursor: "pointer", fontFamily: "var(--font-roboto)" }}>
                  {s === "lab" ? "Lab Library" : "My Library"}
                </button>
              ))}
              {(subProjects ?? []).map((sp) => {
                const active = scope === "project" && modalSubProjectId === sp.id;
                return (
                  <button key={sp.id} onClick={() => { setScope("project"); setModalSubProjectId(sp.id); }} style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 6, border: `1px solid ${active ? (sp.color ?? "#34A853") : "var(--color-border)"}`, backgroundColor: active ? (sp.color ?? "#34A853") : "transparent", color: active ? "#fff" : "var(--color-secondary)", cursor: "pointer", fontFamily: "var(--font-roboto)" }}>
                    {sp.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)", border: "1px solid var(--color-border)", borderRadius: 7, padding: "8px 16px", backgroundColor: "transparent", cursor: "pointer", minHeight: 44, fontFamily: "var(--font-roboto)" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ fontSize: 13, fontWeight: 700, color: "#fff", backgroundColor: "var(--color-navy)", border: "none", borderRadius: 7, padding: "8px 20px", cursor: saving ? "default" : "pointer", minHeight: 44, fontFamily: "var(--font-roboto)", opacity: saving ? 0.7 : 1 }}
            onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-navy-hover)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-navy)"; }}
          >{saving ? "Saving…" : "Add item"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Annotation color palette ──────────────────────────────────────────────────

export const ANNOT_COLORS: { hex: string; label: string }[] = [
  { hex: "#3B82F6", label: "Key finding" },
  { hex: "#F59E0B", label: "Question" },
  { hex: "#EF4444", label: "Important" },
  { hex: "#10B981", label: "Methodology" },
  { hex: "#8B5CF6", label: "Hypothesis" },
  { hex: "#64748B", label: "Note" },
];

// ── Zotero RDF parser ─────────────────────────────────────────────────────────

type RDFParsedNote = { itemRef: string; html: string; color?: string };

function parseZoteroRDF(content: string, existingItems: LiteratureItem[], projectId: string, currentUserId: string, scope: LibraryScope): {
  items: LiteratureItem[];
  notes: RDFParsedNote[];
  dupes: number;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "application/xml");

  const ns = (prefix: string) => ({
    rdf:     "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    z:       "http://www.zotero.org/namespaces/export#",
    dc:      "http://purl.org/dc/elements/1.1/",
    dcterms: "http://purl.org/dc/terms/",
    bib:     "http://purl.org/net/biblio#",
    foaf:    "http://xmlns.com/foaf/0.1/",
    prism:   "http://prismstandard.org/namespaces/basic/2.0/",
    link:    "http://purl.org/rss/1.0/modules/link/",
  })[prefix];

  const el = (parent: Element | Document, localName: string, nsPrefix: string) =>
    parent.getElementsByTagNameNS(ns(nsPrefix)!, localName)[0];
  const txt = (parent: Element | Document, localName: string, nsPrefix: string) =>
    el(parent, localName, nsPrefix)?.textContent?.trim() ?? "";

  const RDF_TYPE_MAP: Record<string, LiteratureType> = {
    Article: "article", BookSection: "book", Book: "book",
    Thesis: "thesis", Report: "report", Memo: "article",
  };

  const itemEls = Array.from(doc.querySelectorAll(
    "Article, BookSection, Book, Thesis, Report, ConferencePaper, Document, Presentation"
  ));

  const now = new Date().toISOString();
  const items: LiteratureItem[] = [];
  let dupes = 0;

  for (const itemEl of itemEls) {
    const title = txt(itemEl, "title", "dc") || txt(itemEl, "title", "dcterms");
    if (!title) continue;

    const doiRaw = txt(itemEl, "identifier", "dc");
    const doi = /^DOI\s+/i.test(doiRaw) ? doiRaw.replace(/^DOI\s+/i, "").trim() : undefined;

    const isDupe = existingItems.some(
      (ex) => (doi && ex.doi?.toLowerCase() === doi.toLowerCase()) ||
               ex.title.toLowerCase() === title.toLowerCase()
    );
    if (isDupe) { dupes++; continue; }

    // Authors from bib:authors → rdf:Seq → rdf:li → foaf:Person
    const authorsEl = el(itemEl, "authors", "bib");
    const authors: string[] = [];
    if (authorsEl) {
      for (const person of Array.from(authorsEl.getElementsByTagNameNS(ns("foaf")!, "Person"))) {
        const surname = person.getElementsByTagNameNS(ns("foaf")!, "surname")[0]?.textContent?.trim() ?? "";
        const given   = person.getElementsByTagNameNS(ns("foaf")!, "givenName")[0]?.textContent?.trim() ?? "";
        const full = [given, surname].filter(Boolean).join(" ");
        if (full) authors.push(full);
      }
    }

    // Year from dc:date or dcterms:dateSubmitted
    const dateStr = txt(itemEl, "date", "dc") || txt(itemEl, "dateSubmitted", "dcterms");
    const year = parseInt(dateStr) || 0;

    // Journal from dcterms:isPartOf → bib:Journal → dc:title
    const isPartOf = el(itemEl, "isPartOf", "dcterms");
    const journal  = isPartOf ? txt(isPartOf, "title", "dc") : undefined;
    const volume   = isPartOf ? txt(isPartOf, "volume", "prism") : undefined;

    const abstract = txt(itemEl, "abstract", "dcterms") || txt(itemEl, "description", "dc");
    const url      = txt(itemEl, "link", "link") || txt(itemEl, "identifier", "link") || undefined;

    // Tags from dc:subject
    const tags = Array.from(itemEl.getElementsByTagNameNS(ns("dc")!, "subject"))
      .map((e) => e.textContent?.trim()).filter((t): t is string => !!t);

    const tagName = itemEl.localName;
    items.push({
      id: crypto.randomUUID(), projectId, scope,
      type: RDF_TYPE_MAP[tagName] ?? "article",
      title, authors, year, journal, doi, abstract, url, volume,
      tags, status: "unread", rating: 0, notes: "",
      files: [], collections: [], relatedIds: [],
      addedById: currentUserId, addedAt: now, importSource: "zotero_json",
    });
  }

  // Extract z:Note elements (Zotero child notes)
  const noteEls = Array.from(doc.getElementsByTagNameNS(ns("z")!, "Note"));
  const notes: RDFParsedNote[] = noteEls.map((noteEl) => {
    const html    = txt(noteEl, "value", "rdf");
    const color   = noteEl.getElementsByTagNameNS(ns("z")!, "color")[0]?.textContent?.trim();
    // Relation: dc:relation @rdf:resource → "#item_N"
    const relation = noteEl.getElementsByTagNameNS(ns("dc")!, "relation")[0]
      ?.getAttributeNS(ns("rdf")!, "resource") ?? "";
    return { itemRef: relation, html, color: color || undefined };
  }).filter((n) => n.html);

  return { items, notes, dupes };
}

// ── Zotero JSON Import Modal ──────────────────────────────────────────────────

type CSLJsonItem = {
  type?: string; title?: string | string[];
  author?: Array<{ family?: string; given?: string; literal?: string }>;
  issued?: { "date-parts"?: number[][] };
  "container-title"?: string; publisher?: string;
  DOI?: string; abstract?: string; URL?: string;
  volume?: string; page?: string;
};
const CSL_TYPE_MAP: Record<string, LiteratureType> = {
  "article-journal": "article", "article-magazine": "article",
  "article-newspaper": "article", article: "article",
  book: "book", chapter: "book", incollection: "book",
  report: "report", thesis: "thesis", phdthesis: "thesis",
  manuscript: "preprint", preprint: "preprint",
};
function parseCSLAuthors(a: CSLJsonItem["author"]): string[] {
  return (a ?? []).map((x) => x.literal ?? `${x.given ?? ""} ${x.family ?? ""}`.trim()).filter(Boolean);
}

function ZoteroImportModal({ existingItems, onImport, onClose, projectId, currentUserId, subProjectId }: {
  existingItems: LiteratureItem[]; onImport: (items: LiteratureItem[]) => void;
  onClose: () => void; projectId: string; currentUserId: string; subProjectId: string | null;
}) {
  const [tab, setTab]           = useState<"file" | "api">("file");
  const [parsed, setParsed]     = useState<LiteratureItem[]>([]);
  const [pendingNotes, setPendingNotes] = useState<RDFParsedNote[]>([]);
  const [dupes, setDupes]       = useState(0);
  const [fileName, setFileName] = useState("");
  const [error, setError]       = useState("");
  const [importing, setImporting] = useState(false);
  const [scope, setScope]       = useState<LibraryScope>("lab");

  // Zotero API tab state
  const [apiKey, setApiKey]     = useState("");
  const [zoteroUserId, setZoteroUserId] = useState("");
  const [syncing, setSyncing]   = useState(false);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setFileName(file.name); setParsed([]); setPendingNotes([]); setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      try {
        if (file.name.toLowerCase().endsWith(".rdf")) {
          // Zotero RDF export (multi-item, with notes)
          const { items, notes, dupes: d } = parseZoteroRDF(content, existingItems, projectId, currentUserId, scope);
          setParsed(items); setPendingNotes(notes); setDupes(d);
        } else {
          // CSL JSON export
          const raw = JSON.parse(content) as CSLJsonItem[];
          const now = new Date().toISOString();
          let dupeCount = 0;
          const items: LiteratureItem[] = [];
          for (const z of raw) {
            const title = (Array.isArray(z.title) ? z.title[0] : z.title) ?? "";
            const doi = z.DOI?.toLowerCase();
            const isDupe = existingItems.some(
              (ex) => (doi && ex.doi?.toLowerCase() === doi) || ex.title.toLowerCase() === title.toLowerCase()
            );
            if (isDupe) { dupeCount++; continue; }
            items.push({
              id: crypto.randomUUID(), projectId, scope,
              type: CSL_TYPE_MAP[z.type ?? ""] ?? "article",
              title, authors: parseCSLAuthors(z.author),
              year: z.issued?.["date-parts"]?.[0]?.[0] ?? 0,
              journal: z["container-title"] ?? z.publisher,
              doi: z.DOI, abstract: z.abstract?.replace(/<[^>]+>/g, ""),
              volume: z.volume, pages: z.page, url: z.URL,
              tags: [], status: "unread", rating: 0, notes: "",
              files: [], collections: [], relatedIds: [],
              addedById: currentUserId, addedAt: now, importSource: "zotero_json",
            });
          }
          setParsed(items); setDupes(dupeCount);
        }
      } catch {
        setError(file.name.toLowerCase().endsWith(".rdf")
          ? "Could not parse RDF file. Export from Zotero: File → Export Library → Zotero RDF."
          : "Could not parse file. Export from Zotero as CSL JSON (File → Export Library → CSL JSON).");
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!parsed.length) return;
    setImporting(true);
    const rows = parsed.map((item) =>
      buildLitInsert(projectId, currentUserId, {
        id: item.id, library: item.scope, type: item.type, title: item.title, authors: item.authors,
        year: item.year || null, journal: item.journal ?? null,
        doi: item.doi ?? null, abstract: item.abstract ?? null,
        tags: [], status: "unread",
        sub_project_id: scope === "project" ? subProjectId : null,
      })
    );
    const { error: insertErr } = await supabase.from("literature_items").insert(rows);
    if (insertErr) {
      console.error("[Zotero import]", insertErr.code, insertErr.message, insertErr.details);
      setError(`Import failed: ${insertErr.message}`);
      setImporting(false);
      return;
    }
    // Import RDF notes as annotations on the corresponding items
    if (pendingNotes.length > 0) {
      const annotRows = pendingNotes.flatMap((note) => {
        // Match by itemRef fragment (#item_N) or positional index if available
        const refFragment = note.itemRef.replace(/^.*#/, "");
        const target = parsed.find((_, i) => `item_${i + 1}` === refFragment || `item${i + 1}` === refFragment)
          ?? parsed[0]; // fallback to first item if ref can't be matched
        if (!target) return [];
        // Pick nearest Canopy color; if Zotero color hex doesn't match palette, keep raw hex
        const color = note.color ?? undefined;
        const plainText = note.html.replace(/<[^>]+>/g, "").trim();
        if (!plainText) return [];
        return [{
          id: crypto.randomUUID(), item_id: target.id, author_id: currentUserId,
          text: "", comment: plainText, parent_id: null,
          ...(color ? { color } : {}),
        }];
      });
      if (annotRows.length > 0)
        await supabase.from("lit_annotations").insert(annotRows);
    }
    onImport(parsed); setImporting(false);
  }

  async function handleAPISync() {
    if (!apiKey.trim() || !zoteroUserId.trim()) {
      setApiError("Enter your Zotero user ID and API key."); return;
    }
    setSyncing(true); setApiError("");
    try {
      const res = await fetch("/api/zotero/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), zoteroUserId: zoteroUserId.trim() }),
      });
      const { items: raw, error: err } = await res.json() as { items?: CSLJsonItem[]; error?: string };
      if (err || !raw) { setApiError(err ?? "Sync failed"); setSyncing(false); return; }
      const now = new Date().toISOString();
      let dupeCount = 0;
      const items: LiteratureItem[] = [];
      for (const z of raw) {
        const title = (Array.isArray(z.title) ? z.title[0] : z.title) ?? "";
        const doi = z.DOI?.toLowerCase();
        const isDupe = existingItems.some(
          (ex) => (doi && ex.doi?.toLowerCase() === doi) || ex.title.toLowerCase() === title.toLowerCase()
        );
        if (isDupe) { dupeCount++; continue; }
        items.push({
          id: crypto.randomUUID(), projectId, scope,
          type: CSL_TYPE_MAP[z.type ?? ""] ?? "article",
          title, authors: parseCSLAuthors(z.author),
          year: z.issued?.["date-parts"]?.[0]?.[0] ?? 0,
          journal: z["container-title"] ?? z.publisher,
          doi: z.DOI, abstract: z.abstract?.replace(/<[^>]+>/g, ""),
          volume: z.volume, pages: z.page, url: z.URL,
          tags: [], status: "unread", rating: 0, notes: "",
          files: [], collections: [], relatedIds: [],
          addedById: currentUserId, addedAt: now, importSource: "zotero_api",
        });
      }
      setFileName(`Zotero API — ${items.length + dupeCount} items`);
      setParsed(items); setDupes(dupeCount);
      setTab("file"); // switch to preview/import flow
    } catch (ex) {
      setApiError(ex instanceof Error ? ex.message : "Sync failed");
    } finally { setSyncing(false); }
  }

  const SCOPE_LABELS: Record<LibraryScope, string> = { lab: "Lab Library", personal: "My Library", project: "Project Library" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(27,46,75,0.35)" }}>
      <div style={{ backgroundColor: "var(--color-surface)", maxWidth: 480, width: "100%", borderRadius: 10, padding: 28, boxShadow: "0 8px 40px rgba(27,46,75,0.18)", maxHeight: "90dvh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 16, color: "var(--color-navy)", margin: 0 }}>Import from Zotero</h2>
          <button onClick={onClose} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 36, height: 36 }}><X size={16} color="var(--color-secondary)" /></button>
        </div>

        {/* Tab: File vs API */}
        <div className="flex rounded-lg p-0.5 mb-4" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", width: "fit-content" }}>
          {([["file", "File export"], ["api", "API sync"]] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 6, border: "none", backgroundColor: tab === t ? "var(--color-navy)" : "transparent", color: tab === t ? "#fff" : "var(--color-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              {t === "api" && <Wifi size={11} />}{label}
            </button>
          ))}
        </div>

        {tab === "file" && (
          <>
            <p style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 14 }}>
              In Zotero: <strong>File → Export Library</strong>, then choose <strong>CSL JSON</strong> or <strong>Zotero RDF</strong> (RDF also imports notes as annotations).
            </p>
            <label style={{ display: "block", border: "2px dashed var(--color-border)", borderRadius: 8, padding: "20px 16px", textAlign: "center", cursor: "pointer", marginBottom: 14 }}>
              <Upload size={20} color="var(--color-secondary)" style={{ margin: "0 auto 8px" }} />
              <p style={{ fontSize: 12, color: fileName ? "var(--color-body)" : "var(--color-secondary)" }}>{fileName || "Click to select a .json or .rdf file"}</p>
              <input type="file" accept=".json,.rdf" className="hidden" onChange={handleFile} />
            </label>
            {error && <p style={{ fontSize: 12, color: "var(--color-error)", marginBottom: 10 }}>{error}</p>}
            {parsed.length > 0 && (
              <div className="mb-4 px-3 py-3 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)" }}>{parsed.length} item{parsed.length > 1 ? "s" : ""} ready to import{pendingNotes.length > 0 ? ` + ${pendingNotes.length} note${pendingNotes.length > 1 ? "s" : ""} as annotations` : ""}</p>
                {dupes > 0 && <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 2 }}>{dupes} duplicate{dupes > 1 ? "s" : ""} skipped (matched by DOI or title)</p>}
                <div className="mt-3">
                  <label style={labelStyle}>Add to</label>
                  <div className="flex rounded-lg p-0.5 mt-1" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", width: "fit-content" }}>
                    {(["lab", "personal", "project"] as const).map((s) => (
                      <button key={s} onClick={() => setScope(s)} style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 6, border: "none", backgroundColor: scope === s ? "var(--color-navy)" : "transparent", color: scope === s ? "#fff" : "var(--color-secondary)", cursor: "pointer" }}>
                        {SCOPE_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "api" && (
          <div>
            <p style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 14 }}>
              Go to <strong>zotero.org → Settings → Feeds/API</strong> to create a personal API key, then enter it below.
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label style={labelStyle}>Zotero User ID</label>
                <input value={zoteroUserId} onChange={(e) => setZoteroUserId(e.target.value)} placeholder="e.g. 1234567"
                  style={{ ...inputStyle, width: "100%" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
              </div>
              <div>
                <label style={labelStyle}>API Key</label>
                <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="e.g. AbCdEfGhIjKlMnOp"
                  type="password" style={{ ...inputStyle, width: "100%" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
              </div>
            </div>
            {apiError && <p style={{ fontSize: 12, color: "var(--color-error)", marginBottom: 10 }}>{apiError}</p>}
            <button onClick={handleAPISync} disabled={syncing || !apiKey.trim() || !zoteroUserId.trim()}
              className="flex items-center gap-2"
              style={{ fontSize: 13, fontWeight: 700, color: "#fff", backgroundColor: "var(--color-navy)", border: "none", borderRadius: 7, padding: "8px 20px", cursor: "pointer", minHeight: 44, opacity: (syncing || !apiKey.trim() || !zoteroUserId.trim()) ? 0.5 : 1 }}>
              <Wifi size={14} />{syncing ? "Syncing…" : "Sync library"}
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)", border: "1px solid var(--color-border)", borderRadius: 7, padding: "8px 16px", backgroundColor: "transparent", cursor: "pointer", minHeight: 44 }}>Cancel</button>
          {tab === "file" && (
            <button onClick={handleImport} disabled={!parsed.length || importing}
              style={{ fontSize: 13, fontWeight: 700, color: "#fff", backgroundColor: "var(--color-navy)", border: "none", borderRadius: 7, padding: "8px 20px", cursor: (!parsed.length || importing) ? "default" : "pointer", minHeight: 44, opacity: (!parsed.length || importing) ? 0.5 : 1 }}>
              {importing ? "Importing…" : `Import ${parsed.length > 0 ? parsed.length + " item" + (parsed.length > 1 ? "s" : "") : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DOI / BibTeX / URL Lookup Modal ──────────────────────────────────────────

function parseBibTeX(bib: string): Partial<LiteratureItem> {
  const field = (name: string) =>
    new RegExp(`${name}\\s*=\\s*[{"]([^}"]+)[}"]`, "i").exec(bib)?.[1]?.trim();
  const rawType = (/@(\w+)\s*\{/.exec(bib)?.[1] ?? "article").toLowerCase();
  const TYPE_MAP_BIB: Record<string, LiteratureType> = {
    article: "article", book: "book", inbook: "book", incollection: "book",
    phdthesis: "thesis", mastersthesis: "thesis", techreport: "report", unpublished: "preprint", misc: "article",
  };
  const authorStr = field("author") ?? "";
  return {
    type: TYPE_MAP_BIB[rawType] ?? "article",
    title: field("title") ?? "",
    authors: authorStr ? authorStr.split(/\s+and\s+/i).map((a) => a.trim()) : [],
    year: parseInt(field("year") ?? "0") || 0,
    journal: field("journal") ?? field("booktitle") ?? undefined,
    doi: field("doi") ?? undefined,
    abstract: field("abstract") ?? undefined,
    volume: field("volume") ?? undefined,
    pages: field("pages") ?? undefined,
  };
}

type DOIMode = "doi" | "bibtex" | "url";

function DOILookupModal({ onSave, onClose, projectId, currentUserId, subProjectId }: {
  onSave: (item: LiteratureItem) => void; onClose: () => void;
  projectId: string; currentUserId: string; subProjectId: string | null;
}) {
  const [mode, setMode]       = useState<DOIMode>("doi");
  const [input, setInput]     = useState("");
  const [preview, setPreview] = useState<Partial<LiteratureItem> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [scope, setScope]     = useState<LibraryScope>("lab");

  useEffect(() => { setInput(""); setPreview(null); setError(""); }, [mode]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function fetchDOI(doi: string) {
    setLoading(true); setError(""); setPreview(null);
    try {
      const clean = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`);
      if (!res.ok) throw new Error("Not found");
      const { message: m } = await res.json();
      setPreview({
        type: "article",
        title: (Array.isArray(m.title) ? m.title[0] : m.title) ?? "",
        authors: (m.author ?? []).map((a: { given?: string; family?: string }) => `${a.given ?? ""} ${a.family ?? ""}`.trim()).filter(Boolean),
        year: m.published?.["date-parts"]?.[0]?.[0] ?? m["published-print"]?.["date-parts"]?.[0]?.[0] ?? 0,
        journal: Array.isArray(m["container-title"]) ? m["container-title"][0] : m["container-title"] ?? undefined,
        doi: m.DOI ?? clean,
        abstract: m.abstract?.replace(/<[^>]+>/g, "") ?? undefined,
        volume: m.volume ?? undefined, pages: m.page ?? undefined,
      });
    } catch { setError("Could not fetch metadata. Check the DOI and try again."); }
    finally { setLoading(false); }
  }

  function handleBibTeX() {
    setError(""); setPreview(null);
    const p = parseBibTeX(input);
    if (!p.title) { setError("Could not parse BibTeX. Check the format."); return; }
    setPreview(p);
  }

  async function handleURL() {
    setError(""); setPreview(null);

    // Bare DOI anywhere in the URL
    const doiMatch = /10\.\d{4,}\/[^\s"<>]+/.exec(input);
    if (doiMatch) { await fetchDOI(doiMatch[0]); return; }

    // Google Scholar — try SerpApi first (if configured server-side), then Semantic Scholar
    if (/scholar\.google\./i.test(input)) {
      if (/[?&]user=/.test(input)) {
        setPreview({ title: "", authors: [], year: 0, url: input });
        setError("This is a Scholar author profile page, not a paper page. Paste a Scholar search result or paper URL instead.");
        return;
      }
      setLoading(true);
      // Try server-side SerpApi route first (handles arbitrary Scholar URLs)
      try {
        const serpRes = await fetch("/api/scholar-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: input }),
        });
        if (serpRes.ok) {
          const data = await serpRes.json() as Partial<LiteratureItem>;
          if (data.title) { setPreview(data); setLoading(false); return; }
        }
        // SerpApi not configured or returned nothing — fall through to Semantic Scholar
      } catch { /* fall through */ }
      // Semantic Scholar fallback using title/q param
      const titleParam = /[?&](?:title|q)=([^&]+)/.exec(input)?.[1];
      if (titleParam) {
        const q = decodeURIComponent(titleParam.replace(/\+/g, " "));
        const ssUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&fields=title,authors,year,journal,externalIds&limit=1`;
        let paper: { title: string; authors?: { name: string }[]; year?: number; journal?: { name?: string }; externalIds?: { DOI?: string } } | null = null;
        for (let attempt = 0; attempt < 3 && !paper; attempt++) {
          try {
            if (attempt > 0) await new Promise((r) => setTimeout(r, 600));
            const { data: ss } = await (await fetch(ssUrl)).json();
            paper = ss?.[0] ?? null;
          } catch { /* retry */ }
        }
        setLoading(false);
        if (paper) {
          setPreview({ type: "article", title: paper.title, authors: (paper.authors ?? []).map((a) => a.name), year: paper.year, journal: paper.journal?.name, doi: paper.externalIds?.DOI });
          return;
        }
        setPreview({ title: "", authors: [], year: 0, url: input });
        setError("Couldn't find this paper. Try the DOI or BibTeX option instead (on Scholar, click the quote icon → BibTeX).");
        return;
      }
      setLoading(false);
      setPreview({ title: "", authors: [], year: 0, url: input });
      setError("Can't extract a title from this Scholar URL. Use the DOI or BibTeX option instead.");
      return;
    }

    // Generic URL fallback
    setPreview({ title: "", authors: [], year: 0, url: input });
    setError("Could not extract a DOI from this URL. Fill in the details manually below.");
  }

  async function handleSave() {
    if (!preview?.title?.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    const item: LiteratureItem = {
      id: crypto.randomUUID(), projectId, scope,
      type: preview.type ?? "article", title: preview.title!,
      authors: preview.authors ?? [], year: preview.year ?? 0,
      journal: preview.journal, doi: preview.doi, abstract: preview.abstract,
      volume: preview.volume, pages: preview.pages, url: preview.url,
      tags: [], status: "unread", rating: 0, notes: "",
      files: [], collections: [], relatedIds: [],
      addedById: currentUserId, addedAt: now,
      importSource: mode === "doi" ? "doi" : mode === "bibtex" ? "bibtex" : "url",
    };
    const { error: insertErr } = await supabase.from("literature_items").insert(
      buildLitInsert(projectId, currentUserId, {
        id: item.id, library: scope, type: item.type, title: item.title, authors: item.authors,
        year: item.year || null, journal: item.journal ?? null,
        doi: item.doi ?? null, abstract: item.abstract ?? null,
        tags: [], status: "unread",
        sub_project_id: scope === "project" ? subProjectId : null,
      })
    );
    if (insertErr) {
      console.error("[DOI lookup save]", insertErr.code, insertErr.message, insertErr.details);
      setError(`Failed to save: ${insertErr.message}`);
      setSaving(false);
      return;
    }
    onSave(item); setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(27,46,75,0.35)" }} onClick={onClose}>
      <div style={{ backgroundColor: "var(--color-surface)", maxWidth: 480, width: "100%", borderRadius: 10, padding: 28, boxShadow: "0 8px 40px rgba(27,46,75,0.18)", maxHeight: "90dvh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 16, color: "var(--color-navy)", margin: 0 }}>Add by DOI / BibTeX / URL</h2>
          <button onClick={onClose} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 36, height: 36 }}><X size={16} color="var(--color-secondary)" /></button>
        </div>

        <div className="flex rounded-lg p-0.5 mb-4" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", width: "fit-content" }}>
          {(["doi", "bibtex", "url"] as DOIMode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 6, border: "none", backgroundColor: mode === m ? "var(--color-navy)" : "transparent", color: mode === m ? "#fff" : "var(--color-secondary)", cursor: "pointer", textTransform: "uppercase" }}>{m}</button>
          ))}
        </div>

        {mode === "doi" && (
          <div className="flex gap-2 mb-3">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="10.xxxx/xxxxx or doi.org/…" style={{ ...inputStyle, flex: 1 }}
              onKeyDown={(e) => { if (e.key === "Enter") fetchDOI(input); }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
            <button onClick={() => fetchDOI(input)} disabled={loading || !input.trim()} style={{ padding: "0 16px", height: 36, borderRadius: 7, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, minWidth: 72, opacity: (loading || !input.trim()) ? 0.5 : 1 }}>
              {loading ? "…" : "Fetch"}
            </button>
          </div>
        )}
        {mode === "bibtex" && (
          <div className="mb-3">
            <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={"@article{key,\n  title = {…},\n  author = {…},\n  year = {2024},\n}"}
              style={{ width: "100%", minHeight: 120, fontSize: 12, fontFamily: "monospace", border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 12px", resize: "vertical", outline: "none", boxSizing: "border-box", backgroundColor: "var(--color-canvas)", color: "var(--color-body)" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
            <button onClick={handleBibTeX} disabled={!input.trim()} style={{ marginTop: 8, padding: "6px 16px", height: 36, borderRadius: 7, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, opacity: !input.trim() ? 0.5 : 1 }}>Parse</button>
          </div>
        )}
        {mode === "url" && (
          <div className="flex gap-2 mb-3">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://doi.org/10.xxxx or article URL" style={{ ...inputStyle, flex: 1 }}
              onKeyDown={(e) => { if (e.key === "Enter") handleURL(); }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
            <button onClick={handleURL} disabled={loading || !input.trim()} style={{ padding: "0 16px", height: 36, borderRadius: 7, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, minWidth: 72, opacity: (loading || !input.trim()) ? 0.5 : 1 }}>
              {loading ? "…" : "Fetch"}
            </button>
          </div>
        )}

        {error && <p style={{ fontSize: 12, color: "var(--color-error)", marginBottom: 10 }}>{error}</p>}

        {preview !== null && (
          <div className="px-3 py-3 rounded-lg mb-4" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
            <label style={labelStyle}>Title</label>
            <input value={preview.title ?? ""} onChange={(e) => setPreview((p) => ({ ...p, title: e.target.value }))}
              style={{ ...inputStyle, fontWeight: 600, marginBottom: 8 }} placeholder="Title"
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
            {((preview.authors ?? []).length > 0 || preview.journal) && (
              <p style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 2 }}>
                {(preview.authors ?? []).join("; ")}{preview.journal ? ` · ${preview.journal}` : ""}{preview.year ? ` · ${preview.year}` : ""}
              </p>
            )}
            {preview.doi && <p style={{ fontSize: 11, color: "var(--color-secondary)" }}>DOI: {preview.doi}</p>}
            <div className="mt-3 flex rounded-lg p-0.5" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", width: "fit-content" }}>
              {(["lab", "personal"] as const).map((s) => (
                <button key={s} onClick={() => setScope(s)} style={{ fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 6, border: "none", backgroundColor: scope === s ? "var(--color-navy)" : "transparent", color: scope === s ? "#fff" : "var(--color-secondary)", cursor: "pointer" }}>
                  {s === "lab" ? "Lab" : "Mine"}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)", border: "1px solid var(--color-border)", borderRadius: 7, padding: "8px 16px", backgroundColor: "transparent", cursor: "pointer", minHeight: 44 }}>Cancel</button>
          <button onClick={handleSave} disabled={!preview?.title?.trim() || saving}
            style={{ fontSize: 13, fontWeight: 700, color: "#fff", backgroundColor: "var(--color-navy)", border: "none", borderRadius: 7, padding: "8px 20px", cursor: (!preview?.title?.trim() || saving) ? "default" : "pointer", minHeight: 44, opacity: (!preview?.title?.trim() || saving) ? 0.5 : 1 }}>
            {saving ? "Adding…" : "Add to library"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Left panel ────────────────────────────────────────────────────────────────

type LitScope = "all" | LibraryScope;

const LIT_SCOPE_COLORS: Record<LitScope, string> = {
  all:      "#475569",
  personal: "#0EA5E9",
  lab:      "#0F2544",
  project:  "#34A853",
};

function LitSidebarRow({ label, count, active, color, onClick }: {
  label: string; count: number; active: boolean; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 11px", borderRadius: 7, border: "none", borderLeft: `3px solid ${active ? color : "transparent"}`, cursor: "pointer", backgroundColor: active ? `${color}18` : "transparent", marginBottom: 1, transition: "background-color 120ms ease, border-left-color 120ms ease", textAlign: "left", boxSizing: "border-box", fontFamily: "var(--font-roboto)" }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,0,0,0.04)"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
    >
      <span style={{ flex: 1, fontSize: 13, color: active ? color : "var(--color-body)", fontWeight: active ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: active ? color : "var(--color-secondary)", backgroundColor: active ? `${color}20` : "rgba(0,0,0,0.06)", borderRadius: 10, padding: "1px 7px", flexShrink: 0, minWidth: 20, textAlign: "center" }}>{count}</span>
    </button>
  );
}

function CollectionsSidebar({
  scope, setScope, selectedSubProjectId, setSelectedSubProjectId,
  activeCollection, setActiveCollection, allTags, activeTag, setActiveTag,
  items, allItems,
  showClose, onClose, onAddItem, onCollapse, onImportZotero, onAddByDOI, subProjects,
}: {
  scope: LitScope; setScope: (s: LitScope) => void;
  selectedSubProjectId: string | null; setSelectedSubProjectId: (id: string | null) => void;
  activeCollection: string; setActiveCollection: (id: string) => void;
  allTags: string[]; activeTag: string | null; setActiveTag: (t: string | null) => void;
  items: LiteratureItem[];    // scoped (for collections/tags/stats)
  allItems: LiteratureItem[]; // unscoped (for scope counts in sidebar)
  showClose?: boolean; onClose?: () => void;
  onAddItem: () => void;
  onCollapse?: () => void;
  onImportZotero?: () => void;
  onAddByDOI?: () => void;
  subProjects?: SubProject[];
}) {
  const totalRead    = items.filter((i) => i.status === "read").length;
  const totalReading = items.filter((i) => i.status === "reading").length;
  const totalUnread  = items.filter((i) => i.status === "unread").length;

  const scopeCounts = {
    all:      allItems.length,
    personal: allItems.filter((i) => i.scope === "personal").length,
    lab:      allItems.filter((i) => i.scope === "lab").length,
  };
  const projectCounts: Record<string, number> = {};
  for (const sp of (subProjects ?? [])) {
    projectCounts[sp.id] = allItems.filter((i) => i.scope === "project" && (i as LiteratureItem & { subProjectId?: string }).subProjectId === sp.id).length;
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 16, color: "var(--color-navy)", margin: 0 }}>Literature</h2>
        <div className="flex items-center gap-1">
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="opacity-0 group-hover/litpanel:opacity-100 transition-opacity flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]"
              style={{ width: 32, height: 32 }}
              title="Collapse panel"
              aria-label="Collapse panel"
            >
              <ChevronLeft size={15} color="var(--color-secondary)" />
            </button>
          )}
          {showClose && <button onClick={onClose} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 44, height: 44 }} aria-label="Close"><X size={16} color="var(--color-secondary)" /></button>}
          {onImportZotero && <button onClick={onImportZotero} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 32, height: 32 }} title="Import from Zotero" aria-label="Import from Zotero"><Upload size={15} color="var(--color-body)" /></button>}
          {onAddByDOI && <button onClick={onAddByDOI} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 32, height: 32 }} title="Add by DOI / BibTeX / URL" aria-label="Add by DOI"><Link2 size={15} color="var(--color-body)" /></button>}
          <button onClick={onAddItem} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 44, height: 44 }} aria-label="Add item">
            <Plus size={14} color="var(--color-navy)" />
          </button>
        </div>
      </div>

      <div style={{ padding: "4px 8px 6px", borderBottom: "1px solid var(--color-border)" }}>
        <LitSidebarRow label="All Items" count={scopeCounts.all} active={scope === "all"} color={LIT_SCOPE_COLORS.all} onClick={() => { setScope("all"); setSelectedSubProjectId(null); }} />
        <LitSidebarRow label="Personal"  count={scopeCounts.personal} active={scope === "personal"} color={LIT_SCOPE_COLORS.personal} onClick={() => { setScope("personal"); setSelectedSubProjectId(null); }} />
        <LitSidebarRow label="Lab"       count={scopeCounts.lab}      active={scope === "lab"}      color={LIT_SCOPE_COLORS.lab}      onClick={() => { setScope("lab");      setSelectedSubProjectId(null); }} />
        {(subProjects ?? []).length > 0 && (
          <>
            <div style={{ height: 1, backgroundColor: "var(--color-border)", margin: "4px 2px" }} />
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 11px 2px", margin: 0 }}>Projects</p>
            {(subProjects ?? []).map((sp) => (
              <LitSidebarRow
                key={sp.id}
                label={sp.name}
                count={projectCounts[sp.id] ?? 0}
                active={scope === "project" && selectedSubProjectId === sp.id}
                color={sp.color ?? LIT_SCOPE_COLORS.project}
                onClick={() => { setScope("project"); setSelectedSubProjectId(sp.id); }}
              />
            ))}
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {[
          { id: "lc0", name: "All Items", iconName: "Library", itemCount: items.length },
          ...[...new Set(items.flatMap((i) => i.collections))].map((colId) => ({
            id: colId,
            name: colId,
            iconName: "Library",
            itemCount: items.filter((i) => i.collections.includes(colId)).length,
          })),
        ].map((col) => (
          <button key={col.id} onClick={() => { setActiveCollection(col.id); onClose?.(); }}
            className="w-full flex items-center justify-between px-3 py-2"
            style={{ backgroundColor: activeCollection === col.id ? "var(--color-navy)" : "transparent", color: activeCollection === col.id ? "#fff" : "var(--color-body)", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, textAlign: "left", minHeight: 44, margin: "0 4px", width: "calc(100% - 8px)" }}>
            <span className="flex items-center gap-2">{collectionIcon(col.iconName, activeCollection === col.id)}{col.name}</span>
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

      <div className="px-4 py-3 grid gap-1" style={{ borderTop: "1px solid var(--color-border)", gridTemplateColumns: totalReading > 0 ? "repeat(4,1fr)" : "repeat(3,1fr)" }}>
        {[
          { label: "Total",   value: items.length },
          { label: "Read",    value: totalRead    },
          ...(totalReading > 0 ? [{ label: "Reading", value: totalReading }] : []),
          { label: "Unread",  value: totalUnread  },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-navy)" }}>{value}</p>
            <p style={{ fontSize: 10, color: "var(--color-secondary)" }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Assign Reading Form ───────────────────────────────────────────────────────

function AssignReadingForm({ itemId, projectId, assignedBy, onAssigned }: {
  itemId: string; projectId: string; assignedBy: string;
  onAssigned: (a: LitAssignedReading) => void;
}) {
  const [assigneeId, setAssigneeId]         = useState("");
  const [dueDate, setDueDate]               = useState("");
  const [note, setNote]                     = useState("");
  const [initialStatus, setInitialStatus]   = useState<AssignmentReadingStatus>("not_started");
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState("");

  async function handleAssign() {
    const raw = assigneeId.trim();
    if (!raw) return;
    setSaving(true);
    setError("");

    let resolvedId = raw;

    if (raw.includes("@")) {
      // Resolve email → user_id via security-definer RPC (reads auth.users server-side)
      const { data: found, error: lookupErr } = await supabase.rpc(
        "find_team_member_id_by_email",
        { p_project_id: projectId, p_email: raw },
      );
      if (lookupErr) {
        setError("Email lookup failed. Please try again.");
        setSaving(false);
        return;
      }
      if (!found) {
        setError("No team member with that email found in this project.");
        setSaving(false);
        return;
      }
      resolvedId = found as string;
    } else {
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRe.test(raw)) {
        setError("Invalid format. Enter a valid user ID (UUID) or email address.");
        setSaving(false);
        return;
      }
    }

    const newA: LitAssignedReading = {
      id: crypto.randomUUID(), itemId, projectId, assignedBy,
      assigneeId: resolvedId, dueDate: dueDate || undefined,
      note: note.trim() || undefined, readingStatus: initialStatus,
      createdAt: new Date().toISOString(),
    };
    const { error: insertErr } = await supabase.from("lit_assigned_readings").insert({
      id: newA.id, item_id: itemId, project_id: projectId, assigned_by: assignedBy,
      assignee_id: resolvedId, due_date: dueDate || null, note: note.trim() || null,
      reading_status: initialStatus,
    });
    if (insertErr) {
      console.error("[Assign reading]", insertErr);
      const friendly =
        insertErr.code === "23503" ? "User not found. Make sure they've joined the project." :
        insertErr.code === "23505" ? "This reading is already assigned to that user." :
        "Failed to assign. Please try again.";
      setError(friendly);
      setSaving(false);
      return;
    }
    onAssigned(newA); setAssigneeId(""); setDueDate(""); setNote(""); setInitialStatus("not_started"); setSaving(false);
  }

  return (
    <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", marginBottom: 8 }}>Assign to a team member</p>
      <div className="space-y-2">
        <input value={assigneeId} onChange={(e) => { setAssigneeId(e.target.value); setError(""); }} placeholder="User ID or email"
          style={{ width: "100%", height: 34, border: "1px solid var(--color-border)", borderRadius: 6, padding: "0 10px", fontSize: 12, fontFamily: "var(--font-roboto)", outline: "none", boxSizing: "border-box" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
        <div className="flex gap-2">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            style={{ flex: 1, height: 34, border: "1px solid var(--color-border)", borderRadius: 6, padding: "0 10px", fontSize: 12, fontFamily: "var(--font-roboto)", outline: "none" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
          <select value={initialStatus} onChange={(e) => setInitialStatus(e.target.value as AssignmentReadingStatus)}
            style={{ height: 34, border: "1px solid var(--color-border)", borderRadius: 6, padding: "0 8px", fontSize: 12, fontFamily: "var(--font-roboto)", outline: "none", color: "var(--color-body)", backgroundColor: "var(--color-surface)", cursor: "pointer" }}>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"
          style={{ width: "100%", height: 34, border: "1px solid var(--color-border)", borderRadius: 6, padding: "0 10px", fontSize: 12, fontFamily: "var(--font-roboto)", outline: "none", boxSizing: "border-box" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
        {error && <p style={{ fontSize: 11, color: "var(--color-error)", margin: 0 }}>{error}</p>}
        <button onClick={handleAssign} disabled={!assigneeId.trim() || saving}
          style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 7, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", cursor: "pointer", minHeight: 36, opacity: (!assigneeId.trim() || saving) ? 0.5 : 1 }}>
          {saving ? "Assigning…" : "Assign"}
        </button>
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

const DETAIL_TABS = ["Info", "Abstract", "Notes", "Tags", "Files", "Cite", "Related", "Annotations", "Assigned"] as const;
type DetailTab = typeof DETAIL_TABS[number];

function DetailPanelContent({
  item, onClose, onUpdateItem, onDeleteItem, allItems, currentUserId, projectId, onAddItem, subProjectId,
}: {
  item: LiteratureItem;
  onClose: () => void;
  onUpdateItem: (id: string, updates: Partial<LiteratureItem>) => void;
  onDeleteItem?: (id: string) => void;
  allItems: LiteratureItem[];
  currentUserId: string;
  projectId: string;
  onAddItem: (item: LiteratureItem) => void;
  subProjectId: string | null;
}) {
  const [tab, setTab]                     = useState<DetailTab>("Info");
  const [citationStyle, setCitationStyle] = useState<"apa" | "mla" | "chicago">("apa");
  const [copied, setCopied]               = useState(false);
  const [notes, setNotes]                 = useState(item.notes ?? "");
  const [notesSaved, setNotesSaved]       = useState(false);
  const [localTags, setLocalTags]         = useState<string[]>(item.tags);
  const [tagInput, setTagInput]           = useState("");
  const [localFiles, setLocalFiles]       = useState<LiteratureFile[]>(item.files);
  const [localStatus, setLocalStatus]     = useState<ReadStatus>(item.status);
  const [localRating, setLocalRating]     = useState<number>(item.rating);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [annotations, setAnnotations]   = useState<LitAnnotation[]>([]);
  const [annotAuthors, setAnnotAuthors] = useState<Record<string, string>>({});
  const [newAnnotText, setNewAnnotText] = useState("");
  const [newAnnotComment, setNewAnnotComment] = useState("");
  const [newAnnotColor, setNewAnnotColor] = useState<string | undefined>(undefined);
  const [replyingTo, setReplyingTo]     = useState<string | null>(null);
  const [replyText, setReplyText]       = useState("");
  const [savingAnnot, setSavingAnnot]   = useState(false);
  const [assigned, setAssigned]         = useState<LitAssignedReading[]>([]);
  const [recs, setRecs]                 = useState<LitRecommendation[]>([]);
  const [recsLoading, setRecsLoading]   = useState(false);
  const [recsError, setRecsError]       = useState("");
  const [recsFetched, setRecsFetched]   = useState(false);

  // Sync when item switches
  useEffect(() => {
    setNotes(item.notes ?? "");
    setLocalTags(item.tags);
    setLocalFiles(item.files);
    setLocalStatus(item.status);
    setLocalRating(item.rating);
    setTab("Info");
    setAnnotations([]); setAssigned([]); setRecs([]); setRecsFetched(false);
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === "Annotations") {
      supabase.from("lit_annotations").select("*").eq("item_id", item.id).order("created_at")
        .then(async ({ data }) => {
          if (!data) return;
          const mapped = data.map((r) => ({
            id: r.id as string, itemId: r.item_id as string, authorId: r.author_id as string,
            text: r.text as string, comment: r.comment as string,
            pageRef: r.page_ref as string | undefined,
            parentId: r.parent_id as string | undefined,
            createdAt: r.created_at as string,
            color: r.color as string | undefined,
          }));
          setAnnotations(mapped);
          // Resolve author IDs to names
          const unknownIds = [...new Set(mapped.map((a) => a.authorId))].filter((id) => id !== currentUserId);
          if (unknownIds.length > 0) {
            const { data: profiles } = await supabase.from("user_profiles").select("id, name").in("id", unknownIds);
            if (profiles) {
              setAnnotAuthors((prev) => {
                const next = { ...prev };
                for (const p of profiles) next[p.id as string] = (p.name as string) ?? p.id;
                return next;
              });
            }
          }
        });
    }
    if (tab === "Assigned") {
      (async () => {
        // Prefer the RPC which enforces server-side status masking and returns aggregates.
        // Fall back to direct select (client-side masking only) if the RPC is unavailable.
        const { data: rpcRows, error: rpcErr } = await supabase.rpc(
          "get_item_assignments", { p_item_id: item.id },
        );
        if (!rpcErr && rpcRows) {
          setAssigned((rpcRows as Record<string, unknown>[]).map((r) => ({
            id: r.id as string, itemId: r.item_id as string, projectId: r.project_id as string,
            assignedBy: r.assigned_by as string, assigneeId: r.assignee_id as string,
            dueDate: r.due_date as string | undefined, note: r.note as string | undefined,
            readingStatus: r.reading_status as AssignmentReadingStatus | null,
            createdAt: r.created_at as string,
            statusHidden: (r.status_hidden as boolean | null) ?? false,
            aggDone: r.agg_done as number,
            aggTotal: r.agg_total as number,
          })));
        } else {
          // Fallback: direct query with client-side masking
          if (rpcErr) console.warn("[Assigned] RPC unavailable, falling back to direct query:", rpcErr.message);
          const { data } = await supabase.from("lit_assigned_readings").select("*").eq("item_id", item.id);
          if (data) setAssigned(data.map((r) => ({
            id: r.id as string, itemId: r.item_id as string, projectId: r.project_id as string,
            assignedBy: r.assigned_by as string, assigneeId: r.assignee_id as string,
            dueDate: r.due_date as string | undefined, note: r.note as string | undefined,
            readingStatus: (r.reading_status as AssignmentReadingStatus | null) ?? "not_started",
            createdAt: r.created_at as string,
            statusHidden: (r.status_hidden as boolean | null) ?? false,
          })));
        }
      })();
    }
  }, [tab, item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addAnnotation(parentId?: string) {
    const comment = parentId ? replyText : newAnnotComment;
    const text    = parentId ? "" : newAnnotText;
    const color   = parentId ? undefined : newAnnotColor;
    if (!comment.trim()) return;
    setSavingAnnot(true);
    const now = new Date().toISOString();
    const newA: LitAnnotation = {
      id: crypto.randomUUID(), itemId: item.id, authorId: currentUserId,
      text, comment, parentId, createdAt: now, color,
    };
    const { error: insertErr } = await supabase.from("lit_annotations").insert({
      id: newA.id, item_id: item.id, author_id: currentUserId,
      text, comment, parent_id: parentId ?? null,
      ...(color ? { color } : {}),
    });
    if (insertErr) console.error("[Annotation insert]", insertErr);
    setAnnotations((prev) => [...prev, newA]);
    if (parentId) { setReplyText(""); setReplyingTo(null); }
    else { setNewAnnotText(""); setNewAnnotComment(""); setNewAnnotColor(undefined); }
    setSavingAnnot(false);
  }

  async function updateAnnotationColor(id: string, color: string | undefined) {
    await supabase.from("lit_annotations").update({ color: color ?? null }).eq("id", id);
    setAnnotations((prev) => prev.map((a) => a.id === id ? { ...a, color } : a));
  }

  async function deleteAnnotation(id: string) {
    const { error: delErr } = await supabase.from("lit_annotations").delete().eq("id", id);
    if (delErr) console.error("[Annotation delete]", delErr);
    setAnnotations((prev) => prev.filter((a) => a.id !== id && a.parentId !== id));
  }

  async function fetchRecs() {
    if (!item.doi) return;
    setRecsLoading(true); setRecsError(""); setRecsFetched(true);
    try {
      const workRes = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(item.doi)}`);
      if (!workRes.ok) throw new Error("Not found in OpenAlex");
      const work = await workRes.json();
      const relatedIds: string[] = (work.related_works ?? []).slice(0, 10);
      if (!relatedIds.length) { setRecs([]); setRecsLoading(false); return; }
      const recsRes = await fetch(
        `https://api.openalex.org/works?filter=ids.openalex:${encodeURIComponent(relatedIds.join("|"))}&per_page=5&select=id,display_name,authorships,publication_year,primary_location,doi`
      );
      const { results = [] } = await recsRes.json();
      setRecs(results.map((w: {
        id: string; display_name: string;
        authorships?: Array<{ author: { display_name: string } }>;
        publication_year?: number;
        primary_location?: { source?: { display_name?: string } };
        doi?: string;
      }) => ({
        id: crypto.randomUUID(), sourceItemId: item.id, projectId,
        title: w.display_name,
        authors: (w.authorships ?? []).slice(0, 3).map((a) => a.author.display_name),
        year: w.publication_year,
        journal: w.primary_location?.source?.display_name,
        doi: w.doi?.replace("https://doi.org/", ""),
        openAlexId: w.id,
        cachedAt: new Date().toISOString(),
        dismissed: false,
      })));
    } catch (err) {
      setRecsError(err instanceof Error ? err.message : "Could not load suggestions.");
    } finally { setRecsLoading(false); }
  }

  function updateStatus(s: ReadStatus) {
    setLocalStatus(s);
    onUpdateItem(item.id, { status: s });
  }

  function updateRating(r: number) {
    setLocalRating(r);
    onUpdateItem(item.id, { rating: r });
  }

  function handleCopy() {
    navigator.clipboard.writeText(formatCitation(item, citationStyle)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSaveNotes() {
    onUpdateItem(item.id, { notes });
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 1500);
  }

  function handleAddTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const tag = tagInput.trim();
    if (!tag || localTags.includes(tag)) { setTagInput(""); return; }
    const updated = [...localTags, tag];
    setLocalTags(updated);
    onUpdateItem(item.id, { tags: updated });
    setTagInput("");
  }

  function handleRemoveTag(tag: string) {
    const updated = localTags.filter((t) => t !== tag);
    setLocalTags(updated);
    onUpdateItem(item.id, { tags: updated });
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const newFile: LiteratureFile = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      uploaderId: currentUserId,
      uploadedAt: new Date().toISOString(),
      ocrStatus: null,
    };
    const updated = [...localFiles, newFile];
    setLocalFiles(updated);
    onUpdateItem(item.id, { files: updated });
    e.target.value = "";
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {TYPE_ICONS[item.type]}
              <StatusBadge status={localStatus} />
            </div>
            <p style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 13, color: "var(--color-body)", lineHeight: 1.4, margin: 0 }}>{item.title}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onDeleteItem && (
              <button
                onClick={() => { if (window.confirm("Remove this paper from the library?")) onDeleteItem(item.id); }}
                className="flex items-center justify-center rounded-lg"
                style={{ width: 36, height: 36, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer" }}
                aria-label="Delete paper"
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-error)"; (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(192,57,43,0.08)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--color-secondary)"; (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
              >
                <Trash2 size={14} />
              </button>
            )}
            <button onClick={onClose} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 44, height: 44 }} aria-label="Close"><X size={15} color="var(--color-secondary)" /></button>
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto px-1" style={{ borderBottom: "1px solid var(--color-border)" }}>
        {DETAIL_TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ fontSize: 12, fontWeight: tab === t ? 600 : 400, color: tab === t ? "var(--color-navy)" : "var(--color-secondary)", backgroundColor: "transparent", border: "none", borderBottom: tab === t ? "2px solid var(--color-navy)" : "2px solid transparent", cursor: "pointer", padding: "10px 10px", whiteSpace: "nowrap", minHeight: 44 }}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "Info" && (
          <div className="px-4 py-4 space-y-3">
            {[["Authors", toAuthorsArray(item.authors).join("; ") || "—"], ["Year", String(item.year)], ["Journal", item.journal ?? item.publisher ?? "—"], ["Volume", item.volume ?? "—"], ["Pages", item.pages ?? "—"], ["DOI", item.doi ?? "—"], ["Type", item.type.charAt(0).toUpperCase() + item.type.slice(1)]].map(([label, value]) => (
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
                  <button key={s} onClick={() => updateStatus(s)}
                    style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 5, border: `1px solid ${localStatus === s ? STATUS_CONFIG[s].color : "var(--color-border)"}`, backgroundColor: localStatus === s ? STATUS_CONFIG[s].bg : "transparent", color: localStatus === s ? STATUS_CONFIG[s].color : "var(--color-secondary)", cursor: "pointer", minHeight: 36 }}>
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Star rating */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", marginBottom: 6 }}>Rating</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => updateRating(star)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", lineHeight: 1 }}
                    aria-label={`Rate ${star} stars`}
                  >
                    <Star size={18} color={star <= localRating ? "#A0622A" : "var(--color-border)"} fill={star <= localRating ? "#A0622A" : "none"} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg" style={{ backgroundColor: "var(--color-navy)", color: "#fff", fontSize: 12, fontWeight: 700, border: "none", borderRadius: 7, cursor: "pointer", minHeight: 44 }}>
                <FileText size={13} /> Open PDF
              </button>
              {item.doi && (
                <a href={`https://doi.org/${item.doi}`} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg"
                  style={{ backgroundColor: "transparent", color: "var(--color-navy)", fontSize: 12, fontWeight: 700, border: "1px solid var(--color-navy)", borderRadius: 7, cursor: "pointer", minHeight: 44, textDecoration: "none" }}>
                  <ExternalLink size={13} /> DOI
                </a>
              )}
            </div>
          </div>
        )}

        {tab === "Abstract" && (
          <div className="px-4 py-4">
            {item.abstract
              ? <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.75 }}>{item.abstract}</p>
              : <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No abstract available.</p>}
          </div>
        )}

        {tab === "Notes" && (
          <div className="px-4 py-4 flex flex-col gap-3">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add your notes here..."
              style={{ width: "100%", minHeight: 180, fontSize: 13, color: "var(--color-body)", fontFamily: "var(--font-roboto)", lineHeight: 1.6, border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 12px", resize: "vertical", backgroundColor: "var(--color-canvas)", outline: "none" }} />
            <button onClick={handleSaveNotes}
              style={{ alignSelf: "flex-end", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 7, backgroundColor: notesSaved ? "var(--color-success)" : "var(--color-navy)", color: "#fff", border: "none", cursor: "pointer", minHeight: 44, transition: "background-color 0.2s" }}>
              {notesSaved ? "Saved ✓" : "Save notes"}
            </button>
          </div>
        )}

        {tab === "Tags" && (
          <div className="px-4 py-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {localTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1" style={{ border: "1px solid var(--color-navy)", borderRadius: 6, fontSize: 12, color: "var(--color-navy)", backgroundColor: "rgba(27,46,75,0.04)" }}>
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} aria-label={`Remove ${tag}`} style={{ display: "flex", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
                    <X size={11} color="var(--color-navy)" />
                  </button>
                </span>
              ))}
            </div>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="Add tag and press Enter"
              style={{ width: "100%", height: 36, paddingLeft: 10, border: "1px solid var(--color-border)", borderRadius: 6, fontSize: 12, fontFamily: "var(--font-roboto)", outline: "none" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
            />
          </div>
        )}

        {tab === "Files" && (
          <div className="px-4 py-4">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
            {localFiles.length > 0 && (
              <div className="space-y-2 mb-4">
                {localFiles.map((file) => (
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
            {localFiles.length === 0 && (
              <p style={{ fontSize: 13, color: "var(--color-secondary)", marginBottom: 12 }}>No files attached.</p>
            )}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 py-6 cursor-pointer transition-colors hover:bg-[rgba(27,46,75,0.03)]"
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
                <button key={s} onClick={() => setCitationStyle(s)}
                  style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 5, border: `1px solid ${citationStyle === s ? "var(--color-navy)" : "var(--color-border)"}`, backgroundColor: citationStyle === s ? "var(--color-navy)" : "transparent", color: citationStyle === s ? "#fff" : "var(--color-secondary)", cursor: "pointer", textTransform: "uppercase", minHeight: 36 }}>
                  {s}
                </button>
              ))}
            </div>
            <div className="px-3 py-3 mb-3" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12, color: "var(--color-body)", lineHeight: 1.65 }}>
              {formatCitation(item, citationStyle)}
            </div>
            <button onClick={handleCopy} className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
              style={{ fontSize: 12, fontWeight: 600, backgroundColor: copied ? "var(--color-success)" : "var(--color-navy)", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", minHeight: 44, transition: "background-color 0.2s" }}>
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
            {item.relatedIds.length === 0
              ? <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No related items linked.</p>
              : (
                <div className="space-y-2 mb-4">
                  {item.relatedIds.map((id) => {
                    const rel = allItems.find((i) => i.id === id);
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

            {/* AI Suggestions */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-3">
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)" }}>AI Suggestions</p>
                {!recsFetched && item.doi && (
                  <button onClick={fetchRecs} disabled={recsLoading}
                    className="flex items-center gap-1.5"
                    style={{ fontSize: 11, fontWeight: 700, color: "var(--color-navy)", backgroundColor: "rgba(27,46,75,0.06)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", minHeight: 30 }}>
                    <Zap size={11} /> Find similar papers
                  </button>
                )}
                {recsFetched && !recsLoading && (
                  <button onClick={() => { setRecsFetched(false); setRecs([]); fetchRecs(); }} style={{ fontSize: 11, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    <RefreshCw size={11} /> Refresh
                  </button>
                )}
              </div>
              {!item.doi && <p style={{ fontSize: 12, color: "var(--color-secondary)" }}>Add a DOI to this item to enable AI suggestions.</p>}
              {recsLoading && <p style={{ fontSize: 12, color: "var(--color-secondary)" }}>Fetching suggestions from OpenAlex…</p>}
              {recsError && <p style={{ fontSize: 12, color: "var(--color-error)" }}>{recsError}</p>}
              {recs.filter((r) => !r.dismissed).map((rec) => (
                <div key={rec.id} className="flex items-start gap-2 px-3 py-2.5 mb-2 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 12, color: "var(--color-body)", lineHeight: 1.35, marginBottom: 2 }}>{rec.title.length > 70 ? rec.title.slice(0, 70) + "…" : rec.title}</p>
                    <p style={{ fontSize: 11, color: "var(--color-secondary)" }}>{rec.authors.join(", ")}{rec.year ? ` · ${rec.year}` : ""}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={async () => {
                      const newItem: LiteratureItem = {
                        id: crypto.randomUUID(), projectId, scope: item.scope,
                        type: "article", title: rec.title, authors: rec.authors,
                        year: rec.year ?? 0, journal: rec.journal, doi: rec.doi,
                        tags: [], status: "unread", rating: 0, notes: "",
                        files: [], collections: [], relatedIds: [],
                        addedById: currentUserId, addedAt: new Date().toISOString(),
                      };
                      const { error: e } = await supabase.from("literature_items").insert(
                        buildLitInsert(projectId, currentUserId, {
                          id: newItem.id, library: item.scope, type: "article", title: rec.title,
                          authors: rec.authors, year: rec.year || null,
                          journal: rec.journal ?? null, doi: rec.doi ?? null,
                          tags: [], status: "unread",
                          sub_project_id: item.scope === "project" ? subProjectId : null,
                        })
                      );
                      if (e) { console.error("[Rec add]", e.code, e.message, e.details); setRecsError(`Failed to add: ${e.message}`); return; }
                      onAddItem(newItem);
                      setRecs((prev) => prev.map((r) => r.id === rec.id ? { ...r, dismissed: true } : r));
                    }} style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 5, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", cursor: "pointer", minHeight: 28, whiteSpace: "nowrap" }}>+ Add</button>
                    <button onClick={() => setRecs((prev) => prev.map((r) => r.id === rec.id ? { ...r, dismissed: true } : r))}
                      style={{ background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "center", padding: 2 }} aria-label="Dismiss">
                      <X size={12} color="var(--color-secondary)" />
                    </button>
                  </div>
                </div>
              ))}
              {recsFetched && !recsLoading && recs.filter((r) => !r.dismissed).length === 0 && !recsError && (
                <p style={{ fontSize: 12, color: "var(--color-secondary)" }}>No suggestions found for this paper.</p>
              )}
            </div>
          </div>
        )}

        {tab === "Annotations" && (
          <div className="px-4 py-4">
            {/* Add annotation form */}
            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
              <label style={labelStyle}>Quoted passage (optional)</label>
              <textarea value={newAnnotText} onChange={(e) => setNewAnnotText(e.target.value)} placeholder="Paste a quote from the paper…"
                style={{ width: "100%", minHeight: 60, fontSize: 12, fontFamily: "var(--font-roboto)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "8px 10px", resize: "none", outline: "none", boxSizing: "border-box", backgroundColor: "var(--color-surface)", color: "var(--color-body)", marginBottom: 8 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
              <label style={labelStyle}>Comment *</label>
              <textarea value={newAnnotComment} onChange={(e) => setNewAnnotComment(e.target.value)} placeholder="Add your comment…"
                style={{ width: "100%", minHeight: 60, fontSize: 12, fontFamily: "var(--font-roboto)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "8px 10px", resize: "none", outline: "none", boxSizing: "border-box", backgroundColor: "var(--color-surface)", color: "var(--color-body)", marginBottom: 8 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
              {/* Color tag picker */}
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 11, color: "var(--color-secondary)" }}>Tag:</span>
                {ANNOT_COLORS.map((c) => (
                  <button key={c.hex} title={c.label} onClick={() => setNewAnnotColor(newAnnotColor === c.hex ? undefined : c.hex)}
                    style={{ width: 16, height: 16, borderRadius: "50%", backgroundColor: c.hex, border: newAnnotColor === c.hex ? "2px solid var(--color-navy)" : "2px solid transparent", cursor: "pointer", outline: "none", flexShrink: 0 }} />
                ))}
                {newAnnotColor && (
                  <span style={{ fontSize: 11, color: "var(--color-secondary)" }}>
                    {ANNOT_COLORS.find((c) => c.hex === newAnnotColor)?.label}
                  </span>
                )}
              </div>
              <button onClick={() => addAnnotation()} disabled={!newAnnotComment.trim() || savingAnnot}
                style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 7, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", cursor: "pointer", minHeight: 36, opacity: (!newAnnotComment.trim() || savingAnnot) ? 0.5 : 1 }}>
                <MessageSquare size={12} style={{ display: "inline", marginRight: 5 }} />{savingAnnot ? "Saving…" : "Add annotation"}
              </button>
            </div>

            {/* Annotation list */}
            {annotations.length === 0
              ? <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No annotations yet. Be the first to comment.</p>
              : annotations.filter((a) => !a.parentId).map((a) => (
                <div key={a.id} className="mb-3">
                  <div className="px-3 py-3 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: `1px solid ${a.color ?? "var(--color-border)"}`, borderLeft: a.color ? `3px solid ${a.color}` : "1px solid var(--color-border)" }}>
                    {a.text && (
                      <blockquote style={{ borderLeft: `3px solid ${a.color ?? "var(--color-navy)"}`, paddingLeft: 10, margin: "0 0 8px", fontSize: 12, color: "var(--color-secondary)", fontStyle: "italic", lineHeight: 1.5 }}>
                        {a.text}
                      </blockquote>
                    )}
                    <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.5, marginBottom: 6 }}>{a.comment}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 10, color: "var(--color-secondary)" }}>
                          {a.authorId === currentUserId ? "You" : (annotAuthors[a.authorId] ?? a.authorId.slice(0, 8))} · {new Date(a.createdAt).toLocaleDateString()}
                        </span>
                        {/* Inline color tag change for annotation author */}
                        {a.authorId === currentUserId && (
                          <div className="flex items-center gap-1">
                            {ANNOT_COLORS.map((c) => (
                              <button key={c.hex} title={c.label} onClick={() => updateAnnotationColor(a.id, a.color === c.hex ? undefined : c.hex)}
                                style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: c.hex, border: a.color === c.hex ? "1.5px solid var(--color-navy)" : "1.5px solid transparent", cursor: "pointer", outline: "none" }} />
                            ))}
                          </div>
                        )}
                        {a.color && a.authorId !== currentUserId && (
                          <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: a.color, display: "inline-block" }} />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setReplyingTo(replyingTo === a.id ? null : a.id)}
                          style={{ fontSize: 11, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>Reply</button>
                        {a.authorId === currentUserId && (
                          <button onClick={() => deleteAnnotation(a.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }} aria-label="Delete">
                            <X size={11} color="var(--color-secondary)" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Replies */}
                  {annotations.filter((r) => r.parentId === a.id).map((reply) => (
                    <div key={reply.id} className="ml-4 mt-1.5 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "rgba(27,46,75,0.03)", border: "1px solid var(--color-border)" }}>
                      <p style={{ fontSize: 12, color: "var(--color-body)", lineHeight: 1.5, marginBottom: 4 }}>{reply.comment}</p>
                      <div className="flex items-center justify-between">
                        <span style={{ fontSize: 10, color: "var(--color-secondary)" }}>{reply.authorId === currentUserId ? "You" : (annotAuthors[reply.authorId] ?? reply.authorId.slice(0, 8))} · {new Date(reply.createdAt).toLocaleDateString()}</span>
                        {reply.authorId === currentUserId && (
                          <button onClick={() => deleteAnnotation(reply.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}><X size={11} color="var(--color-secondary)" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                  {/* Reply form */}
                  {replyingTo === a.id && (
                    <div className="ml-4 mt-1.5 flex gap-2">
                      <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply…"
                        style={{ flex: 1, height: 34, border: "1px solid var(--color-border)", borderRadius: 6, padding: "0 10px", fontSize: 12, fontFamily: "var(--font-roboto)", outline: "none" }}
                        onKeyDown={(e) => { if (e.key === "Enter") addAnnotation(a.id); }}
                        onFocus={(ex) => { ex.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(ex) => { ex.currentTarget.style.borderColor = "var(--color-border)"; }} />
                      <button onClick={() => addAnnotation(a.id)} style={{ padding: "0 12px", height: 34, borderRadius: 6, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12 }}>↑</button>
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        )}

        {tab === "Assigned" && (() => {
          const STATUS_LABELS: Record<AssignmentReadingStatus, string> = {
            not_started: "Not started", in_progress: "In progress", done: "Done",
          };
          const STATUS_COLORS: Record<AssignmentReadingStatus, { color: string; bg: string }> = {
            not_started: { color: "#64748B", bg: "#F1F5F9" },
            in_progress: { color: "#A0622A", bg: "#FDEFD4" },
            done:        { color: "#2E7D52", bg: "#D4EDE0" },
          };
          // Server-computed aggregates include hidden entries; fall back to client count when RPC unavailable.
          const aggDone  = assigned[0]?.aggDone  ?? assigned.filter((a) => a.readingStatus === "done").length;
          const aggTotal = assigned[0]?.aggTotal ?? assigned.length;
          const progress = aggTotal > 0 ? Math.round((aggDone / aggTotal) * 100) : 0;

          return (
            <div className="px-4 py-4">
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", marginBottom: 8 }}>Team Assignments</p>

              {/* Progress summary */}
              {assigned.length > 0 && (
                <div className="mb-4 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-body)" }}>{aggDone} of {aggTotal} completed</span>
                    <span style={{ fontSize: 11, color: "var(--color-secondary)" }}>{progress}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, backgroundColor: "var(--color-border)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, backgroundColor: "#2E7D52", borderRadius: 3, transition: "width 0.3s ease" }} />
                  </div>
                </div>
              )}

              {assigned.length === 0
                ? <p style={{ fontSize: 13, color: "var(--color-secondary)", marginBottom: 16 }}>No one has been assigned this paper yet.</p>
                : (
                  <div className="space-y-2 mb-4">
                    {assigned.map((a) => {
                      // readingStatus is null when the server masked it (hidden peer row)
                      const sc = STATUS_COLORS[a.readingStatus ?? "not_started"];
                      const canSeeStatus = a.readingStatus !== null;
                      return (
                        <div key={a.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
                          <UserCheck size={14} color="var(--color-navy)" style={{ marginTop: 2, flexShrink: 0 }} />
                          <div className="flex-1 min-w-0">
                            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-body)", wordBreak: "break-all" }}>
                              {a.assigneeId === currentUserId ? "You" : a.assigneeId}
                            </p>
                            {a.dueDate && <p style={{ fontSize: 11, color: "var(--color-secondary)" }}>Due {new Date(a.dueDate).toLocaleDateString()}</p>}
                            {a.note && <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 2 }}>{a.note}</p>}
                            {/* Status — only the assignee can update; peers may see "—" if hidden */}
                            {a.assigneeId === currentUserId ? (
                              <div className="flex items-center gap-2 mt-1">
                                <select
                                  value={a.readingStatus ?? "not_started"}
                                  onChange={async (e) => {
                                    const newStatus = e.target.value as AssignmentReadingStatus;
                                    const { error: updErr } = await supabase
                                      .from("lit_assigned_readings")
                                      .update({ reading_status: newStatus })
                                      .eq("id", a.id);
                                    if (updErr) { console.error("[Update reading status]", updErr); return; }
                                    setAssigned((prev) => prev.map((x) => x.id === a.id ? { ...x, readingStatus: newStatus } : x));
                                  }}
                                  style={{ fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 5, border: `1px solid ${sc.color}`, backgroundColor: sc.bg, color: sc.color, cursor: "pointer", outline: "none" }}
                                >
                                  {(["not_started", "in_progress", "done"] as AssignmentReadingStatus[]).map((s) => (
                                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                  ))}
                                </select>
                                {/* Visibility toggle — only the assignee sees this */}
                                <button
                                  title={a.statusHidden ? "Status hidden from peers — click to show" : "Status visible to peers — click to hide"}
                                  onClick={async () => {
                                    const hidden = !a.statusHidden;
                                    await supabase.from("lit_assigned_readings").update({ status_hidden: hidden }).eq("id", a.id);
                                    setAssigned((prev) => prev.map((x) => x.id === a.id ? { ...x, statusHidden: hidden } : x));
                                  }}
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}
                                  aria-label={a.statusHidden ? "Show status to peers" : "Hide status from peers"}
                                >
                                  {a.statusHidden
                                    ? <EyeOff size={13} color="var(--color-secondary)" />
                                    : <Eye size={13} color="var(--color-secondary)" />}
                                </button>
                              </div>
                            ) : (
                              <span style={{ display: "inline-block", marginTop: 4, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, backgroundColor: canSeeStatus ? sc.bg : "#F1F5F9", color: canSeeStatus ? sc.color : "#64748B" }}>
                                {canSeeStatus ? STATUS_LABELS[a.readingStatus!] : "—"}
                              </span>
                            )}
                          </div>
                          {(a.assignedBy === currentUserId || a.assigneeId === currentUserId) && (
                            <button
                              onClick={async () => {
                                const { error: delErr } = await supabase.from("lit_assigned_readings").delete().eq("id", a.id);
                                if (delErr) { console.error("[Remove assignment]", delErr); return; }
                                setAssigned((prev) => prev.filter((x) => x.id !== a.id));
                              }}
                              style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
                              title="Remove assignment" aria-label="Remove assignment"
                            >
                              <X size={13} color="var(--color-secondary)" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              <AssignReadingForm itemId={item.id} projectId={projectId} assignedBy={currentUserId}
                onAssigned={(a) => setAssigned((prev) => [...prev, a])} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Literature page ───────────────────────────────────────────────────────────

export default function LiteraturePage() {
  const { subProjectId, subProjects } = useProject();
  const [items, setItems]               = useState<LiteratureItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [scope, setScope]               = useState<LitScope>("all");
  const [selectedSubProjectId, setSelectedSubProjectId] = useState<string | null>(null);
  const [activeCollection, setActiveCollection] = useState("lc0");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<ReadStatus | "all">("all");
  const [activeTag, setActiveTag]       = useState<string | null>(null);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [panelTransitionActive, setPanelTransitionActive] = useState(false);
  const [isMobile, setIsMobile]         = useState(false);
  const [addItemOpen, setAddItemOpen]       = useState(false);
  const [zoteroImportOpen, setZoteroImportOpen] = useState(false);
  const [doiLookupOpen, setDoiLookupOpen]   = useState(false);
  const [projectId, setProjectId]           = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [typeFilter, setTypeFilter]     = useState<LiteratureType | "all">("all");
  const [yearFilter, setYearFilter]     = useState<number | "all">("all");
  const [yearSort, setYearSort]         = useState<"desc" | "asc">("desc");

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user ?? null;
      if (!user) { setLoadingItems(false); return; }
      setCurrentUserId(user.id);
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("project_id")
        .eq("id", user.id)
        .maybeSingle();
      const projectId = profile?.project_id as string | undefined;
      if (!projectId) { setLoadingItems(false); return; }
      setProjectId(projectId);
      supabase
        .from("literature_items")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .then(({ data, error: fetchError }) => {
          if (fetchError) console.error("[Literature] fetch error:", fetchError);
          if (data) setItems(data.map((row) => ({
            id: row.id as string,
            projectId: row.project_id as string,
            scope: ((row.library ?? row.scope ?? "lab") as LiteratureItem["scope"]),
            subProjectId: (row.sub_project_id as string | null | undefined) ?? undefined,
            type: (row.type as LiteratureItem["type"]) ?? "article",
            title: row.title as string,
            authors: toAuthorsArray(row.authors as string | string[]),
            year: (row.year as number | null) ?? 0,
            journal: (row.journal as string | null) ?? undefined,
            doi: (row.doi as string | null) ?? undefined,
            abstract: (row.abstract as string | null) ?? undefined,
            tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
            status: (row.status as LiteratureItem["status"]) ?? "unread",
            rating: 0,
            notes: "",
            files: [],
            addedById: (row.user_id ?? row.added_by) as string,
            addedAt: (row.created_at ?? row.added_at) as string,
            collections: [],
            relatedIds: [],
          })));
          setLoadingItems(false);
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (collectionsOpen) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [collectionsOpen]);

  // Derive selectedItem from items so updates are atomic — no two-render flicker
  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null;

  function updateItem(id: string, updates: Partial<LiteratureItem>) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...updates } : item));
    if (!isSupabaseConfigured) return;
    const colMap: Record<string, string> = { notes: "notes", tags: "tags", status: "status", rating: "rating" };
    const payload: Record<string, unknown> = {};
    for (const [k, col] of Object.entries(colMap)) {
      if (k in updates) payload[col] = (updates as Record<string, unknown>)[k];
    }
    if (Object.keys(payload).length > 0) {
      supabase.from("literature_items").update(payload).eq("id", id)
        .then(({ error }) => { if (error) console.error("[Literature] update:", error); });
    }
  }

  async function deleteItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedItemId(null);
    if (isSupabaseConfigured) {
      const { error } = await supabase.from("literature_items").delete().eq("id", id);
      if (error) console.error("[Literature] delete:", error);
    }
  }

  function addItem(item: LiteratureItem) {
    setItems((prev) => [item, ...prev]);
    setAddItemOpen(false);
  }

  function importItems(newItems: LiteratureItem[]) {
    setItems((prev) => [...newItems, ...prev]);
    setZoteroImportOpen(false);
  }

  function addItemFromDOI(item: LiteratureItem) {
    setItems((prev) => [item, ...prev]);
    setDoiLookupOpen(false);
  }

  const scopedItems = items.filter((item) => {
    if (scope === "all") return true;
    if (scope === "personal") return item.scope === "personal";
    if (scope === "project") return item.scope === "project" && (!selectedSubProjectId || (item as LiteratureItem & { subProjectId?: string }).subProjectId === selectedSubProjectId);
    return item.scope === "lab";
  });

  const availableYears = [...new Set(scopedItems.map((i) => i.year).filter(Boolean))].sort((a, b) => b - a);

  const filtered = scopedItems
    .filter((item) => {
      if (search && !item.title.toLowerCase().includes(search.toLowerCase()) &&
          !toAuthorsArray(item.authors).some((a) => a.toLowerCase().includes(search.toLowerCase()))) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (yearFilter !== "all" && item.year !== yearFilter) return false;
      if (activeTag && !item.tags.includes(activeTag)) return false;
      if (activeCollection !== "lc0" && !item.collections.includes(activeCollection)) return false;
      return true;
    })
    .sort((a, b) => yearSort === "desc" ? b.year - a.year : a.year - b.year);

  const allTags = [...new Set(scopedItems.flatMap((i) => i.tags))].sort();
  const showingDetailMobile = isMobile && selectedItem !== null;

  // When the detail panel is open on desktop, drop Authors/Year columns so title isn't squeezed
  const narrowList = isMobile || (selectedItem !== null && !isMobile);

  return (
    <div className="flex h-full" style={{ fontFamily: "var(--font-roboto)" }}>

      {collectionsOpen && (
        <div className="fixed inset-0 z-20" style={{ display: isMobile ? "block" : "none", backgroundColor: "rgba(0,0,0,0.3)" }} onClick={() => setCollectionsOpen(false)} aria-hidden="true" />
      )}

      {/* Left panel — animates to 0 when collapsed */}
      <div
        className="flex-col shrink-0 group/litpanel"
        style={{
          display: isMobile ? "none" : "flex",
          width: panelCollapsed ? 0 : 220,
          overflow: "clip",
          borderRight: panelCollapsed ? "none" : "1px solid var(--color-border)",
          transition: panelTransitionActive ? "width 200ms ease" : "none",
        }}
      >
        <CollectionsSidebar
          scope={scope} setScope={setScope}
          selectedSubProjectId={selectedSubProjectId} setSelectedSubProjectId={setSelectedSubProjectId}
          activeCollection={activeCollection} setActiveCollection={setActiveCollection}
          allTags={allTags} activeTag={activeTag} setActiveTag={setActiveTag}
          items={scopedItems} allItems={items} subProjects={subProjects} onAddItem={() => setAddItemOpen(true)}
          onCollapse={() => {
            setPanelTransitionActive(true);
            setPanelCollapsed(true);
            setTimeout(() => setPanelTransitionActive(false), 220);
          }}
          onImportZotero={() => setZoteroImportOpen(true)}
          onAddByDOI={() => setDoiLookupOpen(true)}
        />
      </div>

      {/* Peek strip — desktop only, when panel is collapsed */}
      {panelCollapsed && (
        <button
          className="flex shrink-0 items-center justify-center transition-colors hover:bg-[rgba(27,46,75,0.04)]"
          style={{ display: isMobile ? "none" : "flex", width: 16, border: "none", borderRight: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", cursor: "pointer", padding: 0 }}
          onClick={() => {
            setPanelTransitionActive(true);
            setPanelCollapsed(false);
            setTimeout(() => setPanelTransitionActive(false), 220);
          }}
          title="Expand collections panel"
          aria-label="Expand collections panel"
        >
          <ChevronRight size={10} color="var(--color-secondary)" />
        </button>
      )}

      {/* Mobile collections drawer */}
      <div className="fixed top-0 left-0 h-full z-30"
        style={{ display: isMobile ? "block" : "none", width: 260, transform: collectionsOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.22s ease-out", borderRight: "1px solid var(--color-border)", pointerEvents: collectionsOpen ? "auto" : "none" }}
        aria-hidden={!collectionsOpen}
      >
        <CollectionsSidebar
          scope={scope} setScope={setScope}
          selectedSubProjectId={selectedSubProjectId} setSelectedSubProjectId={setSelectedSubProjectId}
          activeCollection={activeCollection} setActiveCollection={(id) => { setActiveCollection(id); setCollectionsOpen(false); }}
          allTags={allTags} activeTag={activeTag} setActiveTag={(t) => { setActiveTag(t); setCollectionsOpen(false); }}
          items={scopedItems} allItems={items} showClose onClose={() => setCollectionsOpen(false)}
          onAddItem={() => { setAddItemOpen(true); setCollectionsOpen(false); }}
          onImportZotero={() => { setZoteroImportOpen(true); setCollectionsOpen(false); }}
          onAddByDOI={() => { setDoiLookupOpen(true); setCollectionsOpen(false); }}
        />
      </div>

      {/* Center list */}
      {!showingDetailMobile && (
        <div className="flex flex-col flex-1 min-w-0" style={{ minWidth: 240, overflow: "hidden", borderRight: selectedItem && !isMobile ? "1px solid var(--color-border)" : undefined }}>
          <div className="flex items-center gap-2 px-3 md:px-4 py-2.5 flex-wrap" style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", minHeight: 52 }}>
            <button onClick={() => setCollectionsOpen(true)} className="flex items-center gap-1.5 shrink-0"
              style={{ display: isMobile ? "flex" : "none", fontSize: 12, fontWeight: 600, color: "var(--color-navy)", border: "1px solid var(--color-border)", borderRadius: 7, padding: "6px 10px", backgroundColor: "transparent", cursor: "pointer", minHeight: 44 }}>
              <ChevronLeft size={14} /> Collections
            </button>
            <div className="relative" style={{ minWidth: 0, flex: 1 }}>
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" color="var(--color-secondary)" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
                style={{ width: "100%", paddingLeft: 30, paddingRight: 8, height: 36, border: "1px solid var(--color-border)", borderRadius: 7, fontSize: 12, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)", outline: "none" }} />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ReadStatus | "all")}
              style={{ height: 36, paddingLeft: 8, paddingRight: 8, border: "1px solid var(--color-border)", borderRadius: 7, fontSize: 12, fontFamily: "var(--font-roboto)", backgroundColor: statusFilter !== "all" ? "rgba(27,46,75,0.06)" : "var(--color-canvas)", color: "var(--color-body)", outline: "none", cursor: "pointer" }}>
              <option value="all">All Status</option>
              <option value="read">Read</option>
              <option value="reading">Reading</option>
              <option value="unread">Unread</option>
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as LiteratureType | "all")}
              style={{ height: 36, paddingLeft: 8, paddingRight: 8, border: "1px solid var(--color-border)", borderRadius: 7, fontSize: 12, fontFamily: "var(--font-roboto)", backgroundColor: typeFilter !== "all" ? "rgba(27,46,75,0.06)" : "var(--color-canvas)", color: "var(--color-body)", outline: "none", cursor: "pointer" }}>
              <option value="all">All Types</option>
              <option value="article">Article</option>
              <option value="book">Book</option>
              <option value="preprint">Preprint</option>
              <option value="report">Report</option>
              <option value="thesis">Thesis</option>
            </select>
            <div className="flex items-center gap-1">
              <select value={yearFilter === "all" ? "all" : String(yearFilter)} onChange={(e) => setYearFilter(e.target.value === "all" ? "all" : parseInt(e.target.value))}
                style={{ height: 36, paddingLeft: 8, paddingRight: 8, border: "1px solid var(--color-border)", borderRadius: 7, fontSize: 12, fontFamily: "var(--font-roboto)", backgroundColor: yearFilter !== "all" ? "rgba(27,46,75,0.06)" : "var(--color-canvas)", color: "var(--color-body)", outline: "none", cursor: "pointer" }}>
                <option value="all">All Years</option>
                {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <button
                onClick={() => setYearSort((s) => s === "desc" ? "asc" : "desc")}
                title={yearSort === "desc" ? "Oldest first" : "Newest first"}
                style={{ height: 36, width: 36, border: "1px solid var(--color-border)", borderRadius: 7, fontSize: 13, backgroundColor: "var(--color-canvas)", color: "var(--color-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {yearSort === "desc" ? "↓" : "↑"}
              </button>
            </div>
            <button onClick={() => setAddItemOpen(true)} className="flex items-center gap-1 shrink-0"
              style={{ fontSize: 12, fontWeight: 700, color: "#fff", backgroundColor: "var(--color-navy)", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", minHeight: 36, fontFamily: "var(--font-roboto)" }}>
              <Plus size={13} /> Add
            </button>
            {activeTag && (
              <span className="flex items-center gap-1.5 px-2.5 py-1" style={{ backgroundColor: "rgba(27,46,75,0.06)", border: "1px solid var(--color-navy)", borderRadius: 5, fontSize: 11, color: "var(--color-navy)" }}>
                <Tag size={11} />{activeTag}
                <button onClick={() => setActiveTag(null)} style={{ display: "flex" }}><X size={11} /></button>
              </span>
            )}
            <span style={{ fontSize: 11, color: "var(--color-secondary)", marginLeft: "auto", whiteSpace: "nowrap" }}>{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="flex items-center px-4 py-2" style={{ display: isMobile ? "none" : "flex", gap: 8, backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
            <span style={{ flexShrink: 0, width: 28 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "var(--color-secondary)" }}>Title</span>
            {!narrowList && <span style={{ flexShrink: 0, width: 100, fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "var(--color-secondary)" }}>Authors</span>}
            {!narrowList && <span style={{ flexShrink: 0, width: 70, fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "var(--color-secondary)" }}>Year</span>}
            <span style={{ flexShrink: 0, width: 90, fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "var(--color-secondary)" }}>Status</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingItems
              ? <div className="flex items-center justify-center h-40"><p style={{ fontSize: 13, color: "var(--color-secondary)" }}>Loading…</p></div>
              : filtered.length === 0 && items.length === 0
              ? <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
                  <svg width="64" height="52" viewBox="0 0 80 64" fill="none" aria-hidden="true" style={{ opacity: 0.6 }}>
                    <rect x="14" y="12" width="22" height="40" rx="3" stroke="var(--color-border)" strokeWidth="1.5" fill="var(--color-canvas)" />
                    <rect x="42" y="16" width="22" height="36" rx="3" stroke="var(--color-border)" strokeWidth="1.5" fill="var(--color-canvas)" />
                    <path d="M18 20h14M18 26h10M18 32h12" stroke="var(--color-border)" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M46 24h14M46 30h10M46 36h12" stroke="var(--color-border)" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <div><p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-body)", margin: 0 }}>Your library is empty</p><p style={{ fontSize: 12, color: "var(--color-secondary)", margin: "4px 0 0" }}>Add your first paper or import from Zotero.</p></div>
                </div>
              : filtered.length === 0
              ? <div className="flex items-center justify-center h-40"><p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No items match your filters.</p></div>
              : filtered.map((item) => {
                  const isSelected = selectedItem?.id === item.id && !isMobile;
                  return (
                    <button key={item.id} onClick={() => setSelectedItemId(isSelected ? null : item.id)} className="w-full text-left"
                      style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: isMobile ? 12 : 16, paddingRight: isMobile ? 12 : 16, paddingTop: 10, paddingBottom: 10, backgroundColor: isSelected ? "rgba(27,46,75,0.06)" : "transparent", borderLeft: isSelected ? "3px solid var(--color-navy)" : "3px solid transparent", borderBottom: "1px solid var(--color-border)", minHeight: 48 }}
                      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "#F8FAFF"; }}
                      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                    >
                      <span style={{ flexShrink: 0, width: 28 }}>{TYPE_ICONS[item.type]}</span>
                      <span title={item.title} style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: "var(--color-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                      {!narrowList && <span style={{ flexShrink: 0, width: 100, fontSize: 12, color: "var(--color-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{formatAuthors(item.authors)}</span>}
                      {!narrowList && <span style={{ flexShrink: 0, width: 70, fontSize: 12, color: "var(--color-secondary)" }}>{item.year}</span>}
                      <span style={{ flexShrink: 0, width: 90 }}><StatusBadge status={item.status} /></span>
                    </button>
                  );
                })}
          </div>
        </div>
      )}

      {/* Right detail panel */}
      {selectedItem && (
        <>
          {isMobile ? (
            <div className="fixed inset-0 z-40 animate-slide-in-bottom" style={{ backgroundColor: "var(--color-surface)" }}>
              <DetailPanelContent item={selectedItem} onClose={() => setSelectedItemId(null)} onUpdateItem={updateItem} onDeleteItem={deleteItem} allItems={items} currentUserId={currentUserId} projectId={projectId} onAddItem={addItem} subProjectId={subProjectId ?? null} />
            </div>
          ) : (
            <div className="flex flex-col shrink-0" style={{ width: 340, borderLeft: "1px solid var(--color-border)" }}>
              <DetailPanelContent item={selectedItem} onClose={() => setSelectedItemId(null)} onUpdateItem={updateItem} onDeleteItem={deleteItem} allItems={items} currentUserId={currentUserId} projectId={projectId} onAddItem={addItem} subProjectId={subProjectId ?? null} />
            </div>
          )}
        </>
      )}

      {addItemOpen && <AddItemModal onSave={addItem} onClose={() => setAddItemOpen(false)} projectId={projectId} currentUserId={currentUserId} subProjectId={subProjectId ?? null} subProjects={subProjects} />}
      {zoteroImportOpen && <ZoteroImportModal existingItems={items} onImport={importItems} onClose={() => setZoteroImportOpen(false)} projectId={projectId} currentUserId={currentUserId} subProjectId={subProjectId ?? null} />}
      {doiLookupOpen && <DOILookupModal onSave={addItemFromDOI} onClose={() => setDoiLookupOpen(false)} projectId={projectId} currentUserId={currentUserId} subProjectId={subProjectId ?? null} />}
    </div>
  );
}
