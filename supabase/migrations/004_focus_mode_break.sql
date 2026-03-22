-- Replace short_break/long_break with a single 'break' mode
-- Update existing rows
UPDATE focus_sessions SET mode = 'break' WHERE mode IN ('short_break', 'long_break');

-- Drop old constraint and add new one
ALTER TABLE focus_sessions DROP CONSTRAINT IF EXISTS focus_sessions_mode_check;
ALTER TABLE focus_sessions ADD CONSTRAINT focus_sessions_mode_check CHECK (mode IN ('focus', 'break'));
