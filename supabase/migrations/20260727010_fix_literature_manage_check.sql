-- Migration 010: Fix literature_items manage policy WITH CHECK
-- The previous policy required added_by = auth.uid() but added_by was never
-- set by app-level inserts, so all inserts and updates were silently rejected.
-- This migration:
--   1. Backfills added_by = user_id for existing rows where added_by is null
--   2. Changes WITH CHECK to accept either added_by or user_id as ownership proof

update literature_items
  set added_by = user_id
  where added_by is null and user_id is not null;

drop policy if exists "project members can manage literature" on literature_items;
create policy "project members can manage literature" on literature_items
  for all using (
    exists (
      select 1 from team_members tm
      where tm.project_id = literature_items.project_id
        and tm.user_id = auth.uid()
    )
    or
    (
      literature_items.sub_project_id is not null
      and exists (
        select 1 from sub_project_members spm
        where spm.sub_project_id = literature_items.sub_project_id
          and spm.user_id = auth.uid()
      )
    )
  ) with check (
    auth.uid() = coalesce(added_by, user_id)
  );
