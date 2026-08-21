"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  X, ChevronLeft, Lock, Phone, Globe, Mail, MapPin,
  Clock, Send, Check, BookOpen, Library, ChevronRight, Undo2, Calendar, Mic, MicOff,
} from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { getCrisisDefault } from "@/lib/support/crisisDefaults";
import type { CrisisDefault } from "@/lib/support/crisisDefaults";

// ── Types ──────────────────────────────────────────────────────────────────────

type HelpType =
  | "research_question"
  | "blocked"
  | "feedback"
  | "technical"
  | "not_sure"
  | "try_self";

type Screen =
  | { id: "fork" }
  | { id: "a1" }
  | { id: "a2"; helpType: HelpType }
  | { id: "a3"; helpType: HelpType; recipient: Member }
  | { id: "a4"; helpType: HelpType; recipient: Member; body: string; includeJournal: boolean }
  | { id: "a_sent"; recipientName: string; msgId: string }
  | { id: "a_not_sure"; step: 1 | 2; ans1: string }
  | { id: "a_not_sure_result"; suggestion: Member; reason: string }
  | { id: "a_try_self" }
  | { id: "b" }
  | { id: "b_pick"; filter: "pi" | "all" }
  | { id: "b_message"; recipient: Member };

interface Member {
  id: string;
  name: string;
  role: "pi" | "researcher";
  avatarColor: string;
  avatarInitials: string;
  avatarUrl?: string;
  contextNote?: string; // e.g. "PI", "on this task with you"
}

interface SupportResource {
  id: string;
  label: string;
  description: string | null;
  confidentiality: string | null;
  category: string;
  contact_type: "phone" | "url" | "email" | "in_person";
  contact_value: string;
  availability: string | null;
  is_pinned: boolean;
  sort_order: number;
  active: boolean;
}

interface Bookmark {
  id: string;
  title: string;
  url: string;
}

interface LitItem {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
}

interface Task {
  id: string;
  title: string;
  updated_at: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SupportPanelProps {
  track?: "work" | "wellbeing";
  onClose: () => void;
  projectId: string | null;
  userId: string;
  todayJournalText?: string;
}

// ── Copy constants ─────────────────────────────────────────────────────────────

const HELP_OPTIONS: Array<{ type: HelpType; label: string; sub: string }> = [
  { type: "research_question", label: "I have a research question", sub: "Direction, methods, interpreting results. Best for your PI or a senior collaborator." },
  { type: "blocked", label: "I'm blocked on a task", sub: "Someone already working on this task can usually unblock you fastest." },
  { type: "feedback", label: "I'd like feedback", sub: "Share work in progress and request a review or a meeting." },
  { type: "technical", label: "I need technical help", sub: "Code, equipment, software, or data problems." },
  { type: "not_sure", label: "I'm not sure who to ask", sub: "Answer two quick questions to find someone." },
  { type: "try_self", label: "I want to try solving it myself first", sub: "Pull up what's already in the project on this, and check back later." },
];

function firstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName;
}

function draftBody(helpType: HelpType, recipientName: string, taskTitle: string | null): string {
  const n = firstName(recipientName);
  const t = taskTitle;
  switch (helpType) {
    case "research_question":
      return t
        ? `Hi ${n},I've hit a question on ${t} that I'd like your read on.\n\nWhere I am:\nWhat I've tried:\nWhat I'm unsure about:\n\nNo rush,happy to talk in office hours if that's easier.`
        : `Hi ${n},I've hit a research question I'd like your read on.\n\nWhere I am:\nWhat I've tried:\nWhat I'm unsure about:\n\nNo rush,happy to talk in office hours if that's easier.`;
    case "blocked":
      return t
        ? `Hi ${n},I'm stuck on ${t} and I think you've worked on this part.\n\nWhat's blocking me:\nWhat I've tried:\n\nIf you have 15 minutes this week that would help a lot.`
        : `Hi ${n},I'm stuck on something and I think you've worked on this part.\n\nWhat's blocking me:\nWhat I've tried:\n\nIf you have 15 minutes this week that would help a lot.`;
    case "feedback":
      return t
        ? `Hi ${n},I have a draft of ${t} ready for a look.\n\nWhat I'd most like feedback on:\nWhere it's still rough:\n\nAny time this week works.`
        : `Hi ${n},I have a draft I'd like your feedback on.\n\nWhat I'd most like feedback on:\nWhere it's still rough:\n\nAny time this week works.`;
    case "technical":
      return t
        ? `Hi ${n},I'm running into a technical problem with ${t}.\n\nWhat's happening:\nWhat I've tried:\nSetup / error details:`
        : `Hi ${n},I'm running into a technical problem.\n\nWhat's happening:\nWhat I've tried:\nSetup / error details:`;
    default:
      return "";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function dmChannelKey(a: string, b: string): string {
  return `dm:${[a, b].sort().join(":")}`;
}

function contactHref(type: SupportResource["contact_type"], value: string): string {
  if (type === "phone") return `tel:${value}`;
  if (type === "email") return `mailto:${value}`;
  if (type === "url") return value.startsWith("http") ? value : `https://${value}`;
  return "";
}

function ContactIcon({ type }: { type: SupportResource["contact_type"] }) {
  const sz = 15;
  const col = "var(--color-navy)";
  if (type === "phone") return <Phone size={sz} color={col} />;
  if (type === "url") return <Globe size={sz} color={col} />;
  if (type === "email") return <Mail size={sz} color={col} />;
  return <MapPin size={sz} color={col} />;
}

// ── Panel shell ───────────────────────────────────────────────────────────────

function PanelShell({ title, onBack, onClose, children }: {
  title: string; onBack?: () => void; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 shrink-0" style={{
        height: 52, borderBottom: "1px solid var(--color-border)",
        backgroundColor: "var(--color-surface)",
      }}>
        {onBack && (
          <button onClick={onBack} aria-label="Back"
            className="flex items-center justify-center rounded-lg"
            style={{ width: 36, height: 36, minHeight: 44, border: "none", background: "transparent", cursor: "pointer" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-dimmed-bg)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
          >
            <ChevronLeft size={18} color="var(--color-secondary)" />
          </button>
        )}
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--color-body)", fontFamily: "var(--font-roboto)" }}>
          {title}
        </span>
        <button onClick={onClose} aria-label="Close panel"
          className="flex items-center justify-center rounded-lg"
          style={{ width: 36, height: 36, minHeight: 44, border: "none", background: "transparent", cursor: "pointer" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-dimmed-bg)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
        >
          <X size={16} color="var(--color-secondary)" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ padding: "20px 20px 32px" }}>
        {children}
      </div>
    </div>
  );
}

// ── SupportPanel ──────────────────────────────────────────────────────────────

export default function SupportPanel({ track, onClose, projectId, userId, todayJournalText }: SupportPanelProps) {
  // ── Data ────────────────────────────────────────────────────────────────────
  const [members, setMembers] = useState<Member[]>([]);
  const [resources, setResources] = useState<SupportResource[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [literature, setLiterature] = useState<LitItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [piInvitation, setPiInvitation] = useState<{ text: string; piName: string } | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // ── Screen ───────────────────────────────────────────────────────────────────
  const initialScreen: Screen = track === "wellbeing" ? { id: "b" } : track === "work" ? { id: "a1" } : { id: "fork" };
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [history, setHistory] = useState<Screen[]>([]);

  const push = useCallback((s: Screen) => {
    setHistory((h) => [...h, screen]);
    setScreen(s);
  }, [screen]);

  const back = useCallback(() => {
    const prev = history[history.length - 1];
    if (prev) {
      setHistory((h) => h.slice(0, -1));
      setScreen(prev);
    } else {
      onClose();
    }
  }, [history, onClose]);

  // ── Focus trap + ESC ─────────────────────────────────────────────────────────
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
    );
    focusable[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [screen, onClose]);

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) { setLoadingData(false); return; }

    async function load() {
      if (!projectId) return;
      try {
        const [membQ, resQ, bmQ, litQ, taskQ, projQ] = await Promise.all([
          supabase
            .from("team_members")
            .select("user_id, role, user_profiles(name, avatar_initials, avatar_color, avatar_url)")
            .eq("project_id", projectId),
          supabase
            .from("support_resources")
            .select("id, label, description, confidentiality, category, contact_type, contact_value, availability, is_pinned, sort_order, active")
            .eq("project_id", projectId)
            .order("sort_order"),
          supabase
            .from("bookmarks")
            .select("id, title, url")
            .eq("project_id", projectId)
            .limit(20),
          supabase
            .from("literature_items")
            .select("id, title, authors, year")
            .eq("project_id", projectId)
            .limit(20),
          supabase
            .from("tasks")
            .select("id, title, updated_at")
            .eq("project_id", projectId)
            .neq("status", "done")
            .order("updated_at", { ascending: false })
            .limit(20),
          supabase
            .from("projects")
            .select("support_invitation, owner_id")
            .eq("id", projectId)
            .single(),
        ]);

        const rawMembers: Member[] = (membQ.data ?? []).map((row: Record<string, unknown>) => {
          const raw = row["user_profiles"];
          const prof = (Array.isArray(raw) ? raw[0] : raw) as Record<string, string> | null;
          return {
            id: row["user_id"] as string,
            name: prof?.["name"] ?? "Team member",
            role: row["role"] as "pi" | "researcher",
            avatarColor: prof?.["avatar_color"] ?? "#B4D4E3",
            avatarInitials: prof?.["avatar_initials"] ?? initials(prof?.["name"] ?? "TM"),
            avatarUrl: prof?.["avatar_url"] ?? undefined,
          };
        }).filter((m) => m.id !== userId);
        setMembers(rawMembers);

        setResources((resQ.data ?? []) as SupportResource[]);
        setBookmarks((bmQ.data ?? []) as Bookmark[]);
        setLiterature((litQ.data ?? []) as LitItem[]);
        setTasks((taskQ.data ?? []) as Task[]);

        if (!projQ.error && projQ.data?.["support_invitation"]) {
          const piMember = rawMembers.find((m) => m.role === "pi");
          setPiInvitation({ text: projQ.data["support_invitation"] as string, piName: piMember?.name ?? "PI" });
        }
      } catch { /* non-fatal */ } finally {
        setLoadingData(false);
      }
    }

    if (isSupabaseConfigured) {
      void load();
    } else {
      setLoadingData(false);
    }
  }, [projectId, userId]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const pi = members.find((m) => m.role.toLowerCase() === "pi");
  const canGoBack = history.length > 0;

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: "rgba(27,46,75,0.45)" }}
      onClick={onClose}
      aria-hidden="false"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Support"
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          maxHeight: "min(640px, calc(100vh - 32px))",
          backgroundColor: "var(--color-surface)",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(27,46,75,0.22)",
        }}
      >
        {screen.id === "fork" && (
          <ForkScreen
            piInvitation={piInvitation}
            onWork={() => push({ id: "a1" })}
            onWellbeing={() => push({ id: "b" })}
            onClose={onClose}
          />
        )}

        {screen.id === "a1" && (
          <A1Screen
            onBack={canGoBack ? back : undefined}
            onClose={onClose}
            onSelect={(helpType) => {
              if (helpType === "try_self") { push({ id: "a_try_self" }); return; }
              if (helpType === "not_sure") { push({ id: "a_not_sure", step: 1, ans1: "" }); return; }
              push({ id: "a2", helpType });
            }}
          />
        )}

        {screen.id === "a2" && (
          <A2Screen
            helpType={screen.helpType}
            members={members}
            onBack={back}
            onClose={onClose}
            onSelect={(recipient) => push({ id: "a3", helpType: screen.helpType, recipient })}
          />
        )}

        {screen.id === "a3" && (
          <A3Screen
            helpType={screen.helpType}
            recipient={screen.recipient}
            tasks={tasks}
            hasTodayJournal={!!todayJournalText}
            projectId={projectId}
            userId={userId}
            onBack={back}
            onClose={onClose}
            onPreview={(body, includeJournal) =>
              push({ id: "a4", helpType: screen.helpType, recipient: screen.recipient, body, includeJournal })
            }
          />
        )}

        {screen.id === "a4" && (
          <A4Screen
            helpType={screen.helpType}
            recipient={screen.recipient}
            body={screen.body}
            includeJournal={screen.includeJournal}
            todayJournalText={todayJournalText}
            projectId={projectId}
            userId={userId}
            onBack={back}
            onClose={onClose}
            onSent={(msgId) => {
              setHistory([]);
              setScreen({ id: "a_sent", recipientName: screen.recipient.name, msgId });
            }}
          />
        )}

        {screen.id === "a_sent" && (
          <ASentScreen
            recipientName={screen.recipientName}
            msgId={screen.msgId}
            onClose={onClose}
            onDone={() => {
              setHistory([]);
              setScreen({ id: "fork" });
            }}
          />
        )}

        {screen.id === "a_not_sure" && (
          <ANotSureScreen
            step={screen.step}
            ans1={screen.ans1}
            members={members}
            onBack={back}
            onClose={onClose}
            onResult={(suggestion, reason) =>
              push({ id: "a_not_sure_result", suggestion, reason })
            }
            onAdvance={(ans1) =>
              push({ id: "a_not_sure", step: 2, ans1 })
            }
          />
        )}

        {screen.id === "a_not_sure_result" && (
          <ANotSureResultScreen
            suggestion={screen.suggestion}
            reason={screen.reason}
            onBack={back}
            onClose={onClose}
            onMessage={() =>
              push({ id: "a3", helpType: "research_question", recipient: screen.suggestion })
            }
          />
        )}

        {screen.id === "a_try_self" && (
          <ATrySelfScreen
            bookmarks={bookmarks}
            literature={literature}
            userId={userId}
            projectId={projectId}
            onBack={back}
            onClose={onClose}
          />
        )}

        {screen.id === "b" && (
          <BScreen
            resources={resources}
            loading={loadingData}
            pi={pi}
            members={members}
            isCurrentUserPi={false}
            projectId={projectId}
            onBack={canGoBack ? back : undefined}
            onClose={onClose}
            onPickRecipient={(filter) => push({ id: "b_pick", filter })}
          />
        )}

        {screen.id === "b_pick" && (
          <BPickScreen
            filter={screen.filter}
            members={members}
            pi={pi}
            onBack={back}
            onClose={onClose}
            onSelect={(recipient) => push({ id: "b_message", recipient })}
          />
        )}

        {screen.id === "b_message" && (
          <BMessageScreen
            recipient={screen.recipient}
            projectId={projectId}
            userId={userId}
            onBack={back}
            onClose={onClose}
            onSent={(msgId) => {
              setHistory([]);
              setScreen({ id: "a_sent", recipientName: screen.recipient.name, msgId });
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Screen: Fork ──────────────────────────────────────────────────────────────

function ForkScreen({ piInvitation, onWork, onWellbeing, onClose }: {
  piInvitation: { text: string; piName: string } | null;
  onWork: () => void;
  onWellbeing: () => void;
  onClose: () => void;
}) {
  return (
    <PanelShell title="What would help right now?" onClose={onClose}>
      <p style={{ fontSize: 14, color: "var(--color-secondary)", margin: "0 0 16px", lineHeight: 1.6 }}>
        Getting stuck is part of research.
      </p>
      {piInvitation && (
        <blockquote style={{
          margin: "0 0 20px",
          padding: "10px 14px",
          borderLeft: "3px solid var(--color-border)",
          color: "var(--color-secondary)",
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 600 }}>{piInvitation.piName}:</span>{" "}
          &ldquo;{piInvitation.text}&rdquo;
        </blockquote>
      )}
      <div className="flex flex-col gap-3">
        <ForkCard
          label="I need help with my work"
          sub="Research questions, blocked tasks, feedback, technical problems."
          onClick={onWork}
        />
        <ForkCard
          label="I need support with how I'm doing"
          sub="Workload, stress, or anything outside the work itself."
          onClick={onWellbeing}
        />
      </div>
    </PanelShell>
  );
}

function ForkCard({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "16px 18px",
        borderRadius: 10,
        border: `1px solid ${hov ? "var(--color-navy)" : "var(--color-border)"}`,
        backgroundColor: hov ? "var(--color-dimmed-bg)" : "var(--color-canvas)",
        cursor: "pointer",
        minHeight: 44,
        transition: "border-color 120ms, background-color 120ms",
      }}
    >
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-body)", margin: "0 0 5px", fontFamily: "var(--font-roboto)" }}>
        {label}
      </p>
      <p style={{ fontSize: 13, color: "var(--color-secondary)", margin: 0, lineHeight: 1.5 }}>
        {sub}
      </p>
    </button>
  );
}

// ── Screen: A1,What kind of help ───────────────────────────────────────────

function A1Screen({ onBack, onClose, onSelect }: {
  onBack?: () => void;
  onClose: () => void;
  onSelect: (h: HelpType) => void;
}) {
  return (
    <PanelShell title="What kind of help?" onBack={onBack} onClose={onClose}>
      <div className="flex flex-col gap-2">
        {HELP_OPTIONS.map((opt) => (
          <OptionRow key={opt.type} label={opt.label} sub={opt.sub} onClick={() => onSelect(opt.type)} />
        ))}
      </div>
    </PanelShell>
  );
}

function OptionRow({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: 8,
        border: "1px solid var(--color-border)",
        backgroundColor: hov ? "var(--color-dimmed-bg)" : "transparent",
        cursor: "pointer",
        minHeight: 44,
        transition: "background-color 100ms",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)", fontFamily: "var(--font-roboto)" }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: "var(--color-secondary)", lineHeight: 1.5 }}>
        {sub}
      </span>
    </button>
  );
}

// ── Screen: A2,Recipient ────────────────────────────────────────────────────

function sortedForHelp(members: Member[], helpType: HelpType): Member[] {
  return [...members].sort((a, b) => {
    if (helpType === "research_question") {
      if (a.role === "pi" && b.role !== "pi") return -1;
      if (b.role === "pi" && a.role !== "pi") return 1;
    }
    return a.name.localeCompare(b.name);
  }).map((m) => ({
    ...m,
    contextNote: m.role === "pi" ? "PI" : "Researcher",
  }));
}

function A2Screen({ helpType, members, onBack, onClose, onSelect }: {
  helpType: HelpType;
  members: Member[];
  onBack: () => void;
  onClose: () => void;
  onSelect: (m: Member) => void;
}) {
  const sorted = sortedForHelp(members, helpType);
  return (
    <PanelShell title="Who can help?" onBack={onBack} onClose={onClose}>
      {sorted.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No team members found.</p>
      )}
      <div className="flex flex-col gap-2">
        {sorted.map((m) => (
          <MemberRow key={m.id} member={m} onClick={() => onSelect(m)} />
        ))}
      </div>
    </PanelShell>
  );
}

function MemberRow({ member, onClick }: { member: Member; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid var(--color-border)",
        backgroundColor: hov ? "var(--color-dimmed-bg)" : "transparent",
        cursor: "pointer",
        minHeight: 44,
        display: "flex",
        alignItems: "center",
        gap: 12,
        transition: "background-color 100ms",
      }}
    >
      <Avatar user={member} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)", margin: 0, fontFamily: "var(--font-roboto)" }}>
          {member.name}
        </p>
        {member.contextNote && (
          <p style={{ fontSize: 11, color: "var(--color-secondary)", margin: "2px 0 0" }}>
            {member.contextNote}
          </p>
        )}
      </div>
      <ChevronRight size={14} color="var(--color-secondary)" />
    </button>
  );
}

// ── Time proposal helpers ─────────────────────────────────────────────────────

const HOUR_START = 9; // grid starts at 9:00 AM
const SLOT_COUNT = 16; // 16 slots, 30-min each → 9:00 AM – 4:30 PM

interface SuggestedSlot {
  date: string;       // YYYY-MM-DD
  startMin: number;   // minutes from midnight
  shortLabel: string; // e.g. "Thu Aug 28, 2:00 PM"
  mechanism: "proposed"; // no "immediate" since no office_hours distinction
}

function minToLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

const MONTH_ABR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_ABR   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function findRecipientSlots(recipientSlotSet: Set<string>): SuggestedSlot[] {
  const results: SuggestedSlot[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 1; offset <= 14 && results.length < 3; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    const jsDay = d.getDay(); // 0=Sun, 6=Sat
    if (jsDay === 0 || jsDay === 6) continue;
    const gridDay = jsDay - 1; // 0=Mon

    for (let s = 0; s < SLOT_COUNT && results.length < 3; s++) {
      if (!recipientSlotSet.has(`${gridDay}-${s}`)) continue;
      const startMin = HOUR_START * 60 + s * 30;
      const dateStr = d.toISOString().split("T")[0];
      results.push({
        date: dateStr,
        startMin,
        shortLabel: `${DAY_ABR[jsDay]} ${MONTH_ABR[d.getMonth()]} ${d.getDate()}, ${minToLabel(startMin)}`,
        mechanism: "proposed",
      });
      break; // one slot per day
    }
  }
  return results;
}

function viewerTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "local time"; }
}

function slotAppendLine(slot: SuggestedSlot, recipientName: string): string {
  return `\n\nI was thinking: ${slot.shortLabel} (proposed -- ${recipientName} to confirm).`;
}

// ── Requester-picks fallback ──────────────────────────────────────────────────

function RequesterTimePicker({ onSelect }: { onSelect: (line: string) => void }) {
  const TIMES = ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM",
                 "12:00 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
                 "3:00 PM", "3:30 PM", "4:00 PM"];
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i + 1);
    if (d.getDay() === 0 || d.getDay() === 6) return null;
    return { date: d, label: `${DAY_ABR[d.getDay()]} ${MONTH_ABR[d.getMonth()]} ${d.getDate()}` };
  }).filter(Boolean) as { date: Date; label: string }[];

  const [selected, setSelected] = useState<string[]>([]);
  const [day, setDay] = useState(days[0]?.label ?? "");

  function toggle(key: string) {
    setSelected((s) => {
      if (s.includes(key)) return s.filter((x) => x !== key);
      if (s.length >= 3) return s;
      return [...s, key];
    });
  }

  function confirm() {
    if (selected.length === 0) return;
    const line = `\n\nI'm free: ${selected.join(", ")}.`;
    onSelect(line);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="flex gap-2 mb-2 flex-wrap">
        {days.map((d) => (
          <button key={d.label} onClick={() => setDay(d.label)}
            style={{
              fontSize: 11, padding: "4px 10px", borderRadius: 20, minHeight: 44,
              border: `1px solid ${day === d.label ? "var(--color-navy)" : "var(--color-border)"}`,
              backgroundColor: day === d.label ? "var(--color-navy)" : "transparent",
              color: day === d.label ? "#fff" : "var(--color-body)",
              cursor: "pointer", fontFamily: "var(--font-roboto)",
            }}>
            {d.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {TIMES.map((t) => {
          const key = `${day} ${t}`;
          const on = selected.includes(key);
          return (
            <button key={t} onClick={() => toggle(key)}
              style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 6, minHeight: 44,
                border: `1px solid ${on ? "var(--color-navy)" : "var(--color-border)"}`,
                backgroundColor: on ? "rgba(27,46,75,0.08)" : "transparent",
                color: "var(--color-body)", cursor: "pointer", fontFamily: "var(--font-roboto)",
              }}>
              {t}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-col gap-1 mb-2">
          {selected.map((s) => (
            <div key={s} style={{ fontSize: 12, color: "var(--color-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
              <Check size={11} color="var(--color-success)" />
              {s}
            </div>
          ))}
        </div>
      )}
      <button
        onClick={confirm}
        disabled={selected.length === 0}
        style={{
          fontSize: 12, fontWeight: 600, color: selected.length ? "var(--color-navy)" : "var(--color-secondary)",
          background: "transparent", border: `1px solid ${selected.length ? "var(--color-navy)" : "var(--color-border)"}`,
          borderRadius: 7, padding: "6px 14px", cursor: selected.length ? "pointer" : "default",
          fontFamily: "var(--font-roboto)", minHeight: 44,
        }}
      >
        Add to message
      </button>
    </div>
  );
}

// ── Voice-enabled textarea ────────────────────────────────────────────────────

interface ISpeechRecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface ISpeechRecognitionResultList { length: number; [i: number]: ISpeechRecognitionResult }
interface ISpeechRecognitionEvent { resultIndex: number; results: ISpeechRecognitionResultList }
interface ISpeechRecognitionErrorEvent { error: string }
interface ISpeechRecognition {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: ISpeechRecognitionErrorEvent) => void) | null;
}
interface ISpeechRecognitionWindow {
  SpeechRecognition?: new () => ISpeechRecognition;
  webkitSpeechRecognition?: new () => ISpeechRecognition;
}

function VoiceDraftTextarea({ value, onChange, rows = 8, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const [hasMic, setHasMic] = useState<boolean | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const baseRef = useRef("");
  const sessionRef = useRef("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const w = window as unknown as ISpeechRecognitionWindow;
    setHasMic(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => { recognitionRef.current?.stop(); };
  }, []);

  function start() {
    const w = window as unknown as ISpeechRecognitionWindow;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    baseRef.current = value;
    sessionRef.current = "";

    r.onresult = (e: ISpeechRecognitionEvent) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) sessionRef.current += e.results[i][0].transcript + " ";
      }
      const base = baseRef.current;
      const t = sessionRef.current.trimEnd();
      onChange((base + (base && t ? " " : "") + t).trimStart());
    };

    r.onend = () => setRecording(false);
    r.onerror = (e: ISpeechRecognitionErrorEvent) => {
      if (e.error === "not-allowed") setMicDenied(true);
      setRecording(false);
    };

    recognitionRef.current = r;
    try { r.start(); setRecording(true); } catch { /* ignore */ }
  }

  function stop() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
  }

  const showMic = hasMic === true && !micDenied;

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: `10px ${showMic ? 40 : 12}px 10px 12px`,
          fontSize: 13,
          fontFamily: "var(--font-roboto)",
          lineHeight: 1.6,
          backgroundColor: "var(--color-canvas)",
          border: "1px solid var(--color-border)",
          borderRadius: 8,
          color: "var(--color-body)",
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      {showMic && (
        <button
          onClick={recording ? stop : start}
          aria-label={recording ? "Stop recording" : "Voice input"}
          style={{
            position: "absolute", bottom: 8, right: 8,
            width: 28, height: 28,
            backgroundColor: recording ? "var(--color-error)" : "transparent",
            border: `1px solid ${recording ? "var(--color-error)" : "var(--color-border)"}`,
            borderRadius: 6, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: recording ? "#fff" : "var(--color-secondary)",
          }}
        >
          {recording ? <MicOff size={13} /> : <Mic size={13} />}
        </button>
      )}
      {recording && (
        <p style={{ fontSize: 11, color: "var(--color-error)", marginTop: 4 }}>Recording</p>
      )}
      {micDenied && (
        <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 4 }}>
          Microphone access is off in your browser settings.
        </p>
      )}
    </div>
  );
}

// ── Screen: A3,Draft ────────────────────────────────────────────────────────

function A3Screen({ helpType, recipient, tasks, hasTodayJournal, projectId, userId, onBack, onClose, onPreview }: {
  helpType: HelpType;
  recipient: Member;
  tasks: Task[];
  hasTodayJournal: boolean;
  projectId: string | null;
  userId: string;
  onBack: () => void;
  onClose: () => void;
  onPreview: (body: string, includeJournal: boolean) => void;
}) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(tasks[0] ?? null);
  const [body, setBody] = useState(() =>
    helpType === "not_sure" || helpType === "try_self"
      ? ""
      : draftBody(helpType, recipient.name, tasks[0]?.title ?? null)
  );
  const [includeJournal, setIncludeJournal] = useState(false);
  const [chips, setChips] = useState<string[]>([]);

  // Time proposals — all flows
  const [showMeetingPicker, setShowMeetingPicker] = useState(false);
  const [recipientSlots, setRecipientSlots] = useState<SuggestedSlot[]>([]);
  const [noAvailData, setNoAvailData] = useState(false);
  const [showRequesterPicker, setShowRequesterPicker] = useState(false);
  const [pickedSlots, setPickedSlots] = useState<SuggestedSlot[]>([]);
  const tz = viewerTimezone();

  useEffect(() => {
    if (!showMeetingPicker || !projectId || !isSupabaseConfigured) return;
    supabase
      .from("user_availability")
      .select("slots")
      .eq("user_id", recipient.id)
      .eq("project_id", projectId)
      .then(({ data }) => {
        const allSlots = (data ?? []).flatMap((row: Record<string, unknown>) => row["slots"] as string[] ?? []);
        const slotSet = new Set(allSlots);
        if (slotSet.size === 0) {
          setNoAvailData(true);
        } else {
          setRecipientSlots(findRecipientSlots(slotSet));
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMeetingPicker, projectId, recipient.id]);

  const availableChips = [
    selectedTask
      ? `This task has been open ${Math.round((Date.now() - new Date(selectedTask.updated_at).getTime()) / 86400000)} days.`
      : null,
    selectedTask ? `Last updated ${new Date(selectedTask.updated_at).toLocaleDateString("en-US", { day: "numeric", month: "long" })}.` : null,
  ].filter(Boolean) as string[];

  function addChip(chip: string) {
    if (chips.includes(chip)) return;
    setChips((c) => [...c, chip]);
    setBody((b) => b + (b.trim() ? "\n\n" : "") + chip);
  }

  function updateTaskInBody(task: Task | null) {
    setSelectedTask(task);
    if (helpType !== "not_sure" && helpType !== "try_self") {
      setBody(draftBody(helpType, recipient.name, task?.title ?? null));
    }
  }

  return (
    <PanelShell title={`Message ${recipient.name}`} onBack={onBack} onClose={onClose}>
      <div className="flex items-center gap-3 mb-4">
        <Avatar user={recipient} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-body)", margin: 0, fontFamily: "var(--font-roboto)" }}>
            {recipient.name}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {recipient.contextNote && (
              <p style={{ fontSize: 11, color: "var(--color-secondary)", margin: 0 }}>{recipient.contextNote}</p>
            )}
            <button onClick={onBack} style={{ fontSize: 11, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "var(--font-roboto)" }}>
              Change
            </button>
          </div>
        </div>
      </div>

      {helpType !== "not_sure" && helpType !== "try_self" && tasks.length > 0 && (
        <div className="mb-3">
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--color-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
            Regarding task
          </label>
          <select
            value={selectedTask?.id ?? ""}
            onChange={(e) => updateTaskInBody(tasks.find((t) => t.id === e.target.value) ?? null)}
            style={{
              width: "100%", height: 36, padding: "0 8px", fontSize: 13,
              backgroundColor: "var(--color-canvas)", border: "1px solid var(--color-border)",
              borderRadius: 6, color: "var(--color-body)", fontFamily: "var(--font-roboto)", cursor: "pointer",
            }}
          >
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
      )}

      <p style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 6 }}>
        Here&rsquo;s a draft. Change anything before you send it.
      </p>

      <VoiceDraftTextarea
        value={body}
        onChange={setBody}
        rows={helpType === "not_sure" || helpType === "try_self" ? 6 : 10}
        placeholder={helpType === "not_sure" || helpType === "try_self" ? "Say as much or as little as you want." : undefined}
      />

      {availableChips.length > 0 && (
        <div className="mt-3">
          <p style={{ fontSize: 11, color: "var(--color-secondary)", marginBottom: 6 }}>Add context (optional):</p>
          <div className="flex flex-wrap gap-2">
            {availableChips.map((chip) => (
              <button
                key={chip}
                onClick={() => addChip(chip)}
                disabled={chips.includes(chip)}
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 20,
                  border: "1px solid var(--color-border)",
                  backgroundColor: chips.includes(chip) ? "var(--color-dimmed-bg)" : "transparent",
                  color: chips.includes(chip) ? "var(--color-secondary)" : "var(--color-body)",
                  cursor: chips.includes(chip) ? "default" : "pointer",
                  fontFamily: "var(--font-roboto)",
                  minHeight: 44,
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasTodayJournal && (
        <label className="flex items-start gap-2 mt-3" style={{ cursor: "pointer", minHeight: 44, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={includeJournal}
            onChange={(e) => setIncludeJournal(e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0, width: 16, height: 16 }}
          />
          <span style={{ fontSize: 13, color: "var(--color-body)", lineHeight: 1.5 }}>
            Include my journal note from today
          </span>
        </label>
      )}

      {/* Meeting time suggestion — available in all flows */}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => setShowMeetingPicker((v) => !v)}
          style={{
            fontSize: 12, color: "var(--color-secondary)",
            background: "transparent", border: "1px solid var(--color-border)",
            borderRadius: 6, padding: "5px 10px", cursor: "pointer",
            fontFamily: "var(--font-roboto)", display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <Calendar size={12} />
          {showMeetingPicker ? "Hide time picker" : "Suggest a time to meet"}
        </button>
      </div>

      {showMeetingPicker && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
          {!noAvailData && recipientSlots.length > 0 && (
            <>
              <p style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 8 }}>
                {firstName(recipient.name)}&rsquo;s available times (select up to 3):
              </p>
              <div className="flex flex-col gap-2 mb-3">
                {recipientSlots.map((slot) => {
                  const picked = pickedSlots.some(s => s.date === slot.date && s.startMin === slot.startMin);
                  return (
                    <button
                      key={`${slot.date}-${slot.startMin}`}
                      onClick={() => {
                        setPickedSlots(prev => {
                          if (picked) return prev.filter(s => !(s.date === slot.date && s.startMin === slot.startMin));
                          if (prev.length >= 3) return prev;
                          return [...prev, slot];
                        });
                      }}
                      style={{
                        width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8,
                        border: `1px solid ${picked ? "var(--color-navy)" : "var(--color-border)"}`,
                        backgroundColor: picked ? "rgba(27,46,75,0.06)" : "transparent",
                        cursor: "pointer", minHeight: 44, display: "flex", justifyContent: "space-between", alignItems: "center",
                        fontFamily: "var(--font-roboto)",
                      }}
                    >
                      <span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)" }}>{slot.shortLabel}</span>
                        <span style={{ fontSize: 11, color: "var(--color-secondary)", marginLeft: 8 }}>Proposed, {firstName(recipient.name)} confirms</span>
                      </span>
                      {picked && <Check size={13} color="var(--color-navy)" />}
                    </button>
                  );
                })}
              </div>
              {pickedSlots.length > 0 && (
                <button
                  onClick={() => {
                    const line = `\n\nWould any of these work? ${pickedSlots.map(s => s.shortLabel).join(", ")}.`;
                    setBody(b => b + line);
                    setPickedSlots([]);
                    setShowMeetingPicker(false);
                  }}
                  style={{
                    fontSize: 12, fontWeight: 600, color: "var(--color-navy)",
                    background: "transparent", border: "1px solid var(--color-navy)",
                    borderRadius: 7, padding: "6px 14px", cursor: "pointer",
                    fontFamily: "var(--font-roboto)", minHeight: 44, marginBottom: 8,
                  }}
                >
                  Add {pickedSlots.length} time{pickedSlots.length > 1 ? "s" : ""} to message
                </button>
              )}
              <button
                onClick={() => setShowRequesterPicker(v => !v)}
                style={{ fontSize: 12, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "var(--font-roboto)" }}
              >
                {showRequesterPicker ? "Hide manual picker" : "Choose different times"}
              </button>
            </>
          )}

          {(noAvailData || recipientSlots.length === 0 || showRequesterPicker) && (
            <div style={{ marginTop: noAvailData ? 0 : 8 }}>
              {noAvailData && (
                <p style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 8 }}>
                  Pick up to three times and they&rsquo;ll be added to your message.
                </p>
              )}
              <RequesterTimePicker onSelect={(line) => { setBody(b => b + line); setShowMeetingPicker(false); }} />
            </div>
          )}

          <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 8 }}>
            Times shown in {tz}.
          </p>
        </div>
      )}

      <button
        onClick={() => onPreview(body, includeJournal)}
        disabled={!body.trim()}
        style={{
          marginTop: 16,
          width: "100%",
          height: 44,
          backgroundColor: body.trim() ? "var(--color-navy)" : "var(--color-dimmed-bg)",
          color: body.trim() ? "#fff" : "var(--color-secondary)",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: body.trim() ? "pointer" : "default",
          fontFamily: "var(--font-roboto)",
        }}
      >
        Preview message
      </button>
    </PanelShell>
  );
}

// ── Screen: A4,Preview + Send ───────────────────────────────────────────────

function A4Screen({ helpType, recipient, body, includeJournal, todayJournalText, projectId, userId, onBack, onClose, onSent }: {
  helpType: HelpType;
  recipient: Member;
  body: string;
  includeJournal: boolean;
  todayJournalText?: string;
  projectId: string | null;
  userId: string;
  onBack: () => void;
  onClose: () => void;
  onSent: (msgId: string) => void;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const fullBody = includeJournal && todayJournalText
    ? `${body}\n\n--- Journal note from today ---\n${todayJournalText}`
    : body;

  async function send() {
    setSending(true);
    setError("");
    const msgId = crypto.randomUUID();
    const channel = dmChannelKey(userId, recipient.id);
    try {
      if (isSupabaseConfigured && projectId) {
        const { error: err } = await supabase.from("chat_messages").insert({
          id: msgId,
          channel,
          sender_id: userId,
          content: fullBody,
          thread_parent_id: null,
          mentioned_user_ids: [],
          attachments: [],
        });
        if (err) throw err;
      }
      onSent(msgId);
    } catch {
      setError("Something went wrong. One option is to copy the message and send it manually.");
      setSending(false);
    }
  }

  const isScheduleOption = helpType === "feedback";

  function openCalendar() {
    const title = encodeURIComponent(`Feedback session with ${recipient.name}`);
    const details = encodeURIComponent(body);
    window.open(`https://calendar.google.com/calendar/r/eventedit?text=${title}&details=${details}`, "_blank", "noopener");
  }

  return (
    <PanelShell title="Preview" onBack={onBack} onClose={onClose}>
      <div className="flex items-center gap-3 mb-4">
        <Avatar user={recipient} size={36} />
        <div>
          <p style={{ fontSize: 12, color: "var(--color-secondary)", margin: 0 }}>To</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-body)", margin: 0, fontFamily: "var(--font-roboto)" }}>
            {recipient.name}
          </p>
        </div>
      </div>

      <div style={{
        padding: "14px 16px",
        backgroundColor: "var(--color-canvas)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        fontSize: 13,
        color: "var(--color-body)",
        lineHeight: 1.7,
        whiteSpace: "pre-wrap",
        marginBottom: 12,
        fontFamily: "var(--font-roboto)",
      }}>
        {fullBody || <span style={{ color: "var(--color-secondary)" }}>(empty message)</span>}
      </div>

      {error && (
        <p style={{ fontSize: 12, color: "var(--color-error)", marginBottom: 10 }}>{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={send}
          disabled={sending || !fullBody.trim()}
          style={{
            flex: 1, height: 44,
            backgroundColor: "var(--color-navy)", color: "#fff",
            border: "none", borderRadius: 8,
            fontSize: 14, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            opacity: sending ? 0.7 : 1,
            fontFamily: "var(--font-roboto)",
          }}
        >
          <Send size={14} />
          {sending ? "Sending..." : "Send"}
        </button>
        {isScheduleOption && (
          <button
            onClick={openCalendar}
            style={{
              height: 44, padding: "0 16px",
              backgroundColor: "transparent", color: "var(--color-navy)",
              border: "1px solid var(--color-border)", borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "var(--font-roboto)",
            }}
          >
            Book a meeting
          </button>
        )}
      </div>
    </PanelShell>
  );
}

// ── Screen: A Sent ────────────────────────────────────────────────────────────

function ASentScreen({ recipientName, msgId, onClose, onDone }: {
  recipientName: string;
  msgId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [undone, setUndone] = useState(false);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (countdown <= 0 || undone) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, undone]);

  async function undo() {
    setUndone(true);
    if (isSupabaseConfigured) {
      await supabase.from("chat_messages").delete().eq("id", msgId);
    }
    onDone();
  }

  return (
    <PanelShell title="Sent" onClose={onClose}>
      <div className="flex flex-col items-center" style={{ paddingTop: 40, textAlign: "center", gap: 16 }}>
        <div style={{
          width: 56, height: 56,
          backgroundColor: "var(--color-success-bg)",
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Check size={24} color="var(--color-success)" />
        </div>
        <p style={{ fontSize: 16, fontWeight: 600, color: "var(--color-body)", margin: 0, fontFamily: "var(--font-roboto)" }}>
          Sent to {recipientName}.
        </p>
        {!undone && countdown > 0 && (
          <button
            onClick={undo}
            style={{
              fontSize: 13, color: "var(--color-secondary)", background: "transparent",
              border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              minHeight: 44, padding: "0 12px",
            }}
          >
            <Undo2 size={13} />
            Undo ({countdown}s)
          </button>
        )}
        <button
          onClick={onDone}
          style={{
            marginTop: 8, fontSize: 13, color: "var(--color-navy)",
            background: "transparent", border: "none", cursor: "pointer",
            minHeight: 44, fontFamily: "var(--font-roboto)",
          }}
        >
          Back to support options
        </button>
      </div>
    </PanelShell>
  );
}

// ── Screen: A Not Sure,2 questions ─────────────────────────────────────────

const NOT_SURE_Q1_OPTIONS = ["Research direction", "A task I'm working on", "Technical problem", "Something else"];
const NOT_SURE_Q2_OPTIONS = ["As soon as possible", "This week", "No particular rush"];

function ANotSureScreen({ step, ans1, members, onBack, onClose, onResult, onAdvance }: {
  step: 1 | 2;
  ans1: string;
  members: Member[];
  onBack: () => void;
  onClose: () => void;
  onResult: (m: Member, reason: string) => void;
  onAdvance: (ans1: string) => void;
}) {
  function pick(answer: string) {
    if (step === 1) { onAdvance(answer); return; }
    const isUrgent = answer === "As soon as possible";
    const pi = members.find((m) => m.role.toLowerCase() === "pi");
    const researcher = members.find((m) => m.role === "researcher");
    const suggestion = isUrgent && pi ? pi : (pi ?? researcher ?? members[0]);
    if (!suggestion) return;
    const reason = suggestion.role === "pi"
      ? `${suggestion.name} -- ${isUrgent ? "as PI they can help most quickly" : "best placed to help with the direction"}`
      : `${suggestion.name} -- ${isUrgent ? "a quick question to a collaborator is a good first step" : "someone who knows the project context"}`;
    onResult(suggestion, reason);
  }

  const question = step === 1 ? "What area is this related to?" : "How quickly do you need help?";
  const options = step === 1 ? NOT_SURE_Q1_OPTIONS : NOT_SURE_Q2_OPTIONS;

  return (
    <PanelShell title="Find someone to ask" onBack={onBack} onClose={onClose}>
      <p style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 16 }}>
        Question {step} of 2
      </p>
      <h2 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 18, color: "var(--color-navy)", margin: "0 0 16px" }}>
        {question}
      </h2>
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => pick(opt)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "12px 14px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              backgroundColor: "transparent",
              cursor: "pointer",
              fontSize: 14,
              color: "var(--color-body)",
              minHeight: 44,
              fontFamily: "var(--font-roboto)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-dimmed-bg)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
          >
            {opt}
          </button>
        ))}
      </div>
    </PanelShell>
  );
}

function ANotSureResultScreen({ suggestion, reason, onBack, onClose, onMessage }: {
  suggestion: Member;
  reason: string;
  onBack: () => void;
  onClose: () => void;
  onMessage: () => void;
}) {
  return (
    <PanelShell title="A suggestion" onBack={onBack} onClose={onClose}>
      <div className="flex items-center gap-3 mb-4">
        <Avatar user={suggestion} size={48} />
        <div>
          <p style={{ fontSize: 16, fontWeight: 600, color: "var(--color-body)", margin: 0, fontFamily: "var(--font-roboto)" }}>
            {suggestion.name}
          </p>
          <p style={{ fontSize: 13, color: "var(--color-secondary)", margin: "3px 0 0", lineHeight: 1.5 }}>{reason}</p>
        </div>
      </div>
      <button
        onClick={onMessage}
        style={{
          width: "100%", height: 44,
          backgroundColor: "var(--color-navy)", color: "#fff",
          border: "none", borderRadius: 8,
          fontSize: 14, fontWeight: 600, cursor: "pointer",
          fontFamily: "var(--font-roboto)",
        }}
      >
        Draft a message to {suggestion.name}
      </button>
    </PanelShell>
  );
}

// ── Screen: A Try Self ────────────────────────────────────────────────────────

const REMINDER_OPTIONS = [
  { label: "Check back in 2 hours", hours: 2 },
  { label: "Tomorrow morning", hours: 20 },
  { label: "No reminder", hours: 0 },
];

function ATrySelfScreen({ bookmarks, literature, userId, projectId, onBack, onClose }: {
  bookmarks: Bookmark[];
  literature: LitItem[];
  userId: string;
  projectId: string | null;
  onBack: () => void;
  onClose: () => void;
}) {
  const [reminderSet, setReminderSet] = useState(false);

  async function setReminder(hours: number) {
    if (hours === 0 || reminderSet) { onClose(); return; }
    const due = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    if (isSupabaseConfigured && projectId) {
      await supabase.from("reminders").insert({
        user_id: userId,
        project_id: projectId,
        scope: "personal",
        title: "Check back on your question",
        due_at: due,
      });
    }
    setReminderSet(true);
  }

  return (
    <PanelShell title="Working it out" onBack={onBack} onClose={onClose}>
      {bookmarks.length > 0 && (
        <section className="mb-5">
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-secondary)", marginBottom: 8 }}>
            Bookmarks in this project
          </p>
          <div className="flex flex-col gap-1.5">
            {bookmarks.map((bm) => (
              <a key={bm.id} href={bm.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13, color: "var(--color-navy)", display: "flex", alignItems: "center", gap: 8, padding: "6px 0", minHeight: 44, textDecoration: "none" }}>
                <BookOpen size={13} color="var(--color-secondary)" style={{ flexShrink: 0 }} />
                <span style={{ textDecoration: "underline" }}>{bm.title}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {literature.length > 0 && (
        <section className="mb-5">
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-secondary)", marginBottom: 8 }}>
            Literature in this project
          </p>
          <div className="flex flex-col gap-1.5">
            {literature.map((li) => (
              <div key={li.id} style={{ fontSize: 13, color: "var(--color-body)", padding: "6px 0", display: "flex", alignItems: "start", gap: 8, minHeight: 44 }}>
                <Library size={13} color="var(--color-secondary)" style={{ flexShrink: 0, marginTop: 3 }} />
                <span>
                  <span style={{ fontWeight: 600 }}>{li.title}</span>
                  {li.authors.length > 0 && (
                    <span style={{ color: "var(--color-secondary)" }}> &mdash; {li.authors[0]}{li.year ? `, ${li.year}` : ""}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {bookmarks.length === 0 && literature.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--color-secondary)", marginBottom: 20 }}>
          No bookmarks or literature in this project yet.
        </p>
      )}

      <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 16, marginTop: 4 }}>
        {reminderSet ? (
          <p style={{ fontSize: 13, color: "var(--color-success)", display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={14} /> Reminder set.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--color-secondary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Clock size={13} /> Want a reminder to check back?
            </p>
            <div className="flex flex-col gap-2">
              {REMINDER_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setReminder(opt.hours)}
                  style={{
                    width: "100%", textAlign: "left", padding: "10px 14px", borderRadius: 7,
                    border: "1px solid var(--color-border)", backgroundColor: "transparent",
                    cursor: "pointer", fontSize: 13, color: "var(--color-body)", minHeight: 44,
                    fontFamily: "var(--font-roboto)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-dimmed-bg)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </PanelShell>
  );
}

// ── Screen: B Pick — recipient selection from Track B ────────────────────────

function BPickScreen({ filter, members, pi, onBack, onClose, onSelect }: {
  filter: "pi" | "all";
  members: Member[];
  pi: Member | undefined;
  onBack: () => void;
  onClose: () => void;
  onSelect: (m: Member) => void;
}) {
  const candidates = filter === "pi"
    ? (pi ? [pi] : members.filter(m => m.role.toLowerCase() === "pi"))
    : members;

  return (
    <PanelShell title="Who can help?" onBack={onBack} onClose={onClose}>
      {candidates.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>
          {filter === "pi" ? "No PI found in this lab." : "No team members found."}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {candidates.map((m) => (
          <MemberRow key={m.id} member={m} onClick={() => onSelect(m)} />
        ))}
      </div>
    </PanelShell>
  );
}

// ── Screen: B,Support resources ─────────────────────────────────────────────
// Track B: no analytics, no logging, no INSERT/UPDATE triggered by viewing this screen.

function BScreen({ resources, loading, pi, members, isCurrentUserPi, projectId, onBack, onClose, onPickRecipient }: {
  resources: SupportResource[];
  loading: boolean;
  pi: Member | undefined;
  members: Member[];
  isCurrentUserPi: boolean;
  projectId: string | null;
  onBack?: () => void;
  onClose: () => void;
  onPickRecipient: (filter: "pi" | "all") => void;
}) {
  const activeUrgent = resources.filter((r) => r.active && (r.category === "urgent" || r.is_pinned));
  const rest = resources.filter((r) => r.active && r.category !== "urgent" && !r.is_pinned);

  // Always show a crisis path. If the lab has no urgent row, inject the build-time default.
  // A lab row overrides the default; an empty lab cannot produce a panel with no crisis path.
  const crisisDefault = getCrisisDefault("US");
  const urgentToRender: (SupportResource | CrisisDefault)[] =
    activeUrgent.length > 0 ? activeUrgent : [crisisDefault];

  const grouped: Record<string, SupportResource[]> = {};
  for (const r of rest) {
    (grouped[r.category] ??= []).push(r);
  }

  const CATEGORY_LABELS: Record<string, string> = {
    counseling: "Counseling",
    academic: "Academic support",
    workplace: "Workplace",
    health: "Health",
    other: "Other resources",
  };

  const teammates = members.filter((m) => m.role.toLowerCase() !== "pi");

  if (process.env.NODE_ENV === "development" && !pi && members.length > 0) {
    console.warn("[SupportPanel] No PI found in lab members. Roles present:", members.map(m => m.role));
  }

  return (
    <PanelShell title="Support resources" onBack={onBack} onClose={onClose}>
      <div className="flex items-center gap-2 mb-4" style={{ color: "var(--color-secondary)" }}>
        <Lock size={13} />
        <span style={{ fontSize: 12, lineHeight: 1.5 }}>
          Nothing you open here is recorded or shared with your team.
        </span>
      </div>

      {loading && (
        <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>Loading...</p>
      )}

      {/* Crisis block -- always present */}
      <section className="mb-5">
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: "var(--color-error)", marginBottom: 8 }}>
          Urgent,always available
        </p>
        <div className="flex flex-col gap-2">
          {urgentToRender.map((r) => <ResourceRow key={r.id} r={r as SupportResource} isUrgent />)}
        </div>
      </section>

      {Object.entries(grouped).map(([cat, rows]) => (
        <section key={cat} className="mb-5">
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-secondary)", marginBottom: 8 }}>
            {CATEGORY_LABELS[cat] ?? cat}
          </p>
          <div className="flex flex-col gap-2">
            {rows.map((r) => <ResourceRow key={r.id} r={r} />)}
          </div>
        </section>
      ))}

      {!loading && rest.length === 0 && isCurrentUserPi && (
        <p style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 16 }}>
          <a href="/team" style={{ color: "var(--color-navy)", fontWeight: 600 }}>Add counseling and support contacts</a>
          {" "}for your lab.
        </p>
      )}

      <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 16, marginTop: 8 }}>
        <p style={{ fontSize: 13, color: "var(--color-secondary)", marginBottom: 10 }}>
          If you&rsquo;d rather talk to someone on the project
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onPickRecipient("pi")}
            style={{
              height: 44, padding: "0 16px",
              backgroundColor: "transparent",
              color: "var(--color-body)",
              border: "1px solid var(--color-border)", borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "var(--font-roboto)", textAlign: "left",
            }}
          >
            Message my PI
          </button>
          {members.length > 0 && (
            <button
              onClick={() => onPickRecipient("all")}
              style={{
                height: 44, padding: "0 16px",
                backgroundColor: "transparent",
                color: "var(--color-body)",
                border: "1px solid var(--color-border)", borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "var(--font-roboto)", textAlign: "left",
              }}
            >
              Message a teammate
            </button>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

function ResourceRow({ r, isUrgent }: { r: SupportResource; isUrgent?: boolean }) {
  const href = contactHref(r.contact_type, r.contact_value);
  const isLink = r.contact_type === "url";
  const isInPerson = r.contact_type === "in_person";

  const content = (
    <div style={{
      padding: "12px 14px",
      borderRadius: 8,
      border: `1px solid ${isUrgent ? "var(--color-error)" : "var(--color-border)"}`,
      backgroundColor: isUrgent ? "var(--color-error-bg)" : "var(--color-canvas)",
    }}>
      <div className="flex items-start gap-3">
        <span style={{ marginTop: 2, flexShrink: 0 }}>
          <ContactIcon type={r.contact_type} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-body)", margin: 0, fontFamily: "var(--font-roboto)" }}>
            {r.label}
          </p>
          {r.description && (
            <p style={{ fontSize: 12, color: "var(--color-secondary)", margin: "3px 0 0", lineHeight: 1.4 }}>
              {r.description}
            </p>
          )}
          {r.confidentiality && (
            <p style={{ fontSize: 11, color: "var(--color-secondary)", margin: "3px 0 0" }}>
              {r.confidentiality}
            </p>
          )}
          {r.availability && (
            <p style={{ fontSize: 11, color: "var(--color-secondary)", margin: "3px 0 0" }}>
              {r.availability}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  if (isInPerson || !href) return <div>{content}</div>;

  return (
    <a href={href} target={isLink ? "_blank" : undefined} rel={isLink ? "noopener noreferrer" : undefined}
      style={{ display: "block", textDecoration: "none", minHeight: 44 }}>
      {content}
    </a>
  );
}

// ── Screen: B Message,no pre-fill ───────────────────────────────────────────

function BMessageScreen({ recipient, projectId, userId, onBack, onClose, onSent }: {
  recipient: Member;
  projectId: string | null;
  userId: string;
  onBack: () => void;
  onClose: () => void;
  onSent: (msgId: string) => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    setError("");
    const msgId = crypto.randomUUID();
    const channel = dmChannelKey(userId, recipient.id);
    try {
      if (isSupabaseConfigured && projectId) {
        const { error: err } = await supabase.from("chat_messages").insert({
          id: msgId,
          channel,
          sender_id: userId,
          content: body,
          thread_parent_id: null,
          mentioned_user_ids: [],
          attachments: [],
        });
        if (err) throw err;
      }
      onSent(msgId);
    } catch {
      setError("Something went wrong. One option is to send this via Chat directly.");
      setSending(false);
    }
  }

  return (
    <PanelShell title={`Message ${firstName(recipient.name)}`} onBack={onBack} onClose={onClose}>
      <div className="flex items-center gap-3 mb-4">
        <Avatar user={recipient} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-body)", margin: 0, fontFamily: "var(--font-roboto)" }}>
            {recipient.name}
          </p>
          <button onClick={onBack} style={{ fontSize: 11, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "var(--font-roboto)" }}>
            Change
          </button>
        </div>
      </div>
      <VoiceDraftTextarea
        value={body}
        onChange={setBody}
        rows={8}
        placeholder="Say as much or as little as you want."
      />
      {error && <p style={{ fontSize: 12, color: "var(--color-error)", marginTop: 8 }}>{error}</p>}
      <button
        onClick={send}
        disabled={sending}
        style={{
          marginTop: 12, width: "100%", height: 44,
          backgroundColor: "var(--color-navy)",
          color: "#fff",
          border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
          cursor: sending ? "default" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          fontFamily: "var(--font-roboto)",
          opacity: sending ? 0.7 : 1,
        }}
      >
        <Send size={14} />
        {sending ? "Sending..." : "Send"}
      </button>
      {!body.trim() && !sending && (
        <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 6, textAlign: "center" }}>
          Write something above before sending.
        </p>
      )}
    </PanelShell>
  );
}
