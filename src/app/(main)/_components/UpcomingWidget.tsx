"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { CalendarEvent } from "@/types";
import { Card, CardHeader, inlineInputStyle } from "./DashboardCard";

export function UpcomingWidget({
  events: initialEvents,
  projectId,
}: {
  events: CalendarEvent[];
  projectId: string;
}) {
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [title, setTitle]   = useState("");
  const [date, setDate]     = useState("");
  const [time, setTime]     = useState("");
  const [addError, setAddError] = useState("");

  useEffect(() => { setEvents(initialEvents); }, [initialEvents]);

  const allUpcoming = events
    .filter((e) => new Date(e.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const upcoming = showAll ? allUpcoming : allUpcoming.slice(0, 5);
  const hasMoreUpcoming = allUpcoming.length > 5;

  async function handleAdd() {
    if (!title.trim()) { setAddError("Please enter an event title."); return; }
    if (!date) { setAddError("Please select a date."); return; }
    setAddError("");

    if (projectId) {
      const { data, error } = await supabase
        .from("events")
        .insert({ project_id: projectId, title: title.trim(), date, time: time || null })
        .select()
        .single();
      if (error) {
        console.error("[UpcomingWidget] event insert error:", error);
      } else if (data) {
        const newEvent: CalendarEvent = {
          id: data.id as string,
          title: data.title as string,
          date: data.date as string,
          time: (data.time as string) ?? undefined,
          projectId: data.project_id as string,
        };
        setEvents((prev) => [newEvent, ...prev]);
      }
    } else {
      setEvents((prev) => [
        ...prev,
        { id: crypto.randomUUID(), title: title.trim(), date, time: time || undefined, projectId },
      ]);
    }
    setTitle(""); setDate(""); setTime(""); setAddError("");
    setShowForm(false);
  }

  return (
    <Card>
      <CardHeader
        title="Upcoming"
        onTitleClick={hasMoreUpcoming ? () => setShowAll(v => !v) : undefined}
        action={
          <div className="flex items-center gap-3">
            <Link
              href="/scheduling"
              style={{ fontSize: 12, color: "var(--color-secondary)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}
              className="transition-opacity hover:opacity-70"
            >
              See all <ChevronRight size={11} />
            </Link>
            <button
              onClick={() => setShowForm((s) => !s)}
              className="flex items-center gap-1 transition-opacity hover:opacity-70"
              style={{ fontSize: 12, color: "var(--color-navy)", fontWeight: 600 }}
            >
              <Plus size={13} /> Add event
            </button>
          </div>
        }
      />
      <div className="px-5 py-3 space-y-3" style={{ minHeight: 160, maxHeight: 300, overflowY: "auto" }}>
        {upcoming.length === 0 && !showForm && (
          <p style={{ color: "var(--color-secondary)", fontSize: 13 }}>No upcoming events.</p>
        )}
        {upcoming.map((event) => {
          const d = new Date(event.date + "T00:00:00");
          const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return (
            <div key={event.id} className="flex items-center gap-3" style={{ minHeight: 36 }}>
              <span className="shrink-0 px-2.5 py-1" style={{ backgroundColor: "var(--color-navy)", color: "#fff", borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                {monthDay}
              </span>
              <span style={{ fontSize: 13, color: "var(--color-body)" }}>{event.title}</span>
              {event.time && <span style={{ fontSize: 11, color: "var(--color-secondary)", marginLeft: "auto" }}>{event.time}</span>}
            </div>
          );
        })}

        {showForm && (
          <div className="pt-2 space-y-2 animate-fade-in">
            <input
              autoFocus
              value={title}
              onChange={(e) => { setTitle(e.target.value); setAddError(""); }}
              placeholder="Event title"
              style={{ ...inlineInputStyle, width: "100%", borderColor: addError && !title.trim() ? "var(--color-error)" : undefined }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-navy)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = addError && !title.trim() ? "var(--color-error)" : "var(--color-border)"; }}
            />
            {addError && (
              <p role="alert" style={{ fontSize: 11, color: "var(--color-error)", margin: "2px 0 0", fontFamily: "var(--font-roboto)" }}>
                {addError}
              </p>
            )}
            <div className="flex gap-2">
              <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setAddError(""); }} style={{ ...inlineInputStyle, flex: 1 }} />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...inlineInputStyle, width: 100 }} />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleAdd} style={{ fontSize: 12, fontWeight: 700, color: "#fff", backgroundColor: "var(--color-navy)", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", minHeight: 36, fontFamily: "var(--font-roboto)" }}>
                Add
              </button>
              <button onClick={() => { setShowForm(false); setTitle(""); setDate(""); setTime(""); setAddError(""); }} style={{ fontSize: 12, color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
