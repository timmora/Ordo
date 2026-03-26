-- User settings for capacity controls & scheduling preferences
CREATE TABLE user_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  daily_capacity_hours NUMERIC(3,1) NOT NULL DEFAULT 6.0,
  schedule_start_time  TEXT NOT NULL DEFAULT '08:00',
  schedule_end_time    TEXT NOT NULL DEFAULT '22:00',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own settings" ON user_settings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
