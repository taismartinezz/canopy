-- Migration 013: Drop the stale bookmarks delete policy.
-- Migration 011 created "members can delete bookmarks" (the correct policy) but its
-- DROP used the wrong name ("adder can delete bookmarks") so the old restrictive policy
-- "Members can delete their own bookmarks" was never removed. Both policies are now
-- PERMISSIVE and the union of their USING clauses is correct, but the old one is
-- redundant. This migration drops it for clarity.

drop policy if exists "Members can delete their own bookmarks" on bookmarks;
drop policy if exists "adder can delete bookmarks" on bookmarks;
