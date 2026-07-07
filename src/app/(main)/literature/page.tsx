"use client";

import { useState, useEffect, useRef } from "react";
import {
  formatFileSize,
} from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import type { LiteratureItem, ReadStatus, LiteratureType, LibraryScope, LiteratureFile, LitAnnotation, LitAssignedReading, LitRecommendation } from "@/types";
import {
  Plus, Search, Download, FileText, File, X,
  Tag, Star, ExternalLink, Copy, Check, ChevronLeft, ChevronRight,
  Book, BarChart2, GraduationCap,
  Library, ClipboardList, Brain, Microscope, Heart,
  Upload, Link2, MessageSquare, Zap, UserCheck, RefreshCw,
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

function guessLitFileType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  return ext || "other";
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
  onSave, onClose, projectId, currentUserId,
}: {
  onSave: (item: LiteratureItem) => void;
  onClose: () => void;
  projectId: string;
  currentUserId: string;
}) {
  const [type, setType]       = useState<LiteratureType>("article");
  const [title, setTitle]     = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear]       = useState(String(new Date().getFullYear()));
  const [journal, setJournal] = useState("");
  const [doi, setDoi]         = useState("");
  const [tags, setTags]       = useState("");
  const [scope, setScope]     = useState<LibraryScope>("lab");
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
      .insert({
        project_id: projectId,
        user_id: currentUserId,
        library: scope,
        title: title.trim(),
        authors: authors.split(",").map((a) => a.trim()).filter(Boolean),
        year: parseInt(year) || new Date().getFullYear(),
        journal: journal.trim() || null,
        doi: doi.trim() || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        status,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Literature] insert error:", insertError);
      setError("Failed to save. Please try again.");
      setSaving(false);
      return;
    }

    const newItem: LiteratureItem = {
      id: data.id as string,
      projectId: data.project_id as string,
      scope: (data.library as LiteratureItem["scope"]) ?? scope,
      type: "article",
      title: data.title as string,
      authors: (data.authors as string[]) ?? [],
      year: (data.year as number) ?? 0,
      journal: (data.journal as string) ?? undefined,
      doi: (data.doi as string) ?? undefined,
      abstract: (data.abstract as string) ?? undefined,
      tags: (data.tags as string[]) ?? [],
      status: data.status as LiteratureItem["status"],
      rating: 0,
      notes: "",
      files: [],
      addedById: data.user_id as string,
      addedAt: data.created_at as string,
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
            <div className="flex rounded-lg p-0.5" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)", width: "fit-content" }}>
              {(["lab", "my"] as const).map((s) => (
                <button key={s} onClick={() => setScope(s)} style={{ fontSize: 12, fontWeight: 600, padding: "5px 16px", borderRadius: 6, border: "none", backgroundColor: scope === s ? "var(--color-navy)" : "transparent", color: scope === s ? "#fff" : "var(--color-secondary)", cursor: "pointer", fontFamily: "var(--font-roboto)" }}>
                  {s === "lab" ? "Lab Library" : "My Library"}
                </button>
              ))}
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

function ZoteroImportModal({ existingItems, onImport, onClose, projectId, currentUserId }: {
  existingItems: LiteratureItem[]; onImport: (items: LiteratureItem[]) => void;
  onClose: () => void; projectId: string; currentUserId: string;
}) {
  const [parsed, setParsed]     = useState<LiteratureItem[]>([]);
  const [dupes, setDupes]       = useState(0);
  const [fileName, setFileName] = useState("");
  const [error, setError]       = useState("");
  const [importing, setImporting] = useState(false);
  const [scope, setScope]       = useState<LibraryScope>("lab");

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string) as CSLJsonItem[];
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
        setParsed(items); setDupes(dupeCount); setError("");
      } catch { setError("Could not parse file. Export from Zotero as CSL JSON (File → Export Library → CSL JSON)."); }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!parsed.length) return;
    setImporting(true);
    const rows = parsed.map((item) => ({
      id: item.id, project_id: projectId, added_by: currentUserId,
      scope: item.scope, type: item.type, title: item.title, authors: item.authors,
      year: item.year || null, journal: item.journal ?? null, doi: item.doi ?? null,
      abstract: item.abstract ?? null, volume: item.volume ?? null, pages: item.pages ?? null,
      url: item.url ?? null, tags: [], status: "unread", import_source: "zotero_json",
    }));
    const { error: insertErr } = await supabase.from("literature_items").insert(rows);
    if (insertErr) console.error("[Zotero import]", insertErr);
    onImport(parsed); setImporting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(27,46,75,0.35)" }} onClick={onClose}>
      <div style={{ backgroundColor: "var(--color-surface)", maxWidth: 480, width: "100%", borderRadius: 10, padding: 28, boxShadow: "0 8px 40px rgba(27,46,75,0.18)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 16, color: "var(--color-navy)", margin: 0 }}>Import from Zotero</h2>
          <button onClick={onClose} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 36, height: 36 }}><X size={16} color="var(--color-secondary)" /></button>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 14 }}>
          In Zotero: <strong>File → Export Library → CSL JSON</strong>, then upload that file here.
        </p>
        <label style={{ display: "block", border: "2px dashed var(--color-border)", borderRadius: 8, padding: "20px 16px", textAlign: "center", cursor: "pointer", marginBottom: 14 }}>
          <Upload size={20} color="var(--color-secondary)" style={{ margin: "0 auto 8px" }} />
          <p style={{ fontSize: 12, color: fileName ? "var(--color-body)" : "var(--color-secondary)" }}>{fileName || "Click to select a .json file"}</p>
          <input type="file" accept=".json" className="hidden" onChange={handleFile} />
        </label>
        {error && <p style={{ fontSize: 12, color: "var(--color-error)", marginBottom: 10 }}>{error}</p>}
        {parsed.length > 0 && (
          <div className="mb-4 px-3 py-3 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)" }}>{parsed.length} item{parsed.length > 1 ? "s" : ""} ready to import</p>
            {dupes > 0 && <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 2 }}>{dupes} duplicate{dupes > 1 ? "s" : ""} skipped (matched by DOI or title)</p>}
            <div className="mt-3">
              <label style={labelStyle}>Add to</label>
              <div className="flex rounded-lg p-0.5 mt-1" style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", width: "fit-content" }}>
                {(["lab", "my"] as const).map((s) => (
                  <button key={s} onClick={() => setScope(s)} style={{ fontSize: 12, fontWeight: 600, padding: "5px 16px", borderRadius: 6, border: "none", backgroundColor: scope === s ? "var(--color-navy)" : "transparent", color: scope === s ? "#fff" : "var(--color-secondary)", cursor: "pointer" }}>
                    {s === "lab" ? "Lab Library" : "My Library"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)", border: "1px solid var(--color-border)", borderRadius: 7, padding: "8px 16px", backgroundColor: "transparent", cursor: "pointer", minHeight: 44 }}>Cancel</button>
          <button onClick={handleImport} disabled={!parsed.length || importing}
            style={{ fontSize: 13, fontWeight: 700, color: "#fff", backgroundColor: "var(--color-navy)", border: "none", borderRadius: 7, padding: "8px 20px", cursor: (!parsed.length || importing) ? "default" : "pointer", minHeight: 44, opacity: (!parsed.length || importing) ? 0.5 : 1 }}>
            {importing ? "Importing…" : `Import ${parsed.length > 0 ? parsed.length + " item" + (parsed.length > 1 ? "s" : "") : ""}`}
          </button>
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

function DOILookupModal({ onSave, onClose, projectId, currentUserId }: {
  onSave: (item: LiteratureItem) => void; onClose: () => void;
  projectId: string; currentUserId: string;
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
    const doiMatch = /10\.\d{4,}\/\S+/.exec(input);
    if (doiMatch) { await fetchDOI(doiMatch[0]); return; }
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
    const { error: insertErr } = await supabase.from("literature_items").insert({
      id: item.id, project_id: projectId, added_by: currentUserId,
      scope, type: item.type, title: item.title, authors: item.authors,
      year: item.year || null, journal: item.journal ?? null,
      doi: item.doi ?? null, abstract: item.abstract ?? null,
      volume: item.volume ?? null, pages: item.pages ?? null,
      url: item.url ?? null, tags: [], status: "unread",
      import_source: item.importSource,
    });
    if (insertErr) console.error("[DOI lookup save]", insertErr);
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
              {(["lab", "my"] as const).map((s) => (
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

function CollectionsSidebar({
  scope, setScope, activeCollection, setActiveCollection, allTags, activeTag, setActiveTag, items,
  showClose, onClose, onAddItem, onCollapse, onImportZotero, onAddByDOI,
}: {
  scope: LibraryScope; setScope: (s: LibraryScope) => void;
  activeCollection: string; setActiveCollection: (id: string) => void;
  allTags: string[]; activeTag: string | null; setActiveTag: (t: string | null) => void;
  items: LiteratureItem[];
  showClose?: boolean; onClose?: () => void;
  onAddItem: () => void;
  onCollapse?: () => void;
  onImportZotero?: () => void;
  onAddByDOI?: () => void;
}) {
  const totalRead   = items.filter((i) => i.status === "read").length;
  const totalUnread = items.filter((i) => i.status === "unread").length;

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
          {onImportZotero && <button onClick={onImportZotero} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 32, height: 32 }} title="Import from Zotero" aria-label="Import from Zotero"><Upload size={13} color="var(--color-secondary)" /></button>}
          {onAddByDOI && <button onClick={onAddByDOI} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 32, height: 32 }} title="Add by DOI / BibTeX / URL" aria-label="Add by DOI"><Link2 size={13} color="var(--color-secondary)" /></button>}
          <button onClick={onAddItem} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 44, height: 44 }} aria-label="Add item">
            <Plus size={14} color="var(--color-navy)" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2.5" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex rounded-lg p-0.5" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
          {(["lab", "my"] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)} className="flex-1 py-1.5 rounded-md"
              style={{ fontSize: 11, fontWeight: 600, backgroundColor: scope === s ? "var(--color-navy)" : "transparent", color: scope === s ? "#fff" : "var(--color-secondary)", border: "none", cursor: "pointer", minHeight: 36 }}>
              {s === "lab" ? "Lab Library" : "My Library"}
            </button>
          ))}
        </div>
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

// ── Assign Reading Form ───────────────────────────────────────────────────────

function AssignReadingForm({ itemId, projectId, assignedBy, onAssigned }: {
  itemId: string; projectId: string; assignedBy: string;
  onAssigned: (a: LitAssignedReading) => void;
}) {
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate]       = useState("");
  const [note, setNote]             = useState("");
  const [saving, setSaving]         = useState(false);

  async function handleAssign() {
    if (!assigneeId.trim()) return;
    setSaving(true);
    const newA: LitAssignedReading = {
      id: crypto.randomUUID(), itemId, projectId, assignedBy,
      assigneeId: assigneeId.trim(), dueDate: dueDate || undefined,
      note: note.trim() || undefined, createdAt: new Date().toISOString(),
    };
    const { error: insertErr } = await supabase.from("lit_assigned_readings").insert({
      id: newA.id, item_id: itemId, project_id: projectId, assigned_by: assignedBy,
      assignee_id: assigneeId.trim(), due_date: dueDate || null, note: note.trim() || null,
    });
    if (insertErr) console.error("[Assign reading]", insertErr);
    onAssigned(newA); setAssigneeId(""); setDueDate(""); setNote(""); setSaving(false);
  }

  return (
    <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
      <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", marginBottom: 8 }}>Assign to a team member</p>
      <div className="space-y-2">
        <input value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} placeholder="User ID or email"
          style={{ width: "100%", height: 34, border: "1px solid var(--color-border)", borderRadius: 6, padding: "0 10px", fontSize: 12, fontFamily: "var(--font-roboto)", outline: "none", boxSizing: "border-box" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
        <div className="flex gap-2">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            style={{ flex: 1, height: 34, border: "1px solid var(--color-border)", borderRadius: 6, padding: "0 10px", fontSize: 12, fontFamily: "var(--font-roboto)", outline: "none" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"
            style={{ flex: 2, height: 34, border: "1px solid var(--color-border)", borderRadius: 6, padding: "0 10px", fontSize: 12, fontFamily: "var(--font-roboto)", outline: "none" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }} />
        </div>
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
  item, onClose, onUpdateItem, allItems, currentUserId, projectId, onAddItem,
}: {
  item: LiteratureItem;
  onClose: () => void;
  onUpdateItem: (id: string, updates: Partial<LiteratureItem>) => void;
  allItems: LiteratureItem[];
  currentUserId: string;
  projectId: string;
  onAddItem: (item: LiteratureItem) => void;
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
  const [newAnnotText, setNewAnnotText] = useState("");
  const [newAnnotComment, setNewAnnotComment] = useState("");
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
        .then(({ data }) => {
          if (data) setAnnotations(data.map((r) => ({
            id: r.id as string, itemId: r.item_id as string, authorId: r.author_id as string,
            text: r.text as string, comment: r.comment as string,
            pageRef: r.page_ref as string | undefined,
            parentId: r.parent_id as string | undefined,
            createdAt: r.created_at as string,
          })));
        });
    }
    if (tab === "Assigned") {
      supabase.from("lit_assigned_readings").select("*").eq("item_id", item.id)
        .then(({ data }) => {
          if (data) setAssigned(data.map((r) => ({
            id: r.id as string, itemId: r.item_id as string, projectId: r.project_id as string,
            assignedBy: r.assigned_by as string, assigneeId: r.assignee_id as string,
            dueDate: r.due_date as string | undefined, note: r.note as string | undefined,
            createdAt: r.created_at as string,
          })));
        });
    }
  }, [tab, item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addAnnotation(parentId?: string) {
    const comment = parentId ? replyText : newAnnotComment;
    const text    = parentId ? "" : newAnnotText;
    if (!comment.trim()) return;
    setSavingAnnot(true);
    const now = new Date().toISOString();
    const newA: LitAnnotation = {
      id: crypto.randomUUID(), itemId: item.id, authorId: currentUserId,
      text, comment, parentId, createdAt: now,
    };
    const { error: insertErr } = await supabase.from("lit_annotations").insert({
      id: newA.id, item_id: item.id, author_id: currentUserId,
      text, comment, parent_id: parentId ?? null,
    });
    if (insertErr) console.error("[Annotation insert]", insertErr);
    setAnnotations((prev) => [...prev, newA]);
    if (parentId) { setReplyText(""); setReplyingTo(null); }
    else { setNewAnnotText(""); setNewAnnotComment(""); }
    setSavingAnnot(false);
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
          <button onClick={onClose} className="flex items-center justify-center rounded-lg hover:bg-[rgba(27,46,75,0.06)]" style={{ width: 44, height: 44 }} aria-label="Close"><X size={15} color="var(--color-secondary)" /></button>
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
            {[["Authors", item.authors.join("; ") || "—"], ["Year", String(item.year)], ["Journal", item.journal ?? item.publisher ?? "—"], ["Volume", item.volume ?? "—"], ["Pages", item.pages ?? "—"], ["DOI", item.doi ?? "—"], ["Type", item.type.charAt(0).toUpperCase() + item.type.slice(1)]].map(([label, value]) => (
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
                    <button onClick={() => {
                      const newItem: LiteratureItem = {
                        id: crypto.randomUUID(), projectId, scope: item.scope,
                        type: "article", title: rec.title, authors: rec.authors,
                        year: rec.year ?? 0, journal: rec.journal, doi: rec.doi,
                        tags: [], status: "unread", rating: 0, notes: "",
                        files: [], collections: [], relatedIds: [],
                        addedById: currentUserId, addedAt: new Date().toISOString(), importSource: "url",
                      };
                      supabase.from("literature_items").insert({ id: newItem.id, project_id: projectId, added_by: currentUserId, scope: item.scope, type: "article", title: rec.title, authors: rec.authors, year: rec.year || null, journal: rec.journal ?? null, doi: rec.doi ?? null, tags: [], status: "unread" }).then(({ error: e }) => { if (e) console.error(e); });
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
                  <div className="px-3 py-3 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
                    {a.text && (
                      <blockquote style={{ borderLeft: "3px solid var(--color-navy)", paddingLeft: 10, margin: "0 0 8px", fontSize: 12, color: "var(--color-secondary)", fontStyle: "italic", lineHeight: 1.5 }}>
                        {a.text}
                      </blockquote>
                    )}
                    <p style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.5, marginBottom: 6 }}>{a.comment}</p>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 10, color: "var(--color-secondary)" }}>
                        {a.authorId === currentUserId ? "You" : a.authorId.slice(0, 8)} · {new Date(a.createdAt).toLocaleDateString()}
                      </span>
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
                        <span style={{ fontSize: 10, color: "var(--color-secondary)" }}>{reply.authorId === currentUserId ? "You" : reply.authorId.slice(0, 8)} · {new Date(reply.createdAt).toLocaleDateString()}</span>
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

        {tab === "Assigned" && (
          <div className="px-4 py-4">
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)", marginBottom: 12 }}>Team Assignments</p>
            {assigned.length === 0
              ? <p style={{ fontSize: 13, color: "var(--color-secondary)", marginBottom: 16 }}>No one has been assigned this paper yet.</p>
              : (
                <div className="space-y-2 mb-4">
                  {assigned.map((a) => (
                    <div key={a.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)" }}>
                      <UserCheck size={14} color="var(--color-navy)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-body)" }}>
                          {a.assigneeId === currentUserId ? "You" : a.assigneeId.slice(0, 8)}
                        </p>
                        {a.dueDate && <p style={{ fontSize: 11, color: "var(--color-secondary)" }}>Due {new Date(a.dueDate).toLocaleDateString()}</p>}
                        {a.note && <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 2 }}>{a.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            <AssignReadingForm itemId={item.id} projectId={projectId} assignedBy={currentUserId}
              onAssigned={(a) => setAssigned((prev) => [...prev, a])} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Literature page ───────────────────────────────────────────────────────────

export default function LiteraturePage() {
  const [items, setItems]               = useState<LiteratureItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [scope, setScope]               = useState<LibraryScope>("lab");
  const [activeCollection, setActiveCollection] = useState("lc0");
  const [selectedItem, setSelectedItem] = useState<LiteratureItem | null>(null);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<ReadStatus | "all">("all");
  const [activeTag, setActiveTag]       = useState<string | null>(null);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [isMobile, setIsMobile]         = useState(false);
  const [addItemOpen, setAddItemOpen]       = useState(false);
  const [zoteroImportOpen, setZoteroImportOpen] = useState(false);
  const [doiLookupOpen, setDoiLookupOpen]   = useState(false);
  const [projectId, setProjectId]           = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [typeFilter, setTypeFilter]     = useState<LiteratureType | "all">("all");
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
            scope: ((row.library ?? row.scope) as LiteratureItem["scope"]) ?? "lab",
            type: (row.type as LiteratureItem["type"]) ?? "article",
            title: row.title as string,
            authors: (row.authors as string[]) ?? [],
            year: (row.year as number | null) ?? 0,
            journal: row.journal as string | undefined,
            publisher: row.publisher as string | undefined,
            volume: row.volume as string | undefined,
            pages: row.pages as string | undefined,
            doi: row.doi as string | undefined,
            abstract: row.abstract as string | undefined,
            tags: (row.tags as string[]) ?? [],
            status: row.status as LiteratureItem["status"],
            rating: (row.rating as number) ?? 0,
            notes: (row.notes as string) ?? "",
            files: (row.files as LiteratureItem["files"]) ?? [],
            addedById: (row.user_id ?? row.added_by) as string,
            addedAt: (row.created_at ?? row.added_at) as string,
            collections: (row.collections as string[]) ?? [],
            relatedIds: (row.related_ids as string[]) ?? [],
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

  function updateItem(id: string, updates: Partial<LiteratureItem>) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...updates } : item));
    setSelectedItem((prev) => prev?.id === id ? { ...prev, ...updates } as LiteratureItem : prev);
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

  const scopedItems = items.filter((item) => scope === "my" ? item.scope === "my" : item.scope === "lab");

  const filtered = scopedItems
    .filter((item) => {
      if (search && !item.title.toLowerCase().includes(search.toLowerCase()) &&
          !item.authors.some((a) => a.toLowerCase().includes(search.toLowerCase()))) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (activeTag && !item.tags.includes(activeTag)) return false;
      if (activeCollection !== "lc0" && !item.collections.includes(activeCollection)) return false;
      return true;
    })
    .sort((a, b) => yearSort === "desc" ? b.year - a.year : a.year - b.year);

  const allTags = [...new Set(scopedItems.flatMap((i) => i.tags))].sort();
  const showingDetailMobile = isMobile && selectedItem !== null;

  return (
    <div className="flex h-full" style={{ fontFamily: "var(--font-roboto)" }}>

      {collectionsOpen && (
        <div className="fixed inset-0 z-20 md:hidden" style={{ backgroundColor: "rgba(0,0,0,0.3)" }} onClick={() => setCollectionsOpen(false)} aria-hidden="true" />
      )}

      {/* Left panel — animates to 0 when collapsed */}
      <div
        className="hidden md:flex flex-col shrink-0 overflow-hidden group/litpanel"
        style={{
          width: panelCollapsed ? 0 : 220,
          borderRight: panelCollapsed ? "none" : "1px solid var(--color-border)",
          transition: "width 200ms ease",
        }}
      >
        <CollectionsSidebar
          scope={scope} setScope={setScope}
          activeCollection={activeCollection} setActiveCollection={setActiveCollection}
          allTags={allTags} activeTag={activeTag} setActiveTag={setActiveTag}
          items={scopedItems} onAddItem={() => setAddItemOpen(true)}
          onCollapse={() => setPanelCollapsed(true)}
          onImportZotero={() => setZoteroImportOpen(true)}
          onAddByDOI={() => setDoiLookupOpen(true)}
        />
      </div>

      {/* Peek strip — desktop only, when panel is collapsed */}
      {panelCollapsed && (
        <button
          className="hidden md:flex shrink-0 items-center justify-center transition-colors hover:bg-[rgba(27,46,75,0.04)]"
          style={{ width: 16, border: "none", borderRight: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", cursor: "pointer", padding: 0 }}
          onClick={() => setPanelCollapsed(false)}
          title="Expand collections panel"
          aria-label="Expand collections panel"
        >
          <ChevronRight size={10} color="var(--color-secondary)" />
        </button>
      )}

      {/* Mobile collections drawer */}
      <div className="md:hidden fixed top-0 left-0 h-full z-30"
        style={{ width: 260, transform: collectionsOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.22s ease-out", borderRight: "1px solid var(--color-border)" }}
        aria-hidden={!collectionsOpen}
      >
        <CollectionsSidebar
          scope={scope} setScope={setScope}
          activeCollection={activeCollection} setActiveCollection={(id) => { setActiveCollection(id); setCollectionsOpen(false); }}
          allTags={allTags} activeTag={activeTag} setActiveTag={(t) => { setActiveTag(t); setCollectionsOpen(false); }}
          items={scopedItems} showClose onClose={() => setCollectionsOpen(false)}
          onAddItem={() => { setAddItemOpen(true); setCollectionsOpen(false); }}
          onImportZotero={() => { setZoteroImportOpen(true); setCollectionsOpen(false); }}
          onAddByDOI={() => { setDoiLookupOpen(true); setCollectionsOpen(false); }}
        />
      </div>

      {/* Center list */}
      {!showingDetailMobile && (
        <div className="flex flex-col flex-1 min-w-0" style={{ borderRight: selectedItem && !isMobile ? "1px solid var(--color-border)" : undefined }}>
          <div className="flex items-center gap-2 px-3 md:px-4 py-2.5 flex-wrap" style={{ backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", minHeight: 52 }}>
            <button onClick={() => setCollectionsOpen(true)} className="md:hidden flex items-center gap-1.5 shrink-0"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--color-navy)", border: "1px solid var(--color-border)", borderRadius: 7, padding: "6px 10px", backgroundColor: "transparent", cursor: "pointer", minHeight: 44 }}>
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
            <button
              onClick={() => setYearSort((s) => s === "desc" ? "asc" : "desc")}
              style={{ height: 36, paddingLeft: 10, paddingRight: 10, border: "1px solid var(--color-border)", borderRadius: 7, fontSize: 12, fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-canvas)", color: "var(--color-secondary)", cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}
            >
              Year {yearSort === "desc" ? "↓" : "↑"}
            </button>
            <button onClick={() => setAddItemOpen(true)} className="md:hidden flex items-center gap-1 shrink-0"
              style={{ fontSize: 12, fontWeight: 700, color: "#fff", backgroundColor: "var(--color-navy)", border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", minHeight: 44, fontFamily: "var(--font-roboto)" }}>
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

          <div className="hidden md:grid items-center px-4 py-2" style={{ gridTemplateColumns: "28px 1fr 100px 70px 90px", backgroundColor: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", gap: 8 }}>
            {["", "Title", "Authors", "Year", "Status"].map((col, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-secondary)" }}>{col}</span>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingItems
              ? <div className="flex items-center justify-center h-40"><p style={{ fontSize: 13, color: "var(--color-secondary)" }}>Loading…</p></div>
              : filtered.length === 0 && items.length === 0
              ? <div className="flex items-center justify-center h-40"><p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No items yet. Add your first paper.</p></div>
              : filtered.length === 0
              ? <div className="flex items-center justify-center h-40"><p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No items found.</p></div>
              : filtered.map((item) => {
                  const isSelected = selectedItem?.id === item.id && !isMobile;
                  return (
                    <button key={item.id} onClick={() => setSelectedItem(isSelected ? null : item)} className="w-full text-left"
                      style={{ display: "grid", gridTemplateColumns: isMobile ? "28px 1fr 80px" : "28px 1fr 100px 70px 90px", gap: 8, alignItems: "center", paddingLeft: isMobile ? 12 : 16, paddingRight: isMobile ? 12 : 16, paddingTop: 10, paddingBottom: 10, backgroundColor: isSelected ? "rgba(27,46,75,0.06)" : "transparent", borderLeft: isSelected ? "3px solid var(--color-navy)" : "3px solid transparent", borderBottom: "1px solid var(--color-border)", minHeight: 48 }}
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
                })}
          </div>
        </div>
      )}

      {/* Right detail panel */}
      {selectedItem && (
        <>
          {isMobile ? (
            <div className="fixed inset-0 z-40 animate-slide-in-bottom" style={{ backgroundColor: "var(--color-surface)" }}>
              <DetailPanelContent item={selectedItem} onClose={() => setSelectedItem(null)} onUpdateItem={updateItem} allItems={items} currentUserId={currentUserId} projectId={projectId} onAddItem={addItem} />
            </div>
          ) : (
            <div className="flex flex-col shrink-0" style={{ width: 340, borderLeft: "1px solid var(--color-border)" }}>
              <DetailPanelContent item={selectedItem} onClose={() => setSelectedItem(null)} onUpdateItem={updateItem} allItems={items} currentUserId={currentUserId} projectId={projectId} onAddItem={addItem} />
            </div>
          )}
        </>
      )}

      {addItemOpen && <AddItemModal onSave={addItem} onClose={() => setAddItemOpen(false)} projectId={projectId} currentUserId={currentUserId} />}
      {zoteroImportOpen && <ZoteroImportModal existingItems={items} onImport={importItems} onClose={() => setZoteroImportOpen(false)} projectId={projectId} currentUserId={currentUserId} />}
      {doiLookupOpen && <DOILookupModal onSave={addItemFromDOI} onClose={() => setDoiLookupOpen(false)} projectId={projectId} currentUserId={currentUserId} />}
    </div>
  );
}
