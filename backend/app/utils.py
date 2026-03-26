"""Shared utilities for AI response parsing."""

import json


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
