"""Outline ↔ content semantic comparison via Google Gemini (free tier).

Different from outline_compare.py (rule-based heading match): this checks
whether the article **follows the spirit of the outline**:
- Did it use the requested presentation format (table/bullet/text)?
- Did it cover all the info points the outline mentions?
- Did it go deeper than outline (good) or stay sketchy (bad)?

Returns None when GEMINI_API_KEY is unset or the call fails.
"""

import logging

from pydantic import BaseModel

from app.schemas.analysis import OutlineAIAnalysis, OutlineDepthVerdict
from app.services.gemini import generate_structured

logger = logging.getLogger(__name__)


_SYSTEM_PROMPT = """Bạn là biên tập viên SEO senior chuyên đánh giá xem một bài viết \
có bám sát outline (đề cương) đã thống nhất hay không.

User sẽ cung cấp 2 phần:
1. OUTLINE — đề cương ban đầu (heading + ghi chú format/từ/topic).
2. CONTENT — bài viết thực tế (markdown).

Nhiệm vụ: đánh giá 3 chiều, không quan tâm heading-by-heading match (việc đó đã làm rule-based):

A. **Format followed** (boolean): bài viết có dùng đúng format outline yêu cầu không?
   - Outline ghi "table" → bài có table?
   - Outline ghi "bullet" → bài có list bullet/numbered?
   - Outline ghi "text" → bài viết dạng đoạn văn thuần?
   - "Notes" ngắn (1-2 câu): chỉ ra mismatch cụ thể nếu có. Nếu OK, ghi "Format đúng theo outline".

B. **Info coverage** (score 0-100 + missing_points):
   - Score 100 = bài cover hết các điểm thông tin outline đề cập.
   - Score < 100 = có missing.
   - missing_points: list các thông tin outline yêu cầu mà bài viết KHÔNG đề cập đến (≤8 items, mỗi item ≤120 ký tự, nêu rõ outline yêu cầu gì mà bài thiếu).

C. **Depth assessment** (verdict + summary + extra_depth_points):
   - verdict: "sketchy" (sơ sài, chỉ liệt kê tiêu đề) / "adequate" (đủ chuyên sâu như outline yêu cầu) / "detailed" (chuyên sâu hơn outline, có thêm phân tích/ví dụ/dữ liệu).
   - summary: 1-2 câu mô tả tổng quan độ sâu của bài so với outline.
   - extra_depth_points: list các nội dung mà bài viết triển khai SÂU/CHI TIẾT hơn outline (≤6 items, mỗi item ≤120 ký tự). Đây là điểm cộng — chứng tỏ bài không sơ sài. Có thể trống nếu bài chỉ "adequate".

Quy tắc nghiêm ngặt:
- Đánh giá **dựa trên nội dung thực tế**, không dựa trên cảm tính chung chung.
- missing_points và extra_depth_points phải cụ thể (vd: "Outline yêu cầu so sánh giá 3 dòng X/Y/Z nhưng bài chỉ đề cập X").
- Nếu CONTENT trống hoặc không liên quan outline → vẫn trả output đúng schema với coverage=0, verdict="sketchy".

Trả về JSON đúng schema được cung cấp."""


class _AIResult(BaseModel):
    format_followed: bool
    format_notes: str
    info_coverage_score: int
    missing_points: list[str] = []
    extra_depth_points: list[str] = []
    depth_verdict: OutlineDepthVerdict
    depth_summary: str


_MAX_OUTLINE_CHARS = 8_000
_MAX_CONTENT_CHARS = 30_000


async def analyze_outline_followthrough(
    outline: str,
    content: str,
) -> OutlineAIAnalysis | None:
    """Compare article against outline using Gemini. Returns None if disabled."""

    user_msg = (
        f"# OUTLINE\n\n{outline[:_MAX_OUTLINE_CHARS]}\n\n"
        f"---\n\n# CONTENT\n\n{content[:_MAX_CONTENT_CHARS]}"
    )

    parsed = await generate_structured(
        _SYSTEM_PROMPT, user_msg, _AIResult, max_tokens=2048
    )
    if parsed is None:
        return None

    return OutlineAIAnalysis(
        format_followed=parsed.format_followed,
        format_notes=parsed.format_notes[:400],
        info_coverage_score=max(0, min(100, parsed.info_coverage_score)),
        missing_points=parsed.missing_points[:8],
        extra_depth_points=parsed.extra_depth_points[:6],
        depth_verdict=parsed.depth_verdict,
        depth_summary=parsed.depth_summary[:400],
    )
