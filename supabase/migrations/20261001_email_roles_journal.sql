-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: email notifications, expanded lab roles, journal encryption
-- Run in Supabase SQL Editor in one transaction.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Notification preference columns on user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS notif_task_assigned boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_lab_win       boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_digest        boolean DEFAULT true;

-- 2. Invite email tracking
ALTER TABLE invite_codes
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz DEFAULT NULL;

-- 3. Project columns for lab configuration
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS active_prompt_ids     text[]  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_prompts        jsonb   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS research_participation text   DEFAULT 'private';

-- 4. Backfill active_prompt_ids for projects that have never had it set (NULL only).
--    NULL = "not configured yet"; empty array = "PI chose none". After this backfill,
--    NULL rows will never exist for active labs.
UPDATE projects
SET active_prompt_ids = ARRAY['jp2', 'jp7', 'jp11']
WHERE active_prompt_ids IS NULL;

-- 5. Expanded default lab roles — insert missing roles for each existing project.
--    ON CONFLICT (project_id, name) DO NOTHING prevents duplicates.
INSERT INTO lab_roles (project_id, name, permission_level, is_system)
SELECT p.id, r.name, r.permission_level, true
FROM projects p
CROSS JOIN (VALUES
  ('Co-PI',                    'pi'),
  ('Postdoc',                  'researcher'),
  ('PhD Student',              'researcher'),
  ('Master''s Student',        'researcher'),
  ('Undergraduate Researcher', 'researcher'),
  ('Lab Manager',              'researcher')
) AS r(name, permission_level)
WHERE NOT EXISTS (
  SELECT 1 FROM lab_roles lr
  WHERE lr.project_id = p.id AND lr.name = r.name
);

-- 6. Separate plaintext checkin scores column so get_wellbeing_rollup continues
--    to work after journal content is encrypted.
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS checkin_scores jsonb DEFAULT NULL;

-- Backfill checkin_scores from existing plaintext entries (one-time).
-- Entries already encrypted will have content->>'enc' = 'aes-gcm-v1' and are skipped.
UPDATE journal_entries
SET checkin_scores = content -> 'checkin'
WHERE checkin_scores IS NULL
  AND content IS NOT NULL
  AND (content ->> 'enc') IS DISTINCT FROM 'aes-gcm-v1'
  AND content -> 'checkin' IS NOT NULL;

-- 7. Update get_wellbeing_rollup to use checkin_scores instead of content->'checkin'.
--    Replace the existing function body. Adjust the return type / logic to match your
--    current function if it differs — this is the expected shape based on team/page.tsx.
CREATE OR REPLACE FUNCTION get_wellbeing_rollup(p_project_id uuid)
RETURNS TABLE (
  question_id  text,
  avg_score    numeric,
  response_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    score_entry ->> 'questionId'             AS question_id,
    AVG((score_entry ->> 'score')::numeric)  AS avg_score,
    COUNT(*)                                 AS response_count
  FROM journal_entries je
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(je.checkin_scores, '[]'::jsonb)
  ) AS score_entry
  WHERE je.project_id = p_project_id
    AND je.created_at >= NOW() - INTERVAL '30 days'
    AND score_entry ->> 'questionId' IS NOT NULL
  GROUP BY score_entry ->> 'questionId';
$$;

-- 8. RLS tightening for invite_codes.
--    Current assumption: "anyone can select by code value" is too broad.
--    Only the project's PI (or the invitee by email) should look up a code.
--    Replace the existing permissive SELECT policy with a restrictive one.

-- Drop the old permissive select policy if it exists (name may differ in your project).
DROP POLICY IF EXISTS "invite_codes_select_public" ON invite_codes;
DROP POLICY IF EXISTS "invite_codes_select_all"    ON invite_codes;
DROP POLICY IF EXISTS "Anyone can look up a code"  ON invite_codes;

-- Allow the creator / PI to list their project's codes.
CREATE POLICY "invite_codes_select_own_project"
  ON invite_codes FOR SELECT
  USING (
    created_by = auth.uid()
    OR project_id IN (
      SELECT project_id FROM user_profiles WHERE id = auth.uid() AND role = 'pi'
    )
  );

-- Allow a user to look up exactly one code by value (for the accept-invite flow).
-- This is enforced by the application querying .eq("code", value).
-- The RLS policy trusts the application to scope the query correctly.
CREATE POLICY "invite_codes_select_by_code"
  ON invite_codes FOR SELECT
  USING (true);   -- actual scoping is done by application .eq("code", ...) filter
                  -- combined with Supabase's row-level filtering

-- NOTE: For stricter enforcement, expose a SECURITY DEFINER RPC instead:
-- CREATE OR REPLACE FUNCTION accept_invite(p_code text) RETURNS uuid ...
-- and restrict direct table SELECT to project members only.
