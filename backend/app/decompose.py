import json
import os
from datetime import date, datetime

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import create_client

from .auth import get_current_user

router = APIRouter(prefix="/api")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT = """You are a study planning assistant for university students.
When given a task, break it into concrete, actionable subtasks.

Rules:
- Return ONLY a valid JSON array. No markdown, no explanation, no preamble.
- Each element must be an object with exactly two keys: "title" (string) and "estimated_minutes" (integer).
- Each subtask should be 15–120 minutes of work.
- Order subtasks logically (prerequisites first).
- If the student provided an estimated total, your subtask minutes should roughly sum to that total.
- Make subtasks specific to the task and course context, not generic."""


class SubtaskSuggestion(BaseModel):
    title: str
    estimated_minutes: int


class DecomposeResponse(BaseModel):
    subtasks: list[SubtaskSuggestion]


def _build_user_prompt(
    title: str,
    course_name: str | None,
    due_date: str,
    estimated_hours: float | None,
) -> str:
    today = date.today()
    try:
        due = datetime.strptime(due_date, "%Y-%m-%d").date()
        days_remaining = (due - today).days
    except ValueError:
        days_remaining = "unknown"

    lines = [
        "Break down this task into actionable subtasks:",
        "",
        f"Task: {title}",
        f"Course: {course_name or 'N/A'}",
        f"Due: {due_date} ({days_remaining} days from now)",
        f"Estimated total effort: {estimated_hours or 'not specified'} hours",
        "",
        'Return ONLY a JSON array. Each element: {"title": "...", "estimated_minutes": N}',
    ]
    return "\n".join(lines)


def _parse_subtasks(text: str) -> list[SubtaskSuggestion]:
    """Parse the AI response into subtask suggestions."""
    cleaned = text.strip()
    # Strip markdown code fences if present
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()

    data = json.loads(cleaned)
    if not isinstance(data, list):
        raise ValueError("Expected a JSON array")

    return [
        SubtaskSuggestion(
            title=item["title"],
            estimated_minutes=int(item["estimated_minutes"]),
        )
        for item in data
    ]


@router.post("/tasks/{task_id}/decompose", response_model=DecomposeResponse)
async def decompose_task(task_id: str, user_id: str = Depends(get_current_user)):
    # Initialize clients
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    ai = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # Fetch task and verify ownership
    task_resp = sb.table("tasks").select("*").eq("id", task_id).eq("user_id", user_id).execute()
    if not task_resp.data:
        raise HTTPException(status_code=404, detail="Task not found")
    task = task_resp.data[0]

    # Fetch course name if linked
    course_name = None
    if task.get("course_id"):
        course_resp = sb.table("courses").select("name").eq("id", task["course_id"]).execute()
        if course_resp.data:
            course_name = course_resp.data[0]["name"]

    # Build prompt
    user_prompt = _build_user_prompt(
        title=task["title"],
        course_name=course_name,
        due_date=task["due_date"],
        estimated_hours=task.get("estimated_hours"),
    )

    # Call Anthropic Claude
    last_error = None
    for attempt in range(2):
        try:
            message = ai.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )
            response_text = message.content[0].text
            subtasks = _parse_subtasks(response_text)
            return DecomposeResponse(subtasks=subtasks)
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            last_error = e
            continue
        except anthropic.APIError as e:
            raise HTTPException(status_code=502, detail=f"AI service error: {e}")

    raise HTTPException(
        status_code=422,
        detail=f"Could not parse AI response after 2 attempts: {last_error}",
    )
