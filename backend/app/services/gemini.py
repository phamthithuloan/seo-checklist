"""Shared Google Gemini client + helpers (free-tier friendly).

Every AI feature (proofread, outline compare, fact-check) routes through here so
there is a single place that reads GEMINI_API_KEY, picks the model, and handles
errors. Returns None whenever the key is missing, the SDK is absent, or the call
fails — callers treat None as "AI unavailable" and degrade gracefully.
"""

import asyncio
import json
import logging
import re
from typing import TypeVar

from pydantic import BaseModel

from app.core.config import get_settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# Substrings marking transient Gemini errors worth retrying (free tier hits these
# often): 503 high-demand, 429 rate-limit, 500 internal, deadline/timeout.
_TRANSIENT = ("503", "unavailable", "429", "resource_exhausted", "500", "internal", "deadline", "timeout")
# Keep retries short: this runs inside a request the user waits on. A couple of
# quick retries ride out a brief 503 spike; longer waits don't help 429 (its
# window is ~60s) so we fail fast and surface "tạm thời lỗi" instead.
_RETRIES = 3
_BACKOFF = (1.0, 2.0)  # before retry 2, 3


_RETRY_DELAY_RE = re.compile(r"retry\s*(?:delay)?['\"]?\s*[:in]*\s*['\"]?(\d+(?:\.\d+)?)\s*s", re.I)


def _retry_delay_secs(msg: str) -> float | None:
    m = _RETRY_DELAY_RE.search(msg)
    return float(m.group(1)) if m else None


async def _generate_with_retry(make_coro, *, patient: bool = False):
    """Run an async Gemini request thunk, retrying transient errors.

    patient=True: deliberate one-shot actions (e.g. auto-fix) wait out the free
    tier's per-minute window — on 429 we sleep the server-suggested retryDelay
    (capped ~55s) and retry once, so it succeeds instead of failing immediately.
    """
    retries = 2 if patient else _RETRIES
    last: Exception | None = None
    for attempt in range(retries):
        try:
            return await make_coro()
        except Exception as exc:  # noqa: BLE001
            last = exc
            msg = str(exc).lower()
            if attempt < retries - 1 and any(t in msg for t in _TRANSIENT):
                if patient:
                    delay = _retry_delay_secs(str(exc)) or 25.0
                    await asyncio.sleep(min(delay + 2.0, 55.0))
                else:
                    await asyncio.sleep(_BACKOFF[attempt])
                continue
            raise
    assert last is not None
    raise last


def gemini_available() -> bool:
    return bool(get_settings().gemini_api_key)


def _client():
    """Return (client, types_module, model_name) or (None, None, None)."""
    settings = get_settings()
    if not settings.gemini_api_key:
        return None, None, None
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        logger.warning("google-genai not installed — AI features disabled")
        return None, None, None
    return genai.Client(api_key=settings.gemini_api_key), types, settings.gemini_model


def extract_json(text: str) -> dict | None:
    """Tolerant: pull the first {...} object out of an LLM text block."""
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?|\n?```$", "", text).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except Exception:
        return None


async def generate_structured(
    system: str,
    user: str,
    schema: type[T],
    *,
    max_tokens: int = 4096,
    patient: bool = False,
) -> T | None:
    """JSON-mode generation validated against `schema` (no web tools).
    patient=True waits out the per-minute rate limit (for deliberate actions)."""
    client, types, model = _client()
    if client is None:
        return None
    try:
        resp = await _generate_with_retry(
            lambda: client.aio.models.generate_content(
                model=model,
                contents=user,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0,
                    max_output_tokens=max_tokens,
                ),
            ),
            patient=patient,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Gemini structured call failed: %s", exc)
        return None

    parsed = getattr(resp, "parsed", None)
    if isinstance(parsed, schema):
        return parsed
    obj = extract_json(getattr(resp, "text", "") or "")
    if obj is None:
        logger.warning("Gemini structured: no parseable JSON in response")
        return None
    try:
        return schema.model_validate(obj)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Gemini structured: schema validation failed: %s", exc)
        return None


async def generate_grounded(
    system: str,
    user: str,
    *,
    max_uses: int = 5,
    max_tokens: int = 4096,
) -> str | None:
    """Google-Search-grounded generation. Returns raw text (caller parses JSON).

    Structured output (`response_schema`) can't be combined with the search tool,
    so the caller must extract JSON from the returned text via `extract_json`.
    """
    client, types, model = _client()
    if client is None:
        return None
    try:
        resp = await _generate_with_retry(
            lambda: client.aio.models.generate_content(
                model=model,
                contents=user,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                    temperature=0,
                    max_output_tokens=max_tokens,
                ),
            )
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Gemini grounded call failed: %s", exc)
        return None
    return getattr(resp, "text", "") or ""
