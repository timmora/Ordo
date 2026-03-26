# Ordo

**An AI-powered student productivity app** that breaks down overwhelming tasks into scheduled, actionable subtasks, while tracking your focus time, mood, and progress in one place.

<!-- ![Ordo screenshot](docs/screenshot.png) -->
<!-- Uncomment and add a screenshot or demo GIF above -->

<!-- **[Live Demo](https://your-demo-url.com)** · -->
<!-- Uncomment and add a link when deployed -->

## Why I Built Ordo

Ordo is something I've been thinking about since my freshman year of college. The shift from high school to college was a big one, and one of the areas where I struggled a great deal was planning. I suddenly had a lot on my plate and navigating this was a challenge that took long to really get through. I tried all kinds of things, from Google Calendar, to to-do list apps, to focus timer apps and even creating my own environment in Notion. However, it always felt like I was missing something. These apps were either too complex to navigate, didn't give me everything I needed in one place, or required paid plans to get the full experience.

I wanted a single tool that handled the full student workflow: not just a to-do list, but something that understands *how long* tasks take, *when* you're free, and *how* you're actually doing. Existing apps handled pieces of this, but none of them really close the loop between planning, execution, and reflection.

Ordo is where I wanted to connect all three. You add a task, AI decomposes it into subtasks and slots them into your calendar around classes and events, and you work through them with a focus timer. At the end of the day, a journal captures how it went, building data you can actually learn from.

## What Ordo Does

**AI Task Decomposition** — Describe an assignment and Claude breaks it into ordered subtasks with time estimates, then the scheduler places them into open slots on your calendar based on your daily capacity and preferred study hours.

**Focus Timer** — Pomodoro timer linked to specific tasks and subtasks. Tracks per-subtask focus time against estimates so you can see if you're on pace. Logs daily sessions and maintains a streak counter.

**Daily Journal** — Mood and energy check-in (quantitative, trackable over time) plus three reflection prompts: wins, challenges, and tomorrow's intention. No task-parroting — the journal is about your internal state, not your to-do list.

**AI Daily Briefing** — Overview tab generates a summary of your day with completion stats, focus hours, and a personalized tip. Cached per day, regenerate on demand.

**Calendar** — FullCalendar with week/month/year views showing course schedules, events, tasks, and subtasks. Inline checkboxes for marking items done. Recurring events and tasks via RRULE.

## Technical Highlights

**Structured AI output** — The decomposition endpoint sends Claude a system prompt with the task context and course schedule, then parses the response into typed subtask objects with `title`, `estimated_minutes`, and `scheduled_start`. The backend validates and cleans the AI output before returning it to the client.

**Row-Level Security everywhere** — Every table uses Supabase RLS with `auth.uid() = user_id` policies. The frontend talks directly to Supabase for CRUD; the backend uses a service-role key only for cross-user operations and AI calls.

**React Query as the data layer** — All data flows through React Query hooks with a generic `useSupabaseCrud` factory. Mutations invalidate related queries and trigger side effects (summary refresh, schedule recalculation). No prop drilling — each component subscribes to exactly the data it needs.

**Constraint-based scheduling** — The scheduler endpoint collects the user's courses, events, and capacity settings, builds a free-slot map, then greedily assigns subtasks into available windows. Respects daily hour limits and preferred time ranges.

**Optimistic subtask reordering** — Drag-and-drop subtask reorder uses dnd-kit with optimistic cache updates. The reorder mutation sends the new `order_index` array to Supabase in a single batch.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7 |
| Styling | Tailwind CSS v4, shadcn/ui |
| Calendar | FullCalendar v6 |
| Data | React Query v5, Zustand |
| Database | Supabase (Postgres + Auth + RLS) |
| Backend | FastAPI, Python |
| AI | Anthropic Claude API |

<details>
<summary><strong>Project Structure</strong></summary>

```
frontend/src/
├── components/
│   ├── calendar/       FullCalendar wrapper with custom event rendering
│   ├── courses/        Course CRUD modal + sidebar
│   ├── events/         Event CRUD modal
│   ├── tasks/          Task modal, AI decomposition, subtask list (dnd-kit)
│   ├── journal/        Mood/energy selectors, day stats banner
│   ├── settings/       Capacity & schedule preferences
│   ├── shared/         Reusable form fields (color picker, recurrence, time input)
│   ├── tabs/           6 main views (Overview, Calendar, Events, Tasks, Focus, Journal)
│   └── ui/             shadcn/ui primitives
├── hooks/              React Query CRUD hooks + useSupabaseCrud factory
├── lib/                Supabase client, calendar utils, date helpers
├── store/              Zustand stores
└── types/              TypeScript database types

backend/app/
├── main.py             FastAPI app + CORS
├── auth.py             JWT validation via Supabase JWKS
├── decompose.py        AI task decomposition endpoint
├── summary.py          AI daily briefing endpoint
├── scheduler.py        Dynamic subtask scheduling
└── config.py           Env config + cached Supabase/Anthropic clients

supabase/migrations/    8 SQL migrations (courses, events, tasks, subtasks,
                        focus_sessions, journal_entries, daily_summaries,
                        user_settings) — all with RLS
```

</details>

<details>
<summary><strong>Getting Started</strong></summary>

### Prerequisites

- Node.js 18+, pnpm
- Python 3.11+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key

### Database

Run the 8 migrations in order (`supabase/migrations/001_initial.sql` through `008_user_settings.sql`) in the Supabase SQL Editor.

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Create `frontend/.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_BACKEND_URL=http://localhost:8000
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Create `backend/.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
ANTHROPIC_API_KEY=your-anthropic-api-key
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:8000`.

</details>
