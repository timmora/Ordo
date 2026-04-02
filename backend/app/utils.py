"""Shared utilities for AI response parsing."""

import json
from typing import Callable, TypeVar

import anthropic
from fastapi import HTTPException

T = TypeVar("T")


def call_ai_with_retry(
    ai: anthropic.Anthropic,
    *,
    model: str,
    max_tokens: int,
    system: str,
    messages: list,
    parse_fn: Callable[[str], T],
    error_label: str = "AI response",
) -> T:
    """Call Anthropic API with one retry on parse errors."""
    last_error = None
    for _ in range(2):
        try:
            message = ai.messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": messages}],
            )
            response_text = extract_text(message)
            return parse_fn(response_text)
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            last_error = e
            continue
        except anthropic.APIError:
            raise HTTPException(status_code=502, detail="AI service temporarily unavailable")

    raise HTTPException(
        status_code=422,
        detail=f"Could not parse {error_label} after 2 attempts: {last_error}",
    )


def extract_text(message) -> str:
    """Safely extract the text from an Anthropic Message response.

    Validates that content is non-empty and the first block is a text block,
    raising ValueError otherwise.
    """
    if not message.content:
        raise ValueError("AI returned empty content")
    block = message.content[0]
    if block.type != "text":
        raise ValueError(f"Expected text block, got {block.type}")
    return block.text


def parse_ai_json(text: str):
    """Strip markdown code fences and parse JSON from AI response."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()
    return json.loads(cleaned)
