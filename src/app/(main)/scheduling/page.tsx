"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Calendar, Users, Send, Clock, Check, X, Plus,
  Lock, Trash2, ChevronLeft, ChevronRight,
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
import { TimePicker, formatTimeDisplay } from "@/components/ui/DateTimePicker";

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

// ── Tab: Calendar ─────────────────────────────────────────────────────────────

const MONTH_NAMES_CAL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_HEADERS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function CalendarTab({
  events,
  proposals,
  currentUserId,
  projectId,
  onAddEvent,
  onDeleteEvent,
}: {
  events: ScheduleEvent[];
  proposals: MeetingProposal[];
  currentUserId: string;
  projectId: string;
  onAddEvent: (e: Omit<ScheduleEvent, "id">) => void;
  onDeleteEvent: (id: string) => void;
}) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addTime, setAddTime] = useState("");
  const [addScope, setAddScope] = useState<"lab" | "personal">("lab");
  const [addError, setAddError] = useState("");
  const [showTP, setShowTP] = useState(false);
  const [tpPos, setTpPos] = useState<{ top: number; left: number } | null>(null);
  const timeBtnRef = useRef<HTMLButtonElement>(null);

  const firstDayOfMonth = new Date(calYear, calMonth, 1);
  const startOffset = firstDayOfMonth.getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  function dayStr(d: number): string {
    return `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  const eventsByDay = useMemo(() => {
    const map: Record<string, ScheduleEvent[]> = {};
    events.forEach(e => { (map[e.date] ??= []).push(e); });
    return map;
  }, [events]);

  const meetingsByDay = useMemo(() => {
    const map: Record<string, MeetingProposal[]> = {};
    proposals.forEach(p => { (map[p.proposedDate] ??= []).push(p); });
    return map;
  }, [proposals]);

  const selectedEvents = selectedDay ? (eventsByDay[selectedDay] ?? []) : [];
  const selectedMeetings = selectedDay ? (meetingsByDay[selectedDay] ?? []) : [];

  function handleAddEvent() {
    if (!addTitle.trim()) { setAddError("Enter a title."); return; }
    if (!selectedDay) return;
    onAddEvent({ projectId, title: addTitle.trim(), date: selectedDay, time: addTime || undefined, scope: addScope, createdBy: currentUserId });
    setAddTitle(""); setAddTime(""); setAddScope("lab"); setAddError(""); setShowAddForm(false);
  }

  const inputStyle: React.CSSProperties = {
    height: 36, border: "1px solid var(--color-border)", borderRadius: 6,
    padding: "0 10px", fontSize: 13, fontFamily: "var(--font-roboto)",
    backgroundColor: "var(--color-canvas)", color: "var(--color-body)",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div className="space-y-4">
      <Card>
        {/* Month navigation */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--color-secondary)", borderRadius: 6 }}>
            <ChevronLeft size={15} />
          </button>
          <h3 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 15, color: "var(--color-navy)", margin: 0 }}>
            {MONTH_NAMES_CAL[calMonth]} {calYear}
          </h3>
          <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--color-secondary)", borderRadius: 6 }}>
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="p-4">
          {/* Day-of-week headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
            {DAY_HEADERS.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--color-secondary)", padding: "4px 0", letterSpacing: "0.05em" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {Array.from({ length: totalCells }, (_, i) => {
              const dayNum = i - startOffset + 1;
              const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
              const ds = inMonth ? dayStr(dayNum) : null;
              const isToday = ds === todayStr;
              const isSelected = ds === selectedDay;
              const dayEvents = ds ? (eventsByDay[ds] ?? []) : [];
              const dayMeetings = ds ? (meetingsByDay[ds] ?? []) : [];
              const hasItems = dayEvents.length > 0 || dayMeetings.length > 0;

              return (
                <button
                  key={i}
                  onClick={() => {
                    if (!ds) return;
                    setSelectedDay(s => s === ds ? null : ds);
                    setShowAddForm(false);
                  }}
                  disabled={!inMonth}
                  style={{
                    minHeight: 50,
                    padding: "4px 3px 3px",
                    border: isToday && !isSelected ? "1.5px solid var(--color-navy)" : "1px solid transparent",
                    borderRadius: 7,
                    backgroundColor: isSelected ? "var(--color-navy)" : "transparent",
                    cursor: inMonth ? "pointer" : "default",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    transition: "background-color 0.1s",
                  }}
                >
                  <span style={{
                    fontSize: 12,
                    fontWeight: isToday ? 700 : 400,
                    color: isSelected ? "#fff" : inMonth ? "var(--color-body)" : "transparent",
                    lineHeight: 1,
                  }}>
                    {inMonth ? dayNum : ""}
                  </span>
                  {inMonth && hasItems && (
                    <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                      {dayEvents.slice(0, 2).map((ev, idx) => (
                        <span key={idx} style={{
                          width: 5, height: 5, borderRadius: "50%",
                          backgroundColor: isSelected
                            ? "rgba(255,255,255,0.75)"
                            : ev.scope === "lab" ? "var(--color-navy)" : "rgba(27,46,75,0.35)",
                        }} />
                      ))}
                      {dayMeetings.slice(0, 1).map((_, idx) => (
                        <span key={`m${idx}`} style={{
                          width: 5, height: 5, borderRadius: "50%",
                          backgroundColor: isSelected ? "rgba(255,255,255,0.6)" : "#2E7D52",
                        }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
            {[
              { color: "var(--color-navy)", label: "Lab event" },
              { color: "rgba(27,46,75,0.35)", label: "Personal" },
              { color: "#2E7D52", label: "Meeting" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: color, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "var(--color-secondary)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Day detail panel */}
      {selectedDay && (
        <Card>
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <h3 style={{ fontFamily: "var(--font-lora)", fontWeight: 600, fontSize: 14, color: "var(--color-navy)", margin: 0 }}>
              {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h3>
            <button
              onClick={() => { setShowAddForm(s => !s); setAddError(""); }}
              className="flex items-center gap-1"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--color-navy)", background: "none", border: "none", cursor: "pointer" }}
            >
              <Plus size={13} /> Add event
            </button>
          </div>

          {/* Inline add form */}
          {showAddForm && (
            <div className="px-5 py-3 space-y-3" style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "rgba(27,46,75,0.02)" }}>
              <div className="flex gap-1.5">
                {(["lab", "personal"] as const).map(s => (
                  <button key={s} onClick={() => setAddScope(s)} style={{
                    height: 27, paddingInline: 12, borderRadius: 20,
                    border: `1.5px solid ${addScope === s ? "var(--color-navy)" : "var(--color-border)"}`,
                    backgroundColor: addScope === s ? "var(--color-navy)" : "transparent",
                    color: addScope === s ? "#fff" : "var(--color-secondary)",
                    fontSize: 12, fontWeight: addScope === s ? 600 : 400, cursor: "pointer", fontFamily: "var(--font-roboto)",
                  }}>
                    {s === "lab" ? "Lab (visible to all)" : "Personal (only me)"}
                  </button>
                ))}
              </div>
              <input
                autoFocus
                value={addTitle}
                onChange={e => { setAddTitle(e.target.value); setAddError(""); }}
                placeholder="Event title"
                style={{ ...inputStyle, width: "100%" }}
                onFocus={e => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
              />
              <div className="flex items-center gap-2">
                <button
                  ref={timeBtnRef}
                  onClick={() => {
                    if (!timeBtnRef.current) return;
                    const r = timeBtnRef.current.getBoundingClientRect();
                    setTpPos({ top: r.bottom + 6, left: r.left });
                    setShowTP(v => !v);
                  }}
                  style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: addTime ? "var(--color-body)" : "var(--color-secondary)", width: "auto", padding: "0 10px" }}
                >
                  {addTime ? formatTimeDisplay(addTime) : "+ time"}
                </button>
                {addTime && (
                  <button onClick={() => setAddTime("")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--color-secondary)" }}>
                    clear
                  </button>
                )}
              </div>
              {showTP && tpPos && (
                <TimePicker value={addTime || "09:00"} accentColor="#1B2E4B" pos={tpPos}
                  onChange={t => setAddTime(t)}
                  onClear={() => { setAddTime(""); setShowTP(false); }}
                  onClose={() => setShowTP(false)} />
              )}
              {addError && <p style={{ fontSize: 11, color: "var(--color-error)", margin: 0 }}>{addError}</p>}
              <div className="flex gap-2">
                <button onClick={handleAddEvent} style={{ height: 32, paddingInline: 16, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Add
                </button>
                <button onClick={() => { setShowAddForm(false); setAddError(""); }} style={{ height: 32, paddingInline: 12, background: "none", border: "none", fontSize: 12, color: "var(--color-secondary)", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Events + meetings list */}
          {selectedEvents.length === 0 && selectedMeetings.length === 0 && !showAddForm ? (
            <EmptyState icon={Calendar} heading="Nothing scheduled" body="Add a lab or personal event for this day." />
          ) : (
            <div>
              {selectedMeetings.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#2E7D52", flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-body)", margin: 0 }}>{p.title}</p>
                    <p style={{ fontSize: 11, color: "var(--color-secondary)", margin: 0 }}>
                      {p.proposedTime
                        ? new Date(`2000-01-01T${p.proposedTime}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                        : ""}{p.proposedTime ? " · " : ""}
                      {formatDuration(p.durationMinutes)}
                    </p>
                  </div>
                </div>
              ))}
              {selectedEvents.map(event => (
                <div key={event.id} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    backgroundColor: event.scope === "lab" ? "var(--color-navy)" : "rgba(27,46,75,0.35)",
                  }} />
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-body)", margin: 0 }}>{event.title}</p>
                    {event.time && (
                      <p style={{ fontSize: 11, color: "var(--color-secondary)", margin: 0 }}>
                        {new Date(`2000-01-01T${event.time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                  {event.scope === "personal" && <Lock size={11} style={{ color: "var(--color-secondary)", flexShrink: 0 }} />}
                  {event.createdBy === currentUserId && (
                    <button
                      onClick={() => onDeleteEvent(event.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, opacity: 0.5, flexShrink: 0 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.5"; }}
                    >
                      <Trash2 size={13} color="var(--color-secondary)" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Tab: Availability ─────────────────────────────────────────────────────────

type AvailScope = "mine" | "all" | "custom";

function AvailabilityTab({
  savedSlots,
  onSave,
  allAvailabilities,
  teamMembers,
  currentUserId,
}: {
  savedSlots: string[];
  onSave: (slots: string[]) => void;
  allAvailabilities: WeeklyAvailability[];
  teamMembers: User[];
  currentUserId: string;
}) {
  const [scope, setScope] = useState<AvailScope>("mine");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => teamMembers.map(m => m.id));
  const [slots, setSlots] = useState<string[]>(savedSlots);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setSlots(savedSlots); }, [savedSlots]);

  useEffect(() => {
    if (scope === "all") setSelectedIds(teamMembers.map(m => m.id));
  }, [scope, teamMembers]);

  function handleSave() {
    onSave(slots);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const hasChanges = JSON.stringify([...slots].sort()) !== JSON.stringify([...savedSlots].sort());

  const filteredAvailabilities = scope === "mine"
    ? allAvailabilities.filter(a => a.userId === currentUserId)
    : allAvailabilities.filter(a => selectedIds.includes(a.userId));

  const filteredMembers = scope === "mine"
    ? teamMembers.filter(m => m.id === currentUserId)
    : teamMembers.filter(m => selectedIds.includes(m.id));

  const overlapTitle = filteredMembers.length === 0
    ? "Select people to compare"
    : filteredMembers.length <= 3
      ? `Overlap — ${filteredMembers.map(m => m.name.split(" ")[0]).join(", ")}`
      : `Overlap — ${filteredMembers.length} people`;

  return (
    <div className="space-y-4">
      {/* Scope pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {([["mine", "Mine"], ["all", "My Team"], ["custom", "Custom"]] as [AvailScope, string][]).map(([s, label]) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            style={{
              height: 32, paddingInline: 14, borderRadius: 20,
              border: `1.5px solid ${scope === s ? "var(--color-navy)" : "var(--color-border)"}`,
              backgroundColor: scope === s ? "var(--color-navy)" : "transparent",
              color: scope === s ? "#fff" : "var(--color-secondary)",
              fontSize: 13, fontWeight: scope === s ? 600 : 400, cursor: "pointer", fontFamily: "var(--font-roboto)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Per-person chips (shown when not "mine") */}
      {scope !== "mine" && teamMembers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {teamMembers.map(m => {
            const checked = selectedIds.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => setSelectedIds(prev =>
                  checked ? prev.filter(id => id !== m.id) : [...prev, m.id]
                )}
                className="flex items-center gap-1.5"
                style={{
                  height: 30, paddingInline: 10, borderRadius: 20,
                  border: `1.5px solid ${checked ? "var(--color-navy)" : "var(--color-border)"}`,
                  backgroundColor: checked ? "rgba(27,46,75,0.07)" : "transparent",
                  color: checked ? "var(--color-navy)" : "var(--color-secondary)",
                  fontSize: 12, fontWeight: checked ? 600 : 400, cursor: "pointer", fontFamily: "var(--font-roboto)",
                }}
              >
                <Avatar user={m} size={18} />
                {m.name.split(" ")[0]}
              </button>
            );
          })}
        </div>
      )}

      {scope === "mine" ? (
        <Card>
          <SectionHeader
            title="My Weekly Availability"
            action={
              <div className="flex items-center gap-2">
                {saved && <span style={{ fontSize: 12, color: "var(--color-success)", fontWeight: 600 }}>✓ Saved</span>}
                <button
                  onClick={handleSave}
                  disabled={!hasChanges}
                  style={{
                    backgroundColor: hasChanges ? "var(--color-navy)" : "transparent",
                    color: hasChanges ? "#fff" : "var(--color-secondary)",
                    border: hasChanges ? "none" : "1px solid var(--color-border)",
                    borderRadius: 7, fontSize: 12, fontWeight: 600, padding: "6px 14px",
                    cursor: hasChanges ? "pointer" : "not-allowed", fontFamily: "var(--font-roboto)",
                  }}
                >
                  Save Changes
                </button>
              </div>
            }
          />
          <div className="p-5">
            <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(27,46,75,0.05)", border: "1px solid rgba(27,46,75,0.10)" }}>
              <Lock size={13} style={{ marginTop: 2, color: "var(--color-navy)", flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "var(--color-body)", margin: 0, lineHeight: 1.5 }}>
                Team members see only the aggregate overlap — not your individual schedule details.
              </p>
            </div>
            <AvailabilityGrid slots={slots} onChange={setSlots} />
          </div>
        </Card>
      ) : (
        <Card>
          <SectionHeader title={overlapTitle} />
          <div className="p-5">
            {filteredMembers.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-secondary)", textAlign: "center", padding: "24px 0" }}>
                Select at least one person above to see their availability.
              </p>
            ) : filteredAvailabilities.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-secondary)", textAlign: "center", padding: "24px 0" }}>
                None of the selected members have set their availability yet.
              </p>
            ) : (
              <TeamOverlapView
                availabilities={filteredAvailabilities}
                teamMembers={filteredMembers}
              />
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Tab: Upcoming Meetings ────────────────────────────────────────────────────

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
  const todayStr = new Date().toISOString().split("T")[0];

  const myProposals = proposals
    .filter(p => p.proposerId === currentUserId || p.inviteeIds.includes(currentUserId))
    .sort((a, b) => a.proposedDate.localeCompare(b.proposedDate));

  const upcoming = myProposals.filter(p => p.proposedDate >= todayStr);
  const past = myProposals.filter(p => p.proposedDate < todayStr);

  function getMember(id: string) { return teamMembers.find(m => m.id === id); }

  function ProposalRow({ p }: { p: MeetingProposal }) {
    const isIncoming = p.proposerId !== currentUserId;
    const myStatus = p.responses.find(r => r.userId === currentUserId)?.status ?? "pending";
    const needsResponse = isIncoming && myStatus === "pending";
    const c = STATUS_COLORS[myStatus as MeetingResponseStatus];
    const proposer = getMember(p.proposerId);

    return (
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-body)", margin: 0 }}>{p.title}</p>
            {p.description && (
              <p style={{ fontSize: 12, color: "var(--color-secondary)", marginTop: 2 }}>{p.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="flex items-center gap-1" style={{ fontSize: 12, color: "var(--color-body)" }}>
                <Calendar size={11} style={{ color: "var(--color-navy)" }} />
                {formatProposedDate(p.proposedDate, p.proposedTime)}
              </span>
              <span className="flex items-center gap-1" style={{ fontSize: 12, color: "var(--color-secondary)" }}>
                <Clock size={11} /> {formatDuration(p.durationMinutes)}
              </span>
              {isIncoming && proposer && (
                <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--color-secondary)" }}>
                  <Avatar user={proposer} size={14} /> {proposer.name.split(" ")[0]}
                </span>
              )}
            </div>
          </div>
          {!needsResponse && (
            <span style={{
              fontSize: 11, fontWeight: 600, flexShrink: 0,
              color: isIncoming ? c.text : "var(--color-secondary)",
              backgroundColor: isIncoming ? c.bg : "rgba(27,46,75,0.06)",
              borderRadius: 12, padding: "2px 8px",
            }}>
              {isIncoming ? STATUS_LABELS[myStatus as MeetingResponseStatus] : "Proposed"}
            </span>
          )}
        </div>

        {/* Invitee response chips for proposals I created */}
        {!isIncoming && p.inviteeIds.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {p.inviteeIds.map(id => {
              const u = getMember(id);
              const resp = p.responses.find(r => r.userId === id);
              const status = resp?.status ?? "pending";
              const rc = STATUS_COLORS[status];
              if (!u) return null;
              return (
                <div key={id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ backgroundColor: rc.bg }}>
                  <Avatar user={u} size={16} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: rc.text }}>
                    {u.name.split(" ")[0]}: {STATUS_LABELS[status]}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {needsResponse && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onRespond(p.id, "accepted")}
              className="flex items-center gap-1.5"
              style={{ height: 32, paddingInline: 14, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-roboto)" }}
            >
              <Check size={12} /> Accept
            </button>
            <button
              onClick={() => onRespond(p.id, "declined")}
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
      <Card>
        <SectionHeader
          title="Upcoming Meetings"
          action={
            <button
              onClick={onPropose}
              className="flex items-center gap-1.5"
              style={{ height: 32, paddingInline: 14, backgroundColor: "var(--color-navy)", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-roboto)" }}
            >
              <Plus size={13} /> Propose
            </button>
          }
        />
        {upcoming.length === 0 ? (
          <EmptyState
            icon={Send}
            heading="No upcoming meetings"
            body="Propose a time with your lab members — everyone can accept or decline."
            action={
              <button onClick={onPropose} style={{ fontSize: 13, fontWeight: 600, color: "var(--color-navy)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                Propose a meeting
              </button>
            }
          />
        ) : (
          upcoming.map(p => <ProposalRow key={p.id} p={p} />)
        )}
      </Card>

      {past.length > 0 && (
        <Card>
          <SectionHeader title="Past" />
          {past.map(p => <ProposalRow key={p.id} p={p} />)}
        </Card>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "calendar" | "availability" | "meetings";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "calendar",     label: "Calendar",          icon: Calendar },
  { id: "availability", label: "Availability",      icon: Users    },
  { id: "meetings",     label: "Meetings",           icon: Send     },
];

export default function SchedulingPage() {
  const [tab, setTab] = useState<Tab>("calendar");
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Resolved from auth
  const [currentUserId, setCurrentUserId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [teamMembers, setTeamMembers] = useState<User[]>([]);

  // Scheduling data
  const [savedSlots, setSavedSlots] = useState<string[]>([]);
  const [allAvailabilities, setAllAvailabilities] = useState<WeeklyAvailability[]>([]);
  const [proposals, setProposals] = useState<MeetingProposal[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);

  useEffect(() => {
    async function init() {
      if (!isSupabaseConfigured) {
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

      // Availability
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

      // Meeting proposals
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

      // Schedule events
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
        <div className="mb-6">
          <h1 style={{ fontFamily: "var(--font-lora)", fontWeight: 700, fontSize: 22, color: "var(--color-navy)", margin: 0 }}>
            Scheduling
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-secondary)", marginTop: 3 }}>
            Calendar, availability, and meetings with your lab.
          </p>
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
                style={{
                  flex: "0 0 auto", padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: "var(--font-roboto)",
                  backgroundColor: active ? "#fff" : "transparent",
                  color: active ? "var(--color-navy)" : "var(--color-secondary)",
                  boxShadow: active ? "0 1px 4px rgba(27,46,75,0.12)" : "none",
                }}
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
        {tab === "calendar" && (
          <CalendarTab
            events={events}
            proposals={proposals}
            currentUserId={currentUserId}
            projectId={projectId}
            onAddEvent={handleAddEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        )}
        {tab === "availability" && (
          <AvailabilityTab
            savedSlots={savedSlots}
            onSave={handleSaveAvailability}
            allAvailabilities={allAvailabilities}
            teamMembers={teamMembers}
            currentUserId={currentUserId}
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
