-- Add recurrence support to tasks (same pattern as events)
ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT;
