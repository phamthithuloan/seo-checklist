"""Compare the user's article against competitor URLs on structural SEO metrics.

Rule-based (no AI) → free, fast, reliable. Fetches each competitor URL as
markdown via web_fetcher and computes the same metrics for side-by-side review.
"""

import asyncio
import re

from fastapi import HTTPException

from app.schemas.analysis import (
    CompetitorEntry,
    CompetitorMetrics,
    CompareResult,
)
from app.services.web_fetcher import fetch_url_as_markdown

_H2_RE = re.compile(r"^##\s+\S", re.MULTILINE)
_H3_RE = re.compile(r"^###\s+\S", re.MULTILINE)
_BULLET_RE = re.compile(r"^\s*[-*+]\s+\S", re.MULTILINE)
_IMG_RE = re.compile(r"!\[[^\]]*\]\([^)]+\)")
_LINK_RE = re.compile(r"\[[^\]]+\]\((?:https?://|/)[^)]+\)")
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
_FAQ_PATTERNS = ("faq", "câu hỏi thường gặp")
_MAX_URLS = 3


def compute_metrics(content: str, keyword: str) -> CompetitorMetrics:
    text = _HTML_TAG_RE.sub(" ", content)
    words = [w for w in _WS_RE.split(text) if w]
    wc = len(words)
    low = content.lower()
    kw = keyword.lower().strip()
    kw_count = low.count(kw) if kw else 0
    density = round((kw_count / wc) * 100, 2) if wc else 0.0
    return CompetitorMetrics(
        word_count=wc,
        h2_count=len(_H2_RE.findall(content)),
        h3_count=len(_H3_RE.findall(content)),
        bullet_count=len(_BULLET_RE.findall(content)),
        image_count=len(_IMG_RE.findall(content)),
        link_count=len(_LINK_RE.findall(content)),
        has_faq=any(p in low for p in _FAQ_PATTERNS),
        keyword_density=density,
    )


async def _fetch_one(url: str, keyword: str) -> CompetitorEntry:
    try:
        title, markdown = await fetch_url_as_markdown(url)
        return CompetitorEntry(
            url=url, title=title, metrics=compute_metrics(markdown, keyword)
        )
    except HTTPException as exc:
        return CompetitorEntry(url=url, error=str(exc.detail))
    except Exception as exc:  # noqa: BLE001
        return CompetitorEntry(url=url, error=f"Không xử lý được URL: {exc}")


async def compare_with_competitors(
    content: str, keyword: str, competitor_urls: list[str]
) -> CompareResult:
    urls = [u.strip() for u in competitor_urls if u.strip()][:_MAX_URLS]
    competitors = await asyncio.gather(*(_fetch_one(u, keyword) for u in urls))
    return CompareResult(
        yours=compute_metrics(content, keyword),
        competitors=list(competitors),
    )
