-- Reminder metadata for events/tasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_minutes_before integer,
  ADD COLUMN IF NOT EXISTS reminder_last_sent_at timestamptz;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_minutes_before integer,
  ADD COLUMN IF NOT EXISTS reminder_last_sent_at timestamptz;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_reminder_minutes_before_valid
  CHECK (reminder_minutes_before IS NULL OR reminder_minutes_before IN (5, 10, 15, 30, 60, 120, 1440));

ALTER TABLE events
  ADD CONSTRAINT events_reminder_minutes_before_valid
  CHECK (reminder_minutes_before IS NULL OR reminder_minutes_before IN (5, 10, 15, 30, 60, 120, 1440));
