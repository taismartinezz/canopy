-- Add configurable wellbeing respondent threshold to projects table.
-- Defaults to 4 (matches the prior hardcoded value), so existing labs are unaffected.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS min_wellbeing_respondents integer NOT NULL DEFAULT 4;

-- ── get_wellbeing_rollup ──────────────────────────────────────────────────────
-- Returns weekly avg score per check-in question, only for weeks where at least
-- min_wellbeing_respondents distinct opted-in members submitted responses.
CREATE OR REPLACE FUNCTION get_wellbeing_rollup(p_project_id uuid)
RETURNS TABLE (
  week_start       date,
  question_id      text,
  avg_score        numeric,
  respondent_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH threshold AS (
    SELECT min_wellbeing_respondents AS t
    FROM   projects
    WHERE  id = p_project_id
  ),
  opted_in AS (
    SELECT us.user_id
    FROM   user_settings us
    JOIN   team_members  tm ON tm.user_id = us.user_id AND tm.project_id = p_project_id
    WHERE  us.wellbeing_opted_in = true
  ),
  weekly AS (
    SELECT
      date_trunc('week', je.created_at)::date AS week_start,
      jr.question_id,
      AVG(jr.score)                           AS avg_score,
      COUNT(DISTINCT je.user_id)              AS respondent_count
    FROM journal_entries  je
    JOIN journal_responses jr ON jr.entry_id = je.id
    JOIN opted_in          oi ON oi.user_id  = je.user_id
    WHERE je.project_id = p_project_id
      AND je.checkin    = true
    GROUP BY 1, 2
    HAVING COUNT(DISTINCT je.user_id) >= (SELECT t FROM threshold)
  )
  SELECT week_start, question_id, ROUND(avg_score, 2), respondent_count
  FROM   weekly
  ORDER  BY week_start, question_id;
$$;

-- ── get_overdue_signal ────────────────────────────────────────────────────────
-- Returns a single row: how many opted-in members have at least one overdue task,
-- and how many opted-in members exist total for this project.
CREATE OR REPLACE FUNCTION get_overdue_signal(p_project_id uuid)
RETURNS TABLE (
  overdue_count  bigint,
  total_members  bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH opted_in AS (
    SELECT us.user_id
    FROM   user_settings us
    JOIN   team_members  tm ON tm.user_id = us.user_id AND tm.project_id = p_project_id
    WHERE  us.wellbeing_opted_in = true
  ),
  overdue_members AS (
    SELECT DISTINCT ta.user_id
    FROM   tasks         t
    JOIN   task_assignees ta ON ta.task_id = t.id
    JOIN   opted_in       oi ON oi.user_id = ta.user_id
    WHERE  t.project_id = p_project_id
      AND  t.due_date   < CURRENT_DATE
      AND  t.status    != 'done'
      AND  (t.archived IS NULL OR t.archived = false)
  )
  SELECT
    (SELECT COUNT(*) FROM overdue_members)     AS overdue_count,
    (SELECT COUNT(*) FROM opted_in)            AS total_members;
$$;

NOTIFY pgrst, 'reload schema';
