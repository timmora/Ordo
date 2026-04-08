-- Preserve intentionally unscheduled subtasks as "to-do"
ALTER TABLE subtasks
  ADD COLUMN IF NOT EXISTS is_todo boolean NOT NULL DEFAULT false;
