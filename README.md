# Canopy

A research lab management platform built for trauma, psychology, and sensitive-population research teams. Canopy replaces the scattered collection of Slack threads, email chains, and spreadsheets that most labs rely on — bringing tasks, scheduling, journaling, and literature into one privacy-respecting tool.

## Modules

**Tasks** — Kanban board for managing lab work across the full research lifecycle: protocol development, data collection, analysis, and publication. Supports drag-and-drop, priorities, assignees, due dates, file attachments, and real-time activity feeds.

**Scheduling** — Team availability coordination without the email back-and-forth. Members set their weekly availability on a simple grid (when2meet-style). The PI and team can see a live heat map of when everyone overlaps. Any member can propose a meeting time and invite others; invitees accept or decline in-app. Optionally sync with Google Calendar for automatic free/busy — event titles and details are never shared with anyone.

**Journal** — Private weekly check-ins and reflective prompts designed to help researchers process the emotional weight of sensitive fieldwork. The PI can suggest prompts but never sees individual responses.

**Literature** — A shared lab library for papers, books, and preprints. Tag, rate, annotate, and organize by collection. Supports both lab-wide and personal-scope items.

**Bookmarks** — Save and share links, resources, and references relevant to the lab's work.

**Team** — Member directory with weekly status updates and a real-time activity feed showing who moved what.

## Tech stack

- **Framework:** Next.js 15 (App Router)
- **Database & Auth:** Supabase (Postgres + Row-Level Security)
- **Styling:** CSS custom properties — no CSS framework, consistent design tokens throughout
- **Drag & drop:** @dnd-kit/core
- **Icons:** Lucide React
- **Fonts:** Lora (headings) + Roboto (UI)

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs in demo mode (local auth, empty state defaults) if no Supabase credentials are configured.

To connect a real database, create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Then run `supabase/schema.sql` in your Supabase SQL editor to create all tables and RLS policies.

## Design principles

- **Privacy first.** Researchers work with vulnerable populations. Personal calendar events are never visible to teammates. The PI sees only free/busy status — never what someone is doing, why they're blocked, or how they're feeling in their journal.
- **Internal-only scheduling.** There are no public booking links. Meeting proposals are between lab members only.
- **No noise.** The interface stays out of the way. One navy accent color, no gradients, no animations beyond what aids comprehension.
- **Prototype-ready.** Pages fall back to empty states (not mock data) when no database is connected, so UX can be validated in user studies before infrastructure is finalized.
