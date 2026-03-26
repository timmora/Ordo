import json
from datetime import time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from .auth import get_current_user
from .config import get_anthropic, get_supabase
from .utils import extract_text, parse_ai_json

router = APIRouter(prefix="/api")

SYSTEM_PROMPT = """You are a concise, supportive study coach embedded in a student productivity app.
Given the student's current tasks, events, focus session stats, and journal entries, produce a short daily briefing.

Rules:
- Return ONLY a valid JSON object with exactly these keys:
  "summary" (string, 2-4 sentences: what's ahead today/this week, priorities, encouragement),
  "stats" (object with "focus_hours" (number), "tasks_completed" (number), "tasks_total" (number)),
  "tip" (string, 1 sentence: a personalized productivity tip based on their data)
- Be specific to their actual tasks and courses, not generic.
- Keep the tone warm but brief — like a smart friend checking in.
- Do NOT start with time-of-day greetings like "Good morning", "Good afternoon", "Good evening", or "Good night". Use a time-neutral greeting instead.
- Do NOT use markdown or formatting. Plain text only."""


class SummaryResponse(BaseModel):
    summary: str
    stats: dict
    tip: str


@router.post("/overview-summary", response_model=SummaryResponse)
async def overview_summary(
    tz: str = Query(default="America/Chicago"),
    force: bool = Query(default=False),
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()

    from datetime import date, datetime as dt, timedelta

    try:
        local_tz = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, KeyError):
        local_tz = ZoneInfo("America/Chicago")

    now_local = dt.now(local_tz)
    today = now_local.date()

    # Check cache first (unless force regeneration requested)
    if not force:
        cached = sb.table("daily_summaries").select("summary, tip, stats").eq("user_id", user_id).eq("date", str(today)).maybe_single().execute()
        if cached and cached.data:
            return SummaryResponse(
                summary=cached.data["summary"],
                stats=cached.data["stats"],
                tip=cached.data["tip"],
            )

    ai = get_anthropic()
    week_ago = today - timedelta(days=7)
    week_ahead = today + timedelta(days=7)

    tasks_resp = sb.table("tasks").select("id, title, due_date, due_time, estimated_hours, priority, status, course_id").eq("user_id", user_id).gte("due_date", str(week_ago)).lte("due_date", str(week_ahead)).execute()
    task_ids = [t["id"] for t in (tasks_resp.data or [])]
    subtasks_resp = sb.table("subtasks").select("task_id, title, estimated_minutes, status, order_index").eq("user_id", user_id).in_("task_id", task_ids).order("order_index").execute() if task_ids else type("R", (), {"data": []})()

    events_resp = sb.table("events").select("title, start_time, end_time, all_day, course_id").eq("user_id", user_id).gte("start_time", f"{week_ago}T00:00:00").lte("start_time", f"{week_ahead}T23:59:59").execute()
    courses_resp = sb.table("courses").select("id, name").eq("user_id", user_id).execute()
    focus_resp = sb.table("focus_sessions").select("duration_seconds, mode, completed_at, task_id").eq("user_id", user_id).gte("completed_at", f"{week_ago}T00:00:00").execute()
    journal_resp = sb.table("journal_entries").select("date, responses").eq("user_id", user_id).gte("date", str(week_ago)).lte("date", str(today)).order("date", desc=True).limit(3).execute()

    tasks = tasks_resp.data or []
    events = events_resp.data or []
    courses = courses_resp.data or []
    focus_sessions = focus_resp.data or []
    journal_entries = journal_resp.data or []

    course_map = {c["id"]: c["name"] for c in courses}

    # Convert event times to local timezone for accurate AI interpretation
    def to_local(iso_str: str | None) -> str | None:
        if not iso_str:
            return None
        try:
            parsed = dt.fromisoformat(iso_str)
            local = parsed.astimezone(local_tz)
            return local.strftime("%Y-%m-%d %I:%M %p")
        except Exception:
            return iso_str

    # Group subtasks by task_id
    subtasks = subtasks_resp.data or []
    subtask_map: dict[str, list] = {}
    for s in subtasks:
        subtask_map.setdefault(s["task_id"], []).append({
            "title": s["title"],
            "estimated_minutes": s["estimated_minutes"],
            "status": s["status"],
        })

    # Enrich tasks with course names, subtasks, and overdue status
    today_str = str(today)
    for t in tasks:
        t["course"] = course_map.get(t.get("course_id"), None)
        task_subtasks = subtask_map.get(t.get("id"), [])
        if task_subtasks:
            t["subtasks"] = task_subtasks
        # Mark overdue / due today / upcoming
        if t.get("status") == "done":
            t["time_status"] = "done"
        elif t.get("due_date", "") < today_str:
            t["time_status"] = "overdue"
        elif t.get("due_date", "") == today_str:
            if t.get("due_time"):
                try:
                    h, m = t["due_time"].split(":")
                    due_dt = dt.combine(today, time(int(h), int(m)), tzinfo=local_tz)
                    t["time_status"] = "overdue" if now_local > due_dt else "due_today"
                except Exception:
                    t["time_status"] = "due_today"
            else:
                t["time_status"] = "due_today"
        else:
            t["time_status"] = "upcoming"
        # Remove id and course_id from AI context
        t.pop("id", None)
    for e in events:
        e["course"] = course_map.get(e.get("course_id"), None)
        # Determine if event has already passed
        raw_end = e.get("end_time") or e.get("start_time")
        if raw_end and not e.get("all_day"):
            try:
                end_dt = dt.fromisoformat(raw_end).astimezone(local_tz)
                e["status"] = "past" if end_dt < now_local else "upcoming"
            except Exception:
                pass
        e["start_time"] = to_local(e.get("start_time"))
        e["end_time"] = to_local(e.get("end_time"))

    # Compute stats — only count focus-mode sessions >= 1 minute
    meaningful_sessions = [s for s in focus_sessions if s["mode"] == "focus" and s["duration_seconds"] >= 60]
    focus_seconds = sum(s["duration_seconds"] for s in meaningful_sessions)
    focus_hours = round(focus_seconds / 3600, 1)
    tasks_completed = len([t for t in tasks if t["status"] == "done"])
    tasks_total = len(tasks)

    user_prompt = f"""Today is {today.strftime('%A, %B %d, %Y')}. Current time is {now_local.strftime('%I:%M %p')}.
Events marked "past" have already ended — do not refer to them as upcoming.
Tasks have a "time_status" field: "overdue" means past due, "due_today" means due today but not yet overdue, "upcoming" means due in the future, "done" means completed. Respect these statuses in your briefing.

Tasks (this week):
{json.dumps(tasks, indent=2, default=str)}

Events (this week):
{json.dumps(events, indent=2, default=str)}

Focus sessions (past 7 days): {focus_hours} hours total across {len(meaningful_sessions)} sessions

Recent journal entries:
{json.dumps(journal_entries, indent=2, default=str) if journal_entries else "None"}

Stats: {tasks_completed}/{tasks_total} tasks completed, {focus_hours}h focused this week.

Return ONLY a JSON object with keys: "summary", "stats", "tip"."""

    try:
        message = ai.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        response_text = extract_text(message)
        data = parse_ai_json(response_text)
        result = SummaryResponse(
            summary=data.get("summary", ""),
            stats=data.get("stats", {"focus_hours": focus_hours, "tasks_completed": tasks_completed, "tasks_total": tasks_total}),
            tip=data.get("tip", ""),
        )

        # Upsert into daily_summaries cache
        sb.table("daily_summaries").upsert({
            "user_id": user_id,
            "date": str(today),
            "summary": result.summary,
            "tip": result.tip,
            "stats": result.stats,
        }, on_conflict="user_id,date").execute()

        return result
    except (json.JSONDecodeError, ValueError, KeyError) as e:
        # Fallback: return stats without AI summary
        return SummaryResponse(
            summary=f"You have {tasks_total - tasks_completed} tasks remaining this week and {focus_hours}h of focus time logged.",
            stats={"focus_hours": focus_hours, "tasks_completed": tasks_completed, "tasks_total": tasks_total},
            tip="Try breaking large tasks into smaller subtasks to build momentum.",
        )
    except anthropic.APIError:
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable")
