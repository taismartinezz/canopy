-- User-specific settings: timezone and per-day working hours
-- working_hours keys: "0"=Mon … "6"=Sun, value null = off day
-- Default: 9 AM–5 PM Monday–Friday, weekends off

CREATE TABLE IF NOT EXISTS user_settings (
  user_id      uuid PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  timezone     text NOT NULL DEFAULT 'America/New_York',
  working_hours jsonb NOT NULL DEFAULT '{
    "0": {"start": "09:00", "end": "17:00"},
    "1": {"start": "09:00", "end": "17:00"},
    "2": {"start": "09:00", "end": "17:00"},
    "3": {"start": "09:00", "end": "17:00"},
    "4": {"start": "09:00", "end": "17:00"},
    "5": null,
    "6": null
  }'::jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users can read/write only their own settings
CREATE POLICY "user_settings: owner select"
  ON user_settings FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_settings: owner insert"
  ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_settings: owner update"
  ON user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Team members of the same lab can read each other's settings (for scheduling)
CREATE POLICY "user_settings: team members select"
  ON user_settings FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm1
      JOIN team_members tm2 ON tm1.project_id = tm2.project_id
      WHERE tm1.user_id = auth.uid()
        AND tm2.user_id = user_settings.user_id
    )
  );
