-- ============================================================
-- Aporia — Phase 1 Initial Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Courses
create table courses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  name        text not null,
  color       text not null default '#6366f1',
  -- Array of recurring blocks: [{day:'Mon', start:'10:00', end:'11:00', location:''}]
  schedule    jsonb not null default '[]',
  created_at  timestamptz not null default now()
);
alter table courses enable row level security;
create policy "users manage own courses" on courses
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Events (calendar events — distinct from tasks)
create table events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  course_id       uuid references courses(id) on delete set null,
  title           text not null,
  start_time      timestamptz not null,
  end_time        timestamptz,
  location        text,
  color           text,
  all_day         boolean not null default false,
  recurrence_rule text,          -- RRULE string (e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR")
  created_at      timestamptz not null default now()
);
alter table events enable row level security;
create policy "users manage own events" on events
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Tasks
create table tasks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  course_id       uuid references courses(id) on delete set null,
  title           text not null,
  due_date        date not null,
  estimated_hours numeric(4, 1),
  priority        text not null default 'medium'
                    check (priority in ('low', 'medium', 'high')),
  status          text not null default 'todo'
                    check (status in ('todo', 'in_progress', 'done')),
  created_at      timestamptz not null default now()
);
alter table tasks enable row level security;
create policy "users manage own tasks" on tasks
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
