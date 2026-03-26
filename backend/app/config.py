"""Centralised configuration — env vars and shared clients."""

import os
from functools import lru_cache

import anthropic
from supabase import Client, create_client

SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY: str = os.environ.get("SUPABASE_SERVICE_KEY", "")
ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Return a reusable Supabase service-role client (cached)."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


@lru_cache(maxsize=1)
def get_anthropic() -> anthropic.Anthropic:
    """Return a reusable Anthropic client (cached)."""
    return anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
