import json
from datetime import date, datetime

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth import get_current_user
from .config import get_anthropic, get_supabase
from .utils import extract_text, parse_ai_json

router = APIRouter(prefix="/api")

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
    title: str = Field(min_length=1, max_length=200)
    estimated_minutes: int = Field(ge=5, le=240)


class DecomposeRequest(BaseModel):
    description: str | None = Field(default=None, max_length=10_000)
    file_content: str | None = Field(default=None, max_length=500_000)
    file_name: str | None = Field(default=None, max_length=255)


class DecomposeResponse(BaseModel):
    subtasks: list[SubtaskSuggestion]


def _build_user_prompt(
    title: str,
    course_name: str | None,
    due_date: str,
    estimated_hours: float | None,
    description: str | None = None,
    file_content: str | None = None,
    file_name: str | None = None,
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
    ]

    if description:
        lines += ["", f"Student's description: {description}"]

    if file_content:
        # ~4 chars per token on average; keep file content under ~50k tokens
        # to leave room for system prompt, task context, and response (200k limit)
        max_chars = 200_000
        truncated = file_content[:max_chars]
        if len(file_content) > max_chars:
            truncated += "\n\n[... content truncated for length ...]"
        label = f"Attached file ({file_name})" if file_name else "Attached file"
        lines += ["", f"{label}:", "---", truncated, "---"]

    lines += [
        "",
        'Return ONLY a JSON array. Each element: {"title": "...", "estimated_minutes": N}',
    ]
    return "\n".join(lines)


def _parse_subtasks(text: str) -> list[SubtaskSuggestion]:
    """Parse the AI response into subtask suggestions."""
    data = parse_ai_json(text)
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
async def decompose_task(
    task_id: str,
    body: DecomposeRequest = DecomposeRequest(),
    user_id: str = Depends(get_current_user),
):
    # Initialize clients
    sb = get_supabase()
    ai = get_anthropic()

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
        description=body.description,
        file_content=body.file_content,
        file_name=body.file_name,
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
            response_text = extract_text(message)
            subtasks = _parse_subtasks(response_text)
            return DecomposeResponse(subtasks=subtasks)
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            last_error = e
            continue
        except anthropic.APIError:
            raise HTTPException(status_code=502, detail="AI service temporarily unavailable")

    raise HTTPException(
        status_code=422,
        detail=f"Could not parse AI response after 2 attempts: {last_error}",
    )
