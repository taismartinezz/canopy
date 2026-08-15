"use client";

import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { SmilePlus, MessageCircle, Pin, Pencil, Trash2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { ChatMessage } from "./types";
import { GROUP_GAP_MS } from "./types";
import { buildUser, formatTime, formatHM, renderMd, EmojiPicker, TBtn } from "./chatUtils";

export function MessageRow({
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
