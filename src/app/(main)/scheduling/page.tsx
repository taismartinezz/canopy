"use client";

import { useState, useEffect, useRef } from "react";
import {
  Calendar, Users, Send, Clock, Check, X, Plus,
  AlertCircle, Lock, Trash2,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { computeInitials } from "@/lib/utils";
import type {
  User, WeeklyAvailability, MeetingProposal, MeetingResponse,
  ScheduleEvent, MeetingResponseStatus,
} from "@/types";
import AvailabilityGrid from "@/components/scheduling/AvailabilityGrid";
import TeamOverlapView from "@/components/scheduling/TeamOverlapView";
import MeetingProposalModal from "@/components/scheduling/MeetingProposalModal";
import Avatar from "@/components/ui/Avatar";
import ClientOnly from "@/components/ui/ClientOnly";
import { CalendarPicker, TimePicker, formatDateLabel, formatTimeDisplay } from "@/components/ui/DateTimePicker";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatProposedDate(date: string, time: string): string {
  const d = new Date(`${date}T${time}`);
  return (
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const STATUS_COLORS: Record<MeetingResponseStatus, { bg: string; text: string }> = {
  pending:  { bg: "#FEF3C7", text: "#92400E" },
  accepted: { bg: "#D1FAE5", text: "#065F46" },
  declined: { bg: "#FEE2E2", text: "#991B1B" },
};

const STATUS_LABELS: Record<MeetingResponseStatus, string> = {
  pending:  "Pending",
  accepted: "Accepted",
  declined: "Declined",
};

// ── Shared primitives ─────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4"
      style={{ borderBottom: "1px solid var(--color-border)" }}
    >
      <h3
        style={{
          fontFamily: "var(--font-lora)",
          fontWeight: 600,
          fontSize: 15,
          color: "var(--color-navy)",
          margin: 0,
        }}
      >
        {title}
      </h3>
      {action}
    </div>
  );
}

function EmptyState({ icon: Icon, heading, body, action }: {
  icon: React.ElementType;
  heading: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-10 flex flex-col items-center text-center gap-2">
      <Icon size={32} style={{ color: "var(--color-border)" }} />
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-body)", margin: 0 }}>{heading}</p>
      {body && <p style={{ fontSize: 13, color: "var(--color-secondary)", margin: 0 }}>{body}</p>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

// ── Tab: My Availability ──────────────────────────────────────────────────────

function MyAvailabilityTab({
  savedSlots,
  onSave,
  googleConnected,
  onToggleGoogle,
}: {
  savedSlots: string[];
  onSave: (slots: string[]) => void;
  googleConnected: boolean;
  onToggleGoogle: () => void;
}) {
  const [slots, setSlots] = useState<string[]>(savedSlots);
  const [saved, setSaved] = useState(false);

  // Keep grid in sync if parent re-fetches (e.g. Supabase load completes)
  useEffect(() => { setSlots(savedSlots); }, [savedSlots]);

  function handleSave() {
    onSave(slots);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const hasChanges =
    JSON.stringify([...slots].sort()) !== JSON.stringify([...savedSlots].sort());

  return (
    <div className="space-y-5">
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-lg"
        style={{ backgroundColor: "rgba(27,46,75,0.05)", border: "1px solid rgba(27,46,75,0.10)" }}
      >
        <Lock size={14} style={{ marginTop: 2, color: "var(--color-navy)", flexShrink: 0 }} />
        <p style={{ fontSize: 13, color: "var(--color-body)", margin: 0, lineHeight: 1.5 }}>
          Your availability shows when you&apos;re generally free — not what you&apos;re doing.
          Team members see only the aggregate overlap, not your individual schedule details.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <Card>
          <SectionHeader
            title="My Weekly Availability"
            action={
              <div className="flex items-center gap-2">
                {saved && (
                  <span style={{ fontSize: 12, color: "var(--color-success)", fontWeight: 600 }}>
                    ✓ Saved
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={!hasChanges}
                  style={{
                    backgroundColor: hasChanges ? "var(--color-navy)" : "transparent",
                    color: hasChanges ? "#fff" : "var(--color-secondary)",
                    border: hasChanges ? "none" : "1px solid var(--color-border)",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "6px 14px",
                    cursor: hasChanges ? "pointer" : "not-allowed",
                    fontFamily: "var(--font-roboto)",
                  }}
                >
                  Save Changes
                </button>
              </div>
            }
          />
          <div className="p-5">
            <AvailabilityGrid slots={slots} onChange={setSlots} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionHeader title="Google Calendar Sync" />
            <div className="px-5 py-4 space-y-3">
              <div
                className="flex items-start gap-2 p-3 rounded-lg"
                style={{
                  backgroundColor: googleConnected ? "rgba(46,125,82,0.07)" : "rgba(27,46,75,0.04)",
                  border: "1px solid",
                  borderColor: googleConnected ? "rgba(46,125,82,0.25)" : "var(--color-border)",
                }}
              >
                {googleConnected ? (
                  <Check size={14} style={{ color: "var(--color-success)", marginTop: 2, flexShrink: 0 }} />
                ) : (
                  <AlertCircle size={14} style={{ color: "var(--color-secondary)", marginTop: 2, flexShrink: 0 }} />
                )}
                <p style={{ fontSize: 12, color: "var(--color-body)", margin: 0, lineHeight: 1.5 }}>
                  {googleConnected
                    ? "Connected — your free/busy status syncs automatically. No event titles or details are visible to anyone."
                    : "Not connected. Connect to sync your free/busy status automatically instead of filling the grid manually."}
                </p>
              </div>

              <button
                onClick={onToggleGoogle}
                className="w-full flex items-center justify-center gap-2"
                style={{
                  height: 38,
                  border: "1px solid var(--color-border)",
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: googleConnected ? "transparent" : "var(--color-navy)",
                  color: googleConnected ? "var(--color-error)" : "#fff",
                  fontFamily: "var(--font-roboto)",
                }}
              >
                {googleConnected ? "Disconnect Calendar" : "Connect Google Calendar"}
              </button>

              <p style={{ fontSize: 11, color: "var(--color-secondary)", lineHeight: 1.5 }}>
                Only your free/busy status is used. Event titles, descriptions, and attendees
                are never read or shared with anyone.
              </p>
            </div>
          </Card>

          <Card>
            <div className="px-5 py-4">
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-secondary)", marginBottom: 8, letterSpacing: "0.04em" }}>
                AVAILABILITY SUMMARY
              </p>
              {slots.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>
                  No availability set yet. Click or drag cells on the grid to mark when you&apos;re free.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: "var(--color-body)", margin: 0 }}>
                    <span style={{ fontWeight: 700, color: "var(--color-navy)", fontSize: 20 }}>
                      {Math.round(slots.length * 0.5)}h
                    </span>{" "}
                    per week marked as available
                  </p>
                  <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 4 }}>
                    {slots.length} time slots × 30 min
                  </p>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Team Overlap ─────────────────────────────────────────────────────────

function TeamOverlapTab({
  availabilities,
  teamMembers,
  onProposeMeeting,
}: {
  availabilities: WeeklyAvailability[];
  teamMembers: User[];
  onProposeMeeting: () => void;
}) {
  if (teamMembers.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          heading="No team members yet"
          body="Invite collaborators to your lab to see availability overlap here."
        />
      </Card>
    );
  }

  const membersWithAvailability = availabilities.filter((a) =>
    teamMembers.some((m) => m.id === a.userId)
  );

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="Team Availability Overlap" />
        <div className="p-5">
          {membersWithAvailability.length === 0 ? (
            <div className="py-6 text-center">
              <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>
                No team members have set their availability yet. Ask everyone to fill in their grid.
              </p>
              <button
                onClick={onProposeMeeting}
                style={{
                  marginTop: 10,
                  backgroundColor: "var(--color-navy)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontFamily: "var(--font-roboto)",
                }}
              >
                + Propose Meeting Anyway
              </button>
            </div>
          ) : (
            <TeamOverlapView
              availabilities={membersWithAvailability}
              teamMembers={teamMembers}
              onProposeMeeting={onProposeMeeting}
            />
          )}
        </div>
      </Card>

      <Card>
        <SectionHeader title="Availability Status" />
        <div className="px-5 py-3 space-y-1">
          {teamMembers.map((member) => {
            const hasAvailability = availabilities.some((a) => a.userId === member.id);
            return (
              <div key={member.id} className="flex items-center gap-3 py-2">
                <Avatar user={member} size={26} />
                <span style={{ flex: 1, fontSize: 13, color: "var(--color-body)" }}>
                  {member.name}
                  {member.role === "pi" && (
                    <span style={{ fontSize: 10, marginLeft: 6, color: "var(--color-secondary)" }}>PI</span>
                  )}
                </span>
                {hasAvailability ? (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#065F46", backgroundColor: "#D1FAE5", borderRadius: 12, padding: "2px 8px" }}>
                    ✓ Set
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--color-secondary)", backgroundColor: "rgba(27,46,75,0.05)", borderRadius: 12, padding: "2px 8px" }}>
                    Not set
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ── Tab: Meetings ─────────────────────────────────────────────────────────────

function MeetingsTab({
  proposals,
  currentUserId,
  teamMembers,
  onRespond,
  onPropose,
}: {
  proposals: MeetingProposal[];
  currentUserId: string;
  teamMembers: User[];
  onRespond: (proposalId: string, status: "accepted" | "declined") => void;
  onPropose: () => void;
}) {
  const incoming = proposals.filter(
    (p) =>
      p.proposerId !== currentUserId &&
      p.inviteeIds.includes(currentUserId) &&
      (p.responses.find((r) => r.userId === currentUserId)?.status ?? "pending") === "pending"
  );
  const outgoing = proposals.filter((p) => p.proposerId === currentUserId);
  const responded = proposals.filter(
    (p) =>
      p.proposerId !== currentUserId &&
      p.inviteeIds.includes(currentUserId) &&
      (p.responses.find((r) => r.userId === currentUserId)?.status ?? "pending") !== "pending"
  );

  function getMember(id: string): User | undefined {
    return teamMembers.find((m) => m.id === id);
  }

  function MyResponseBadge({ proposal }: { proposal: MeetingProposal }) {
    const myResp = proposal.responses.find((r) => r.userId === currentUserId);
    const status = myResp?.status ?? "pending";
    const c = STATUS_COLORS[status];
    return (
      <span style={{ fontSize: 11, fontWeight: 600, color: c.text, backgroundColor: c.bg, borderRadius: 12, padding: "2px 8px" }}>
        {STATUS_LABELS[status]}
      </span>
    );
  }

  function ProposalCard({
    proposal,
    showActions,
    showResponses,
  }: {
    proposal: MeetingProposal;
    showActions?: boolean;
    showResponses?: boolean;
  }) {
    const proposer = getMember(proposal.proposerId);
    return (
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-body)", margin: 0 }}>
              {proposal.title}
            </p>
            {proposal.description && (
              <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 3 }}>
                {proposal.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="flex items-center gap-1" style={{ fontSize: 12, color: "var(--color-body)" }}>
                <Calendar size={11} style={{ color: "var(--color-navy)" }} />
                {formatProposedDate(proposal.proposedDate, proposal.proposedTime)}
              </span>
              <span className="flex items-center gap-1" style={{ fontSize: 12, color: "var(--color-secondary)" }}>
                <Clock size={11} />
                {formatDuration(proposal.durationMinutes)}
              </span>
              {proposer && (
                <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--color-secondary)" }}>
                  <Avatar user={proposer} size={14} />
                  {proposer.name.split(" ")[0]}
                </span>
              )}
            </div>
          </div>
          {!showActions && <MyResponseBadge proposal={proposal} />}
        </div>

        {showResponses && proposal.inviteeIds.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {proposal.inviteeIds.map((id) => {
              const u = getMember(id);
              const resp = proposal.responses.find((r) => r.userId === id);
              const status = resp?.status ?? "pending";
              const c = STATUS_COLORS[status];
              if (!u) return null;
              return (
                <div key={id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ backgroundColor: c.bg }}>
                  <Avatar user={u} size={16} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: c.text }}>
                    {u.name.split(" ")[0]}: {STATUS_LABELS[status]}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {showActions && (
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => onRespond(proposal.id, "accepted")}
              className="flex items-center gap-1.5"
              style={{ height: 32, paddingInline: 14, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-roboto)" }}
            >
              <Check size={12} /> Accept
            </button>
            <button
              onClick={() => onRespond(proposal.id, "declined")}
              className="flex items-center gap-1.5"
              style={{ height: 32, paddingInline: 14, backgroundColor: "transparent", color: "var(--color-error)", border: "1px solid var(--color-error)", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-roboto)" }}
            >
              <X size={12} /> Decline
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {incoming.length > 0 && (
        <Card>
          <SectionHeader title="Needs Your Response" />
          <div>{incoming.map((p) => <ProposalCard key={p.id} proposal={p} showActions />)}</div>
        </Card>
      )}

      <Card>
        <SectionHeader
          title="My Proposals"
          action={
            <button
              onClick={onPropose}
              className="flex items-center gap-1"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--color-navy)", background: "none", border: "none", cursor: "pointer" }}
            >
              <Plus size={13} /> Propose Meeting
            </button>
          }
        />
        {outgoing.length === 0 ? (
          <EmptyState
            icon={Send}
            heading="No meeting proposals yet"
            body="Click '+ Propose Meeting' to suggest a time to your lab members."
            action={
              <button
                onClick={onPropose}
                style={{ fontSize: 13, fontWeight: 600, color: "var(--color-navy)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Propose a meeting time
              </button>
            }
          />
        ) : (
          outgoing.map((p) => <ProposalCard key={p.id} proposal={p} showResponses />)
        )}
      </Card>

      {responded.length > 0 && (
        <Card>
          <SectionHeader title="Responded" />
          <div>{responded.map((p) => <ProposalCard key={p.id} proposal={p} />)}</div>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Events ───────────────────────────────────────────────────────────────

const evInputStyle: React.CSSProperties = {
  height: 36,
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  padding: "0 10px",
  fontSize: 13,
  fontFamily: "var(--font-roboto)",
  backgroundColor: "var(--color-canvas)",
  color: "var(--color-body)",
  outline: "none",
  boxSizing: "border-box",
};

function EventsTab({
  events,
  currentUserId,
  projectId,
  onAddEvent,
  onDeleteEvent,
}: {
  events: ScheduleEvent[];
  currentUserId: string;
  projectId: string;
  onAddEvent: (e: Omit<ScheduleEvent, "id">) => void;
  onDeleteEvent: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [scope, setScope] = useState<"lab" | "personal">("lab");
  const [error, setError] = useState("");
  const [showCal, setShowCal] = useState(false);
  const [calPos, setCalPos] = useState<{ top: number; left: number } | null>(null);
  const [showTP, setShowTP] = useState(false);
  const [tpPos, setTpPos] = useState<{ top: number; left: number } | null>(null);
  const dateBtnRef = useRef<HTMLButtonElement>(null);
  const timeBtnRef = useRef<HTMLButtonElement>(null);

  // Chronological, lab events + my personal events already filtered by parent
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  function handleAdd() {
    if (!title.trim()) { setError("Please enter a title."); return; }
    if (!date) { setError("Please select a date."); return; }
    setError("");
    onAddEvent({ projectId, title: title.trim(), date, time: time || undefined, scope, createdBy: currentUserId });
    setTitle(""); setDate(""); setTime(""); setScope("lab");
    setShowForm(false);
  }

  return (
    <Card>
      <SectionHeader
        title="Events"
        action={
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--color-navy)", background: "none", border: "none", cursor: "pointer" }}
          >
            <Plus size={13} /> Add event
          </button>
        }
      />

      {/* Inline form */}
      {showForm && (
        <div className="px-5 py-4 space-y-3 animate-fade-in" style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "rgba(27,46,75,0.02)" }}>
          {/* Lab / Personal toggle */}
          <div className="flex gap-1.5">
            {(["lab", "personal"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                style={{
                  height: 28,
                  paddingInline: 12,
                  borderRadius: 20,
                  border: "1.5px solid",
                  borderColor: scope === s ? "var(--color-navy)" : "var(--color-border)",
                  backgroundColor: scope === s ? "var(--color-navy)" : "transparent",
                  color: scope === s ? "#fff" : "var(--color-secondary)",
                  fontSize: 12,
                  fontWeight: scope === s ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: "var(--font-roboto)",
                }}
              >
                {s === "lab" ? "Lab (visible to all)" : "Personal (only me)"}
              </button>
            ))}
          </div>
          <input
            autoFocus
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(""); }}
            placeholder="Event title"
            style={{ ...evInputStyle, width: "100%" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
          />
          <div className="flex gap-2">
            <button
              ref={dateBtnRef}
              onClick={() => {
                if (!dateBtnRef.current) return;
                const r = dateBtnRef.current.getBoundingClientRect();
                setCalPos({ top: r.bottom + 6, left: r.left });
                setShowCal(v => !v); setShowTP(false); setError("");
              }}
              style={{ ...evInputStyle, flex: 1, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: date ? "var(--color-body)" : "var(--color-secondary)" }}
            >
              {date ? formatDateLabel(date) : "Date"}
            </button>
            <button
              ref={timeBtnRef}
              onClick={() => {
                if (!timeBtnRef.current) return;
                const r = timeBtnRef.current.getBoundingClientRect();
                setTpPos({ top: r.bottom + 6, left: r.left });
                setShowTP(v => !v); setShowCal(false);
              }}
              style={{ ...evInputStyle, width: 110, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: time ? "var(--color-body)" : "var(--color-secondary)" }}
            >
              {time ? formatTimeDisplay(time) : "+ time"}
            </button>
          </div>
          {showCal && calPos && (
            <CalendarPicker value={date || undefined} accentColor="#1B2E4B" pos={calPos}
              onSelect={d => { setDate(d); setShowCal(false); }}
              onClear={() => { setDate(""); setShowCal(false); }}
              onClose={() => setShowCal(false)} />
          )}
          {showTP && tpPos && (
            <TimePicker value={time || "09:00"} accentColor="#1B2E4B" pos={tpPos}
              onChange={t => setTime(t)}
              onClear={() => { setTime(""); setShowTP(false); }}
              onClose={() => setShowTP(false)} />
          )}
          {error && <p style={{ fontSize: 11, color: "var(--color-error)" }}>{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleAdd} style={{ height: 32, paddingInline: 16, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add</button>
            <button onClick={() => { setShowForm(false); setError(""); }} style={{ height: 32, paddingInline: 12, background: "none", border: "none", fontSize: 12, color: "var(--color-secondary)", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Event list */}
      {sorted.length === 0 ? (
        <EmptyState icon={Calendar} heading="No events yet" body="Add a lab event (visible to the whole team) or a personal one (only you)." />
      ) : (
        <>
          {sorted.map((event) => {
            const d = new Date(event.date + "T00:00:00");
            const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            const isPersonal = event.scope === "personal";
            return (
              <div
                key={event.id}
                className="flex items-center gap-3 px-5 py-3"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <span
                  className="shrink-0 px-2 py-1"
                  style={{
                    backgroundColor: isPersonal ? "rgba(27,46,75,0.08)" : "var(--color-navy)",
                    color: isPersonal ? "var(--color-navy)" : "#fff",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-body)", margin: 0 }}>{event.title}</p>
                </div>
                {isPersonal && (
                  <Lock size={11} style={{ color: "var(--color-secondary)", flexShrink: 0 }} aria-label="Personal event" />
                )}
                {event.time && (
                  <span style={{ fontSize: 11, color: "var(--color-secondary)", flexShrink: 0 }}>
                    {new Date(`2000-01-01T${event.time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                )}
                {event.createdBy === currentUserId && (
                  <button
                    onClick={() => onDeleteEvent(event.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0, opacity: 0.5 }}
                    aria-label="Delete event"
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.5"; }}
                  >
                    <Trash2 size={13} color="var(--color-secondary)" />
                  </button>
                )}
              </div>
            );
          })}
          <p className="px-5 py-2" style={{ fontSize: 11, color: "var(--color-secondary)", margin: 0 }}>
            <Lock size={10} style={{ display: "inline", marginRight: 4 }} />
            Personal events are visible only to you and do not appear in the team overlap view.
          </p>
        </>
      )}
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "availability" | "team" | "meetings" | "events";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "availability", label: "My Availability",    icon: Calendar },
  { id: "team",         label: "Team Overlap",        icon: Users    },
  { id: "meetings",     label: "Meetings",            icon: Send     },
  { id: "events",       label: "Events",               icon: Calendar },
];

export default function SchedulingPage() {
  const [tab, setTab] = useState<Tab>("availability");
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Resolved from auth
  const [currentUserId, setCurrentUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [teamMembers, setTeamMembers] = useState<User[]>([]);

  // Scheduling data — starts empty for every user
  const [savedSlots, setSavedSlots] = useState<string[]>([]);
  const [allAvailabilities, setAllAvailabilities] = useState<WeeklyAvailability[]>([]);
  const [proposals, setProposals] = useState<MeetingProposal[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured) {
        // Demo mode: identify the user from localStorage but show empty data
        try {
          const stored = localStorage.getItem("canopy_user");
          if (stored) {
            const u = JSON.parse(stored);
            setCurrentUserId(u.id ?? "demo");
          }
          const proj = localStorage.getItem("canopy_project");
          if (proj) {
            const p = JSON.parse(proj);
            setProjectId(p.id ?? "demo-project");
          }
        } catch { /* ignore */ }
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      setCurrentUserId(user.id);

      const { data: prof } = await supabase
        .from("user_profiles")
        .select("project_id")
        .eq("id", user.id)
        .maybeSingle();

      const pid = prof?.project_id as string | undefined;
      if (!pid) { setLoading(false); return; }
      setProjectId(pid);

      // Team members
      const { data: members } = await supabase
        .from("team_members")
        .select("user_id, role, user_profiles(name, avatar_color, avatar_initials, avatar_url)")
        .eq("project_id", pid);

      if (members) {
        setTeamMembers(
          members.map((row) => {
            const p = Array.isArray(row.user_profiles) ? row.user_profiles[0] : row.user_profiles;
            const profile = p as Record<string, string> | null;
            const name = profile?.name ?? "Team Member";
            return {
              id: row.user_id as string,
              name,
              email: "",
              role: (row.role ?? "researcher") as User["role"],
              avatarColor: profile?.avatar_color ?? "#B4D4E3",
              avatarInitials: computeInitials(name) || (profile?.avatar_initials ?? "??"),
              avatarUrl: profile?.avatar_url ?? undefined,
            };
          })
        );
      }

      // Availability (all members in this project)
      const { data: avData } = await supabase
        .from("user_availability")
        .select("*")
        .eq("project_id", pid);

      if (avData) {
        const mapped: WeeklyAvailability[] = avData.map((row) => ({
          userId: row.user_id as string,
          projectId: row.project_id as string,
          slots: (row.slots as string[]) ?? [],
          updatedAt: row.updated_at as string,
        }));
        setAllAvailabilities(mapped);
        const mine = mapped.find((a) => a.userId === user.id);
        if (mine) setSavedSlots(mine.slots);
      }

      // Meeting proposals for this project
      const { data: propData } = await supabase
        .from("meeting_proposals")
        .select("*")
        .eq("project_id", pid)
        .order("created_at", { ascending: false });

      if (propData) {
        setProposals(
          propData.map((row) => ({
            id: row.id as string,
            projectId: row.project_id as string,
            proposerId: row.proposer_id as string,
            title: row.title as string,
            description: (row.description as string) ?? undefined,
            proposedDate: row.proposed_date as string,
            proposedTime: row.proposed_time as string,
            durationMinutes: row.duration_minutes as number,
            inviteeIds: (row.invitee_ids as string[]) ?? [],
            responses: (row.responses as MeetingResponse[]) ?? [],
            createdAt: row.created_at as string,
          }))
        );
      }

      // Schedule events: lab events for this project, plus my personal events
      const { data: evData } = await supabase
        .from("schedule_events")
        .select("*")
        .eq("project_id", pid)
        .or(`scope.eq.lab,and(scope.eq.personal,created_by.eq.${user.id})`)
        .order("date", { ascending: true });

      if (evData) {
        setEvents(
          evData.map((row) => ({
            id: row.id as string,
            projectId: row.project_id as string,
            title: row.title as string,
            date: row.date as string,
            time: (row.time as string) ?? undefined,
            endTime: (row.end_time as string) ?? undefined,
            scope: row.scope as ScheduleEvent["scope"],
            createdBy: row.created_by as string,
            description: (row.description as string) ?? undefined,
          }))
        );
      }

      setLoading(false);
    }

    init();
  }, []);

  // ── Write handlers ──────────────────────────────────────────────────────────

  function handleSaveAvailability(slots: string[]) {
    setSavedSlots(slots);
    const updated: WeeklyAvailability = {
      userId: currentUserId,
      projectId,
      slots,
      updatedAt: new Date().toISOString(),
    };
    setAllAvailabilities((prev) => {
      const exists = prev.some((a) => a.userId === currentUserId);
      return exists
        ? prev.map((a) => (a.userId === currentUserId ? updated : a))
        : [...prev, updated];
    });

    if (isSupabaseConfigured && projectId && currentUserId) {
      supabase
        .from("user_availability")
        .upsert(
          { project_id: projectId, user_id: currentUserId, slots, updated_at: updated.updatedAt },
          { onConflict: "project_id,user_id" }
        )
        .then(({ error }) => { if (error) console.error("[Scheduling] save availability:", error); });
    }
  }

  function handleRespond(proposalId: string, status: "accepted" | "declined") {
    let updatedResponses: MeetingResponse[] = [];

    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== proposalId) return p;
        const responses = p.responses.map((r) =>
          r.userId === currentUserId ? { ...r, status, respondedAt: new Date().toISOString() } : r
        );
        if (!responses.some((r) => r.userId === currentUserId)) {
          responses.push({ userId: currentUserId, status, respondedAt: new Date().toISOString() });
        }
        updatedResponses = responses;
        return { ...p, responses };
      })
    );

    if (isSupabaseConfigured && proposalId && updatedResponses.length > 0) {
      supabase
        .from("meeting_proposals")
        .update({ responses: updatedResponses })
        .eq("id", proposalId)
        .then(({ error }) => { if (error) console.error("[Scheduling] respond to proposal:", error); });
    }
  }

  async function handleProposal(proposal: Omit<MeetingProposal, "id" | "createdAt" | "responses">) {
    const initialResponses: MeetingResponse[] = proposal.inviteeIds.map((id) => ({
      userId: id,
      status: "pending",
    }));
    const tempId = crypto.randomUUID();
    const newProposal: MeetingProposal = {
      ...proposal,
      projectId,
      id: tempId,
      createdAt: new Date().toISOString(),
      responses: initialResponses,
    };

    if (isSupabaseConfigured && projectId && currentUserId) {
      const { data, error } = await supabase
        .from("meeting_proposals")
        .insert({
          project_id: projectId,
          proposer_id: currentUserId,
          title: proposal.title,
          description: proposal.description ?? null,
          proposed_date: proposal.proposedDate,
          proposed_time: proposal.proposedTime,
          duration_minutes: proposal.durationMinutes,
          invitee_ids: proposal.inviteeIds,
          responses: initialResponses,
        })
        .select()
        .single();
      if (!error && data) {
        setProposals((prev) => [{ ...newProposal, id: data.id as string }, ...prev]);
      } else {
        if (error) console.error("[Scheduling] create proposal:", error);
        setProposals((prev) => [newProposal, ...prev]);
      }
    } else {
      setProposals((prev) => [newProposal, ...prev]);
    }

    setShowProposalModal(false);
    setTab("meetings");
  }

  async function handleAddEvent(event: Omit<ScheduleEvent, "id">) {
    const tempId = crypto.randomUUID();
    if (isSupabaseConfigured && projectId && currentUserId) {
      const { data, error } = await supabase
        .from("schedule_events")
        .insert({
          project_id: projectId,
          title: event.title,
          date: event.date,
          time: event.time ?? null,
          end_time: event.endTime ?? null,
          scope: event.scope,
          created_by: currentUserId,
          description: event.description ?? null,
        })
        .select()
        .single();
      if (!error && data) {
        setEvents((prev) => [...prev, { ...event, id: data.id as string }]);
      } else {
        if (error) console.error("[Scheduling] add event:", error);
        setEvents((prev) => [...prev, { ...event, id: tempId }]);
      }
    } else {
      setEvents((prev) => [...prev, { ...event, id: tempId }]);
    }
  }

  function handleDeleteEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (isSupabaseConfigured) {
      supabase.from("schedule_events").delete().eq("id", id)
        .then(({ error }) => { if (error) console.error("[Scheduling] delete event:", error); });
    }
  }

  const pendingCount = proposals.filter(
    (p) =>
      p.proposerId !== currentUserId &&
      p.inviteeIds.includes(currentUserId) &&
      (p.responses.find((r) => r.userId === currentUserId)?.status ?? "pending") === "pending"
  ).length;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ backgroundColor: "var(--color-canvas)" }}>
        <div style={{ width: 32, height: 32, border: "3px solid var(--color-border)", borderTopColor: "var(--color-navy)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <ClientOnly>
      <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 22, color: "var(--color-navy)", margin: 0 }}>
              Scheduling
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 3 }}>
              Set your availability, find team overlap, and propose meetings.
            </p>
          </div>
          <button
            onClick={() => setShowProposalModal(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, padding: "9px 16px", cursor: "pointer", fontFamily: "var(--font-roboto)" }}
          >
            <Plus size={14} /> Propose Meeting
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 mb-6 overflow-x-auto" style={{ backgroundColor: "rgba(27,46,75,0.06)", borderRadius: 9, padding: 3 }}>
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            const hasBadge = id === "meetings" && pendingCount > 0;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex items-center gap-1.5 whitespace-nowrap"
                style={{ flex: "0 0 auto", padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: "var(--font-roboto)", backgroundColor: active ? "#fff" : "transparent", color: active ? "var(--color-navy)" : "var(--color-secondary)", boxShadow: active ? "0 1px 4px rgba(27,46,75,0.12)" : "none" }}
              >
                <Icon size={13} />
                {label}
                {hasBadge && (
                  <span style={{ backgroundColor: "#C0392B", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", marginLeft: 2 }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === "availability" && (
          <MyAvailabilityTab
            savedSlots={savedSlots}
            onSave={handleSaveAvailability}
            googleConnected={googleConnected}
            onToggleGoogle={() => setGoogleConnected((c) => !c)}
          />
        )}
        {tab === "team" && (
          <TeamOverlapTab
            availabilities={allAvailabilities}
            teamMembers={teamMembers}
            onProposeMeeting={() => setShowProposalModal(true)}
          />
        )}
        {tab === "meetings" && (
          <MeetingsTab
            proposals={proposals}
            currentUserId={currentUserId}
            teamMembers={teamMembers}
            onRespond={handleRespond}
            onPropose={() => setShowProposalModal(true)}
          />
        )}
        {tab === "events" && (
          <EventsTab
            events={events}
            currentUserId={currentUserId}
            projectId={projectId}
            onAddEvent={handleAddEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        )}
      </div>

      {showProposalModal && (
        <MeetingProposalModal
          currentUserId={currentUserId}
          teamMembers={teamMembers}
          onSubmit={handleProposal}
          onClose={() => setShowProposalModal(false)}
        />
      )}
    </ClientOnly>
  );
}
