-- Persistent daily AI summaries (one per user per day)
CREATE TABLE daily_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  summary TEXT NOT NULL,
  tip TEXT NOT NULL,
  stats JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own summaries" ON daily_summaries
  FOR ALL USING (user_id = auth.uid());
