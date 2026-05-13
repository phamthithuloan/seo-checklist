"""AI-powered Vietnamese grammar + spelling check via Claude Sonnet 4.6.

Opt-in (cost-bearing). Returns None when ANTHROPIC_API_KEY is unset.
System prompt cached via prompt caching — subsequent calls within ~5 min
hit cache for the system block.
"""

import logging

from anthropic import APIError, AsyncAnthropic
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.schemas.analysis import CheckIssue, CheckResult

logger = logging.getLogger(__name__)

# Stable system prompt — any byte change invalidates the cache. Keep this frozen.
_SYSTEM_PROMPT = """Bạn là một biên tập viên tiếng Việt chuyên nghiệp.

Nhiệm vụ: đọc bài viết người dùng cung cấp và tìm:
1. **Lỗi ngữ pháp**: sai chủ-vị, sai cú pháp, câu cụt, câu thiếu thành phần, dùng từ sai cấu trúc.
2. **Lỗi chính tả**: viết sai chính tả, sai dấu thanh, sai phụ âm đầu/cuối phổ biến trong tiếng Việt.

Quy tắc nghiêm ngặt:
- CHỈ báo cáo lỗi rõ ràng và không thể tranh cãi.
- KHÔNG quibble về phong cách, từ đồng nghĩa, dấu câu tuỳ chọn, hay cách diễn đạt mang tính sở thích cá nhân.
- Mỗi lỗi: trích nguyên câu chứa lỗi (≤200 ký tự), mô tả lỗi ngắn gọn, đề xuất sửa cụ thể.
- KHÔNG báo cáo trùng lặp — mỗi từ sai chính tả chỉ báo 1 lần dù xuất hiện nhiều lần.
- Nếu bài không có lỗi → trả về 2 list rỗng.

Trả về JSON đúng schema được cung cấp."""


class _GrammarIssue(BaseModel):
    sentence: str = Field(description="Câu chứa lỗi (≤200 ký tự)")
    issue: str = Field(description="Mô tả lỗi ngắn gọn")
    suggestion: str = Field(description="Cách sửa đề xuất")


class _SpellingIssue(BaseModel):
    word: str = Field(description="Từ viết sai chính tả")
    sentence: str = Field(description="Câu chứa từ sai (≤200 ký tự)")
    suggestion: str = Field(description="Cách viết đúng")


class _ProofreadResult(BaseModel):
    grammar_issues: list[_GrammarIssue] = Field(default_factory=list)
    spelling_issues: list[_SpellingIssue] = Field(default_factory=list)


_MAX_CONTENT_CHARS = 30_000


async def proofread_content(content: str) -> tuple[CheckResult, CheckResult] | None:
    """Run grammar + spelling check via Claude. Returns (grammar, spelling) check
    results, or None if ANTHROPIC_API_KEY is not configured or the call fails."""

    settings = get_settings()
    if not settings.anthropic_api_key:
        logger.info("ANTHROPIC_API_KEY not set — skipping AI proofread")
        return None

    text = content[:_MAX_CONTENT_CHARS]
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    try:
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=[
                {
                    "type": "text",
                    "text": _SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": text}],
            output_config={
                "format": {
                    "type": "json_schema",
                    "schema": _ProofreadResult.model_json_schema(),
                }
            },
        )
    except APIError as exc:
        logger.warning("AI proofread API error: %s", exc)
        return None
    except Exception as exc:
        logger.warning("AI proofread unexpected error: %s", exc)
        return None

    text_block = next((b for b in response.content if b.type == "text"), None)
    if text_block is None:
        logger.warning("AI proofread: no text block in response")
        return None

    try:
        parsed = _ProofreadResult.model_validate_json(text_block.text)
    except Exception as exc:
        logger.warning("AI proofread JSON parse failed: %s", exc)
        return None

    logger.info(
        "AI proofread tokens: cache_read=%d cache_write=%d input=%d output=%d",
        getattr(response.usage, "cache_read_input_tokens", 0) or 0,
        getattr(response.usage, "cache_creation_input_tokens", 0) or 0,
        response.usage.input_tokens,
        response.usage.output_tokens,
    )

    grammar = CheckResult(
        id="grammar",
        label="Ngữ pháp đúng, diễn đạt mạch lạc",
        category="grammar",
        status="pass" if not parsed.grammar_issues else "fail",
        detail=(
            "Không phát hiện lỗi ngữ pháp."
            if not parsed.grammar_issues
            else f"Phát hiện {len(parsed.grammar_issues)} lỗi ngữ pháp."
        ),
        recommendation=(
            None
            if not parsed.grammar_issues
            else "Sửa các lỗi ngữ pháp / cú pháp / câu cụt để diễn đạt mạch lạc hơn."
        ),
        issues=[
            CheckIssue(
                kind="sentence",
                text=i.sentence[:200],
                note=f"{i.issue} → {i.suggestion}",
            )
            for i in parsed.grammar_issues[:15]
        ],
    )

    spelling = CheckResult(
        id="spelling",
        label="Không có lỗi chính tả",
        category="grammar",
        status="pass" if not parsed.spelling_issues else "fail",
        detail=(
            "Không phát hiện lỗi chính tả."
            if not parsed.spelling_issues
            else f"Phát hiện {len(parsed.spelling_issues)} từ viết sai chính tả."
        ),
        recommendation=(
            None
            if not parsed.spelling_issues
            else "Sửa lại các từ viết sai chính tả."
        ),
        issues=[
            CheckIssue(
                kind="word",
                text=i.word,
                note=f'"{i.sentence[:80]}…" → sửa thành "{i.suggestion}"',
            )
            for i in parsed.spelling_issues[:15]
        ],
    )

    return grammar, spelling
