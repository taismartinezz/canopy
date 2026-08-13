"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";
import { useUndoToast } from "@/context/UndoToastContext";
import Avatar from "@/components/ui/Avatar";
import type { User } from "@/types";
import { MessageSquare, Send, Pencil, Trash2, Check, X } from "lucide-react";
import { computeInitials } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  channel: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

// Active channel is either the lab channel, a sub-project id, or "dm:<peerId>"
type ActiveChannel = string;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function resolveChannelKey(projectId: string, currentUserId: string, active: ActiveChannel): string {
  if (active === "lab") return `lab:${projectId}`;
  if (active.startsWith("dm:")) {
    const peerId = active.slice(3);
    return `dm:${[currentUserId, peerId].sort().join(":")}`;
  }
  return `project:${active}`;
}

function buildAvatarUser(id: string, name: string): User {
  return {
    id, name, email: "", role: "researcher",
    avatarColor: "#CBD5E1",
    avatarInitials: computeInitials(name) || name.slice(0, 2).toUpperCase(),
  };
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyChatState({ onCompose }: { onCompose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center gap-3">
      <MessageSquare size={40} style={{ color: "var(--color-border)" }} />
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-body)", margin: 0 }}>
        No messages yet
      </p>
      <p style={{ fontSize: 13, color: "var(--color-secondary)", margin: 0 }}>
        Be the first to send a message in this channel.
      </p>
      <button
        onClick={onCompose}
        style={{ marginTop: 6, fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 7, backgroundColor: "var(--color-btn-primary)", color: "#fff", border: "none", cursor: "pointer" }}
      >
        Send a message
      </button>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageRow({
  msg, prevMsg, currentUserId, onEdit, onDelete,
}: {
  msg: ChatMessage;
  prevMsg: ChatMessage | null;
  currentUserId: string;
  onEdit: (id: string, newContent: string) => void;
  onDelete: (id: string) => void;
}) {
  const isOwn = msg.senderId === currentUserId;
  const isContinuation = prevMsg?.senderId === msg.senderId &&
    (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 5 * 60 * 1000;
  const avatarUser = buildAvatarUser(msg.senderId, msg.senderName);

  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(msg.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setEditDraft(msg.content);
      setTimeout(() => editRef.current?.focus(), 30);
    }
  }, [editing, msg.content]);

  function commitEdit() {
    const trimmed = editDraft.trim();
    if (!trimmed || trimmed === msg.content) { setEditing(false); return; }
    onEdit(msg.id, trimmed);
    setEditing(false);
  }

  function onEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") { setEditing(false); }
  }

  return (
    <div
      style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: isContinuation ? "1px 16px" : "8px 16px 1px", flexDirection: isOwn ? "row-reverse" : "row", position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!isOwn && (
        <div style={{ width: 28, flexShrink: 0, alignSelf: "flex-end" }}>
          {!isContinuation && <Avatar user={avatarUser} size={28} />}
        </div>
      )}
      <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", gap: 2, alignItems: isOwn ? "flex-end" : "flex-start" }}>
        {!isContinuation && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexDirection: isOwn ? "row-reverse" : "row" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-body)" }}>{isOwn ? "You" : msg.senderName}</span>
            <span style={{ fontSize: 10, color: "var(--color-secondary)" }}>{formatTime(msg.createdAt)}</span>
          </div>
        )}
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
            <textarea
              ref={editRef}
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              onKeyDown={onEditKeyDown}
              rows={2}
              style={{
                fontSize: 13, lineHeight: 1.5, padding: "8px 10px", borderRadius: 10,
                border: "1.5px solid var(--color-navy)", outline: "none",
                resize: "none", fontFamily: "var(--font-roboto)",
                backgroundColor: "var(--color-surface)", color: "var(--color-body)",
                width: 260,
              }}
            />
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button onClick={() => setEditing(false)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "none", cursor: "pointer", color: "var(--color-secondary)" }}>Cancel</button>
              <button onClick={commitEdit} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "none", background: "var(--color-btn-primary)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Save</button>
            </div>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: isOwn ? "var(--color-btn-primary)" : "var(--color-surface-2)",
              color: isOwn ? "#fff" : "var(--color-body)",
              borderRadius: isOwn ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              padding: "8px 12px", fontSize: 13, lineHeight: 1.5,
              wordBreak: "break-word", whiteSpace: "pre-wrap",
            }}
          >
            {msg.content}
          </div>
        )}
        {isContinuation && !editing && (
          <span style={{ fontSize: 9, color: "var(--color-secondary)", padding: "0 2px" }}>{formatTime(msg.createdAt)}</span>
        )}
      </div>

      {/* Hover actions for own messages */}
      {isOwn && !editing && hovered && (
        <div style={{
          display: "flex", alignItems: "center", gap: 2,
          position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
          backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: 8, padding: "2px 4px", boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          zIndex: 1,
        }}>
          <button
            onClick={() => setEditing(true)}
            title="Edit message"
            aria-label="Edit message"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 4px", display: "flex", opacity: 0.55, borderRadius: 5, transition: "opacity 0.1s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.55"; }}
          >
            <Pencil size={12} color="var(--color-body)" />
          </button>
          <button
            onClick={() => onDelete(msg.id)}
            title="Delete message"
            aria-label="Delete message"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "3px 4px", display: "flex", opacity: 0.55, borderRadius: 5, transition: "opacity 0.1s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.55"; }}
          >
            <Trash2 size={12} color="var(--color-body)" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Channel sidebar ───────────────────────────────────────────────────────────

function ChannelSidebar({
  activeChannel, onSelect, labChannelVisible, subProjects, dmPeers,
}: {
  activeChannel: ActiveChannel;
  onSelect: (id: ActiveChannel) => void;
  labChannelVisible: boolean;
  subProjects: { id: string; name: string; color?: string | null }[];
  dmPeers: User[];
}) {
  function Row({ id, label, icon, color }: { id: ActiveChannel; label: string; icon?: React.ReactNode; color?: string }) {
    const active = activeChannel === id;
    const c = color ?? "var(--color-navy)";
    return (
      <button
        onClick={() => onSelect(id)}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: "6px 10px 6px 11px", borderRadius: 7, border: "none",
          borderLeft: `3px solid ${active ? c : "transparent"}`,
          cursor: "pointer",
          backgroundColor: active ? `${c}18` : "transparent",
          fontFamily: "var(--font-roboto)", textAlign: "left", boxSizing: "border-box",
          marginBottom: 1, transition: "background-color 120ms ease",
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,0,0,0.04)"; }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
      >
        {icon ?? <MessageSquare size={13} style={{ color: active ? c : "var(--color-secondary)", flexShrink: 0 }} />}
        <span style={{ fontSize: 13, color: active ? c : "var(--color-body)", fontWeight: active ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      </button>
    );
  }

  const sectionLabel = (text: string) => (
    <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "10px 0 4px 2px" }}>
      {text}
    </p>
  );

  return (
    <div style={{ width: 200, flexShrink: 0, borderRight: "1px solid var(--color-border)", backgroundColor: "var(--color-canvas)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <div style={{ padding: "16px 12px 12px" }}>
        {labChannelVisible && (
          <>
            {sectionLabel("Channels")}
            <Row id="lab" label="Lab" color="#0ea5e9" />
          </>
        )}
        {!labChannelVisible && subProjects.length > 0 && (
          <>
            {sectionLabel("Channel")}
            <Row id={subProjects[0].id} label={subProjects[0].name} color={subProjects[0].color ?? undefined} />
          </>
        )}
        {labChannelVisible && subProjects.length > 0 && (
          <>
            {sectionLabel("Projects")}
            {subProjects.map((sp) => (
              <Row key={sp.id} id={sp.id} label={sp.name} color={sp.color ?? undefined} />
            ))}
          </>
        )}
        {dmPeers.length > 0 && (
          <>
            {sectionLabel("Direct Messages")}
            {dmPeers.map((peer) => (
              <Row
                key={`dm:${peer.id}`}
                id={`dm:${peer.id}`}
                label={peer.name}
                icon={<span style={{ flexShrink: 0, display: "flex" }}><Avatar user={peer} size={18} /></span>}
                color="var(--color-navy)"
              />
            ))}
          </>
        )}
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

  // Default channel: project view shows that project's channel, lab shows lab channel
  const defaultChannel = isProjectView && subProjects.find((sp) => sp.id === subProjectId)
    ? (subProjectId ?? "lab")
    : "lab";

  const [activeChannel, setActiveChannel] = useState<ActiveChannel>(defaultChannel);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auth init
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCurrentUserId("demo-user");
      setCurrentUserName("You");
      setTeamMembers([
        buildAvatarUser("demo-pi", "Dr. Sarah Chen"),
        buildAvatarUser("demo-ra", "Marcus Johnson"),
        buildAvatarUser("demo-grad", "Priya Patel"),
      ]);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      setCurrentUserId(session.user.id);
      supabase.from("user_profiles").select("name").eq("id", session.user.id).single()
        .then(({ data }) => { if (data?.name) setCurrentUserName(data.name as string); });
    });
  }, []);

  // Fetch team/project members
  useEffect(() => {
    if (!isSupabaseConfigured || !projectId || !currentUserId) return;

    async function load() {
      if (isProjectView && subProjectId) {
        const { data } = await supabase
          .from("sub_project_members")
          .select("user_id, user_profiles(name, avatar_color, avatar_initials, avatar_url)")
          .eq("sub_project_id", subProjectId);
        if (!data) return;
        setTeamMembers(data
          .filter((r) => r.user_id !== currentUserId)
          .map((r) => {
            const p = (Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles) as Record<string, string> | null;
            const name = p?.name ?? "Unknown";
            return { id: r.user_id as string, name, email: "", role: "researcher" as const, avatarColor: p?.avatar_color ?? "#CBD5E1", avatarInitials: computeInitials(name) || (p?.avatar_initials ?? "??"), avatarUrl: p?.avatar_url ?? undefined };
          }));
      } else {
        const { data } = await supabase
          .from("team_members")
          .select("user_id, user_profiles(name, avatar_color, avatar_initials, avatar_url)")
          .eq("project_id", projectId);
        if (!data) return;
        setTeamMembers(data
          .filter((r) => r.user_id !== currentUserId)
          .map((r) => {
            const p = (Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles) as Record<string, string> | null;
            const name = p?.name ?? "Unknown";
            return { id: r.user_id as string, name, email: "", role: "researcher" as const, avatarColor: p?.avatar_color ?? "#CBD5E1", avatarInitials: computeInitials(name) || (p?.avatar_initials ?? "??"), avatarUrl: p?.avatar_url ?? undefined };
          }));
      }
    }
    load();
  }, [projectId, currentUserId, isProjectView, subProjectId]);

  // Reset channel when scope changes
  useEffect(() => {
    setActiveChannel(defaultChannel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScope, subProjectId]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!projectId || !currentUserId) return;
    setLoading(true);
    const key = resolveChannelKey(projectId, currentUserId, activeChannel);

    if (!isSupabaseConfigured) {
      setMessages([
        { id: "demo-1", channel: key, senderId: "demo-pi", senderName: "Dr. Sarah Chen", content: "Good morning everyone! Quick reminder that lab meeting is moved to Thursday this week.", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
        { id: "demo-2", channel: key, senderId: "demo-ra", senderName: "Marcus Johnson", content: "Thanks for the heads up! I'll update my calendar.", createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString() },
        { id: "demo-3", channel: key, senderId: "demo-grad", senderName: "Priya Patel", content: "Will the agenda be the same? I was going to present my prelim results.", createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString() },
        { id: "demo-4", channel: key, senderId: "demo-pi", senderName: "Dr. Sarah Chen", content: "Yes, same agenda. Priya you're still presenting first -- we're all looking forward to it!", createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
        { id: "demo-5", channel: key, senderId: "demo-user", senderName: "You", content: "See everyone Thursday!", createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
      ]);
      setLoading(false); return;
    }

    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, channel, sender_id, content, created_at, user_profiles!sender_id(name)")
      .eq("channel", key)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) { console.error("[Chat] fetch error:", error); setLoading(false); return; }

    setMessages((data ?? []).map((row) => {
      const prof = row.user_profiles as { name?: string } | null;
      return {
        id: row.id as string,
        channel: row.channel as string,
        senderId: row.sender_id as string,
        senderName: prof?.name ?? "Unknown",
        content: row.content as string,
        createdAt: row.created_at as string,
      };
    }));
    setLoading(false);
  }, [projectId, currentUserId, activeChannel]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!isSupabaseConfigured || !projectId || !currentUserId) return;
    const key = resolveChannelKey(projectId, currentUserId, activeChannel);
    const channel = supabase
      .channel(`chat:${key}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel=eq.${key}` }, async (payload) => {
        const row = payload.new as Record<string, unknown>;
        let senderName = "Unknown";
        const { data: prof } = await supabase.from("user_profiles").select("name").eq("id", row.sender_id as string).single();
        if (prof?.name) senderName = prof.name as string;
        const newMsg: ChatMessage = {
          id: row.id as string, channel: row.channel as string,
          senderId: row.sender_id as string, senderName,
          content: row.content as string, createdAt: row.created_at as string,
        };
        setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages", filter: `channel=eq.${key}` }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        setMessages((prev) => prev.map((m) => m.id === row.id ? { ...m, content: row.content as string } : m));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages", filter: `channel=eq.${key}` }, (payload) => {
        const row = payload.old as Record<string, unknown>;
        setMessages((prev) => prev.filter((m) => m.id !== row.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, currentUserId, activeChannel]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || sending || !currentUserId || !projectId) return;
    setSending(true);
    const key = resolveChannelKey(projectId, currentUserId, activeChannel);

    if (!isSupabaseConfigured) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), channel: key, senderId: currentUserId, senderName: currentUserName, content: text, createdAt: new Date().toISOString() }]);
      setDraft(""); setSending(false); return;
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const { error } = await supabase.from("chat_messages").insert({ id, channel: key, sender_id: currentUserId, content: text, created_at: createdAt });
    if (error) { console.error("[Chat] send error:", error); }
    else {
      setMessages((prev) => [...prev, { id, channel: key, senderId: currentUserId, senderName: currentUserName, content: text, createdAt }]);
      setDraft("");
    }
    setSending(false);
    inputRef.current?.focus();
  }

  function handleEdit(id: string, newContent: string) {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content: newContent } : m));
    if (isSupabaseConfigured) {
      supabase.from("chat_messages").update({ content: newContent }).eq("id", id)
        .then(({ error }) => { if (error) console.error("[Chat] edit error:", error); });
    }
  }

  function handleDelete(id: string) {
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    showUndoToast(
      "Message deleted",
      () => setMessages((prev) => {
        const insertIdx = prev.findIndex((m) => m.createdAt > msg.createdAt);
        if (insertIdx === -1) return [...prev, msg];
        return [...prev.slice(0, insertIdx), msg, ...prev.slice(insertIdx)];
      }),
      async () => {
        if (!isSupabaseConfigured) return;
        const { error } = await supabase.from("chat_messages").delete().eq("id", id);
        if (error) console.error("[Chat] delete error:", error);
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // Which sub-project is currently the active one (project view)
  const activeSubProject = isProjectView ? subProjects.find((sp) => sp.id === subProjectId) : null;

  // Channel label for header
  function channelLabel(): string {
    if (activeChannel === "lab") return "Lab";
    if (activeChannel.startsWith("dm:")) {
      const peerId = activeChannel.slice(3);
      return teamMembers.find((m) => m.id === peerId)?.name ?? "Direct Message";
    }
    return subProjects.find((sp) => sp.id === activeChannel)?.name ?? "Channel";
  }

  // Sub-projects shown in channel sidebar
  const visibleSubProjects = isProjectView
    ? (activeSubProject ? [activeSubProject] : [])
    : subProjects;

  if (projectLoading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ color: "var(--color-secondary)", fontSize: 13 }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ fontFamily: "var(--font-roboto)", overflow: "hidden" }}>
      <ChannelSidebar
        activeChannel={activeChannel}
        onSelect={(id) => { setActiveChannel(id); setMessages([]); }}
        labChannelVisible={!isProjectView}
        subProjects={visibleSubProjects}
        dmPeers={teamMembers}
      />

      {/* Message area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <MessageSquare size={16} style={{ color: "var(--color-secondary)" }} />
            <span style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 16, color: "var(--color-navy)" }}>{channelLabel()}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--color-canvas)" }}>
          {loading && (
            <div className="flex items-center justify-center py-10" style={{ color: "var(--color-secondary)", fontSize: 13 }}>
              Loading messages...
            </div>
          )}
          {!loading && messages.length === 0 && (
            <EmptyChatState onCompose={() => inputRef.current?.focus()} />
          )}
          {!loading && messages.length > 0 && (
            <div style={{ paddingTop: 12, paddingBottom: 4 }}>
              {messages.map((msg, i) => (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  prevMsg={i > 0 ? messages[i - 1] : null}
                  currentUserId={currentUserId}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, border: "1px solid var(--color-border)", borderRadius: 10, backgroundColor: "var(--color-surface-2)", padding: "6px 6px 6px 12px" }}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${channelLabel()}... (Enter to send, Shift+Enter for newline)`}
              rows={1}
              style={{
                flex: 1, resize: "none", border: "none", outline: "none",
                background: "transparent", color: "var(--color-body)",
                fontSize: 13, lineHeight: 1.5, fontFamily: "var(--font-roboto)",
                maxHeight: 120, overflowY: "auto",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!draft.trim() || sending}
              aria-label="Send message"
              style={{ width: 32, height: 32, borderRadius: 7, border: "none", backgroundColor: draft.trim() ? "var(--color-btn-primary)" : "transparent", color: draft.trim() ? "#fff" : "var(--color-secondary)", cursor: draft.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background-color 0.15s" }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
