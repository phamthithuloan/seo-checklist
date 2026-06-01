"""AI-powered Vietnamese grammar + spelling check via Google Gemini (free tier).

Opt-in. Returns None when GEMINI_API_KEY is unset or the call fails.
"""

import logging

from pydantic import BaseModel, Field

from app.schemas.analysis import CheckIssue, CheckResult
from app.services.gemini import generate_structured

logger = logging.getLogger(__name__)

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
    """Run grammar + spelling check via Gemini. Returns (grammar, spelling) check
    results, or None if GEMINI_API_KEY is not configured or the call fails."""

    parsed = await generate_structured(
        _SYSTEM_PROMPT,
        content[:_MAX_CONTENT_CHARS],
        _ProofreadResult,
        max_tokens=4096,
    )
    if parsed is None:
        return None

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
