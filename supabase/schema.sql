-- Run this in the Supabase SQL editor: Dashboard → SQL Editor → New query

-- ── Projects ──────────────────────────────────────────────────────────────────

create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  institution     text not null default '',
  research_type   text not null default '',
  research_participation text not null default 'wellbeing_only',
  owner_id        uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now()
);

alter table projects enable row level security;

-- Members of a project can read it; owner can update/delete
create policy "project members can read" on projects
  for select using (
    auth.uid() = owner_id
    or exists (
      select 1 from team_members tm
      where tm.project_id = projects.id and tm.user_id = auth.uid()
    )
  );

create policy "owner can insert own project" on projects
  for insert with check (auth.uid() = owner_id);

create policy "owner can update own project" on projects
  for update using (auth.uid() = owner_id);

-- ── User Profiles ─────────────────────────────────────────────────────────────

create table if not exists user_profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null,
  role            text not null check (role in ('pi', 'researcher')),
  institution     text,
  avatar_initials text,
  avatar_color    text default '#B4D4E3',
  project_id      uuid references projects(id) on delete set null,
  created_at      timestamptz not null default now()
);

alter table user_profiles enable row level security;

create policy "user can read own profile" on user_profiles
  for select using (auth.uid() = id);

create policy "same-project members can read profiles" on user_profiles
  for select using (
    exists (
      select 1 from team_members a
      join  team_members b on b.project_id = a.project_id
      where a.user_id = auth.uid() and b.user_id = user_profiles.id
    )
  );

create policy "user can upsert own profile" on user_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ── Team Members ──────────────────────────────────────────────────────────────

create table if not exists team_members (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('pi', 'researcher')),
  joined_at   timestamptz not null default now(),
  unique (project_id, user_id)
);

-- FK to user_profiles lets PostgREST resolve the join in select queries
alter table team_members add constraint if not exists fk_team_members_user_profiles
  foreign key (user_id) references user_profiles(id) on delete cascade;

alter table team_members enable row level security;

create policy "members can read team" on team_members
  for select using (
    exists (
      select 1 from team_members self
      where self.project_id = team_members.project_id and self.user_id = auth.uid()
    )
  );

create policy "user can insert own membership" on team_members
  for insert with check (auth.uid() = user_id);

-- ── Invite Codes ──────────────────────────────────────────────────────────────

create table if not exists invite_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  project_id  uuid not null references projects(id) on delete cascade,
  created_by  uuid not null references auth.users(id),
  used_by     uuid references auth.users(id),
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table invite_codes enable row level security;

create policy "anyone can look up a code" on invite_codes
  for select using (true);

create policy "pi can insert invite code" on invite_codes
  for insert with check (auth.uid() = created_by);

create policy "user can claim unused code" on invite_codes
  for update using (used_by is null) with check (auth.uid() = used_by);

-- ── Tasks ─────────────────────────────────────────────────────────────────────

create table if not exists tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  title         text not null,
  description   text not null default '',
  status        text not null check (status in ('todo','in_progress','in_review','done')) default 'todo',
  priority      text not null check (priority in ('high','medium','low')) default 'medium',
  assignee_ids  uuid[] not null default '{}',
  due_date      date,
  comments      jsonb not null default '[]',
  files         jsonb not null default '[]',
  links         jsonb not null default '[]',
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table tasks enable row level security;

create policy "project members can read tasks" on tasks
  for select using (
    exists (select 1 from team_members tm where tm.project_id = tasks.project_id and tm.user_id = auth.uid())
  );

create policy "project members can insert tasks" on tasks
  for insert with check (
    auth.uid() = created_by and
    exists (select 1 from team_members tm where tm.project_id = tasks.project_id and tm.user_id = auth.uid())
  );

create policy "project members can update tasks" on tasks
  for update using (
    exists (select 1 from team_members tm where tm.project_id = tasks.project_id and tm.user_id = auth.uid())
  );

create policy "project members can delete tasks" on tasks
  for delete using (
    exists (select 1 from team_members tm where tm.project_id = tasks.project_id and tm.user_id = auth.uid())
  );

-- ── Journal Entries ───────────────────────────────────────────────────────────

create table if not exists journal_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid references projects(id) on delete cascade,
  date        date not null,
  prompts     jsonb not null default '[]',
  checkin     jsonb not null default '[]',
  is_draft    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table journal_entries enable row level security;

create policy "user owns journal entries" on journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Literature Collections ────────────────────────────────────────────────────

create table if not exists literature_collections (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  name        text not null,
  icon_name   text not null default 'Library',
  created_at  timestamptz not null default now()
);

alter table literature_collections enable row level security;

create policy "project members can read collections" on literature_collections
  for select using (
    exists (select 1 from team_members tm where tm.project_id = literature_collections.project_id and tm.user_id = auth.uid())
  );

create policy "project members can manage collections" on literature_collections
  for all using (
    exists (select 1 from team_members tm where tm.project_id = literature_collections.project_id and tm.user_id = auth.uid())
  );

-- ── Literature Items ──────────────────────────────────────────────────────────

create table if not exists literature_items (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  scope           text not null check (scope in ('lab','my')) default 'lab',
  type            text not null check (type in ('article','book','preprint','report','thesis')) default 'article',
  title           text not null,
  authors         text[] not null default '{}',
  year            int,
  journal         text,
  publisher       text,
  volume          text,
  pages           text,
  doi             text,
  abstract        text,
  tags            text[] not null default '{}',
  status          text not null check (status in ('unread','reading','read')) default 'unread',
  rating          int not null default 0,
  notes           text not null default '',
  files           jsonb not null default '[]',
  collections     text[] not null default '{}',
  related_ids     text[] not null default '{}',
  added_by        uuid not null references auth.users(id),
  added_at        timestamptz not null default now()
);

alter table literature_items enable row level security;

create policy "project members can read literature" on literature_items
  for select using (
    exists (select 1 from team_members tm where tm.project_id = literature_items.project_id and tm.user_id = auth.uid())
  );

create policy "project members can manage literature" on literature_items
  for all using (
    exists (select 1 from team_members tm where tm.project_id = literature_items.project_id and tm.user_id = auth.uid())
  ) with check (
    auth.uid() = added_by
  );

-- ── Scheduling: User Availability ────────────────────────────────────────────
-- Stores each member's weekly availability as an array of "day-slot" keys.
-- Only free/busy is shared — no event content is stored here.

create table if not exists user_availability (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  slots       text[] not null default '{}',
  updated_at  timestamptz not null default now(),
  unique (project_id, user_id)
);

alter table user_availability enable row level security;

create policy "project members can read availability" on user_availability
  for select using (
    exists (select 1 from team_members tm where tm.project_id = user_availability.project_id and tm.user_id = auth.uid())
  );

create policy "user can upsert own availability" on user_availability
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Scheduling: Meeting Proposals ─────────────────────────────────────────────

create table if not exists meeting_proposals (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  proposer_id      uuid not null references auth.users(id),
  title            text not null,
  description      text,
  proposed_date    date not null,
  proposed_time    time not null,
  duration_minutes int not null default 30,
  invitee_ids      uuid[] not null default '{}',
  responses        jsonb not null default '[]',
  created_at       timestamptz not null default now()
);

alter table meeting_proposals enable row level security;

create policy "project members can read proposals" on meeting_proposals
  for select using (
    exists (select 1 from team_members tm where tm.project_id = meeting_proposals.project_id and tm.user_id = auth.uid())
  );

create policy "project members can insert proposals" on meeting_proposals
  for insert with check (
    auth.uid() = proposer_id and
    exists (select 1 from team_members tm where tm.project_id = meeting_proposals.project_id and tm.user_id = auth.uid())
  );

create policy "project members can update proposal responses" on meeting_proposals
  for update using (
    exists (select 1 from team_members tm where tm.project_id = meeting_proposals.project_id and tm.user_id = auth.uid())
  );

-- ── Scheduling: Schedule Events ───────────────────────────────────────────────
-- Lab-wide events are visible to all project members.
-- Personal events are visible only to their creator.

create table if not exists schedule_events (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  title       text not null,
  date        date not null,
  time        time,
  end_time    time,
  scope       text not null check (scope in ('lab', 'personal')) default 'lab',
  created_by  uuid not null references auth.users(id),
  description text,
  created_at  timestamptz not null default now()
);

alter table schedule_events enable row level security;

create policy "members can read lab events and own personal events" on schedule_events
  for select using (
    (scope = 'lab' and exists (
      select 1 from team_members tm where tm.project_id = schedule_events.project_id and tm.user_id = auth.uid()
    ))
    or (scope = 'personal' and auth.uid() = created_by)
  );

create policy "project members can insert events" on schedule_events
  for insert with check (
    auth.uid() = created_by and
    exists (select 1 from team_members tm where tm.project_id = schedule_events.project_id and tm.user_id = auth.uid())
  );

create policy "creator can delete own events" on schedule_events
  for delete using (auth.uid() = created_by);

-- ── Scheduling: Reminders ─────────────────────────────────────────────────────
-- Private to each user — no one else can read or modify them.

create table if not exists reminders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  project_id      uuid references projects(id) on delete cascade,
  scope           text not null check (scope in ('personal', 'lab')) default 'personal',
  title           text not null,
  due_at          timestamptz,
  linked_task_id  uuid,
  linked_event_id uuid,
  email_enabled   boolean not null default false,
  sent            boolean not null default false,
  completed       boolean not null default false,
  completed_at    timestamptz,
  priority        text check (priority in ('low', 'medium', 'high')),
  recurrence      text check (recurrence in ('daily', 'weekly', 'monthly')),
  created_at      timestamptz not null default now()
);

alter table reminders enable row level security;

-- Personal: own only. Lab: all project members can read + mark done; only creator can delete.
create policy "reminders select" on reminders
  for select using (
    auth.uid() = user_id
    or (scope = 'lab' and exists (
      select 1 from team_members tm
      where tm.project_id = reminders.project_id and tm.user_id = auth.uid()
    ))
  );

create policy "reminders insert" on reminders
  for insert with check (auth.uid() = user_id);

create policy "reminders update" on reminders
  for update using (
    auth.uid() = user_id
    or (scope = 'lab' and exists (
      select 1 from team_members tm
      where tm.project_id = reminders.project_id and tm.user_id = auth.uid()
    ))
  );

create policy "reminders delete" on reminders
  for delete using (auth.uid() = user_id);
