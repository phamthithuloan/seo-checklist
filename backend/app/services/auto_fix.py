"""Auto-fix an article via Google Gemini — rewrite to fix the flagged issues
while preserving the original meaning, information, and sources.

Opt-in (needs GEMINI_API_KEY). Returns None when unavailable / on failure.
"""

import logging

from pydantic import BaseModel

from app.services.gemini import generate_structured

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """Bạn là biên tập viên SEO tiếng Việt. Viết LẠI bài dưới đây để \
SỬA các lỗi, nhưng GIỮ NGUYÊN ý nghĩa, thông tin và các nguồn dẫn gốc.

Nguyên tắc bắt buộc:
- Sửa lỗi chính tả, ngữ pháp, câu cụt; diễn đạt mạch lạc.
- Bỏ văn phong máy móc / sáo rỗng, viết tự nhiên như người thật.
- Chia đoạn ngắn (3-4 dòng); thêm heading "Kết luận" tóm tắt ở cuối nếu bài chưa có.
- TUYỆT ĐỐI KHÔNG bịa thêm số liệu / sự kiện / nguồn mới. Giữ nguyên mọi link và
  số liệu đã có (chỉ sửa diễn đạt quanh chúng).
- Giữ định dạng Markdown: heading (#, ##, ###), bullet (-), in đậm (**...**).
- Nếu user cung cấp danh sách "Các lỗi cần sửa", ưu tiên xử lý đúng các lỗi đó.

Trả về JSON đúng schema: {"content": "<toàn bộ bài viết Markdown đã sửa>"}."""


class _FixResult(BaseModel):
    content: str


_MAX_CONTENT_CHARS = 24_000


async def autofix_article(
    content: str, keyword: str, issues: list[str] | None = None
) -> str | None:
    issue_block = ""
    if issues:
        bullets = "\n".join(f"- {i}" for i in issues[:30])
        issue_block = f"\n\n# Các lỗi cần sửa (ưu tiên)\n{bullets}"

    user_msg = (
        f"# Từ khoá chính\n{keyword}\n\n"
        f"# Bài viết gốc (Markdown)\n{content[:_MAX_CONTENT_CHARS]}"
        f"{issue_block}"
    )

    # patient=True: auto-fix là thao tác chủ động — chờ qua giới hạn 5 lượt/phút
    # rồi thử lại thay vì fail ngay khi quota vừa bị dùng bởi lần phân tích.
    parsed = await generate_structured(
        _SYSTEM_PROMPT, user_msg, _FixResult, max_tokens=8192, patient=True
    )
    if parsed is None or not parsed.content.strip():
        return None
    return parsed.content.strip()
