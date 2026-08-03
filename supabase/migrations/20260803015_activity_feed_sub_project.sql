-- Add sub_project_id to activity_feed so individual project dashboards can filter
-- the Team Activity widget to only show activity belonging to the selected sub-project.
--
-- Existing rows get sub_project_id = NULL, which is intentional: they are treated as
-- lab-wide activity and appear only in the Lab Home dashboard view. Project-specific
-- views will only show rows where sub_project_id matches the selected sub-project.
--
-- Run this migration before deploying the dashboard scoping changes.

ALTER TABLE activity_feed
  ADD COLUMN IF NOT EXISTS sub_project_id uuid REFERENCES sub_projects(id);
