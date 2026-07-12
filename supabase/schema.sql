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

-- ── Literature: Additions ─────────────────────────────────────────────────────

-- Add url + import_source to existing literature_items
alter table literature_items
  add column if not exists url text,
  add column if not exists import_source text check (import_source in ('manual','zotero_json','zotero_api','doi','bibtex','url'));

-- Per-user reading status (overrides the item-level status for multi-user views)
create table if not exists lit_reading_status (
  user_id   uuid not null references auth.users(id) on delete cascade,
  item_id   uuid not null references literature_items(id) on delete cascade,
  status    text not null check (status in ('unread','reading','read')) default 'unread',
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table lit_reading_status enable row level security;

create policy "user can manage own reading status" on lit_reading_status
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Project members can see team reading status for shared items
create policy "project members can read team status" on lit_reading_status
  for select using (
    exists (
      select 1 from literature_items li
      join team_members tm on tm.project_id = li.project_id
      where li.id = lit_reading_status.item_id and tm.user_id = auth.uid()
    )
  );

-- Annotations: highlights + comments on a reference
create table if not exists lit_annotations (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references literature_items(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  text       text not null default '',    -- quoted passage; empty for standalone comment
  comment    text not null default '',
  page_ref   text,
  parent_id  uuid references lit_annotations(id) on delete cascade,  -- null = top-level
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table lit_annotations enable row level security;

create policy "project members can read annotations" on lit_annotations
  for select using (
    exists (
      select 1 from literature_items li
      join team_members tm on tm.project_id = li.project_id
      where li.id = lit_annotations.item_id and tm.user_id = auth.uid()
    )
  );

create policy "project members can insert annotations" on lit_annotations
  for insert with check (
    auth.uid() = author_id and
    exists (
      select 1 from literature_items li
      join team_members tm on tm.project_id = li.project_id
      where li.id = lit_annotations.item_id and tm.user_id = auth.uid()
    )
  );

create policy "author can update own annotation" on lit_annotations
  for update using (auth.uid() = author_id);

create policy "author can delete own annotation" on lit_annotations
  for delete using (auth.uid() = author_id);

-- Assigned readings: PI assigns a reference to one or more members
create table if not exists lit_assigned_readings (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references literature_items(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  assigned_by uuid not null references auth.users(id),
  assignee_id uuid not null references auth.users(id),
  due_date    date,
  note        text,
  created_at  timestamptz not null default now()
);

alter table lit_assigned_readings enable row level security;

create policy "project members can read assigned readings" on lit_assigned_readings
  for select using (
    exists (select 1 from team_members tm where tm.project_id = lit_assigned_readings.project_id and tm.user_id = auth.uid())
  );

create policy "pi can assign readings" on lit_assigned_readings
  for insert with check (
    auth.uid() = assigned_by and
    exists (
      select 1 from user_profiles up where up.id = auth.uid() and up.role = 'pi'
    )
  );

create policy "assigner can delete assignments" on lit_assigned_readings
  for delete using (auth.uid() = assigned_by);

-- Per-user Zotero credentials (stored encrypted at rest via Supabase Vault in prod)
create table if not exists user_zotero_credentials (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  api_key        text not null,             -- treat as sensitive; encrypt in prod via Vault
  zotero_user_id text not null,
  group_id       text,                      -- optional Zotero group library
  last_synced_at timestamptz,
  created_at     timestamptz not null default now()
);

alter table user_zotero_credentials enable row level security;

create policy "user can manage own zotero creds" on user_zotero_credentials
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- AI recommendation cache (per project, keyed to source item + OpenAlex ID)
create table if not exists lit_recommendation_cache (
  id             uuid primary key default gen_random_uuid(),
  source_item_id uuid not null references literature_items(id) on delete cascade,
  project_id     uuid not null references projects(id) on delete cascade,
  title          text not null,
  authors        text[] not null default '{}',
  year           int,
  journal        text,
  doi            text,
  abstract       text,
  open_alex_id   text,
  score          float,
  dismissed      boolean not null default false,
  cached_at      timestamptz not null default now()
);

alter table lit_recommendation_cache enable row level security;

create policy "project members can read recommendations" on lit_recommendation_cache
  for select using (
    exists (select 1 from team_members tm where tm.project_id = lit_recommendation_cache.project_id and tm.user_id = auth.uid())
  );

create policy "project members can manage recommendation cache" on lit_recommendation_cache
  for all using (
    exists (select 1 from team_members tm where tm.project_id = lit_recommendation_cache.project_id and tm.user_id = auth.uid())
  );

-- ── Feature additions ─────────────────────────────────────────────────────────

-- Item 2: annotation color tagging
alter table lit_annotations add column if not exists color text;

-- Item 7: reading status + visibility on assigned readings
alter table lit_assigned_readings
  add column if not exists reading_status text not null default 'not_started'
    check (reading_status in ('not_started', 'in_progress', 'done')),
  add column if not exists status_hidden boolean not null default false;

-- Assignee can update their own reading_status and status_hidden
create policy if not exists "assignee can update reading status" on lit_assigned_readings
  for update using (auth.uid() = assignee_id);

-- Item 4: project-level library scope
create table if not exists project_libraries (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name       text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table project_libraries enable row level security;

create policy if not exists "project members can read project libraries" on project_libraries
  for select using (
    exists (select 1 from team_members tm where tm.project_id = project_libraries.project_id and tm.user_id = auth.uid())
  );

create policy if not exists "project members can manage project libraries" on project_libraries
  for all using (
    exists (select 1 from team_members tm where tm.project_id = project_libraries.project_id and tm.user_id = auth.uid())
  ) with check (auth.uid() = created_by);

-- Link literature items to a named project library (optional, null = unassigned)
alter table literature_items
  add column if not exists project_library_id uuid references project_libraries(id) on delete set null;

-- ── RPC: email → user_id lookup ───────────────────────────────────────────────
-- SECURITY DEFINER so it can read auth.users (email lives there, not in user_profiles).
-- Restricted to team members of the given project so users can't enumerate all emails.
create or replace function find_team_member_id_by_email(p_project_id uuid, p_email text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select tm.user_id
  from   team_members tm
  join   auth.users u on u.id = tm.user_id
  where  tm.project_id = p_project_id
    and  lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

-- ── RPC: server-enforced status masking for assigned readings ─────────────────
-- Peers receive reading_status = NULL and status_hidden = NULL for hidden rows,
-- so the masked values are never sent over the wire.
-- agg_done / agg_total carry the true aggregate (including hidden entries) so
-- the client can display "X of Y completed" without leaking individual statuses.
create or replace function get_item_assignments(p_item_id uuid)
returns table (
  id             uuid,
  item_id        uuid,
  project_id     uuid,
  assigned_by    uuid,
  assignee_id    uuid,
  due_date       date,
  note           text,
  reading_status text,
  status_hidden  boolean,
  created_at     timestamptz,
  agg_done       bigint,
  agg_total      bigint
)
language plpgsql
security invoker
stable
as $$
declare
  v_project uuid;
  v_is_pi   boolean;
  v_done    bigint;
  v_total   bigint;
begin
  -- Resolve project_id from any assignment row for this item
  select lar.project_id into v_project
  from   lit_assigned_readings lar
  where  lar.item_id = p_item_id
  limit  1;

  -- Guard: return nothing if no assignments or caller is not a project member
  if v_project is null or not exists (
    select 1 from team_members tm
    where  tm.project_id = v_project and tm.user_id = auth.uid()
  ) then
    return;
  end if;

  -- Is the caller a PI in this project?
  select exists (
    select 1 from user_profiles up
    join   team_members tm on tm.user_id = up.id
    where  tm.project_id = v_project
      and  up.id = auth.uid()
      and  up.role = 'pi'
  ) into v_is_pi;

  -- True aggregate counts (all rows, regardless of status_hidden)
  select count(*) filter (where reading_status = 'done'), count(*)
  into   v_done, v_total
  from   lit_assigned_readings
  where  item_id = p_item_id;

  return query
  select
    lar.id,
    lar.item_id,
    lar.project_id,
    lar.assigned_by,
    lar.assignee_id,
    lar.due_date,
    lar.note,
    -- mask reading_status for rows where status is hidden from this caller
    case
      when not lar.status_hidden
        or  lar.assignee_id = auth.uid()
        or  v_is_pi
      then lar.reading_status
      else null
    end,
    -- mask the flag itself: only the assignee and PI need to see it
    case
      when lar.assignee_id = auth.uid() or v_is_pi
      then lar.status_hidden
      else null
    end,
    lar.created_at,
    v_done,
    v_total
  from lit_assigned_readings lar
  where lar.item_id = p_item_id;
end;
$$;
