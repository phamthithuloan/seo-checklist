"""SEO rule-based analyzer — Python port of frontend/lib/seoAnalyzer.ts.

11 rules grouped into 4 categories. Keep id/label/threshold identical to the TS
source so frontend (Phase 7) can swap from local logic to backend without UI changes.
"""

import math
import re

from app.schemas.analysis import AnalysisConfig, AnalysisResult, CheckIssue, CheckResult


def _truncate(text: str, n: int = 160) -> str:
    text = text.strip().replace("\n", " ")
    if len(text) <= n:
        return text
    return text[: n - 1] + "…"

# Default forbidden ad words (Vietnamese advertising compliance hints).
DEFAULT_AD_FORBIDDEN_WORDS: tuple[str, ...] = (
    "tốt nhất",
    "số 1",
    "duy nhất",
    "100%",
    "hàng đầu",
    "không ai bằng",
)

# Comparison words that, combined with a competitor mention, suggest unverified comparison.
_COMPARISON_WORDS = ("hơn", "tốt hơn", "kém", "tệ hơn", "vượt trội", "thua kém")

# Domains considered "credible" for citations.
_CREDIBLE_DOMAINS = (
    ".gov",
    ".edu",
    ".ac",
    "wikipedia.org",
    "google.com/search",
    "developers.google.com",
    "moz.com",
    "ahrefs.com",
    "semrush.com",
    "backlinko.com",
    "searchengineland.com",
    "nature.com",
    "sciencedirect.com",
    "vinmec.com",
    "vnexpress.net",
    "vneconomy.vn",
)

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


ALL_RULE_IDS: tuple[str, ...] = (
    # readability
    "word-count",
    "sentence-length",
    "paragraph-length",
    "lead-paragraph",
    "persona-keywords",
    # technical
    "has-h1",
    "h1-quality",
    "has-h2",
    "h2-keyword",
    "sapo",
    "conclusion",
    "meta-description",
    "meta-keyword",
    "keyword-density",
    "internal-link",
    "secondary-keywords",
    "product-link-coverage",
    "conclusion-not-cta",
    # ul-li
    "bullet-list",
    "bold-emphasis",
    # ai-opt
    "heading-question",
    "tldr",
    "lsi-coverage",
    # branding
    "faq",
    "cta",
    "brand-pronoun",
    "brand-voice",
    "brand-message",
    "ad-forbidden-words",
    "competitor-mention",
    "cta-3s-quality",
    # eeat
    "eeat-experience",
    "eeat-case-study",
    "eeat-customer-reviews",
    "eeat-authority-brand",
    "eeat-trust-citations",
    "eeat-trust-harvard",
)

CONFIGURABLE_RULE_IDS: frozenset[str] = frozenset({
    "secondary-keywords",
    "persona-keywords",
    "lsi-coverage",
    "brand-pronoun",
    "brand-voice",
    "brand-message",
    "ad-forbidden-words",
    "competitor-mention",
    "product-link-coverage",
    "eeat-authority-brand",
})

_H1_RE = re.compile(r"^#(?!#)\s+(.+)$", re.MULTILINE)
_H3_RE = re.compile(r"^###(?!#)\s+(.+)$", re.MULTILINE)
_BOLD_RE = re.compile(r"\*\*[^*\n]+\*\*")
_CONCLUSION_RE = re.compile(
    r"^#{1,4}\s*(?:kết luận|tổng kết|kết bài|lời kết|tóm lại)\b",
    re.IGNORECASE | re.MULTILINE,
)
_HEADING_LINE_RE = re.compile(r"^#{1,6}\s+.*$", re.MULTILINE)


def _strip_heading_lines(text: str) -> str:
    """Remove markdown heading lines so they don't pollute paragraph word counts."""
    return _HEADING_LINE_RE.sub("", text)


def analyze_content(
    content: str,
    keyword: str,
    meta_description: str = "",
    enabled_checks: list[str] | None = None,
    config: AnalysisConfig | None = None,
) -> AnalysisResult:
    """Run SEO rules. If enabled_checks is None or empty, run all; otherwise
    only run rules whose id is in the list. Configurable rules use values from
    `config` — if a configurable rule is enabled but its input is empty, it
    emits a 'needs-config' warning so the user knows to fill it in."""

    if enabled_checks is None or not enabled_checks:
        enabled = set(ALL_RULE_IDS)
    else:
        enabled = set(enabled_checks)

    cfg = config or AnalysisConfig()

    lower = _normalize(content)
    kw = _normalize(keyword)
    kw_display = keyword.strip() or "từ khóa chính"
    kw_slug = kw.replace(" ", "-") if kw else "tu-khoa"
    checks: list[CheckResult] = []

    def add(result: CheckResult) -> None:
        if result.id in enabled:
            checks.append(result)

    # 1. Word count
    word_count = _count_words(content)
    words_needed = max(0, 800 - word_count)
    add(
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
    add(
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
    h2_kw_issues: list[CheckIssue] = []
    if h2_matches and not h2_has_keyword:
        h2_kw_issues = [
            CheckIssue(kind="heading", text=h.strip(), note="không chứa từ khoá")
            for h in h2_matches[:10]
        ]
    add(
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
            issues=h2_kw_issues,
        )
    )

    # 4. FAQ
    has_faq = any(p in lower for p in FAQ_PATTERNS)
    add(
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
    add(
        CheckResult(
            id="cta",
            label="Có Call-to-Action",
            category="branding",
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

    add(
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
    add(
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
    add(
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

    # 9. Paragraph length (60-80 ideal, ≤100 acceptable)
    paragraphs = [p.strip() for p in _PARAGRAPH_SPLIT_RE.split(content) if p.strip()]
    long_para_pairs = [
        (p, _count_words(_strip_heading_lines(p)))
        for p in paragraphs
        if _count_words(_strip_heading_lines(p)) > 100
    ]
    long_paragraphs = len(long_para_pairs)
    add(
        CheckResult(
            id="paragraph-length",
            label="Đoạn văn ≤ 100 từ",
            category="readability",
            status="pass" if long_paragraphs == 0 else "warn",
            detail="Tất cả đoạn đều có độ dài hợp lý."
            if long_paragraphs == 0
            else f"Có {long_paragraphs} đoạn dài hơn 100 từ.",
            recommendation=None
            if long_paragraphs == 0
            else (
                "Chia đoạn dài thành 60-80 từ (~3-4 dòng, tối đa 5 dòng). "
                "Tách tại điểm chuyển ý — đoạn ngắn dễ scan trên mobile và tăng dwell time."
            ),
            issues=[
                CheckIssue(
                    kind="paragraph",
                    text=_truncate(_strip_heading_lines(p).strip(), 220),
                    note=f"{n} từ",
                )
                for p, n in long_para_pairs[:10]
            ],
        )
    )

    # 10. Sentence length — strip headings so they don't merge with body sentences
    content_no_headings = _HEADING_LINE_RE.sub(".", content)
    flat = _NEWLINES_RE.sub(" ", content_no_headings)
    sentences = [s.strip() for s in _SENTENCE_SPLIT_RE.split(flat) if s.strip()]
    long_sent_pairs = [(s, _count_words(s)) for s in sentences if _count_words(s) > 30]
    long_sentences = len(long_sent_pairs)
    add(
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
            issues=[
                CheckIssue(kind="sentence", text=_truncate(s, 200), note=f"{n} từ")
                for s, n in long_sent_pairs[:15]
            ],
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
    add(
        CheckResult(
            id="tldr",
            label="Có TL;DR / Tóm tắt dạng bullet",
            category="ai-opt",
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

    # 12. Has H1
    h1_matches = _H1_RE.findall(content)
    has_h1 = len(h1_matches) > 0
    add(
        CheckResult(
            id="has-h1",
            label="Có Heading H1",
            category="technical",
            status="pass" if has_h1 else "fail",
            detail=f"Tìm thấy {len(h1_matches)} H1." if has_h1 else "Không có H1 nào.",
            recommendation=None
            if has_h1
            else (
                "Đặt H1 duy nhất cho cả bài (cú pháp `# Tiêu đề`). "
                "H1 nên là tiêu đề chính của trang."
            ),
        )
    )

    # 13. H1 quality (length + keyword)
    if has_h1:
        h1 = h1_matches[0].strip()
        h1_len = len(h1)
        h1_has_kw = bool(kw) and kw in _normalize(h1)
        h1_len_ok = h1_len <= 63
        h1_ok = h1_has_kw and h1_len_ok
        if h1_ok:
            h1_detail = f"H1 dài {h1_len} ký tự, chứa từ khoá."
            h1_rec = None
        elif not h1_len_ok and not h1_has_kw:
            h1_detail = f"H1 dài {h1_len} ký tự (>63) và không chứa từ khoá."
            h1_rec = (
                f'Rút gọn H1 ≤ 63 ký tự + đưa "{kw_display}" vào đầu/giữa tiêu đề.'
            )
        elif not h1_len_ok:
            h1_detail = f"H1 dài {h1_len} ký tự (>63)."
            h1_rec = "Rút gọn H1 ≤ 63 ký tự để hiển thị đủ trên SERP."
        else:
            h1_detail = f"H1 dài {h1_len} ký tự nhưng không chứa từ khoá."
            h1_rec = f'Đưa "{kw_display}" vào H1, ưu tiên đứng đầu tiêu đề.'
        add(
            CheckResult(
                id="h1-quality",
                label="H1 ≤ 63 ký tự + chứa từ khoá",
                category="technical",
                status="pass" if h1_ok else "warn",
                detail=h1_detail,
                recommendation=h1_rec,
            )
        )
    else:
        add(
            CheckResult(
                id="h1-quality",
                label="H1 ≤ 63 ký tự + chứa từ khoá",
                category="technical",
                status="fail",
                detail="Bài chưa có H1 để kiểm tra.",
                recommendation="Thêm H1 trước khi đánh giá độ dài / keyword.",
            )
        )

    # 14. Sapo (mở bài) — paragraph đầu sau H1, 30-100 từ + chứa keyword
    sapo_idx = 0
    if paragraphs and paragraphs[0].lstrip().startswith("# "):
        sapo_idx = 1
    sapo_text = paragraphs[sapo_idx] if sapo_idx < len(paragraphs) else ""
    sapo_text = sapo_text.strip()
    if sapo_text.startswith("#"):
        sapo_text = ""
    sapo_words = _count_words(sapo_text)
    sapo_has_kw = bool(kw) and bool(sapo_text) and kw in _normalize(sapo_text)
    sapo_len_ok = 30 <= sapo_words <= 100
    sapo_ok = bool(sapo_text) and sapo_has_kw and sapo_len_ok
    if sapo_ok:
        sapo_detail = f"Sapo {sapo_words} từ, chứa từ khoá."
        sapo_rec = None
    elif not sapo_text:
        sapo_detail = "Chưa có đoạn mở bài (Sapo)."
        sapo_rec = (
            f'Viết Sapo 3-5 dòng (30-100 từ) ngay sau H1, có chứa "{kw_display}".'
        )
    elif not sapo_has_kw:
        sapo_detail = f"Sapo {sapo_words} từ nhưng không chứa từ khoá."
        sapo_rec = f'Đưa "{kw_display}" vào Sapo, ưu tiên 1-2 câu đầu.'
    else:
        sapo_detail = f"Sapo {sapo_words} từ — ngoài khoảng 30-100 từ."
        sapo_rec = (
            "Sapo nên dài 3-5 dòng (30-100 từ): sơ lược nội dung + lợi ích chính."
        )
    add(
        CheckResult(
            id="sapo",
            label="Mở bài (Sapo) 3-5 dòng + chứa từ khoá",
            category="technical",
            status="pass" if sapo_ok else "warn",
            detail=sapo_detail,
            recommendation=sapo_rec,
        )
    )

    # 15. Conclusion (kết bài)
    has_conclusion = bool(_CONCLUSION_RE.search(content))
    add(
        CheckResult(
            id="conclusion",
            label="Có Kết bài",
            category="technical",
            status="pass" if has_conclusion else "warn",
            detail="Đã có heading kết bài."
            if has_conclusion
            else "Chưa thấy phần kết bài.",
            recommendation=None
            if has_conclusion
            else (
                'Thêm heading "Kết luận" / "Tổng kết" ở cuối bài — '
                "tóm tắt 2-3 ý chính, tách riêng khỏi CTA."
            ),
        )
    )

    # 16. Meta description chứa keyword
    meta_lower = _normalize(meta_description)
    meta_has_kw = bool(kw) and bool(meta_lower) and kw in meta_lower
    if meta_len == 0:
        meta_kw_status: str = "warn"
        meta_kw_detail = "Chưa có meta description."
    elif meta_has_kw:
        meta_kw_status = "pass"
        meta_kw_detail = "Meta đã chứa từ khoá chính."
    else:
        meta_kw_status = "fail"
        meta_kw_detail = "Meta không chứa từ khoá chính."
    add(
        CheckResult(
            id="meta-keyword",
            label="Meta description chứa từ khoá",
            category="technical",
            status=meta_kw_status,  # type: ignore[arg-type]
            detail=meta_kw_detail,
            recommendation=None
            if meta_has_kw
            else (
                f'Đưa "{kw_display}" vào meta, ưu tiên gần đầu để tăng độ phù hợp + CTR.'
            ),
        )
    )

    # 17. Lead paragraph (câu dẫn sau H2)
    blocks = [b for b in _PARAGRAPH_SPLIT_RE.split(content) if b.strip()]
    h2_count = 0
    missing_lead_h2s: list[str] = []
    for i, b in enumerate(blocks):
        first_line = b.lstrip().split("\n", 1)[0]
        if not first_line.startswith("## ") or first_line.startswith("###"):
            continue
        h2_count += 1
        heading_text = first_line.lstrip("# ").strip()
        # Look at the rest of this block first (heading + lead in same block)
        rest = b.split("\n", 1)[1].strip() if "\n" in b else ""
        if rest:
            if rest.lstrip().startswith(("-", "*", "+")):
                missing_lead_h2s.append(heading_text)
            continue
        # Otherwise the next block
        if i + 1 >= len(blocks):
            missing_lead_h2s.append(heading_text)
            continue
        nxt = blocks[i + 1].lstrip()
        nxt_first = nxt.split("\n", 1)[0]
        if nxt_first.startswith("#") or nxt_first.startswith(("-", "*", "+")):
            missing_lead_h2s.append(heading_text)

    h2_missing_lead = len(missing_lead_h2s)
    if h2_count == 0:
        lead_status: str = "warn"
        lead_detail = "Không có H2 để kiểm tra câu dẫn."
        lead_rec = None
    elif h2_missing_lead == 0:
        lead_status = "pass"
        lead_detail = "Mọi H2 đều có câu dẫn."
        lead_rec = None
    else:
        lead_status = "warn"
        lead_detail = f"{h2_missing_lead}/{h2_count} H2 thiếu đoạn văn dẫn."
        lead_rec = (
            "Sau mỗi H2, viết 1-2 câu dẫn dắt để định hướng người đọc trước khi liệt kê bullet."
        )
    add(
        CheckResult(
            id="lead-paragraph",
            label="Câu dẫn sau H2",
            category="readability",
            status=lead_status,  # type: ignore[arg-type]
            detail=lead_detail,
            recommendation=lead_rec,
            issues=[
                CheckIssue(kind="heading", text=h, note="thiếu đoạn dẫn")
                for h in missing_lead_h2s[:10]
            ],
        )
    )

    # 18. Bullet list (cần ≥ 3 bullets)
    bullet_count = len(_BULLET_RE.findall(content))
    has_bullets = bullet_count >= 3
    add(
        CheckResult(
            id="bullet-list",
            label="Có Bullet List",
            category="ul-li",
            status="pass" if has_bullets else "warn",
            detail=f"Tìm thấy {bullet_count} dòng bullet."
            if bullet_count > 0
            else "Bài chưa có bullet list.",
            recommendation=None
            if has_bullets
            else (
                "Trình bày các ý cùng cấp dưới dạng bullet `- mục` "
                "— AI và người đọc đều quét nhanh hơn."
            ),
        )
    )

    # 19. Bold emphasis
    bold_count = len(_BOLD_RE.findall(content))
    has_bold = bold_count > 0
    add(
        CheckResult(
            id="bold-emphasis",
            label="Có in đậm",
            category="ul-li",
            status="pass" if has_bold else "warn",
            detail=f"Tìm thấy {bold_count} cụm in đậm."
            if has_bold
            else "Bài chưa có in đậm.",
            recommendation=None
            if has_bold
            else (
                "Highlight ý chính bằng `**chữ in đậm**` "
                "— giúp người đọc skim và AI hiểu key entities."
            ),
        )
    )

    # 20. Heading question (H2 hoặc H3 kết thúc dấu ?)
    h2_h3 = h2_matches + _H3_RE.findall(content)
    has_question_heading = any(h.strip().endswith("?") for h in h2_h3)
    add(
        CheckResult(
            id="heading-question",
            label="Heading dạng câu hỏi",
            category="ai-opt",
            status="pass" if has_question_heading else "warn",
            detail="Đã có heading dạng câu hỏi."
            if has_question_heading
            else "Chưa có H2/H3 nào kết thúc bằng dấu ?",
            recommendation=None
            if has_question_heading
            else (
                'Đổi 1-2 H2/H3 thành câu hỏi (vd "X là gì?", "Cách Y như thế nào?") '
                "— bắt long-tail keyword và xuất hiện trong People Also Ask."
            ),
        )
    )

    # ─────────── Configurable rules (use values from `cfg`) ───────────

    def _needs_config(rule_id: str, label: str, category, what: str) -> CheckResult:
        return CheckResult(
            id=rule_id,
            label=label,
            category=category,
            status="warn",
            detail=f"Chưa cấu hình {what} trong Checklist SEO.",
            recommendation=(
                f"Mở Checklist SEO → tìm rule này → nhập {what} → bấm Lưu để tool kiểm tra."
            ),
        )

    # 21. Secondary keywords presence
    if cfg.secondary_keywords:
        missing = [
            k for k in cfg.secondary_keywords if k.strip() and k.lower() not in lower
        ]
        ok = len(missing) == 0
        add(
            CheckResult(
                id="secondary-keywords",
                label="Từ khoá phụ xuất hiện ≥1 lần",
                category="technical",
                status="pass" if ok else "fail",
                detail=(
                    f"Đủ {len(cfg.secondary_keywords)} từ khoá phụ."
                    if ok
                    else f"Thiếu {len(missing)}/{len(cfg.secondary_keywords)} từ khoá phụ."
                ),
                recommendation=None
                if ok
                else f"Bổ sung các từ chưa có: {', '.join(missing[:5])}…",
                issues=[
                    CheckIssue(kind="word", text=k, note="chưa xuất hiện trong bài")
                    for k in missing[:15]
                ],
            )
        )
    else:
        add(_needs_config(
            "secondary-keywords",
            "Từ khoá phụ xuất hiện ≥1 lần",
            "technical",
            "danh sách từ khoá phụ",
        ))

    # 22. Persona keywords
    if cfg.persona_keywords:
        found = sum(1 for k in cfg.persona_keywords if k.strip() and k.lower() in lower)
        ratio = found / len(cfg.persona_keywords) if cfg.persona_keywords else 0
        ok = ratio >= 0.5
        add(
            CheckResult(
                id="persona-keywords",
                label="Cá nhân hoá: từ khoá persona",
                category="readability",
                status="pass" if ok else "warn",
                detail=f"Tìm thấy {found}/{len(cfg.persona_keywords)} từ persona.",
                recommendation=None
                if ok
                else "Bổ sung từ ngữ phù hợp với đối tượng đọc — tránh viết chung chung.",
            )
        )
    else:
        add(_needs_config(
            "persona-keywords",
            "Cá nhân hoá: từ khoá persona",
            "readability",
            "danh sách từ persona / đối tượng đọc",
        ))

    # 23. LSI coverage — ≥3 LSI per paragraph
    if cfg.lsi_keywords:
        lsi_lower = [w.lower() for w in cfg.lsi_keywords if w.strip()]
        body_paras = [
            p for p in paragraphs if not p.lstrip().startswith("#") and _count_words(p) >= 20
        ]
        if not body_paras:
            add(CheckResult(
                id="lsi-coverage", label="Mỗi đoạn ≥3 từ LSI",
                category="ai-opt", status="warn",
                detail="Không có đoạn văn để kiểm tra.",
                recommendation=None,
            ))
        else:
            bad_paras: list[tuple[str, int]] = []
            for p in body_paras:
                lp = p.lower()
                hits = sum(1 for w in lsi_lower if w in lp)
                if hits < 3:
                    bad_paras.append((p, hits))
            ok = len(bad_paras) == 0
            add(CheckResult(
                id="lsi-coverage", label="Mỗi đoạn ≥3 từ LSI",
                category="ai-opt", status="pass" if ok else "warn",
                detail=(
                    f"Đủ ≥3 LSI ở mọi đoạn."
                    if ok
                    else f"{len(bad_paras)}/{len(body_paras)} đoạn có <3 LSI."
                ),
                recommendation=None if ok else (
                    "Đan thêm các từ cùng trường nghĩa ở các đoạn thiếu — "
                    "tăng cosine similarity với từ khoá chính."
                ),
                issues=[
                    CheckIssue(
                        kind="paragraph",
                        text=_truncate(p, 180),
                        note=f"chỉ có {hits} từ LSI",
                    )
                    for p, hits in bad_paras[:10]
                ],
            ))
    else:
        add(_needs_config(
            "lsi-coverage", "Mỗi đoạn ≥3 từ LSI",
            "ai-opt", "danh sách từ LSI / cùng trường nghĩa",
        ))

    # 24. Brand pronoun — kiểm tra xưng hô có dùng + không lẫn
    if cfg.pronouns:
        pronouns_lower = [p.lower() for p in cfg.pronouns if p.strip()]
        usage = {p: _count_occurrences(lower, p) for p in pronouns_lower}
        primary = max(usage, key=usage.get) if usage else None
        other_used = [p for p, n in usage.items() if p != primary and n > 0]
        primary_count = usage.get(primary, 0) if primary else 0
        if primary_count == 0:
            status_ = "fail"
            d = "Bài chưa dùng xưng hô đã cấu hình."
            rec = (
                f'Đưa xưng hô "{cfg.pronouns[0]}" vào bài, ít nhất 3 lần để giọng đồng nhất.'
            )
        elif other_used:
            status_ = "warn"
            d = (
                f'Chính "{primary}" {primary_count} lần — '
                f"nhưng còn lẫn: {', '.join(other_used)}."
            )
            rec = "Thống nhất 1 cách xưng hô duy nhất trong cả bài."
        else:
            status_ = "pass"
            d = f'Xưng hô "{primary}" dùng {primary_count} lần, không lẫn.'
            rec = None
        pronoun_issues: list[CheckIssue] = []
        if status_ == "warn":
            for p, n in usage.items():
                if n > 0:
                    note = "chính" if p == primary else "lẫn vào"
                    pronoun_issues.append(
                        CheckIssue(kind="word", text=p, note=f"{note} ({n} lần)")
                    )
        add(CheckResult(
            id="brand-pronoun", label="Xưng hô nhất quán",
            category="branding", status=status_, detail=d, recommendation=rec,
            issues=pronoun_issues,
        ))
    else:
        add(_needs_config(
            "brand-pronoun", "Xưng hô nhất quán",
            "branding", 'cách xưng hô (vd "Bạn", "Anh/Chị")',
        ))

    # 25. Brand voice keywords
    if cfg.brand_voice_keywords:
        bv = [k for k in cfg.brand_voice_keywords if k.strip()]
        found = sum(1 for k in bv if k.lower() in lower)
        ok = found >= max(1, len(bv) // 2)
        add(CheckResult(
            id="brand-voice", label="Brand voice keywords",
            category="branding", status="pass" if ok else "warn",
            detail=f"Tìm thấy {found}/{len(bv)} brand voice keyword.",
            recommendation=None if ok else (
                "Đan thêm các từ thể hiện giọng thương hiệu (vd: chuyên nghiệp, đồng hành...)."
            ),
        ))
    else:
        add(_needs_config(
            "brand-voice", "Brand voice keywords",
            "branding", "list từ thể hiện giọng thương hiệu",
        ))

    # 26. Brand message
    if cfg.brand_message.strip():
        ok = cfg.brand_message.lower().strip() in lower
        add(CheckResult(
            id="brand-message", label="Thông điệp thương hiệu xuất hiện",
            category="branding", status="pass" if ok else "fail",
            detail="Thông điệp đã có trong bài." if ok
                else "Chưa thấy thông điệp thương hiệu trong bài.",
            recommendation=None if ok else (
                f'Đưa câu thông điệp "{cfg.brand_message[:60]}…" vào bài, '
                "ưu tiên kết bài hoặc CTA."
            ),
        ))
    else:
        add(_needs_config(
            "brand-message", "Thông điệp thương hiệu xuất hiện",
            "branding", "câu thông điệp thương hiệu",
        ))

    # 25b. Brand voice keywords — surface missing ones as issues
    if cfg.brand_voice_keywords:
        bv_missing = [k for k in cfg.brand_voice_keywords if k.strip() and k.lower() not in lower]
        # Patch issues onto the brand-voice check we just appended
        for c in checks:
            if c.id == "brand-voice":
                c.issues = [
                    CheckIssue(kind="word", text=k, note="chưa xuất hiện")
                    for k in bv_missing[:10]
                ]
                break

    # 27. Ad forbidden words
    if cfg.ad_forbidden_words or "ad-forbidden-words" in enabled:
        ad_words = cfg.ad_forbidden_words or list(DEFAULT_AD_FORBIDDEN_WORDS)
        found_ad = [w for w in ad_words if w.strip() and w.lower() in lower]
        add(CheckResult(
            id="ad-forbidden-words",
            label="Không dùng từ cấm quảng cáo",
            category="branding",
            status="pass" if not found_ad else "fail",
            detail=("Không phát hiện từ cấm." if not found_ad
                    else f"Phát hiện: {', '.join(found_ad[:5])}"),
            recommendation=None if not found_ad else (
                "Thay các từ cấm bằng diễn đạt khách quan, có dẫn nguồn nếu cần "
                "so sánh. Tham khảo 6 quy định quảng cáo."
            ),
            issues=[
                CheckIssue(kind="word", text=w, note="xuất hiện trong bài")
                for w in found_ad[:15]
            ],
        ))

    # 28. Competitor mention + comparison flag
    if cfg.competitors:
        comps = [c for c in cfg.competitors if c.strip()]
        found_comp = [c for c in comps if c.lower() in lower]
        comparison_hits = [w for w in _COMPARISON_WORDS if w in lower]
        if found_comp and comparison_hits:
            status_ = "fail"
            d = (
                f"Có nhắc đối thủ ({', '.join(found_comp[:3])}) cùng từ so sánh "
                f"({', '.join(comparison_hits[:3])}) — cần có nguồn bên thứ 3."
            )
            rec = (
                "Bỏ so sánh trực tiếp hoặc dẫn thống kê công khai từ bên thứ 3 uy tín."
            )
        elif found_comp:
            status_ = "warn"
            d = f"Nhắc đối thủ {', '.join(found_comp[:3])} — không kèm so sánh, an toàn."
            rec = None
        else:
            status_ = "pass"
            d = "Bài không nhắc tên đối thủ."
            rec = None
        comp_issues: list[CheckIssue] = []
        for c in found_comp:
            comp_issues.append(CheckIssue(kind="word", text=c, note="đối thủ được nhắc"))
        for w in comparison_hits:
            comp_issues.append(CheckIssue(kind="word", text=w, note="từ so sánh"))
        add(CheckResult(
            id="competitor-mention",
            label="Không so sánh đối thủ thiếu nguồn",
            category="branding", status=status_, detail=d, recommendation=rec,
            issues=comp_issues[:15],
        ))
    else:
        add(_needs_config(
            "competitor-mention",
            "Không so sánh đối thủ thiếu nguồn",
            "branding", "danh sách tên đối thủ",
        ))

    # 29. Product link coverage — each product url is linked at least once
    if cfg.product_urls:
        product_urls = [u for u in cfg.product_urls if u.strip()]
        missing = [u for u in product_urls if u not in content]
        ok = len(missing) == 0
        add(CheckResult(
            id="product-link-coverage",
            label="Có link tới các sản phẩm nhắc trong bài",
            category="technical",
            status="pass" if ok else "warn",
            detail=(
                f"Đủ link tới {len(product_urls)} sản phẩm."
                if ok else f"Thiếu link cho {len(missing)}/{len(product_urls)} sản phẩm."
            ),
            recommendation=None if ok else (
                f"Thêm link tới: {', '.join(missing[:3])}…"
            ),
        ))
    else:
        add(_needs_config(
            "product-link-coverage",
            "Có link tới các sản phẩm nhắc trong bài",
            "technical", "danh sách URL sản phẩm",
        ))

    # 30. E-E-A-T authority brand mentions
    if cfg.awards_mentions:
        awards = [a for a in cfg.awards_mentions if a.strip()]
        found_award = [a for a in awards if a.lower() in lower]
        add(CheckResult(
            id="eeat-authority-brand",
            label="Authoritativeness: nhắc giải thưởng / danh tiếng",
            category="eeat",
            status="pass" if found_award else "warn",
            detail=(
                f"Có nhắc: {', '.join(found_award[:3])}"
                if found_award else "Chưa nhắc giải thưởng / danh tiếng nào."
            ),
            recommendation=None if found_award else (
                "Đan các thành tích / giải thưởng đã cấu hình vào bài để tăng độ uy tín."
            ),
        ))
    else:
        add(_needs_config(
            "eeat-authority-brand",
            "Authoritativeness: nhắc giải thưởng / danh tiếng",
            "eeat", "danh sách giải thưởng / brand mention",
        ))

    # ─────────── Heuristic rules (no input needed) ───────────

    # 31. EEAT — Experience: đếm ảnh markdown + first-person markers
    images = len(re.findall(r"!\[[^\]]*\]\([^)]+\)", content))
    first_person = (
        _count_occurrences(lower, "tôi đã")
        + _count_occurrences(lower, "chúng tôi đã")
        + _count_occurrences(lower, "kinh nghiệm của")
        + _count_occurrences(lower, "thực tế khi")
    )
    exp_score = images + first_person
    add(CheckResult(
        id="eeat-experience",
        label="Experience: ảnh thực tế + first-person",
        category="eeat",
        status="pass" if exp_score >= 2 else "warn",
        detail=f"{images} ảnh, {first_person} pattern trải nghiệm cá nhân.",
        recommendation=None if exp_score >= 2 else (
            'Thêm ảnh thực tế bằng `![mô tả](đường dẫn)` và mệnh đề như "Tôi đã / Chúng tôi đã..." '
            "để tăng tín hiệu Experience."
        ),
    ))

    # 32. EEAT — Case study + data points
    has_case_study = "case study" in lower or "case-study" in lower
    metric_hits = len(re.findall(r"\d+\s*(?:%|nghìn|triệu|tỷ|vnd|usd)", lower))
    case_score = (2 if has_case_study else 0) + (1 if metric_hits >= 3 else 0)
    add(CheckResult(
        id="eeat-case-study",
        label="Expertise: case study + số liệu",
        category="eeat",
        status="pass" if case_score >= 2 else "warn",
        detail=(
            f"Case study: {'có' if has_case_study else 'không'}, "
            f"{metric_hits} điểm dữ liệu định lượng."
        ),
        recommendation=None if case_score >= 2 else (
            "Bổ sung case study cụ thể (bối cảnh → thách thức → kết quả) kèm số liệu thực tế."
        ),
    ))

    # 33. EEAT — Customer reviews / quotes
    quote_matches = re.findall(r'"([^"\n]{15,})"', content)
    blockquote_matches = re.findall(r'>\s*([^\n]{20,})', content)
    rev_total = len(quote_matches) + len(blockquote_matches)
    rev_issues = [
        CheckIssue(kind="quote", text=_truncate(q, 180), note="ngoặc kép")
        for q in quote_matches[:5]
    ] + [
        CheckIssue(kind="quote", text=_truncate(q, 180), note="blockquote")
        for q in blockquote_matches[:5]
    ]
    add(CheckResult(
        id="eeat-customer-reviews",
        label="Authoritativeness: trích dẫn / review",
        category="eeat",
        status="pass" if rev_total >= 1 else "warn",
        detail=f"{len(quote_matches)} trích dẫn ngoặc kép, {len(blockquote_matches)} blockquote.",
        recommendation=None if rev_total >= 1 else (
            'Thêm trích dẫn từ khách hàng / chuyên gia dạng `> Câu nói` hoặc `"Câu nói"`.'
        ),
        issues=rev_issues,
    ))

    # 34. EEAT — Trust citations from credible domains
    all_links = re.findall(r"https?://[^\s)\"]+", content)
    credible = [u for u in all_links if any(d in u.lower() for d in _CREDIBLE_DOMAINS)]
    add(CheckResult(
        id="eeat-trust-citations",
        label="Trustworthiness: nguồn trích dẫn uy tín",
        category="eeat",
        status="pass" if credible else "warn",
        detail=f"{len(credible)} link từ nguồn uy tín / {len(all_links)} tổng link.",
        recommendation=None if credible else (
            "Dẫn link tới nguồn uy tín (.gov, .edu, wikipedia, journal, báo chính thống)."
        ),
        issues=[
            CheckIssue(kind="link", text=_truncate(u, 200), note="domain uy tín")
            for u in credible[:10]
        ],
    ))

    # 35. EEAT — Harvard-style citation format "Tác giả, Năm"
    harvard_matches = re.findall(r"\([^)]*?,\s*(?:19|20)\d{2}\)", content)
    harvard = len(harvard_matches)
    add(CheckResult(
        id="eeat-trust-harvard",
        label="Citation format Harvard",
        category="eeat",
        status="pass" if harvard >= 1 else "warn",
        detail=f"{harvard} citation theo format (Tác giả, Năm).",
        recommendation=None if harvard >= 1 else (
            'Khi dẫn nghiên cứu / thống kê, dùng format Harvard: vd "(Smith, 2024)" hoặc "(Bộ Y tế, 2023)".'
        ),
        issues=[
            CheckIssue(kind="text", text=h, note="citation Harvard")
            for h in harvard_matches[:10]
        ],
    ))

    # 36. CTA 3S quality (auto heuristic — separate from existing `cta` presence rule)
    cta_sentence_re = re.compile(
        r"[^.!?\n]*(?:liên hệ|đăng ký|tư vấn|mua ngay|nhận ngay|đặt hàng)[^.!?\n]*[.!?]",
        re.IGNORECASE,
    )
    cta_sentences = cta_sentence_re.findall(content)
    if cta_sentences:
        # Pick best CTA: short (<= 20 words) AND has strong verb at start
        good = [
            s for s in cta_sentences
            if _count_words(s) <= 20 and re.match(r"\s*(liên hệ|đăng ký|tư vấn|mua|nhận|đặt)", s, re.IGNORECASE)
        ]
        ok = bool(good)
        add(CheckResult(
            id="cta-3s-quality",
            label="CTA đạt 3S (Simple / Specific / Strong)",
            category="branding",
            status="pass" if ok else "warn",
            detail=(
                f"{len(good)}/{len(cta_sentences)} CTA ngắn + dùng động từ mạnh."
                if cta_sentences else "Chưa có câu CTA rõ ràng."
            ),
            recommendation=None if ok else (
                "Viết CTA ngắn (≤20 từ), bắt đầu bằng động từ mạnh "
                '(vd "Liên hệ ngay…", "Đăng ký nhận tư vấn miễn phí…").'
            ),
        ))
    else:
        add(CheckResult(
            id="cta-3s-quality",
            label="CTA đạt 3S (Simple / Specific / Strong)",
            category="branding",
            status="warn",
            detail="Chưa có câu CTA rõ ràng.",
            recommendation=(
                "Viết ≥1 CTA ngắn, có động từ mạnh, lời mời cụ thể."
            ),
        ))

    # 37. Conclusion không gộp CTA
    conc_match = _CONCLUSION_RE.search(content)
    if conc_match:
        # Take text from conclusion heading until next heading or end
        start = conc_match.end()
        rest = content[start:]
        next_heading = re.search(r"\n#{1,4}\s", rest)
        conc_block = rest[: next_heading.start()] if next_heading else rest
        conc_lower = conc_block.lower()
        has_cta_word = any(p in conc_lower for p in CTA_PATTERNS)
        # Pass if conclusion exists AND no CTA-only content (has some non-CTA sentences)
        # Heuristic: conclusion length > 30 words and CTA words proportionally small
        conc_words = _count_words(conc_block)
        ok = conc_words >= 20 and (not has_cta_word or conc_words >= 60)
        add(CheckResult(
            id="conclusion-not-cta",
            label="Kết bài không gộp chung CTA",
            category="technical",
            status="pass" if ok else "warn",
            detail=(
                f"Kết bài {conc_words} từ, "
                + ("có nhắc CTA — đảm bảo có phần kết luận riêng." if has_cta_word else "không lẫn CTA.")
            ),
            recommendation=None if ok else (
                "Tách kết luận và CTA thành 2 section: kết luận chốt nội dung trước, "
                "CTA đặt sau."
            ),
        ))
    else:
        add(CheckResult(
            id="conclusion-not-cta",
            label="Kết bài không gộp chung CTA",
            category="technical",
            status="warn",
            detail="Chưa có heading kết bài để kiểm tra.",
            recommendation="Thêm heading Kết luận / Tổng kết tách riêng phần CTA.",
        ))

    pass_count = sum(1 for c in checks if c.status == "pass")
    fail_count = sum(1 for c in checks if c.status == "fail")
    warn_count = sum(1 for c in checks if c.status == "warn")
    total = len(checks)
    score = (
        math.floor(((pass_count + warn_count * 0.5) / total) * 100 + 0.5)
        if total > 0
        else 0
    )

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
