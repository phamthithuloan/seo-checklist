"""Compare the user's article against competitor URLs on structural SEO metrics.

Rule-based (no AI) → free, fast, reliable. Fetches each competitor URL as
markdown via web_fetcher and computes the same metrics for side-by-side review.
"""

import asyncio
import re

from fastapi import HTTPException
from pydantic import BaseModel

from app.schemas.analysis import (
    CompetitorEntry,
    CompetitorMetrics,
    CompareResult,
)
from app.services.gemini import gemini_available, generate_structured
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


async def _fetch_one(url: str, keyword: str) -> tuple[CompetitorEntry, str]:
    try:
        title, markdown = await fetch_url_as_markdown(url)
        entry = CompetitorEntry(
            url=url, title=title, metrics=compute_metrics(markdown, keyword)
        )
        return entry, markdown
    except HTTPException as exc:
        return CompetitorEntry(url=url, error=str(exc.detail)), ""
    except Exception as exc:  # noqa: BLE001
        return CompetitorEntry(url=url, error=f"Không xử lý được URL: {exc}"), ""


class _GapResult(BaseModel):
    gaps: list[str] = []


_GAP_SYSTEM = """Bạn là chuyên gia SEO. So sánh BÀI CỦA USER với các bài ĐỐI THỦ \
(cùng chủ đề). Liệt kê các chủ đề / mục / khía cạnh mà đối thủ CÓ đề cập nhưng bài \
user THIẾU hoặc làm sơ sài hơn — để user bổ sung cho đầy đủ hơn đối thủ.

Quy tắc: mỗi item ngắn gọn, CỤ THỂ (≤120 ký tự), nêu rõ nội dung còn thiếu (vd \
"Thiếu mục so sánh chi phí giữa các phương pháp"). Tối đa 8 item, ưu tiên quan trọng \
nhất. Nếu bài user đã bao phủ đầy đủ → trả gaps rỗng. Trả JSON đúng schema."""

_MAX_USER_CHARS = 8_000
_MAX_COMP_CHARS = 5_000


async def _content_gaps(
    content: str, keyword: str, comps: list[tuple[str, str]]
) -> tuple[list[str], str | None]:
    if not comps:
        return [], None
    if not gemini_available():
        return [], "Cần GEMINI_API_KEY ở backend để AI gợi ý nội dung còn thiếu."

    parts = [f"# BÀI CỦA USER (từ khoá: {keyword})\n\n{content[:_MAX_USER_CHARS]}"]
    for i, (name, md) in enumerate(comps, 1):
        parts.append(f"# ĐỐI THỦ {i}: {name}\n\n{md[:_MAX_COMP_CHARS]}")
    user_msg = "\n\n---\n\n".join(parts)

    parsed = await generate_structured(_GAP_SYSTEM, user_msg, _GapResult, max_tokens=1024)
    if parsed is None:
        return [], "AI tạm thời không trả về kết quả — thử lại sau."
    return parsed.gaps[:8], None


async def compare_with_competitors(
    content: str, keyword: str, competitor_urls: list[str]
) -> CompareResult:
    urls = [u.strip() for u in competitor_urls if u.strip()][:_MAX_URLS]
    fetched = await asyncio.gather(*(_fetch_one(u, keyword) for u in urls))
    entries = [e for e, _ in fetched]
    comp_texts = [(e.title or e.url, md) for e, md in fetched if md]
    gaps, note = await _content_gaps(content, keyword, comp_texts)
    return CompareResult(
        yours=compute_metrics(content, keyword),
        competitors=entries,
        content_gaps=gaps,
        ai_note=note,
    )
