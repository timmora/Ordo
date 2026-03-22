-- ============================================================
-- Ordo — Phase 2: Subtasks for AI Task Decomposition
-- Run this in your Supabase SQL editor
-- ============================================================

-- Subtasks table
CREATE TABLE subtasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users NOT NULL,
  task_id           UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  title             TEXT NOT NULL,
  order_index       INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  scheduled_start   TIMESTAMPTZ,
  scheduled_end     TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'in_progress', 'complete')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own subtasks" ON subtasks
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_subtasks_task_id ON subtasks(task_id);

-- Link focus sessions to subtasks
ALTER TABLE focus_sessions
  ADD COLUMN subtask_id UUID REFERENCES subtasks(id) ON DELETE SET NULL;
