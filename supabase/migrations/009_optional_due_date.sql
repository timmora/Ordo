-- Make due_date optional on tasks to support undated to-do items
ALTER TABLE tasks ALTER COLUMN due_date DROP NOT NULL;
