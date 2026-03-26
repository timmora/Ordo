"""
Scheduler — assigns subtasks to free calendar slots.

Algorithm:
1. Fetch user settings (capacity, working hours)
2. Fetch all incomplete subtasks with their parent task deadlines
3. Fetch busy intervals (course schedules + events) for the scheduling window
4. Score subtasks: priority weight + urgency (days until due)
5. For each subtask (highest score first), find the earliest free slot
   within working hours that respects daily capacity
6. Write scheduled_start/scheduled_end back to subtasks table
"""

from datetime import date, datetime, timedelta, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from .auth import get_current_user
from .config import get_supabase

router = APIRouter(prefix="/api")

DAY_MAP = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}


# ── Pydantic models ──────────────────────────────────────────

class ScheduleChange(BaseModel):
    subtask_id: str
    title: str
    old_start: str | None
    old_end: str | None
    new_start: str | None
    new_end: str | None
    action: str  # 'scheduled' | 'moved' | 'unscheduled'


class ScheduleResponse(BaseModel):
    scheduled_count: int
    unschedulable: list[str]
    changes: list[ScheduleChange]


class SettingsResponse(BaseModel):
    id: str
    user_id: str
    daily_capacity_hours: float
    schedule_start_time: str
    schedule_end_time: str


class SettingsUpdate(BaseModel):
    daily_capacity_hours: float | None = None
    schedule_start_time: str | None = None
    schedule_end_time: str | None = None


# ── Helper functions ──────────────────────────────────────────

def parse_time(t: str) -> time:
    """Parse 'HH:MM' to a time object."""
    h, m = t.split(":")
    return time(int(h), int(m))


def expand_course_schedule(courses: list[dict], start_date: date, end_date: date, tz: ZoneInfo) -> list[tuple[datetime, datetime]]:
    """Expand recurring course blocks into concrete busy intervals."""
    busy = []
    current = start_date
    while current <= end_date:
        weekday = current.weekday()  # 0=Mon
        for course in courses:
            schedule = course.get("schedule") or []
            for block in schedule:
                day_name = block.get("day", "")
                if DAY_MAP.get(day_name) != weekday:
                    continue
                block_start = parse_time(block["start"])
                block_end = parse_time(block["end"])
                busy.append((
                    datetime.combine(current, block_start, tzinfo=tz),
                    datetime.combine(current, block_end, tzinfo=tz),
                ))
        current += timedelta(days=1)
    return busy


def expand_events(events: list[dict], tz: ZoneInfo) -> list[tuple[datetime, datetime]]:
    """Convert events to (start, end) busy intervals."""
    busy = []
    for ev in events:
        if ev.get("all_day"):
            continue
        start_str = ev.get("start_time")
        end_str = ev.get("end_time")
        if not start_str:
            continue
        start = datetime.fromisoformat(start_str)
        if start.tzinfo is None:
            start = start.replace(tzinfo=tz)
        if end_str:
            end = datetime.fromisoformat(end_str)
            if end.tzinfo is None:
                end = end.replace(tzinfo=tz)
        else:
            end = start + timedelta(hours=1)
        busy.append((start, end))
    return busy


def merge_intervals(intervals: list[tuple[datetime, datetime]]) -> list[tuple[datetime, datetime]]:
    """Merge overlapping intervals."""
    if not intervals:
        return []
    sorted_iv = sorted(intervals, key=lambda x: x[0])
    merged = [sorted_iv[0]]
    for start, end in sorted_iv[1:]:
        if start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def compute_free_slots(
    day: date,
    busy: list[tuple[datetime, datetime]],
    work_start: time,
    work_end: time,
    tz: ZoneInfo,
) -> list[tuple[datetime, datetime]]:
    """Find free slots within working hours for a given day."""
    day_start = datetime.combine(day, work_start, tzinfo=tz)
    day_end = datetime.combine(day, work_end, tzinfo=tz)

    # Filter busy intervals for this day
    day_busy = []
    for bs, be in busy:
        # Clip to this day's working window
        cs = max(bs, day_start)
        ce = min(be, day_end)
        if cs < ce:
            day_busy.append((cs, ce))

    day_busy = merge_intervals(day_busy)

    # Find gaps
    slots = []
    cursor = day_start
    for bs, be in day_busy:
        if cursor < bs:
            slots.append((cursor, bs))
        cursor = max(cursor, be)
    if cursor < day_end:
        slots.append((cursor, day_end))

    return slots


def score_subtask(subtask: dict, task: dict, today: date) -> float:
    """Score for scheduling priority: priority weight + urgency."""
    priority_weights = {"high": 3, "medium": 2, "low": 1}
    weight = priority_weights.get(task.get("priority", "medium"), 2)

    due_date_str = task.get("due_date", "")
    if due_date_str:
        due = date.fromisoformat(due_date_str)
        days_until = (due - today).days
        urgency = max(0, 5 - days_until)
    else:
        urgency = 0

    return weight + urgency


def _try_place_in_range(
    start_day: date,
    end_day: date,
    subtask: dict,
    duration: int,
    needed: timedelta,
    daily_used: dict[date, int],
    daily_cap_minutes: int,
    all_busy: list[tuple[datetime, datetime]],
    work_start: time,
    work_end: time,
    tz,
    scheduled: list[dict],
) -> bool:
    """Try to place a subtask in a free slot within [start_day, end_day]. Returns True if placed."""
    current_day = start_day
    while current_day <= end_day:
        used = daily_used.get(current_day, 0)
        if daily_cap_minutes - used < duration:
            current_day += timedelta(days=1)
            continue

        free_slots = compute_free_slots(current_day, all_busy, work_start, work_end, tz)
        for slot_start, slot_end in free_slots:
            if (slot_end - slot_start).total_seconds() / 60 >= duration:
                end_time = slot_start + needed
                scheduled.append({
                    "id": subtask["id"],
                    "scheduled_start": slot_start.isoformat(),
                    "scheduled_end": end_time.isoformat(),
                })
                all_busy.append((slot_start, end_time))
                all_busy[:] = merge_intervals(all_busy)
                daily_used[current_day] = used + duration
                return True
        current_day += timedelta(days=1)
    return False


def schedule_subtasks(
    subtasks_with_tasks: list[tuple[dict, dict]],
    busy: list[tuple[datetime, datetime]],
    settings: dict,
    tz: ZoneInfo,
    today: date,
    horizon_days: int = 30,
) -> tuple[list[dict], list[str]]:
    """
    Assign subtasks to free slots, spread evenly before each task's deadline.
    Returns (scheduled_updates, unschedulable_titles).
    """
    work_start = parse_time(settings.get("schedule_start_time", "08:00"))
    work_end = parse_time(settings.get("schedule_end_time", "22:00"))
    daily_cap_minutes = float(settings.get("daily_capacity_hours", 6)) * 60

    # Track how many minutes are used per day
    daily_used: dict[date, float] = {}

    # ── Group subtasks by parent task and compute ideal days ──
    from collections import defaultdict
    from math import floor

    task_groups: dict[str, list[tuple[dict, dict]]] = defaultdict(list)
    for subtask, task in subtasks_with_tasks:
        task_groups[task.get("id", "")].append((subtask, task))

    # Build list of (ideal_day, score, subtask, task)
    items: list[tuple[date, float, dict, dict]] = []
    for task_id, group in task_groups.items():
        # Sort by order_index within each task
        group.sort(key=lambda st: st[0].get("order_index", 0))
        task = group[0][1]
        due_str = task.get("due_date", "")
        if due_str:
            due_date = date.fromisoformat(due_str)
            available_days = max(1, (due_date - today).days)
        else:
            available_days = horizon_days

        n = len(group)
        spacing = available_days / n

        for i, (subtask, task) in enumerate(group):
            ideal_day = today + timedelta(days=floor(i * spacing))
            score = score_subtask(subtask, task, today)
            items.append((ideal_day, score, subtask, task))

    # Sort by ideal_day first, then by score descending for tie-breaking
    items.sort(key=lambda x: (x[0], -x[1]))

    scheduled = []
    unschedulable = []

    # Collect all busy intervals (will grow as we schedule)
    all_busy = list(busy)

    for ideal_day, _score, subtask, task in items:
        duration = subtask.get("estimated_minutes", 30)
        needed = timedelta(minutes=duration)

        due_str = task.get("due_date", "")
        end_day = today + timedelta(days=horizon_days)
        if due_str:
            due_date = date.fromisoformat(due_str)
            end_day = min(end_day, due_date)

        # Phase 1: try from ideal_day forward to end_day
        placed = _try_place_in_range(ideal_day, end_day, subtask, duration, needed,
                                      daily_used, daily_cap_minutes, all_busy,
                                      work_start, work_end, tz, scheduled)

        # Phase 2: fallback — try from today to ideal_day if not placed
        if not placed:
            placed = _try_place_in_range(today, ideal_day - timedelta(days=1), subtask, duration, needed,
                                          daily_used, daily_cap_minutes, all_busy,
                                          work_start, work_end, tz, scheduled)

        if not placed:
            unschedulable.append(subtask.get("title", "Unknown"))

    return scheduled, unschedulable


# ── Routes ────────────────────────────────────────────────────

def get_or_create_settings(sb, user_id: str) -> dict:
    """Get user settings, creating defaults if they don't exist."""
    result = sb.table("user_settings").select("*").eq("user_id", user_id).maybe_single().execute()
    if result and result.data:
        return result.data

    # Create defaults
    created = sb.table("user_settings").insert({
        "user_id": user_id,
        "daily_capacity_hours": 6.0,
        "schedule_start_time": "08:00",
        "schedule_end_time": "22:00",
    }).execute()
    return created.data[0] if created.data else {
        "daily_capacity_hours": 6.0,
        "schedule_start_time": "08:00",
        "schedule_end_time": "22:00",
    }


@router.post("/schedule", response_model=ScheduleResponse)
async def run_schedule(
    tz: str = Query(default="America/Chicago"),
    force: bool = Query(default=False),
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()

    try:
        local_tz = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, KeyError):
        local_tz = ZoneInfo("America/Chicago")

    today_date = date.today()
    settings = get_or_create_settings(sb, user_id)

    # Fetch tasks (incomplete, with due dates in the future or today)
    tasks_resp = sb.table("tasks").select("id, title, due_date, due_time, priority, status, course_id").eq("user_id", user_id).neq("status", "done").gte("due_date", str(today_date)).execute()
    tasks = tasks_resp.data or []
    task_map = {t["id"]: t for t in tasks}
    task_ids = list(task_map.keys())

    if not task_ids:
        return ScheduleResponse(scheduled_count=0, unschedulable=[], changes=[])

    # Fetch subtasks
    subtasks_resp = sb.table("subtasks").select("*").eq("user_id", user_id).in_("task_id", task_ids).neq("status", "complete").execute()
    all_subtasks = subtasks_resp.data or []

    # If force, clear all scheduled times first
    if force:
        for s in all_subtasks:
            if s.get("scheduled_start"):
                sb.table("subtasks").update({
                    "scheduled_start": None,
                    "scheduled_end": None,
                }).eq("id", s["id"]).execute()
                s["scheduled_start"] = None
                s["scheduled_end"] = None

    # Separate already-scheduled vs unscheduled
    to_schedule = []
    already_scheduled_busy = []
    for s in all_subtasks:
        task = task_map.get(s["task_id"])
        if not task:
            continue
        if s.get("scheduled_start") and s.get("scheduled_end"):
            # Already scheduled — keep as busy time
            start = datetime.fromisoformat(s["scheduled_start"])
            end = datetime.fromisoformat(s["scheduled_end"])
            if start.tzinfo is None:
                start = start.replace(tzinfo=local_tz)
            if end.tzinfo is None:
                end = end.replace(tzinfo=local_tz)
            already_scheduled_busy.append((start, end))
        else:
            to_schedule.append((s, task))

    if not to_schedule:
        return ScheduleResponse(scheduled_count=0, unschedulable=[], changes=[])

    # Fetch busy intervals: courses + events
    horizon = today_date + timedelta(days=30)
    courses_resp = sb.table("courses").select("id, schedule").eq("user_id", user_id).execute()
    courses = courses_resp.data or []
    course_busy = expand_course_schedule(courses, today_date, horizon, local_tz)

    events_resp = sb.table("events").select("title, start_time, end_time, all_day").eq("user_id", user_id).gte("start_time", f"{today_date}T00:00:00").lte("start_time", f"{horizon}T23:59:59").execute()
    events = events_resp.data or []
    event_busy = expand_events(events, local_tz)

    all_busy = merge_intervals(course_busy + event_busy + already_scheduled_busy)

    # Run scheduler
    scheduled_updates, unschedulable = schedule_subtasks(
        to_schedule, all_busy, settings, local_tz, today_date
    )

    # Write updates and build changes list
    changes: list[ScheduleChange] = []
    for update in scheduled_updates:
        subtask_id = update["id"]
        # Find the original subtask
        original = next((s for s in all_subtasks if s["id"] == subtask_id), None)

        sb.table("subtasks").update({
            "scheduled_start": update["scheduled_start"],
            "scheduled_end": update["scheduled_end"],
        }).eq("id", subtask_id).execute()

        changes.append(ScheduleChange(
            subtask_id=subtask_id,
            title=original["title"] if original else "Unknown",
            old_start=original.get("scheduled_start") if original else None,
            old_end=original.get("scheduled_end") if original else None,
            new_start=update["scheduled_start"],
            new_end=update["scheduled_end"],
            action="moved" if (original and original.get("scheduled_start")) else "scheduled",
        ))

    return ScheduleResponse(
        scheduled_count=len(scheduled_updates),
        unschedulable=unschedulable,
        changes=changes,
    )


@router.get("/settings", response_model=SettingsResponse)
async def get_settings(user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    settings = get_or_create_settings(sb, user_id)
    return SettingsResponse(**settings)


@router.put("/settings", response_model=SettingsResponse)
async def update_settings(
    body: SettingsUpdate,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    settings = get_or_create_settings(sb, user_id)

    updates = body.model_dump(exclude_none=True)
    if not updates:
        return SettingsResponse(**settings)

    result = sb.table("user_settings").update(updates).eq("id", settings["id"]).execute()
    if result.data:
        return SettingsResponse(**result.data[0])
    return SettingsResponse(**settings)
