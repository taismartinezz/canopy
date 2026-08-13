"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useProject } from "@/context/ProjectContext";
import Avatar from "@/components/ui/Avatar";
import type { User, SubProject } from "@/types";
import { MessageSquare, Send } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  channel: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

type ChannelId = "lab" | "personal" | string; // string = sub-project id

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function channelKey(projectId: string, channelId: ChannelId): string {
  if (channelId === "lab" || channelId === "personal") return `${channelId}:${projectId}`;
  return `project:${channelId}`;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyChatState({ onCompose }: { onCompose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center gap-3">
      <MessageSquare size={40} style={{ color: "var(--color-border)" }} />
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-body)", margin: 0 }}>
        No messages yet — say hello!
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

function MessageRow({ msg, prevMsg, currentUserId }: {
  msg: ChatMessage;
  prevMsg: ChatMessage | null;
  currentUserId: string;
}) {
  const isOwn = msg.senderId === currentUserId;
  const isContinuation = prevMsg?.senderId === msg.senderId &&
    (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 5 * 60 * 1000;
  const avatarUser: User = { id: msg.senderId, name: msg.senderName, email: "", role: "student" as const };

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: isContinuation ? "1px 16px" : "8px 16px 1px", flexDirection: isOwn ? "row-reverse" : "row" }}>
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
        <div
          style={{
            backgroundColor: isOwn ? "var(--color-btn-primary)" : "var(--color-surface-2)",
            color: isOwn ? "#fff" : "var(--color-body)",
            borderRadius: isOwn ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
            padding: "8px 12px",
            fontSize: 13,
            lineHeight: 1.5,
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
          }}
        >
          {msg.content}
        </div>
        {isContinuation && (
          <span style={{ fontSize: 9, color: "var(--color-secondary)", padding: "0 2px" }}>{formatTime(msg.createdAt)}</span>
        )}
      </div>
    </div>
  );
}

// ── Channel sidebar ───────────────────────────────────────────────────────────

function ChannelSidebar({ activeChannel, onSelect, subProjects }: {
  activeChannel: ChannelId;
  onSelect: (id: ChannelId) => void;
  subProjects: SubProject[];
}) {
  function ChannelRow({ id, label, color }: { id: ChannelId; label: string; color?: string }) {
    const active = activeChannel === id;
    return (
      <button
        onClick={() => onSelect(id)}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: "6px 10px 6px 11px", borderRadius: 7, border: "none",
          borderLeft: `3px solid ${active ? (color ?? "var(--color-navy)") : "transparent"}`,
          cursor: "pointer",
          backgroundColor: active ? `${color ?? "var(--color-navy)"}18` : "transparent",
          fontFamily: "var(--font-roboto)", textAlign: "left", boxSizing: "border-box",
          marginBottom: 1,
          transition: "background-color 120ms ease",
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,0,0,0.04)"; }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
      >
        <MessageSquare size={13} style={{ color: active ? (color ?? "var(--color-navy)") : "var(--color-secondary)", flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: active ? (color ?? "var(--color-navy)") : "var(--color-body)", fontWeight: active ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      </button>
    );
  }

  return (
    <div style={{ width: 200, flexShrink: 0, borderRight: "1px solid var(--color-border)", backgroundColor: "var(--color-canvas)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <div style={{ padding: "16px 12px 8px" }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px 2px" }}>Channels</p>
        <ChannelRow id="lab" label="Lab" color="#0ea5e9" />
        <ChannelRow id="personal" label="Personal (DMs)" color="#6366f1" />
        {subProjects.length > 0 && (
          <>
            <div style={{ height: 1, backgroundColor: "var(--color-border)", margin: "8px 2px 6px" }} />
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px 2px" }}>Projects</p>
            {subProjects.map(sp => (
              <ChannelRow key={sp.id} id={sp.id} label={sp.name} color={sp.color ?? undefined} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { projectId, subProjects, isLoading: projectLoading } = useProject();
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [activeChannel, setActiveChannel] = useState<ChannelId>("lab");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Init current user
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setCurrentUserId("demo-user");
      setCurrentUserName("You");
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      setCurrentUserId(session.user.id);
      supabase.from("user_profiles").select("name").eq("id", session.user.id).single()
        .then(({ data }) => { if (data?.name) setCurrentUserName(data.name as string); });
    });
  }, []);

  // Fetch messages for the active channel
  const fetchMessages = useCallback(async () => {
    if (!projectId || !currentUserId) return;
    setLoading(true);
    const key = channelKey(projectId, activeChannel);

    if (!isSupabaseConfigured) {
      setMessages([]);
      setLoading(false);
      return;
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!isSupabaseConfigured || !projectId || !currentUserId) return;
    const key = channelKey(projectId, activeChannel);
    const channel = supabase
      .channel(`chat:${key}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel=eq.${key}` }, async (payload) => {
        const row = payload.new as Record<string, unknown>;
        // Fetch sender name
        let senderName = "Unknown";
        const { data: prof } = await supabase.from("user_profiles").select("name").eq("id", row.sender_id as string).single();
        if (prof?.name) senderName = prof.name as string;

        const newMsg: ChatMessage = {
          id: row.id as string,
          channel: row.channel as string,
          senderId: row.sender_id as string,
          senderName,
          content: row.content as string,
          createdAt: row.created_at as string,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId, currentUserId, activeChannel]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || sending || !currentUserId || !projectId) return;
    setSending(true);
    const key = channelKey(projectId, activeChannel);

    if (!isSupabaseConfigured) {
      // Demo mode: add locally
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), channel: key, senderId: currentUserId, senderName: currentUserName, content: text, createdAt: new Date().toISOString() }]);
      setDraft("");
      setSending(false);
      return;
    }

    const { error } = await supabase.from("chat_messages").insert({
      channel: key,
      sender_id: currentUserId,
      content: text,
    });

    if (error) {
      console.error("[Chat] send error:", error);
    } else {
      // Optimistic — realtime will confirm; add locally to avoid delay for sender
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), channel: key, senderId: currentUserId, senderName: currentUserName, content: text, createdAt: new Date().toISOString() }]);
      setDraft("");
    }
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const channelLabel = activeChannel === "lab"
    ? "Lab"
    : activeChannel === "personal"
      ? "Personal (DMs)"
      : subProjects.find((sp) => sp.id === activeChannel)?.name ?? "Channel";

  if (projectLoading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ color: "var(--color-secondary)", fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ fontFamily: "var(--font-roboto)", overflow: "hidden" }}>
      {/* Channel list */}
      <ChannelSidebar
        activeChannel={activeChannel}
        onSelect={(id) => { setActiveChannel(id); setMessages([]); }}
        subProjects={subProjects}
      />

      {/* Message area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", flexShrink: 0 }}>
          <div className="flex items-center gap-2">
            <MessageSquare size={16} style={{ color: "var(--color-secondary)" }} />
            <span style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 16, color: "var(--color-navy)" }}>{channelLabel}</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "var(--color-canvas)" }}>
          {loading && (
            <div className="flex items-center justify-center py-10" style={{ color: "var(--color-secondary)", fontSize: 13 }}>
              Loading messages…
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
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)", flexShrink: 0 }}>
          <div
            style={{
              display: "flex", alignItems: "flex-end", gap: 8,
              border: "1px solid var(--color-border)", borderRadius: 10,
              backgroundColor: "var(--color-surface-2)",
              padding: "6px 6px 6px 12px",
            }}
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${channelLabel}… (Enter to send, Shift+Enter for newline)`}
              rows={1}
              style={{
                flex: 1, resize: "none", border: "none", outline: "none",
                background: "transparent", color: "var(--color-body)",
                fontSize: 13, fontFamily: "var(--font-roboto)", lineHeight: 1.5,
                maxHeight: 120, overflowY: "auto",
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!draft.trim() || sending}
              aria-label="Send message"
              style={{
                width: 34, height: 34, borderRadius: 8, border: "none",
                backgroundColor: !draft.trim() || sending ? "var(--color-border)" : "var(--color-btn-primary)",
                color: "#fff", cursor: !draft.trim() || sending ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background-color 0.15s", flexShrink: 0,
              }}
            >
              <Send size={15} />
            </button>
          </div>
          <p style={{ fontSize: 10, color: "var(--color-secondary)", margin: "4px 2px 0", fontStyle: "italic" }}>
            Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
