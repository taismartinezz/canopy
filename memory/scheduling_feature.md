---
name: scheduling-feature
description: Scheduling module — files created, design decisions, what's built vs. deferred
metadata:
  type: project
---

Built a full Scheduling feature on branch `scheduling-section`.

## Files Created
- `src/app/(main)/scheduling/page.tsx` — Main page with 4 tabs
- `src/components/scheduling/AvailabilityGrid.tsx` — Click/drag when2meet-style grid (Mon-Fri, 9am-5pm, 30-min slots)
- `src/components/scheduling/TeamOverlapView.tsx` — Heat map overlap view with count badges and hover tooltips
- `src/components/scheduling/MeetingProposalModal.tsx` — Full modal: title, date, time, duration pill-select, invitee checkboxes

## Files Modified
- `src/types/index.ts` — Added: WeeklyAvailability, MeetingProposal, MeetingResponse, ScheduleEvent, Reminder, plus meeting_proposed/meeting_response/reminder notification types
- `src/lib/mock-data/index.ts` — Added: AVAILABILITIES (5 users), MEETING_PROPOSALS (3), SCHEDULE_EVENTS (6), REMINDERS (2); also added meeting_proposed notification (n4)
- `src/components/layout/AppShell.tsx` — Added "Scheduling" nav item with CalendarDays icon (between Tasks and Journal)
- `src/app/(main)/page.tsx` — Demo mode now seeds dashEvents from SCHEDULE_EVENTS (lab only); Upcoming widget has "See all → /scheduling" link

## Design Decisions
- Availability grid: slot key format "day-slot" where day=0..4 (Mon-Fri), slot=0..15 (9:00-4:30pm in 30-min steps)
- Tab structure: My Availability | Team Overlap | Meetings | Events & Reminders
- Google Calendar sync: UI only (connect/disconnect toggle), no real OAuth — clearly labeled "free/busy only, never event titles"
- Privacy: personal events have lock icon + "visible only to you" note; team overlap shows counts not individual names unless hovered
- PI cannot see personal event content — only aggregate free/busy in team overlap
- MeetingProposals: proposer sees per-invitee response status; invitees see accept/decline on "Needs Your Response" section
- Meetings tab shows badge count for pending incoming proposals

**Why:** Prototype-first per [[feedback-build-approach]]. Google Calendar OAuth, Supabase schema for scheduling tables (availability, meeting_proposals, schedule_events, reminders), and email reminder dispatch are all deferred until UX is validated in the user study.
