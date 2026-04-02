import json

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth import get_current_user
from .config import get_anthropic
from .utils import call_ai_with_retry, extract_text, parse_ai_json

router = APIRouter(prefix="/api")

SYSTEM_PROMPT = """You are an academic assistant that parses university course syllabi.
Extract structured information from the provided syllabus PDF and return ONLY a valid JSON object.

Return this exact shape (no markdown, no explanation):
{
  "course_name": "Full course name",
  "schedule_blocks": [
    { "day": "Mon", "start": "HH:MM", "end": "HH:MM", "location": "Room 101" }
  ],
  "tasks": [
    { "title": "Assignment title", "due_date": "YYYY-MM-DD", "due_time": "HH:MM", "type": "homework", "estimated_hours": 2 }
  ]
}

Rules:
- day must be one of: Mon, Tue, Wed, Thu, Fri, Sat, Sun
- start/end must be 24-hour HH:MM format
- location is optional (omit if unknown)
- due_date must be YYYY-MM-DD; omit tasks with no clear date
- due_time is optional HH:MM (24h); omit if not specified
- type must be one of: exam, homework, project, quiz, reading, other
- estimated_hours is optional; estimate based on assignment type if not stated
- Only include graded assignments, exams, projects, and quizzes — skip policies, office hours, etc.
- If the year is ambiguous, use the upcoming academic year relative to today"""


class ScheduleBlock(BaseModel):
    day: str
    start: str
    end: str
    location: str | None = None


class SyllabusTask(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    due_date: str
    due_time: str | None = None
    type: str = "other"
    estimated_hours: float | None = None


class SyllabusParseRequest(BaseModel):
    file_data: str  # base64 encoded PDF
    file_name: str | None = Field(default=None, max_length=255)


class SyllabusParseResponse(BaseModel):
    course_name: str
    schedule_blocks: list[ScheduleBlock]
    tasks: list[SyllabusTask]


def _parse_response(text: str) -> SyllabusParseResponse:
    data = parse_ai_json(text)
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object")
    return SyllabusParseResponse(
        course_name=data.get("course_name", ""),
        schedule_blocks=[ScheduleBlock(**b) for b in data.get("schedule_blocks", [])],
        tasks=[SyllabusTask(**t) for t in data.get("tasks", [])],
    )


@router.post("/syllabi/parse", response_model=SyllabusParseResponse)
async def parse_syllabus(
    body: SyllabusParseRequest,
    _user_id: str = Depends(get_current_user),
):
    ai = get_anthropic()
    file_label = body.file_name or "syllabus.pdf"

    message_content: list = [
        {
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": body.file_data,
            },
        },
        {
            "type": "text",
            "text": f"Parse this syllabus ({file_label}) and return the structured JSON as described.",
        },
    ]

    return call_ai_with_retry(
        ai,
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=message_content,
        parse_fn=_parse_response,
        error_label="syllabus",
    )
