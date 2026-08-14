"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";
import { useUndoToast } from "@/context/UndoToastContext";
import Avatar from "@/components/ui/Avatar";
import type { User } from "@/types";
import {
  MessageSquare, Send, Pencil, Trash2, Hash,
  SmilePlus, MessageCircle, Pin, X, Plus, ChevronDown,
} from "lucide-react";
import ScopeSidebar, { type ScopeSection } from "@/components/ui/ScopeSidebar";
import { computeInitials } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MessageReaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface ChatMessage {
  id: string;
  channel: string;
  senderId: string;
  senderName: string;
  senderColor?: string;
  content: string;
  createdAt: string;
  threadParentId: string | null;
  deletedAt: string | null;
  threadCount: number;
  reactions: MessageReaction[];
}

type ActiveChannel = string;

// ── Constants ─────────────────────────────────────────────────────────────────

const COMMON_EMOJIS = [
  "👍","👎","❤️","😂","😮","😢","🎉","🔥",
  "✅","❌","🤔","💡","📌","🚀","💯","👀",
  "🙌","💪","🎯","⭐","🏆","👏","✨","🤝",
  "📚","💬","🔬","📊","📝","⚡","🌟","😊",
];

const GROUP_GAP_MS = 5 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatHM(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function resolveChannelKey(projectId: string, currentUserId: string, active: ActiveChannel): string {
  if (active === "lab") return `lab:${projectId}`;
  if (active.startsWith("dm:")) {
    const peerId = active.slice(3);
    return `dm:${[currentUserId, peerId].sort().join(":")}`;
  }
  return `project:${active}`;
}

function buildUser(id: string, name: string, color?: string): User {
  return { id, name, email: "", role: "researcher", avatarColor: color ?? "#CBD5E1", avatarInitials: computeInitials(name) || name.slice(0, 2).toUpperCase() };
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderMd(text: string): ReactNode[] {
  const codeBlock = /```([\s\S]*?)```/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = codeBlock.exec(text)) !== null) {
    if (m.index > last) out.push(...renderInline(text.slice(last, m.index), last));
    out.push(<pre key={`cb${m.index}`} style={{ fontFamily: "monospace", fontSize: 12, backgroundColor: "var(--color-surface-2)", borderRadius: 6, padding: "8px 10px", margin: "4px 0", overflowX: "auto", whiteSpace: "pre", color: "var(--color-body)", display: "block" }}>{m[1]}</pre>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...renderInline(text.slice(last), last));
  return out;
}

function renderInline(text: string, offset: number): ReactNode[] {
  const tokens = text.split(/(\*\*[\s\S]*?\*\*|__[\s\S]*?__|_[\s\S]*?_|\*[^*][\s\S]*?\*|`[^`]*`|\[[\s\S]*?\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s]+)/);
  return tokens.map((tok, i) => {
    const k = `i${offset}${i}`;
    if (/^\*\*[\s\S]*\*\*$/.test(tok) && tok.length > 4) return <strong key={k}>{tok.slice(2, -2)}</strong>;
    if (/^__[\s\S]*__$/.test(tok) && tok.length > 4) return <strong key={k}>{tok.slice(2, -2)}</strong>;
    if (/^_[\s\S]*_$/.test(tok) && tok.length > 2) return <em key={k}>{tok.slice(1, -1)}</em>;
    if (/^\*[^*][\s\S]*\*$/.test(tok) && tok.length > 2) return <em key={k}>{tok.slice(1, -1)}</em>;
    if (/^`[^`]*`$/.test(tok) && tok.length > 2) return <code key={k} style={{ fontFamily: "monospace", fontSize: 12, backgroundColor: "var(--color-surface-2)", borderRadius: 3, padding: "1px 4px" }}>{tok.slice(1, -1)}</code>;
    const lm = tok.match(/^\[([\s\S]+?)\]\((https?:\/\/[^\s)]+)\)$/);
    if (lm) return <a key={k} href={lm[2]} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-navy)", textDecoration: "underline" }}>{lm[1]}</a>;
    if (/^https?:\/\//.test(tok)) return <a key={k} href={tok} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-navy)", textDecoration: "underline" }}>{tok}</a>;
    return tok;
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DateDivider({ iso }: { iso: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px 4px", userSelect: "none" }}>
      <div style={{ flex: 1, height: 1, backgroundColor: "var(--color-border)" }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", whiteSpace: "nowrap" }}>{formatDateLabel(iso)}</span>
      <div style={{ flex: 1, height: 1, backgroundColor: "var(--color-border)" }} />
    </div>
  );
}

function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function down(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [onClose]);
  return (
    <div ref={ref} style={{ position: "absolute", zIndex: 200, bottom: "calc(100% + 4px)", right: 0, backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.14)", padding: 8, width: 228 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2 }}>
        {COMMON_EMOJIS.map(em => (
          <button key={em} onClick={() => { onSelect(em); onClose(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: "4px 2px", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--color-surface-2)")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
          >{em}</button>
        ))}
      </div>
    </div>
  );
}

function TBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  const base = danger ? "var(--color-error)" : "var(--color-secondary)";
  const hover = danger ? "var(--color-error)" : "var(--color-body)";
  return (
    <button onClick={onClick} title={label} aria-label={label}
      style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 5px", borderRadius: 5, display: "flex", alignItems: "center", color: base, transition: "background-color 0.1s, color 0.1s" }}
      onMouseEnter={e => { const b = e.currentTarget; b.style.backgroundColor = "var(--color-surface-2)"; b.style.color = hover; }}
      onMouseLeave={e => { const b = e.currentTarget; b.style.backgroundColor = "transparent"; b.style.color = base; }}
    >{children}</button>
  );
}

function TypingIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  const txt = names.length === 1 ? `${names[0]} is typing…` : names.length === 2 ? `${names[0]} and ${names[1]} are typing…` : "Several people are typing…";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 16px 5px 64px" }}>
      <div style={{ display: "flex", gap: 3 }}>
        {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "var(--color-secondary)", animation: `typBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
      </div>
      <span style={{ fontSize: 11, color: "var(--color-secondary)" }}>{txt}</span>
    </div>
  );
}

// ── MessageRow ────────────────────────────────────────────────────────────────

function MessageRow({
  msg, prevMsg, currentUserId, onEdit, onDelete, onReact, onOpenThread,
}: {
  msg: ChatMessage; prevMsg: ChatMessage | null; currentUserId: string;
  onEdit: (id: string, c: string) => void; onDelete: (id: string) => void;
  onReact: (id: string, em: string) => void; onOpenThread: (m: ChatMessage) => void;
}) {
  const isOwn = msg.senderId === currentUserId;
  const isCont = prevMsg !== null && !prevMsg.deletedAt && prevMsg.threadParentId === null && prevMsg.senderId === msg.senderId &&
    new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < GROUP_GAP_MS;
  const avUser = buildUser(msg.senderId, msg.senderName, msg.senderColor);
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (editing) { setDraft(msg.content); setTimeout(() => editRef.current?.focus(), 30); } }, [editing, msg.content]);

  function commitEdit() {
    const t = draft.trim();
    if (!t || t === msg.content) { setEditing(false); return; }
    onEdit(msg.id, t); setEditing(false);
  }

  const showBar = (hovered || emojiOpen) && !editing;

  if (msg.deletedAt) {
    return (
      <div style={{ display: "flex", padding: "1px 48px 1px 0" }}>
        <div style={{ width: 52, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: "var(--color-secondary)", fontStyle: "italic" }}>This message was deleted.</span>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", flexDirection: "column", padding: isCont ? "1px 48px 1px 0" : "6px 48px 1px 0", position: "relative", backgroundColor: (hovered || emojiOpen) ? "var(--color-surface-2)" : "transparent", transition: "background-color 0.06s" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <div style={{ width: 52, flexShrink: 0, paddingTop: 2, display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          {!isCont ? <Avatar user={avUser} size={32} /> : hovered ? <span style={{ fontSize: 10, color: "var(--color-secondary)", lineHeight: "20px", whiteSpace: "nowrap" }}>{formatHM(msg.createdAt)}</span> : null}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {!isCont && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-body)" }}>{isOwn ? "You" : msg.senderName}</span>
              <span style={{ fontSize: 11, color: "var(--color-secondary)" }}>{formatTime(msg.createdAt)}</span>
            </div>
          )}
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingRight: 16 }}>
              <textarea ref={editRef} value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); } if (e.key === "Escape") setEditing(false); }}
                rows={2} style={{ fontSize: 14, lineHeight: 1.5, padding: "8px 10px", borderRadius: 8, border: "1.5px solid var(--color-navy)", outline: "none", resize: "none", fontFamily: "var(--font-roboto)", backgroundColor: "var(--color-surface)", color: "var(--color-body)", width: "100%", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setEditing(false)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "none", cursor: "pointer", color: "var(--color-secondary)" }}>Cancel</button>
                <button onClick={commitEdit} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "none", background: "var(--color-btn-primary)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Save</button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--color-body)", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{renderMd(msg.content)}</div>
          )}

          {msg.reactions.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
              {msg.reactions.map(r => (
                <button key={r.emoji} onClick={() => onReact(msg.id, r.emoji)}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 12, fontSize: 12, backgroundColor: r.hasReacted ? "rgba(14,165,233,0.12)" : "var(--color-surface-2)", border: `1px solid ${r.hasReacted ? "var(--color-navy)" : "var(--color-border)"}`, cursor: "pointer", fontFamily: "var(--font-roboto)", color: "var(--color-body)" }}>
                  <span>{r.emoji}</span><span style={{ fontSize: 11, fontWeight: 600 }}>{r.count}</span>
                </button>
              ))}
            </div>
          )}

          {msg.threadCount > 0 && !editing && (
            <button onClick={() => onOpenThread(msg)} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4, background: "none", border: "none", cursor: "pointer", padding: "2px 0", color: "var(--color-navy)", fontSize: 12, fontWeight: 600, fontFamily: "var(--font-roboto)" }}>
              <MessageCircle size={12} />{msg.threadCount} {msg.threadCount === 1 ? "reply" : "replies"}
            </button>
          )}
        </div>
      </div>

      {showBar && (
        <div style={{ position: "absolute", top: 0, right: 0, zIndex: 10 }}>
          <div style={{ position: "relative" }}>
            <div style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "2px 3px", boxShadow: "0 2px 8px rgba(0,0,0,0.10)", display: "flex", alignItems: "center", gap: 1 }}>
              <TBtn label="Add reaction" onClick={() => setEmojiOpen(v => !v)}><SmilePlus size={14} /></TBtn>
              <TBtn label="Reply in thread" onClick={() => onOpenThread(msg)}><MessageCircle size={14} /></TBtn>
              <TBtn label="Pin message" onClick={() => {}}><Pin size={14} /></TBtn>
              {isOwn && <TBtn label="Edit message" onClick={() => setEditing(true)}><Pencil size={14} /></TBtn>}
              {isOwn && <TBtn label="Delete message" onClick={() => onDelete(msg.id)} danger><Trash2 size={14} /></TBtn>}
            </div>
            {emojiOpen && <EmojiPicker onSelect={em => { onReact(msg.id, em); setEmojiOpen(false); }} onClose={() => setEmojiOpen(false)} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ThreadPanel ───────────────────────────────────────────────────────────────

function ThreadPanel({ parent, currentUserId, currentUserName, projectId, onClose, onReact }: {
  parent: ChatMessage; currentUserId: string; currentUserName: string;
  projectId: string; onClose: () => void; onReact: (id: string, em: string) => void;
}) {
  const [replies, setReplies] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const avUser = buildUser(parent.senderId, parent.senderName, parent.senderColor);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReplies([{ id: "tr-1", channel: parent.channel, senderId: "demo-pi", senderName: "Dr. Sarah Chen", content: "Great point! Let's revisit Thursday.", createdAt: new Date(Date.now() - 60000 * 3).toISOString(), threadParentId: parent.id, deletedAt: null, threadCount: 0, reactions: [] }]);
      return;
    }
    supabase.from("chat_messages").select("id, channel, sender_id, content, created_at, deleted_at").eq("thread_parent_id", parent.id).order("created_at", { ascending: true })
      .then(async ({ data }) => {
        if (!data) return;
        const ids = [...new Set(data.map(r => r.sender_id as string))];
        const nameMap: Record<string, string> = {};
        if (ids.length) {
          const { data: ps } = await supabase.from("user_profiles").select("id, name").in("id", ids);
          for (const p of ps ?? []) nameMap[p.id as string] = p.name as string;
        }
        setReplies(data.map(row => ({ id: row.id as string, channel: row.channel as string, senderId: row.sender_id as string, senderName: nameMap[row.sender_id as string] ?? "Unknown", content: row.content as string, createdAt: row.created_at as string, threadParentId: parent.id, deletedAt: (row.deleted_at as string | null) ?? null, threadCount: 0, reactions: [] })));
      });
  }, [parent.id, parent.channel]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [replies]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const ch = supabase.channel(`thread:${parent.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_parent_id=eq.${parent.id}` }, async payload => {
        const row = payload.new as Record<string, unknown>;
        let name = "Unknown";
        const { data: p } = await supabase.from("user_profiles").select("name").eq("id", row.sender_id as string).single();
        if (p?.name) name = p.name as string;
        const nm: ChatMessage = { id: row.id as string, channel: row.channel as string, senderId: row.sender_id as string, senderName: name, content: row.content as string, createdAt: row.created_at as string, threadParentId: parent.id, deletedAt: null, threadCount: 0, reactions: [] };
        setReplies(prev => prev.some(m => m.id === nm.id) ? prev : [...prev, nm]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `thread_parent_id=eq.${parent.id}` }, payload => {
        const row = payload.new as Record<string, unknown>;
        setReplies(prev => prev.map(m => m.id === row.id ? { ...m, content: row.content as string, deletedAt: (row.deleted_at as string | null) ?? null } : m));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [parent.id]);

  async function sendReply() {
    const text = draft.trim();
    if (!text || sending || !currentUserId || !projectId) return;
    setSending(true);
    if (!isSupabaseConfigured) {
      setReplies(p => [...p, { id: crypto.randomUUID(), channel: parent.channel, senderId: currentUserId, senderName: currentUserName, content: text, createdAt: new Date().toISOString(), threadParentId: parent.id, deletedAt: null, threadCount: 0, reactions: [] }]);
      setDraft(""); setSending(false); return;
    }
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await supabase.from("chat_messages").insert({ id, channel: parent.channel, sender_id: currentUserId, content: text, created_at: createdAt, thread_parent_id: parent.id });
    setReplies(p => [...p, { id, channel: parent.channel, senderId: currentUserId, senderName: currentUserName, content: text, createdAt, threadParentId: parent.id, deletedAt: null, threadCount: 0, reactions: [] }]);
    setDraft(""); setSending(false);
    inputRef.current?.focus();
  }

  return (
    <div style={{ width: 380, flexShrink: 0, display: "flex", flexDirection: "column", height: "100%", borderLeft: "1px solid var(--color-border)", backgroundColor: "var(--color-canvas)", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 15, color: "var(--color-navy)" }}>Thread</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", borderRadius: 6, color: "var(--color-secondary)" }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--color-surface-2)")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
        ><X size={16} /></button>
      </div>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Avatar user={avUser} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginBottom: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-body)" }}>{parent.senderName}</span>
              <span style={{ fontSize: 10, color: "var(--color-secondary)" }}>{formatTime(parent.createdAt)}</span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--color-body)", wordBreak: "break-word" }}>{renderMd(parent.content)}</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {replies.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--color-secondary)", textAlign: "center", marginTop: 24 }}>No replies yet.</p>
        ) : replies.map((reply, i) => (
          <MessageRow key={reply.id} msg={reply} prevMsg={i > 0 ? replies[i - 1] : null} currentUserId={currentUserId}
            onEdit={(id, c) => { setReplies(p => p.map(r => r.id === id ? { ...r, content: c } : r)); if (isSupabaseConfigured) supabase.from("chat_messages").update({ content: c }).eq("id", id); }}
            onDelete={id => { const now = new Date().toISOString(); setReplies(p => p.map(r => r.id === id ? { ...r, deletedAt: now } : r)); if (isSupabaseConfigured) supabase.from("chat_messages").update({ deleted_at: now }).eq("id", id); }}
            onReact={onReact}
            onOpenThread={() => {}}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, border: "1px solid var(--color-border)", borderRadius: 10, backgroundColor: "var(--color-canvas)", padding: "6px 6px 6px 10px" }}>
          <textarea ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
            placeholder="Reply in thread…" rows={1}
            style={{ flex: 1, resize: "none", border: "none", outline: "none", background: "transparent", color: "var(--color-body)", fontSize: 13, lineHeight: 1.5, fontFamily: "var(--font-roboto)", maxHeight: 100, overflowY: "auto" }} />
          <button onClick={sendReply} disabled={!draft.trim() || sending} aria-label="Send reply"
            style={{ width: 30, height: 30, borderRadius: 7, border: "none", backgroundColor: draft.trim() ? "var(--color-btn-primary)" : "transparent", color: draft.trim() ? "#fff" : "var(--color-secondary)", cursor: draft.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background-color 0.15s" }}>
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { show: showUndoToast } = useUndoToast();
  const { projectId, subProjects, activeScope, subProjectId, isLoading: projectLoading } = useProject();
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const isProjectView = activeScope === "project" && !!subProjectId;

  const defaultChannel = isProjectView && subProjects.find(sp => sp.id === subProjectId) ? (subProjectId ?? "lab") : "lab";
  const [activeChannel, setActiveChannel] = useState<ActiveChannel>(defaultChannel);
  const [chatSidebarCollapsed, setChatSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("chat_sidebar_collapsed") === "true"; } catch { return false; }
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [threadMsg, setThreadMsg] = useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<{ userId: string; name: string }[]>([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastCountRef = useRef(0);
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const typingChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Auth
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCurrentUserId("demo-user"); setCurrentUserName("You");
      setTeamMembers([buildUser("demo-pi", "Dr. Sarah Chen"), buildUser("demo-ra", "Marcus Johnson"), buildUser("demo-grad", "Priya Patel")]);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      setCurrentUserId(session.user.id);
      supabase.from("user_profiles").select("name").eq("id", session.user.id).single().then(({ data }) => { if (data?.name) setCurrentUserName(data.name as string); });
    });
  }, []);

  // Team members
  useEffect(() => {
    if (!isSupabaseConfigured || !projectId || !currentUserId) return;
    async function load() {
      const table = isProjectView && subProjectId ? "sub_project_members" : "team_members";
      const fk = isProjectView && subProjectId ? "sub_project_id" : "project_id";
      const fv = isProjectView && subProjectId ? subProjectId : projectId;
      const { data } = await supabase.from(table).select("user_id, user_profiles(name, avatar_color, avatar_initials, avatar_url)").eq(fk, fv as string);
      if (!data) return;
      setTeamMembers(data.filter(r => r.user_id !== currentUserId).map(r => {
        const p = (Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles) as Record<string, string> | null;
        const name = p?.name ?? "Unknown";
        return { id: r.user_id as string, name, email: "", role: "researcher" as const, avatarColor: p?.avatar_color ?? "#CBD5E1", avatarInitials: computeInitials(name) || (p?.avatar_initials ?? "??"), avatarUrl: p?.avatar_url ?? undefined };
      }));
    }
    load();
  }, [projectId, currentUserId, isProjectView, subProjectId]);

  // Reset channel
  useEffect(() => { setActiveChannel(defaultChannel); setThreadMsg(null); }, [activeScope, subProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!projectId || !currentUserId) return;
    setLoading(true);
    const key = resolveChannelKey(projectId, currentUserId, activeChannel);

    if (!isSupabaseConfigured) {
      setMessages([
        { id: "d1", channel: key, senderId: "demo-pi", senderName: "Dr. Sarah Chen", content: "Good morning! Lab meeting moved to Thursday.", createdAt: new Date(Date.now() - 7200000).toISOString(), threadParentId: null, deletedAt: null, threadCount: 2, reactions: [{ emoji: "👍", count: 3, hasReacted: true }] },
        { id: "d2", channel: key, senderId: "demo-ra", senderName: "Marcus Johnson", content: "Thanks for the heads up! I'll update my calendar.", createdAt: new Date(Date.now() - 3300000).toISOString(), threadParentId: null, deletedAt: null, threadCount: 0, reactions: [] },
        { id: "d3", channel: key, senderId: "demo-grad", senderName: "Priya Patel", content: "Will the agenda be the same? I was going to present my prelim results.", createdAt: new Date(Date.now() - 2400000).toISOString(), threadParentId: null, deletedAt: null, threadCount: 0, reactions: [{ emoji: "🎉", count: 2, hasReacted: false }] },
        { id: "d4", channel: key, senderId: "demo-pi", senderName: "Dr. Sarah Chen", content: "Yes! Priya you're still presenting first — looking forward to it.", createdAt: new Date(Date.now() - 1800000).toISOString(), threadParentId: null, deletedAt: null, threadCount: 0, reactions: [] },
        { id: "d5", channel: key, senderId: "demo-user", senderName: "You", content: "See everyone Thursday!", createdAt: new Date(Date.now() - 300000).toISOString(), threadParentId: null, deletedAt: null, threadCount: 0, reactions: [] },
      ]);
      setLoading(false); return;
    }

    const { data, error } = await supabase.from("chat_messages").select("id, channel, sender_id, content, created_at, thread_parent_id, deleted_at").eq("channel", key).is("thread_parent_id", null).order("created_at", { ascending: true }).limit(200);
    if (error) { console.error("[Chat] fetch:", error); setLoading(false); return; }
    const rows = data ?? [];
    const sids = [...new Set(rows.map(r => r.sender_id as string))];
    const nameMap: Record<string, string> = {};
    if (sids.length) { const { data: ps } = await supabase.from("user_profiles").select("id, name").in("id", sids); for (const p of ps ?? []) nameMap[p.id as string] = p.name as string; }

    const mids = rows.map(r => r.id as string);
    let tcMap: Record<string, number> = {};
    let rxMap: Record<string, MessageReaction[]> = {};
    if (mids.length) {
      const [tc, rx] = await Promise.all([
        supabase.from("chat_messages").select("thread_parent_id").in("thread_parent_id", mids).then(r => r.data ?? []),
        supabase.from("message_reactions").select("message_id, emoji, user_id").in("message_id", mids).then(r => r.data ?? []),
      ]);
      for (const t of tc) { if (t.thread_parent_id) tcMap[t.thread_parent_id] = (tcMap[t.thread_parent_id] ?? 0) + 1; }
      for (const r of rx) {
        if (!rxMap[r.message_id]) rxMap[r.message_id] = [];
        const ex = rxMap[r.message_id].find(x => x.emoji === r.emoji);
        if (ex) { ex.count++; if (r.user_id === currentUserId) ex.hasReacted = true; }
        else rxMap[r.message_id].push({ emoji: r.emoji, count: 1, hasReacted: r.user_id === currentUserId });
      }
    }

    setMessages(rows.map(row => ({ id: row.id as string, channel: row.channel as string, senderId: row.sender_id as string, senderName: nameMap[row.sender_id as string] ?? "Unknown", content: row.content as string, createdAt: row.created_at as string, threadParentId: null, deletedAt: (row.deleted_at as string | null) ?? null, threadCount: tcMap[row.id as string] ?? 0, reactions: rxMap[row.id as string] ?? [] })));
    setLoading(false);
  }, [projectId, currentUserId, activeChannel]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Scroll handling
  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const atBottom = scrollHeight - scrollTop - clientHeight < 80;
    setIsAtBottom(atBottom);
    if (atBottom) setHasNewMessages(false);
  }

  function scrollToBottom() { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); setHasNewMessages(false); }

  useEffect(() => {
    const count = messages.length;
    if (count > lastCountRef.current) {
      if (isAtBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      else if (lastCountRef.current > 0) setHasNewMessages(true);
    }
    lastCountRef.current = count;
  }, [messages.length, isAtBottom]);

  // Realtime
  useEffect(() => {
    if (!isSupabaseConfigured || !projectId || !currentUserId) return;
    const key = resolveChannelKey(projectId, currentUserId, activeChannel);
    const ch = supabase.channel(`chat:${key}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel=eq.${key}` }, async payload => {
        const row = payload.new as Record<string, unknown>;
        if (row.thread_parent_id) return;
        let name = "Unknown";
        const { data: p } = await supabase.from("user_profiles").select("name").eq("id", row.sender_id as string).single();
        if (p?.name) name = p.name as string;
        const nm: ChatMessage = { id: row.id as string, channel: row.channel as string, senderId: row.sender_id as string, senderName: name, content: row.content as string, createdAt: row.created_at as string, threadParentId: null, deletedAt: null, threadCount: 0, reactions: [] };
        setMessages(prev => prev.some(m => m.id === nm.id) ? prev : [...prev, nm]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `channel=eq.${key}` }, payload => {
        const row = payload.new as Record<string, unknown>;
        if (row.thread_parent_id) return;
        setMessages(prev => prev.map(m => m.id === row.id ? { ...m, content: row.content as string, deletedAt: (row.deleted_at as string | null) ?? null } : m));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions" }, payload => {
        const row = payload.new as Record<string, unknown>;
        setMessages(prev => prev.map(m => {
          if (m.id !== row.message_id) return m;
          const ex = m.reactions.find(r => r.emoji === row.emoji);
          if (ex) return { ...m, reactions: m.reactions.map(r => r.emoji === row.emoji ? { ...r, count: r.count + 1, hasReacted: r.hasReacted || row.user_id === currentUserId } : r) };
          return { ...m, reactions: [...m.reactions, { emoji: row.emoji as string, count: 1, hasReacted: row.user_id === currentUserId }] };
        }));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions" }, payload => {
        const row = payload.old as Record<string, unknown>;
        setMessages(prev => prev.map(m => {
          if (m.id !== row.message_id) return m;
          return { ...m, reactions: m.reactions.map(r => r.emoji === row.emoji ? { ...r, count: Math.max(0, r.count - 1), hasReacted: row.user_id === currentUserId ? false : r.hasReacted } : r).filter(r => r.count > 0) };
        }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, currentUserId, activeChannel]);

  // Typing
  useEffect(() => {
    if (!isSupabaseConfigured || !projectId || !currentUserId) return;
    const key = resolveChannelKey(projectId, currentUserId, activeChannel);
    const ch = supabase.channel(`typing:${key}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { userId, name } = payload as { userId: string; name: string };
        if (userId === currentUserId) return;
        setTypingUsers(prev => prev.some(u => u.userId === userId) ? prev : [...prev, { userId, name }]);
        const old = typingTimers.current.get(userId);
        if (old) clearTimeout(old);
        const tid = setTimeout(() => { setTypingUsers(p => p.filter(u => u.userId !== userId)); typingTimers.current.delete(userId); }, 3000);
        typingTimers.current.set(userId, tid);
      })
      .subscribe();
    typingChRef.current = ch;
    return () => { supabase.removeChannel(ch); typingTimers.current.forEach(t => clearTimeout(t)); typingTimers.current.clear(); };
  }, [projectId, currentUserId, activeChannel]);

  function broadcastTyping() {
    if (!isSupabaseConfigured || !typingChRef.current) return;
    try { typingChRef.current.send({ type: "broadcast", event: "typing", payload: { userId: currentUserId, name: currentUserName } }); } catch { /* ignore */ }
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text || sending || !currentUserId || !projectId) return;
    setSending(true);
    const key = resolveChannelKey(projectId, currentUserId, activeChannel);
    if (!isSupabaseConfigured) {
      setMessages(p => [...p, { id: crypto.randomUUID(), channel: key, senderId: currentUserId, senderName: currentUserName, content: text, createdAt: new Date().toISOString(), threadParentId: null, deletedAt: null, threadCount: 0, reactions: [] }]);
      setDraft(""); setSending(false); return;
    }
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const { error } = await supabase.from("chat_messages").insert({ id, channel: key, sender_id: currentUserId, content: text, created_at: createdAt, thread_parent_id: null });
    if (!error) {
      setMessages(p => [...p, { id, channel: key, senderId: currentUserId, senderName: currentUserName, content: text, createdAt, threadParentId: null, deletedAt: null, threadCount: 0, reactions: [] }]);
      setDraft("");
    }
    setSending(false);
    inputRef.current?.focus();
  }

  function handleEdit(id: string, content: string) {
    setMessages(p => p.map(m => m.id === id ? { ...m, content } : m));
    if (threadMsg?.id === id) setThreadMsg(t => t ? { ...t, content } : t);
    if (isSupabaseConfigured) supabase.from("chat_messages").update({ content }).eq("id", id).then(({ error }) => { if (error) console.error("[Chat] edit:", error); });
  }

  function handleDelete(id: string) {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;
    const now = new Date().toISOString();
    setMessages(p => p.map(m => m.id === id ? { ...m, deletedAt: now } : m));
    if (isSupabaseConfigured) supabase.from("chat_messages").update({ deleted_at: now }).eq("id", id);
    showUndoToast("Message deleted",
      () => { setMessages(p => p.map(m => m.id === id ? { ...m, deletedAt: null } : m)); if (isSupabaseConfigured) supabase.from("chat_messages").update({ deleted_at: null }).eq("id", id); },
      async () => { /* already applied */ },
    );
  }

  async function handleReact(msgId: string, emoji: string) {
    if (!isSupabaseConfigured) {
      setMessages(p => p.map(m => {
        if (m.id !== msgId) return m;
        const ex = m.reactions.find(r => r.emoji === emoji);
        if (ex?.hasReacted) return { ...m, reactions: m.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count - 1, hasReacted: false } : r).filter(r => r.count > 0) };
        if (ex) return { ...m, reactions: m.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, hasReacted: true } : r) };
        return { ...m, reactions: [...m.reactions, { emoji, count: 1, hasReacted: true }] };
      }));
      return;
    }
    const msg = messages.find(m => m.id === msgId);
    const alreadyReacted = msg?.reactions.find(r => r.emoji === emoji)?.hasReacted;
    if (alreadyReacted) {
      await supabase.from("message_reactions").delete().eq("message_id", msgId).eq("user_id", currentUserId).eq("emoji", emoji);
    } else {
      await supabase.from("message_reactions").upsert({ message_id: msgId, user_id: currentUserId, emoji });
    }
  }

  function toggleSidebar() {
    setChatSidebarCollapsed(v => { const next = !v; try { localStorage.setItem("chat_sidebar_collapsed", String(next)); } catch { /* ignore */ } return next; });
  }

  function channelLabel(): string {
    if (activeChannel === "lab") return "Lab";
    if (activeChannel.startsWith("dm:")) { const pid = activeChannel.slice(3); return teamMembers.find(m => m.id === pid)?.name ?? "Direct Message"; }
    return subProjects.find(sp => sp.id === activeChannel)?.name ?? "Channel";
  }

  const visibleSubProjects = isProjectView ? subProjects.filter(sp => sp.id === subProjectId) : subProjects;

  const chatSections: ScopeSection[] = !isProjectView
    ? [{ id: "lab", label: "Lab", color: "#0ea5e9", icon: <Hash size={17} />, isActive: activeChannel === "lab", onClick: () => { setActiveChannel("lab"); setMessages([]); setThreadMsg(null); } }]
    : visibleSubProjects.map(sp => ({ id: sp.id, label: sp.name, color: sp.color ?? "var(--color-navy)", icon: <Hash size={17} />, isActive: activeChannel === sp.id, onClick: () => { setActiveChannel(sp.id); setMessages([]); setThreadMsg(null); } }));

  const chatExtra = (
    <>
      {!isProjectView && visibleSubProjects.length > 0 && (
        <>
          <div style={{ height: 1, backgroundColor: "var(--color-border)", margin: "5px 2px" }} />
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 11px 4px", margin: 0 }}>Projects</p>
          {visibleSubProjects.map(sp => {
            const act = activeChannel === sp.id;
            const c = sp.color ?? "var(--color-navy)";
            return (
              <button key={sp.id} onClick={() => { setActiveChannel(sp.id); setMessages([]); setThreadMsg(null); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 10px 6px 11px", borderRadius: 7, border: "none", borderLeft: `3px solid ${act ? c : "transparent"}`, cursor: "pointer", backgroundColor: act ? `${c}18` : "transparent", fontFamily: "var(--font-roboto)", textAlign: "left", boxSizing: "border-box", marginBottom: 1 }}
                onMouseEnter={e => { if (!act) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,0,0,0.04)"; }}
                onMouseLeave={e => { if (!act) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
              >
                <MessageSquare size={13} style={{ color: act ? c : "var(--color-secondary)", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: act ? c : "var(--color-body)", fontWeight: act ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sp.name}</span>
              </button>
            );
          })}
        </>
      )}
      {teamMembers.length > 0 && (
        <>
          <div style={{ height: 1, backgroundColor: "var(--color-border)", margin: "5px 2px" }} />
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 11px 4px", margin: 0 }}>Direct Messages</p>
          {teamMembers.map(peer => {
            const id = `dm:${peer.id}`;
            const act = activeChannel === id;
            const c = "var(--color-navy)";
            return (
              <button key={id} onClick={() => { setActiveChannel(id); setMessages([]); setThreadMsg(null); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 10px 6px 11px", borderRadius: 7, border: "none", borderLeft: `3px solid ${act ? c : "transparent"}`, cursor: "pointer", backgroundColor: act ? `${c}18` : "transparent", fontFamily: "var(--font-roboto)", textAlign: "left", boxSizing: "border-box", marginBottom: 1 }}
                onMouseEnter={e => { if (!act) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,0,0,0.04)"; }}
                onMouseLeave={e => { if (!act) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
              >
                <span style={{ flexShrink: 0, position: "relative", display: "inline-flex" }}>
                  <span style={{ borderRadius: "50%", boxShadow: "0 0 0 2px var(--color-canvas)", display: "flex" }}><Avatar user={peer} size={22} /></span>
                  <span style={{ position: "absolute", bottom: 0, right: 0, width: 7, height: 7, borderRadius: "50%", backgroundColor: "var(--color-secondary)", border: "1.5px solid var(--color-canvas)", opacity: 0.55 }} aria-hidden="true" />
                </span>
                <span style={{ fontSize: 13, color: act ? c : "var(--color-body)", fontWeight: act ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{peer.name}</span>
              </button>
            );
          })}
        </>
      )}
    </>
  );

  if (projectLoading) return <div className="flex h-full items-center justify-center" style={{ color: "var(--color-secondary)", fontSize: 13 }}>Loading...</div>;

  const memberCount = teamMembers.length + 1;
  const isDm = activeChannel.startsWith("dm:");

  return (
    <>
      <style>{`@keyframes typBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}`}</style>
      <div className="flex h-full" style={{ fontFamily: "var(--font-roboto)", overflow: "hidden" }}>
        <ScopeSidebar
          storageKey="chat_sidebar"
          sections={chatSections}
          extraContent={chatExtra}
          collapsed={chatSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Channel header */}
          <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", flexShrink: 0 }}>
            <div className="flex items-center gap-2">
              {!isDm && <Hash size={16} style={{ color: "var(--color-secondary)", flexShrink: 0 }} />}
              <span style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 22, color: "var(--color-navy)" }}>{channelLabel()}</span>
              {!isDm && <span style={{ fontSize: 12, color: "var(--color-secondary)", marginLeft: 4 }}>{memberCount} members</span>}
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ backgroundColor: "var(--color-canvas)", position: "relative" }}
            onScroll={handleScroll}
          >
            {loading && <div className="flex items-center justify-center py-10" style={{ color: "var(--color-secondary)", fontSize: 13 }}>Loading messages…</div>}
            {!loading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center gap-3">
                <MessageSquare size={40} style={{ color: "var(--color-border)" }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-body)", margin: 0 }}>No messages yet</p>
                <p style={{ fontSize: 13, color: "var(--color-secondary)", margin: 0 }}>Be the first to send a message.</p>
                <button onClick={() => inputRef.current?.focus()} style={{ marginTop: 6, fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 7, backgroundColor: "var(--color-btn-primary)", color: "#fff", border: "none", cursor: "pointer" }}>Send a message</button>
              </div>
            )}
            {!loading && messages.length > 0 && (
              <div style={{ paddingTop: 12, paddingBottom: 4 }}>
                {messages.map((msg, i) => {
                  const prev = i > 0 ? messages[i - 1] : null;
                  const showDiv = !prev || !sameDay(prev.createdAt, msg.createdAt);
                  return (
                    <div key={msg.id}>
                      {showDiv && <DateDivider iso={msg.createdAt} />}
                      <MessageRow msg={msg} prevMsg={prev} currentUserId={currentUserId} onEdit={handleEdit} onDelete={handleDelete} onReact={handleReact} onOpenThread={setThreadMsg} />
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
            {hasNewMessages && (
              <button onClick={scrollToBottom} style={{ position: "sticky", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.18)", whiteSpace: "nowrap" }}>
                New messages <ChevronDown size={13} />
              </button>
            )}
          </div>

          <TypingIndicator names={typingUsers.map(u => u.name)} />

          {/* Input bar */}
          <div style={{ padding: "10px 16px 12px", borderTop: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, border: "1px solid var(--color-border)", borderRadius: 10, backgroundColor: "var(--color-canvas)", padding: "6px 6px 6px 10px" }}>
              <button title="Attach file" aria-label="Attach file" style={{ width: 28, height: 28, borderRadius: 7, border: "none", backgroundColor: "transparent", color: "var(--color-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Plus size={16} />
              </button>
              <textarea
                ref={inputRef}
                value={draft}
                onChange={e => { setDraft(e.target.value); broadcastTyping(); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={`Message ${channelLabel()}…`}
                rows={1}
                style={{ flex: 1, resize: "none", border: "none", outline: "none", background: "transparent", color: "var(--color-body)", fontSize: 14, lineHeight: 1.5, fontFamily: "var(--font-roboto)", maxHeight: 120, overflowY: "auto" }}
              />
              <button onClick={sendMessage} disabled={!draft.trim() || sending} aria-label="Send message"
                style={{ width: 32, height: 32, borderRadius: 7, border: "none", backgroundColor: draft.trim() ? "var(--color-btn-primary)" : "transparent", color: draft.trim() ? "#fff" : "var(--color-secondary)", cursor: draft.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background-color 0.15s" }}>
                <Send size={15} />
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--color-secondary)", margin: "4px 0 0 10px" }}>
              <strong>**bold**</strong>, <em>_italic_</em>, <code style={{ fontFamily: "monospace", fontSize: 10 }}>`code`</code> — Shift+Enter for newline
            </p>
          </div>
        </div>

        {threadMsg && (
          <ThreadPanel
            parent={threadMsg}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            projectId={projectId ?? ""}
            onClose={() => setThreadMsg(null)}
            onReact={handleReact}
          />
        )}
      </div>
    </>
  );
}
