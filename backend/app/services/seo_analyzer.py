"""SEO rule-based analyzer — Python port of frontend/lib/seoAnalyzer.ts.

11 rules grouped into 4 categories. Keep id/label/threshold identical to the TS
source so frontend (Phase 7) can swap from local logic to backend without UI changes.
"""

import math
import re

from app.schemas.analysis import AnalysisResult, CheckResult

CTA_PATTERNS = [
    "liên hệ",
    "đăng ký",
    "tư vấn",
    "mua ngay",
    "nhận ngay",
    "đặt hàng",
]
FAQ_PATTERNS = ["faq", "câu hỏi thường gặp"]
TLDR_PATTERNS = ["tldr", "tl;dr", "tóm tắt", "tóm lược"]

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")
_H2_RE = re.compile(r"^##\s+.+$", re.MULTILINE)
_PARAGRAPH_SPLIT_RE = re.compile(r"\n{2,}")
_NEWLINES_RE = re.compile(r"\n+")
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
_BULLET_RE = re.compile(r"^\s*[-*+]\s+", re.MULTILINE)
_INTERNAL_LINK_PATTERNS = [
    re.compile(r"\]\(/[^)]+\)"),
    re.compile(r"""href=["']/[^"']+["']"""),
    re.compile(r"\[[^\]]+\]\(https?://[^)]+\)"),
]


def _normalize(text: str) -> str:
    return text.lower().strip()


def _count_words(text: str) -> int:
    stripped = _HTML_TAG_RE.sub(" ", text)
    return len([t for t in _WHITESPACE_RE.split(stripped) if t])


def _count_occurrences(haystack: str, needle: str) -> int:
    if not needle:
        return 0
    pattern = re.compile(rf"\b{re.escape(needle)}\b", re.IGNORECASE)
    return len(pattern.findall(haystack))


def analyze_content(
    content: str,
    keyword: str,
    meta_description: str = "",
) -> AnalysisResult:
    lower = _normalize(content)
    kw = _normalize(keyword)
    kw_display = keyword.strip() or "từ khóa chính"
    kw_slug = kw.replace(" ", "-") if kw else "tu-khoa"
    checks: list[CheckResult] = []

    # 1. Word count
    word_count = _count_words(content)
    words_needed = max(0, 800 - word_count)
    checks.append(
        CheckResult(
            id="word-count",
            label="Word count tối thiểu",
            category="readability",
            status="pass" if word_count >= 800 else "warn",
            detail=f"Bài viết có {word_count} từ.",
            recommendation=None
            if word_count >= 800
            else (
                f"Bổ sung thêm ~{words_needed} từ để đạt ngưỡng 800. "
                f'Mở rộng bằng: ví dụ thực tế, case study, mục "Lưu ý khi triển khai", '
                f"hoặc so sánh phương án."
            ),
        )
    )

    # 2. Has H2
    h2_matches = _H2_RE.findall(content)
    has_h2 = len(h2_matches) > 0
    checks.append(
        CheckResult(
            id="has-h2",
            label="Có heading H2",
            category="technical",
            status="pass" if has_h2 else "fail",
            detail=f"Tìm thấy {len(h2_matches)} H2." if has_h2 else "Không có H2 nào.",
            recommendation=None
            if has_h2
            else (
                f"Chia bài thành 3-5 phần với heading H2 (cú pháp `## Tiêu đề`). "
                f'Cấu trúc gợi ý cho bài về "{kw_display}":'
            ),
            example=None
            if has_h2
            else (
                f"## {kw_display} là gì?\n"
                f"## Lợi ích của {kw_display}\n"
                f"## Cách triển khai {kw_display} hiệu quả\n"
                f"## Lưu ý quan trọng\n"
                f"## Câu hỏi thường gặp"
            ),
        )
    )

    # 3. H2 contains keyword
    h2_has_keyword = bool(kw) and any(kw in _normalize(h) for h in h2_matches)
    checks.append(
        CheckResult(
            id="h2-keyword",
            label="H2 chứa từ khóa chính",
            category="technical",
            status="pass" if h2_has_keyword else "fail",
            detail="Có H2 chứa từ khóa." if h2_has_keyword else "Chưa có H2 nào chứa từ khóa chính.",
            recommendation=None
            if h2_has_keyword
            else (
                f'Đưa từ khóa "{kw_display}" vào ít nhất 1 H2 — '
                f"Google ưu tiên heading khi xác định chủ đề trang. Ví dụ:"
            ),
            example=None
            if h2_has_keyword
            else (
                f"## {kw_display} là gì?\n"
                f"## 5 lợi ích của {kw_display} cho doanh nghiệp\n"
                f"## Quy trình {kw_display} chuẩn 2026"
            ),
        )
    )

    # 4. FAQ
    has_faq = any(p in lower for p in FAQ_PATTERNS)
    checks.append(
        CheckResult(
            id="faq",
            label="Có phần FAQ / Câu hỏi thường gặp",
            category="branding",
            status="pass" if has_faq else "fail",
            detail="Đã tìm thấy mục FAQ." if has_faq else "Chưa thấy phần FAQ.",
            recommendation=None
            if has_faq
            else (
                "Thêm mục FAQ ở cuối bài với 3-5 câu hỏi người dùng hay tìm. "
                'Đây là cơ hội xuất hiện ở "People Also Ask" của Google. Mẫu:'
            ),
            example=None
            if has_faq
            else (
                f"## Câu hỏi thường gặp\n\n"
                f"**{kw_display} là gì?**\n[câu trả lời 2-3 dòng]\n\n"
                f"**Chi phí {kw_display} bao nhiêu?**\n[câu trả lời...]\n\n"
                f"**{kw_display} phù hợp với ai?**\n[câu trả lời...]"
            ),
        )
    )

    # 5. CTA
    cta_found = next((p for p in CTA_PATTERNS if p in lower), None)
    checks.append(
        CheckResult(
            id="cta",
            label="Có Call-to-Action",
            category="cta",
            status="pass" if cta_found else "fail",
            detail=f'CTA tìm thấy: "{cta_found}".' if cta_found else "Không có CTA rõ ràng.",
            recommendation=None
            if cta_found
            else (
                "Đặt CTA ở cuối bài (bắt buộc) và nhắc lại 1 lần ở giữa. "
                "CTA cần rõ hành động + lợi ích cụ thể. Ví dụ:"
            ),
            example=None
            if cta_found
            else (
                f"> 👉 **Liên hệ Seongon** để nhận tư vấn miễn phí về {kw_display} "
                f"— phản hồi trong 24h.\n"
                f"> [Đăng ký nhận báo giá](/lien-he)"
            ),
        )
    )

    # 6. Meta description
    meta_len = len(meta_description.strip())
    meta_ok = 0 < meta_len <= 165
    if meta_ok:
        meta_status: str = "pass"
    elif meta_len == 0:
        meta_status = "warn"
    else:
        meta_status = "fail"

    if meta_ok:
        meta_rec = None
        meta_example = None
    elif meta_len == 0:
        meta_rec = (
            f'Viết meta 150-160 ký tự, đặt từ khóa "{kw_display}" gần đầu '
            f"+ 1 lý do click. Mẫu:"
        )
        meta_example = (
            f"Tìm hiểu {kw_display} từ A-Z: định nghĩa, lợi ích và quy trình triển khai "
            f"chuẩn 2026. Đăng ký nhận tư vấn miễn phí ngay hôm nay."
        )
    else:
        meta_rec = (
            f"Rút gọn còn 150-160 ký tự (đang dư {meta_len - 160} ký tự). "
            f"Google sẽ cắt phần dư trong SERP. Ưu tiên giữ keyword ở đầu + USP."
        )
        meta_example = None

    checks.append(
        CheckResult(
            id="meta-description",
            label="Meta description ≤ 165 ký tự",
            category="technical",
            status=meta_status,  # type: ignore[arg-type]
            detail="Chưa nhập meta description."
            if meta_len == 0
            else f"Độ dài meta: {meta_len} ký tự.",
            recommendation=meta_rec,
            example=meta_example,
        )
    )

    # 7. Keyword density
    kw_count = _count_occurrences(lower, kw) if kw else 0
    density = (kw_count / word_count) * 100 if word_count > 0 else 0.0
    density_ok = 1 <= density <= 3
    target_min = math.ceil(word_count * 1 / 100)
    target_max = math.floor(word_count * 3 / 100)
    if density_ok:
        density_rec = None
    elif density < 1:
        density_rec = (
            f'Tăng số lần xuất hiện "{kw_display}" lên {target_min}-{target_max} lần. '
            f"Vị trí ưu tiên: 100 từ đầu, 1-2 H2, đoạn kết, ALT của ảnh, anchor text internal link."
        )
    else:
        density_rec = (
            f"Giảm xuống {target_min}-{target_max} lần (đang dư {kw_count - target_max}). "
            f'Thay bằng từ đồng nghĩa / LSI: "dịch vụ {kw_display}", "giải pháp {kw_display}", '
            f'"{kw_display} là gì". Tránh nhồi nhét gây phạt.'
        )
    checks.append(
        CheckResult(
            id="keyword-density",
            label="Keyword density 1% – 3%",
            category="technical",
            status="pass" if density_ok else "fail",
            detail=f"Từ khóa xuất hiện {kw_count} lần ({density:.2f}%).",
            recommendation=density_rec,
        )
    )

    # 8. Internal / link
    has_internal_link = any(p.search(content) for p in _INTERNAL_LINK_PATTERNS)
    checks.append(
        CheckResult(
            id="internal-link",
            label="Có link trong bài",
            category="technical",
            status="pass" if has_internal_link else "fail",
            detail="Đã có link." if has_internal_link else "Không phát hiện link nào.",
            recommendation=None
            if has_internal_link
            else (
                "Thêm 2-3 internal link tới bài liên quan trong site và 1-2 external link tới "
                'nguồn uy tín. Anchor text nên mô tả rõ trang đích (không dùng "click here").'
            ),
            example=None
            if has_internal_link
            else (
                f"Xem thêm: [hướng dẫn {kw_display} chi tiết](/blog/huong-dan-{kw_slug})\n"
                f"Tham khảo: [báo cáo của Google](https://developers.google.com/search)"
            ),
        )
    )

    # 9. Paragraph length
    paragraphs = [p.strip() for p in _PARAGRAPH_SPLIT_RE.split(content) if p.strip()]
    long_paragraphs = sum(1 for p in paragraphs if _count_words(p) > 150)
    checks.append(
        CheckResult(
            id="paragraph-length",
            label="Đoạn văn ≤ 150 từ",
            category="readability",
            status="pass" if long_paragraphs == 0 else "warn",
            detail="Tất cả đoạn đều có độ dài hợp lý."
            if long_paragraphs == 0
            else f"Có {long_paragraphs} đoạn dài hơn 150 từ.",
            recommendation=None
            if long_paragraphs == 0
            else (
                "Chia đoạn dài thành các đoạn 50-100 từ (~3-4 câu). "
                "Tách tại điểm chuyển ý — khi đổi chủ đề con thì xuống dòng. "
                "Đoạn ngắn dễ scan trên mobile và tăng dwell time."
            ),
        )
    )

    # 10. Sentence length
    flat = _NEWLINES_RE.sub(" ", content)
    sentences = [s.strip() for s in _SENTENCE_SPLIT_RE.split(flat) if s.strip()]
    long_sentences = sum(1 for s in sentences if _count_words(s) > 30)
    checks.append(
        CheckResult(
            id="sentence-length",
            label="Câu ≤ 30 từ",
            category="readability",
            status="pass" if long_sentences == 0 else "warn",
            detail="Câu có độ dài hợp lý."
            if long_sentences == 0
            else f"Có {long_sentences} câu dài hơn 30 từ.",
            recommendation=None
            if long_sentences == 0
            else (
                "Trung bình 15-20 từ/câu là dễ đọc nhất. Cắt câu dài tại liên từ "
                '("và", "nhưng", "tuy nhiên", "vì vậy") — '
                "đổi dấu phẩy thành dấu chấm để tách thành 2 câu độc lập."
            ),
        )
    )

    # 11. TL;DR + bullet
    has_tldr = any(p in lower for p in TLDR_PATTERNS)
    has_bullet = bool(_BULLET_RE.search(content))
    tldr_ok = has_tldr and has_bullet
    if tldr_ok:
        tldr_detail = "Đã có phần tóm tắt với bullet list."
    elif has_tldr:
        tldr_detail = "Có nhắc TL;DR nhưng thiếu bullet."
    else:
        tldr_detail = "Chưa có phần tóm tắt."
    checks.append(
        CheckResult(
            id="tldr",
            label="Có TL;DR / Tóm tắt dạng bullet",
            category="readability",
            status="pass" if tldr_ok else "fail",
            detail=tldr_detail,
            recommendation=None
            if tldr_ok
            else (
                "Thêm mục tóm tắt ở đầu bài (sau intro) với 3-5 bullet — "
                "giúp người đọc nắm nhanh ý chính, tăng dwell time và giảm bounce rate."
            ),
            example=None
            if tldr_ok
            else (
                f"## TL;DR\n"
                f"- {kw_display} giúp [lợi ích chính #1]\n"
                f"- Phù hợp với [đối tượng]\n"
                f"- Quy trình gồm [N] bước chính\n"
                f"- Chi phí khoảng [...]\n"
                f"- Liên hệ Seongon để được tư vấn"
            ),
        )
    )

    pass_count = sum(1 for c in checks if c.status == "pass")
    fail_count = sum(1 for c in checks if c.status == "fail")
    warn_count = sum(1 for c in checks if c.status == "warn")
    score = math.floor(((pass_count + warn_count * 0.5) / len(checks)) * 100 + 0.5)

    return AnalysisResult(
        score=score,
        total_checks=len(checks),
        pass_count=pass_count,
        fail_count=fail_count,
        warn_count=warn_count,
        word_count=word_count,
        keyword_density=density,
        checks=checks,
    )
