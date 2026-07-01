"use client";

import { useState, useEffect } from "react";
import {
  Calendar, Users, Send, Clock, Check, X, Plus,
  Bell, AlertCircle, Lock, ChevronRight, Trash2,
} from "lucide-react";
import {
  USERS, CURRENT_USER_ID, getUser, getStoredProject,
  AVAILABILITIES, MEETING_PROPOSALS, SCHEDULE_EVENTS, REMINDERS,
  formatDate,
} from "@/lib/mock-data";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  User, WeeklyAvailability, MeetingProposal, ScheduleEvent,
  Reminder, MeetingResponseStatus,
} from "@/types";
import AvailabilityGrid from "@/components/scheduling/AvailabilityGrid";
import TeamOverlapView from "@/components/scheduling/TeamOverlapView";
import MeetingProposalModal from "@/components/scheduling/MeetingProposalModal";
import Avatar from "@/components/ui/Avatar";
import ClientOnly from "@/components/ui/ClientOnly";
import { useProject } from "@/context/ProjectContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatProposedDate(date: string, time: string): string {
  const d = new Date(`${date}T${time}`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
    " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatReminderDue(isoDatetime: string): string {
  const d = new Date(isoDatetime);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const STATUS_COLORS: Record<MeetingResponseStatus, { bg: string; text: string }> = {
  pending:  { bg: "#FEF3C7", text: "#92400E" },
  accepted: { bg: "#D1FAE5", text: "#065F46" },
  declined: { bg: "#FEE2E2", text: "#991B1B" },
};

const STATUS_LABELS: Record<MeetingResponseStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
};

// ── Shared card wrapper ───────────────────────────────────────────────────────

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

// ── Tab: My Availability ──────────────────────────────────────────────────────

function MyAvailabilityTab({
  availability,
  onSave,
  googleConnected,
  onToggleGoogle,
}: {
  availability: WeeklyAvailability;
  onSave: (slots: string[]) => void;
  googleConnected: boolean;
  onToggleGoogle: () => void;
}) {
  const [slots, setSlots] = useState<string[]>(availability.slots);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onSave(slots);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const hasChanges = JSON.stringify(slots.sort()) !== JSON.stringify([...availability.slots].sort());

  return (
    <div className="space-y-5">
      {/* Privacy notice */}
      <div
        className="flex items-start gap-3 px-4 py-3 rounded-lg"
        style={{ backgroundColor: "rgba(27,46,75,0.05)", border: "1px solid rgba(27,46,75,0.10)" }}
      >
        <Lock size={14} style={{ marginTop: 2, color: "var(--color-navy)", flexShrink: 0 }} />
        <p style={{ fontSize: 13, color: "var(--color-body)", margin: 0, lineHeight: 1.5 }}>
          Your availability shows when you&apos;re generally free — not what you&apos;re doing.
          Team members see only the overlap across the group, not your individual schedule details.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Grid */}
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

        {/* Google Calendar Sync */}
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
                are never read or shown to anyone.
              </p>
            </div>
          </Card>

          {/* Quick stats */}
          <Card>
            <div className="px-5 py-4">
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-secondary)", marginBottom: 8, letterSpacing: "0.04em" }}>
                AVAILABILITY SUMMARY
              </p>
              <p style={{ fontSize: 13, color: "var(--color-body)", margin: 0 }}>
                <span style={{ fontWeight: 700, color: "var(--color-navy)", fontSize: 20 }}>
                  {Math.round(slots.length * 0.5)}h
                </span>{" "}
                per week marked as available
              </p>
              <p style={{ fontSize: 11, color: "var(--color-secondary)", marginTop: 4 }}>
                {slots.length} time slots × 30 min
              </p>
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
  const membersWithAvailability = teamMembers.filter((m) =>
    availabilities.some((a) => a.userId === m.id)
  );
  const missing = teamMembers.filter((m) => !availabilities.some((a) => a.userId === m.id));

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="Team Availability Overlap" />
        <div className="p-5">
          <TeamOverlapView
            availabilities={availabilities}
            teamMembers={teamMembers}
            onProposeMeeting={onProposeMeeting}
          />
        </div>
      </Card>

      {/* Who has set availability */}
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
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#065F46",
                      backgroundColor: "#D1FAE5",
                      borderRadius: 12,
                      padding: "2px 8px",
                    }}
                  >
                    ✓ Set
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--color-secondary)",
                      backgroundColor: "rgba(27,46,75,0.05)",
                      borderRadius: 12,
                      padding: "2px 8px",
                    }}
                  >
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

  function getUser(id: string): User | undefined {
    return teamMembers.find((m) => m.id === id);
  }

  function MyResponse({ proposal }: { proposal: MeetingProposal }) {
    const myResponse = proposal.responses.find((r) => r.userId === currentUserId);
    const status = myResponse?.status ?? "pending";
    const c = STATUS_COLORS[status];
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: c.text,
          backgroundColor: c.bg,
          borderRadius: 12,
          padding: "2px 8px",
        }}
      >
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
    const proposer = getUser(proposal.proposerId);
    return (
      <div
        className="px-5 py-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
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
          {!showActions && <MyResponse proposal={proposal} />}
        </div>

        {/* Invitee responses (for outgoing proposals) */}
        {showResponses && (
          <div className="mt-3 flex flex-wrap gap-2">
            {proposal.inviteeIds.map((id) => {
              const u = getUser(id);
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

        {/* Accept / Decline buttons */}
        {showActions && (
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => onRespond(proposal.id, "accepted")}
              className="flex items-center gap-1.5"
              style={{
                height: 32,
                paddingInline: 14,
                backgroundColor: "var(--color-navy)",
                color: "#fff",
                border: "none",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-roboto)",
              }}
            >
              <Check size={12} /> Accept
            </button>
            <button
              onClick={() => onRespond(proposal.id, "declined")}
              className="flex items-center gap-1.5"
              style={{
                height: 32,
                paddingInline: 14,
                backgroundColor: "transparent",
                color: "var(--color-error)",
                border: "1px solid var(--color-error)",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "var(--font-roboto)",
              }}
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
      {/* Incoming — needs response */}
      {incoming.length > 0 && (
        <Card>
          <SectionHeader title="Needs Your Response" />
          <div>
            {incoming.map((p) => (
              <ProposalCard key={p.id} proposal={p} showActions />
            ))}
          </div>
        </Card>
      )}

      {/* My proposals */}
      <Card>
        <SectionHeader
          title="My Proposals"
          action={
            <button
              onClick={onPropose}
              className="flex items-center gap-1"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-navy)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              <Plus size={13} /> Propose Meeting
            </button>
          }
        />
        {outgoing.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Send size={28} style={{ color: "var(--color-border)", margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>
              No meeting proposals yet.
            </p>
            <button
              onClick={onPropose}
              style={{
                marginTop: 10,
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-navy)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Propose a meeting time
            </button>
          </div>
        ) : (
          outgoing.map((p) => (
            <ProposalCard key={p.id} proposal={p} showResponses />
          ))
        )}
      </Card>

      {/* Already responded */}
      {responded.length > 0 && (
        <Card>
          <SectionHeader title="Responded" />
          <div>
            {responded.map((p) => (
              <ProposalCard key={p.id} proposal={p} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Events & Reminders ───────────────────────────────────────────────────

function EventsTab({
  events,
  reminders,
  currentUserId,
  onAddEvent,
  onDeleteEvent,
  onAddReminder,
  onDeleteReminder,
}: {
  events: ScheduleEvent[];
  reminders: Reminder[];
  currentUserId: string;
  onAddEvent: (e: Omit<ScheduleEvent, "id">) => void;
  onDeleteEvent: (id: string) => void;
  onAddReminder: (r: Omit<Reminder, "id" | "sent" | "createdAt">) => void;
  onDeleteReminder: (id: string) => void;
}) {
  const [showEventForm, setShowEventForm] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);

  // Event form state
  const [evTitle, setEvTitle] = useState("");
  const [evDate, setEvDate] = useState("");
  const [evTime, setEvTime] = useState("");
  const [evScope, setEvScope] = useState<"lab" | "personal">("lab");
  const [evDesc, setEvDesc] = useState("");
  const [evError, setEvError] = useState("");

  // Reminder form state
  const [remTitle, setRemTitle] = useState("");
  const [remDate, setRemDate] = useState("");
  const [remTime, setRemTime] = useState("");
  const [remEmail, setRemEmail] = useState(false);
  const [remError, setRemError] = useState("");

  const labEvents = events
    .filter((e) => e.scope === "lab")
    .sort((a, b) => a.date.localeCompare(b.date));
  const personalEvents = events
    .filter((e) => e.scope === "personal" && e.createdBy === currentUserId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const myReminders = reminders
    .filter((r) => r.userId === currentUserId)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  function handleAddEvent() {
    if (!evTitle.trim()) { setEvError("Please enter an event title."); return; }
    if (!evDate) { setEvError("Please select a date."); return; }
    setEvError("");
    onAddEvent({
      projectId: "p1",
      title: evTitle.trim(),
      date: evDate,
      time: evTime || undefined,
      scope: evScope,
      createdBy: currentUserId,
      description: evDesc.trim() || undefined,
    });
    setEvTitle(""); setEvDate(""); setEvTime(""); setEvScope("lab"); setEvDesc("");
    setShowEventForm(false);
  }

  function handleAddReminder() {
    if (!remTitle.trim()) { setRemError("Please enter a title."); return; }
    if (!remDate || !remTime) { setRemError("Please select a date and time."); return; }
    setRemError("");
    onAddReminder({
      userId: currentUserId,
      title: remTitle.trim(),
      dueAt: new Date(`${remDate}T${remTime}`).toISOString(),
      emailEnabled: remEmail,
    });
    setRemTitle(""); setRemDate(""); setRemTime(""); setRemEmail(false);
    setShowReminderForm(false);
  }

  const inputStyle: React.CSSProperties = {
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

  function EventRow({ event }: { event: ScheduleEvent }) {
    const d = new Date(event.date + "T00:00:00");
    const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" });
    return (
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <span
          className="shrink-0 px-2 py-1"
          style={{
            backgroundColor: event.scope === "lab" ? "var(--color-navy)" : "rgba(27,46,75,0.10)",
            color: event.scope === "lab" ? "#fff" : "var(--color-navy)",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {monthDay}
        </span>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-body)", margin: 0 }}>
            {event.title}
          </p>
          {event.description && (
            <p style={{ fontSize: 11, color: "var(--color-secondary)", margin: "2px 0 0" }}>
              {event.description}
            </p>
          )}
        </div>
        {event.time && (
          <span style={{ fontSize: 11, color: "var(--color-secondary)", flexShrink: 0 }}>
            {new Date(`2000-01-01T${event.time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
        )}
        {event.createdBy === currentUserId && (
          <button
            onClick={() => onDeleteEvent(event.id)}
            className="transition-opacity hover:opacity-70"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}
            aria-label="Delete event"
          >
            <Trash2 size={13} color="var(--color-secondary)" />
          </button>
        )}
      </div>
    );
  }

  function ReminderRow({ reminder }: { reminder: Reminder }) {
    return (
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <Bell size={14} style={{ color: "var(--color-navy)", flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-body)", margin: 0 }}>
            {reminder.title}
          </p>
          <p style={{ fontSize: 11, color: "var(--color-secondary)", margin: "2px 0 0" }}>
            {formatReminderDue(reminder.dueAt)}
            {reminder.emailEnabled && " · Email notification"}
          </p>
        </div>
        <button
          onClick={() => onDeleteReminder(reminder.id)}
          className="transition-opacity hover:opacity-70"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}
          aria-label="Delete reminder"
        >
          <Trash2 size={13} color="var(--color-secondary)" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Lab Events */}
      <Card>
        <SectionHeader
          title="Lab Events"
          action={
            <button
              onClick={() => { setEvScope("lab"); setShowEventForm(true); }}
              className="flex items-center gap-1"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--color-navy)", background: "none", border: "none", cursor: "pointer" }}
            >
              <Plus size={13} /> Add lab event
            </button>
          }
        />
        {showEventForm && evScope === "lab" && (
          <div className="px-5 py-4 space-y-3 animate-fade-in" style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "rgba(27,46,75,0.02)" }}>
            <input
              autoFocus
              value={evTitle}
              onChange={(e) => { setEvTitle(e.target.value); setEvError(""); }}
              placeholder="Event title"
              style={{ ...inputStyle, width: "100%" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={evDate}
                onChange={(e) => { setEvDate(e.target.value); setEvError(""); }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="time"
                value={evTime}
                onChange={(e) => setEvTime(e.target.value)}
                style={{ ...inputStyle, width: 110 }}
              />
            </div>
            <textarea
              value={evDesc}
              onChange={(e) => setEvDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              style={{ ...inputStyle, height: "auto", padding: "6px 10px", width: "100%", resize: "none" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
            />
            {evError && <p style={{ fontSize: 11, color: "var(--color-error)" }}>{evError}</p>}
            <div className="flex gap-2">
              <button onClick={handleAddEvent} style={{ height: 34, paddingInline: 16, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add</button>
              <button onClick={() => { setShowEventForm(false); setEvError(""); }} style={{ height: 34, paddingInline: 12, background: "none", border: "none", fontSize: 12, color: "var(--color-secondary)", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
        {labEvents.length === 0 && !showEventForm ? (
          <div className="px-5 py-6 text-center">
            <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No lab events scheduled.</p>
          </div>
        ) : (
          <div>{labEvents.map((e) => <EventRow key={e.id} event={e} />)}</div>
        )}
      </Card>

      {/* Personal Events */}
      <Card>
        <SectionHeader
          title="My Personal Events"
          action={
            <button
              onClick={() => { setEvScope("personal"); setShowEventForm(true); }}
              className="flex items-center gap-1"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--color-navy)", background: "none", border: "none", cursor: "pointer" }}
            >
              <Plus size={13} /> Add event
            </button>
          }
        />
        <div
          className="flex items-start gap-2 px-5 py-2"
          style={{ backgroundColor: "rgba(27,46,75,0.03)", borderBottom: "1px solid var(--color-border)" }}
        >
          <Lock size={11} style={{ color: "var(--color-secondary)", marginTop: 3, flexShrink: 0 }} />
          <p style={{ fontSize: 11, color: "var(--color-secondary)", margin: 0, lineHeight: 1.5 }}>
            Personal events are visible only to you. They do not appear in the team overlap view or to other team members.
          </p>
        </div>
        {showEventForm && evScope === "personal" && (
          <div className="px-5 py-4 space-y-3 animate-fade-in" style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "rgba(27,46,75,0.02)" }}>
            <input
              autoFocus
              value={evTitle}
              onChange={(e) => { setEvTitle(e.target.value); setEvError(""); }}
              placeholder="Event title (visible only to you)"
              style={{ ...inputStyle, width: "100%" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={evDate}
                onChange={(e) => { setEvDate(e.target.value); setEvError(""); }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="time"
                value={evTime}
                onChange={(e) => setEvTime(e.target.value)}
                style={{ ...inputStyle, width: 110 }}
              />
            </div>
            {evError && <p style={{ fontSize: 11, color: "var(--color-error)" }}>{evError}</p>}
            <div className="flex gap-2">
              <button onClick={handleAddEvent} style={{ height: 34, paddingInline: 16, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add</button>
              <button onClick={() => { setShowEventForm(false); setEvError(""); }} style={{ height: 34, paddingInline: 12, background: "none", border: "none", fontSize: 12, color: "var(--color-secondary)", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
        {personalEvents.length === 0 && !(showEventForm && evScope === "personal") ? (
          <div className="px-5 py-6 text-center">
            <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No personal events. Only you can see these.</p>
          </div>
        ) : (
          <div>{personalEvents.map((e) => <EventRow key={e.id} event={e} />)}</div>
        )}
      </Card>

      {/* Reminders */}
      <Card>
        <SectionHeader
          title="Reminders"
          action={
            <button
              onClick={() => setShowReminderForm(true)}
              className="flex items-center gap-1"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--color-navy)", background: "none", border: "none", cursor: "pointer" }}
            >
              <Plus size={13} /> Add reminder
            </button>
          }
        />
        {showReminderForm && (
          <div className="px-5 py-4 space-y-3 animate-fade-in" style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "rgba(27,46,75,0.02)" }}>
            <input
              autoFocus
              value={remTitle}
              onChange={(e) => { setRemTitle(e.target.value); setRemError(""); }}
              placeholder="Reminder title"
              style={{ ...inputStyle, width: "100%" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={remDate}
                onChange={(e) => { setRemDate(e.target.value); setRemError(""); }}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="time"
                value={remTime}
                onChange={(e) => { setRemTime(e.target.value); setRemError(""); }}
                style={{ ...inputStyle, width: 110 }}
              />
            </div>
            <label className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--color-body)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={remEmail}
                onChange={(e) => setRemEmail(e.target.checked)}
                style={{ accentColor: "var(--color-navy)", width: 14, height: 14 }}
              />
              Send email notification
            </label>
            {remError && <p style={{ fontSize: 11, color: "var(--color-error)" }}>{remError}</p>}
            <div className="flex gap-2">
              <button onClick={handleAddReminder} style={{ height: 34, paddingInline: 16, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add</button>
              <button onClick={() => { setShowReminderForm(false); setRemError(""); }} style={{ height: 34, paddingInline: 12, background: "none", border: "none", fontSize: 12, color: "var(--color-secondary)", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        )}
        {myReminders.length === 0 && !showReminderForm ? (
          <div className="px-5 py-6 text-center">
            <p style={{ fontSize: 13, color: "var(--color-secondary)" }}>No reminders set.</p>
          </div>
        ) : (
          <div>{myReminders.map((r) => <ReminderRow key={r.id} reminder={r} />)}</div>
        )}
      </Card>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "availability" | "team" | "meetings" | "events";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "availability", label: "My Availability", icon: Calendar },
  { id: "team",         label: "Team Overlap",    icon: Users    },
  { id: "meetings",     label: "Meetings",        icon: Send     },
  { id: "events",       label: "Events & Reminders", icon: Bell  },
];

export default function SchedulingPage() {
  const { projectId } = useProject();
  const [tab, setTab] = useState<Tab>("availability");
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);

  // State
  const [availability, setAvailability] = useState<WeeklyAvailability>(() => {
    const found = AVAILABILITIES.find((a) => a.userId === CURRENT_USER_ID);
    return found ?? { userId: CURRENT_USER_ID, projectId: "p1", slots: [], updatedAt: new Date().toISOString() };
  });
  const [allAvailabilities, setAllAvailabilities] = useState<WeeklyAvailability[]>(AVAILABILITIES);
  const [proposals, setProposals] = useState<MeetingProposal[]>(MEETING_PROPOSALS);
  const [events, setEvents] = useState<ScheduleEvent[]>(SCHEDULE_EVENTS);
  const [reminders, setReminders] = useState<Reminder[]>(REMINDERS);

  const currentUser = USERS.find((u) => u.id === CURRENT_USER_ID)!;
  const teamMembers = USERS;

  // Count pending incoming proposals for badge
  const pendingCount = proposals.filter(
    (p) =>
      p.proposerId !== CURRENT_USER_ID &&
      p.inviteeIds.includes(CURRENT_USER_ID) &&
      (p.responses.find((r) => r.userId === CURRENT_USER_ID)?.status ?? "pending") === "pending"
  ).length;

  function handleSaveAvailability(slots: string[]) {
    const updated: WeeklyAvailability = { ...availability, slots, updatedAt: new Date().toISOString() };
    setAvailability(updated);
    setAllAvailabilities((prev) => prev.map((a) => a.userId === CURRENT_USER_ID ? updated : a));
  }

  function handleRespond(proposalId: string, status: "accepted" | "declined") {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== proposalId) return p;
        const responses = p.responses.map((r) =>
          r.userId === CURRENT_USER_ID
            ? { ...r, status, respondedAt: new Date().toISOString() }
            : r
        );
        if (!responses.some((r) => r.userId === CURRENT_USER_ID)) {
          responses.push({ userId: CURRENT_USER_ID, status, respondedAt: new Date().toISOString() });
        }
        return { ...p, responses };
      })
    );
  }

  function handleProposal(proposal: Omit<MeetingProposal, "id" | "createdAt" | "responses">) {
    const newProposal: MeetingProposal = {
      ...proposal,
      projectId: projectId ?? "p1",
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      responses: proposal.inviteeIds.map((id) => ({ userId: id, status: "pending" })),
    };
    setProposals((prev) => [newProposal, ...prev]);
    setShowProposalModal(false);
    setTab("meetings");
  }

  function handleAddEvent(event: Omit<ScheduleEvent, "id">) {
    setEvents((prev) => [{ ...event, id: crypto.randomUUID() }, ...prev]);
  }

  function handleDeleteEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function handleAddReminder(reminder: Omit<Reminder, "id" | "sent" | "createdAt">) {
    const newReminder: Reminder = {
      ...reminder,
      id: crypto.randomUUID(),
      sent: false,
      createdAt: new Date().toISOString(),
    };
    setReminders((prev) => [newReminder, ...prev]);
  }

  function handleDeleteReminder(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <ClientOnly>
      <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1
              style={{
                fontFamily: "var(--font-lora)",
                fontWeight: 700,
                fontSize: 22,
                color: "var(--color-navy)",
                margin: 0,
              }}
            >
              Scheduling
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 3 }}>
              Set your availability, find team overlap, and propose meetings.
            </p>
          </div>
          <button
            onClick={() => setShowProposalModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              backgroundColor: "var(--color-navy)",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 600,
              padding: "9px 16px",
              cursor: "pointer",
              fontFamily: "var(--font-roboto)",
            }}
          >
            <Plus size={14} /> Propose Meeting
          </button>
        </div>

        {/* Tab bar */}
        <div
          className="flex gap-0.5 mb-6 overflow-x-auto"
          style={{
            backgroundColor: "rgba(27,46,75,0.06)",
            borderRadius: 9,
            padding: 3,
          }}
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            const hasBadge = id === "meetings" && pendingCount > 0;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex items-center gap-1.5 whitespace-nowrap"
                style={{
                  flex: "0 0 auto",
                  padding: "7px 14px",
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  fontFamily: "var(--font-roboto)",
                  backgroundColor: active ? "#fff" : "transparent",
                  color: active ? "var(--color-navy)" : "var(--color-secondary)",
                  boxShadow: active ? "0 1px 4px rgba(27,46,75,0.12)" : "none",
                  position: "relative",
                }}
              >
                <Icon size={13} />
                {label}
                {hasBadge && (
                  <span
                    style={{
                      backgroundColor: "#C0392B",
                      color: "#fff",
                      borderRadius: "50%",
                      width: 16,
                      height: 16,
                      fontSize: 9,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginLeft: 2,
                    }}
                  >
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
            availability={availability}
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
            currentUserId={CURRENT_USER_ID}
            teamMembers={teamMembers}
            onRespond={handleRespond}
            onPropose={() => setShowProposalModal(true)}
          />
        )}
        {tab === "events" && (
          <EventsTab
            events={events}
            reminders={reminders}
            currentUserId={CURRENT_USER_ID}
            onAddEvent={handleAddEvent}
            onDeleteEvent={handleDeleteEvent}
            onAddReminder={handleAddReminder}
            onDeleteReminder={handleDeleteReminder}
          />
        )}
      </div>

      {/* Meeting proposal modal */}
      {showProposalModal && (
        <MeetingProposalModal
          currentUserId={CURRENT_USER_ID}
          teamMembers={teamMembers}
          onSubmit={handleProposal}
          onClose={() => setShowProposalModal(false)}
        />
      )}
    </ClientOnly>
  );
}
