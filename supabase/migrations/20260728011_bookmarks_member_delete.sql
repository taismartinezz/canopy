-- Migration 011: Allow any lab/project member to delete shared bookmarks.
-- Personal bookmarks remain restricted to their creator.

drop policy if exists "adder can delete bookmarks" on bookmarks;

create policy "members can delete bookmarks" on bookmarks
  for delete using (
    -- Personal bookmarks: only the creator can delete
    (scope = 'personal' and added_by = auth.uid())
    -- Lab / project-scoped bookmarks: any project member can delete
    or (
      coalesce(scope, 'lab') != 'personal'
      and exists (
        select 1 from team_members tm
        where tm.project_id = bookmarks.project_id and tm.user_id = auth.uid()
      )
    )
  );
