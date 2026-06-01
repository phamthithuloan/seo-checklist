"""Unit tests for SEO analyzer — Python port parity check."""

from app.schemas.analysis import AnalysisConfig
from app.services.seo_analyzer import analyze_content


def _check_by_id(result, check_id):
    for c in result.checks:
        if c.id == check_id:
            return c
    raise AssertionError(f"check {check_id} not found in result")


# A ~820-word article that satisfies every rule.
# 5 H2 (one contains keyword), TL;DR + bullets, FAQ, CTA, internal link, meta OK.
# Multiple ~100-word paragraphs each mentioning keyword once or twice so density ≈ 2%.
def _para(i: int) -> str:
    return (
        f"Phần {i}: dịch vụ SEO tổng thể giúp doanh nghiệp xây dựng nền tảng "
        f"trực tuyến bền vững. "
        f"Đội ngũ chuyên gia phân tích từ khóa và hành vi người dùng để định "
        f"hình chiến lược. "
        f"Khi triển khai bài bản, website tăng thứ hạng và mang về traffic "
        f"chất lượng. "
        f"Mỗi giai đoạn đều có chỉ số đo lường rõ ràng cho khách hàng."
    )

SAPO = (
    "Dịch vụ SEO tổng thể là giải pháp tối ưu hoá toàn diện website "
    "để **tăng traffic** và doanh thu tự nhiên. "
    "Bài viết này giúp bạn hiểu quy trình triển khai, chi phí và hiệu quả "
    "có thể đạt được khi đầu tư bài bản."
)

PERFECT_ARTICLE = (
    "# Hướng dẫn dịch vụ SEO tổng thể 2026\n\n"
    + SAPO + "\n\n"
    "## TL;DR\n"
    "Tóm tắt các điểm chính trước khi đọc chi tiết.\n\n"
    "- Dịch vụ SEO giúp tăng traffic tự nhiên.\n"
    "- Quy trình gồm audit, từ khóa, on-page, off-page.\n"
    "- Chi phí dao động theo quy mô website.\n"
    "- Hiệu quả thấy rõ sau 3-6 tháng.\n"
    "- Liên hệ Seongon để tư vấn miễn phí.\n\n"
    "## Dịch vụ SEO là gì?\n"
    + _para(1) + "\n\n"
    "## Lợi ích chính\n"
    + _para(2) + "\n\n"
    + "Tham khảo thêm [hướng dẫn cơ bản](/blog/seo-101) trước khi đọc tiếp.\n\n"
    "## Quy trình triển khai\n\n"
    "Quy trình triển khai dịch vụ SEO chia làm nhiều giai đoạn cụ thể như sau.\n\n"
    + _para(3) + "\n\n"
    + _para(4) + "\n\n"
    + _para(5) + "\n\n"
    + _para(6) + "\n\n"
    + _para(7) + "\n\n"
    + _para(8) + "\n\n"
    + _para(9) + "\n\n"
    + _para(10) + "\n\n"
    + _para(11) + "\n\n"
    "## FAQ\n"
    "Phần dưới giải đáp các thắc mắc phổ biến nhất.\n\n"
    "**Mất bao lâu để thấy kết quả?** Thường 3-6 tháng tuỳ ngành.\n\n"
    "**Chi phí dịch vụ SEO bao nhiêu?** Phụ thuộc quy mô website và ngành nghề.\n\n"
    "## Kết luận\n"
    "Dịch vụ SEO bài bản giúp doanh nghiệp tăng trưởng bền vững trong dài hạn.\n\n"
    "## Liên hệ\n"
    "Liên hệ Seongon ngay để được tư vấn miễn phí về dịch vụ SEO của bạn.\n"
)


def test_perfect_article_passes_all_auto_rules():
    """The fixture is curated to pass all 20 base auto rules (no config).
    Configurable + heuristic rules will warn because the fixture doesn't
    include images / case studies / config — that's expected."""
    from app.services.seo_analyzer import CONFIGURABLE_RULE_IDS

    r = analyze_content(
        content=PERFECT_ARTICLE,
        keyword="dịch vụ SEO",
        meta_description=(
            "Dịch vụ SEO tổng thể tại Seongon — audit, từ khóa, on-page, off-page. "
            "Liên hệ nhận tư vấn miễn phí."
        ),
    )
    # Fixture has no config input → configurable rules are 'needs-config' inactive
    # (shown but NOT scored). They stay in `checks` but are excluded from totals.
    assert len(r.checks) == 37
    inactive = [c for c in r.checks if c.inactive is not None]
    assert all(c.inactive == "needs-config" for c in inactive), inactive
    assert r.total_checks == len(r.checks) - len(inactive)
    assert r.total_checks == 28  # 37 - 9 config rules awaiting input
    assert r.word_count >= 800
    # All FAILs must be 0 among scored rules
    assert r.fail_count == 0, [c.id for c in r.checks if c.status == "fail" and c.inactive is None]

    # Identify base auto rules (everything not configurable, not heuristic eeat/cta-3s/conclusion-not-cta)
    HEURISTIC_RULE_IDS = {
        "eeat-experience",
        "eeat-case-study",
        "eeat-customer-reviews",
        "eeat-trust-citations",
        "eeat-trust-harvard",
        "cta-3s-quality",
        "conclusion-not-cta",
    }
    base_auto = [
        c for c in r.checks
        if c.id not in CONFIGURABLE_RULE_IDS and c.id not in HEURISTIC_RULE_IDS
    ]
    assert len(base_auto) == 20, [c.id for c in base_auto]
    assert all(c.status == "pass" for c in base_auto), [
        c.id for c in base_auto if c.status != "pass"
    ]


def test_empty_article_fails_most():
    r = analyze_content(content="", keyword="seo", meta_description="")
    assert r.word_count == 0
    assert r.score < 50
    assert _check_by_id(r, "has-h2").status == "fail"
    assert _check_by_id(r, "h2-keyword").status == "fail"
    assert _check_by_id(r, "faq").status == "fail"
    assert _check_by_id(r, "cta").status == "fail"
    assert _check_by_id(r, "tldr").status == "fail"
    assert _check_by_id(r, "word-count").status == "warn"
    assert _check_by_id(r, "meta-description").status == "warn"


def test_meta_description_states():
    short_doc = "## SEO\nNội dung."

    # 0 ký tự → warn
    r1 = analyze_content(short_doc, "seo", "")
    assert _check_by_id(r1, "meta-description").status == "warn"

    # 150 ký tự (ok) → pass
    r2 = analyze_content(short_doc, "seo", "x" * 150)
    assert _check_by_id(r2, "meta-description").status == "pass"

    # 200 ký tự (too long) → fail
    r3 = analyze_content(short_doc, "seo", "x" * 200)
    c = _check_by_id(r3, "meta-description")
    assert c.status == "fail"
    assert "200" in c.detail


def test_keyword_density_thresholds():
    # 100 từ, keyword 0 lần → density 0 → fail
    content = ("word " * 100).strip()
    r1 = analyze_content(content, "seo", "")
    c = _check_by_id(r1, "keyword-density")
    assert c.status == "fail"
    assert "0 lần" in c.detail

    # 100 từ, keyword 2 lần (2%) → pass
    content = ("seo " + "word " * 99).strip()  # 100 words, 1 seo = 1%
    r2 = analyze_content(content, "seo", "")
    # 1% boundary — should pass (>= 1)
    assert _check_by_id(r2, "keyword-density").status == "pass"

    # density way too high (~50%)
    content = ("seo " * 50).strip()
    r3 = analyze_content(content, "seo", "")
    c = _check_by_id(r3, "keyword-density")
    assert c.status == "fail"


def test_h2_keyword_detection():
    # H2 contains keyword
    r1 = analyze_content("## Dịch vụ SEO là gì\nNội dung.", "dịch vụ seo", "")
    assert _check_by_id(r1, "has-h2").status == "pass"
    assert _check_by_id(r1, "h2-keyword").status == "pass"

    # H2 không chứa keyword
    r2 = analyze_content("## Giới thiệu\nNội dung.", "dịch vụ seo", "")
    assert _check_by_id(r2, "has-h2").status == "pass"
    assert _check_by_id(r2, "h2-keyword").status == "fail"


def test_cta_detection():
    for word in ["liên hệ", "đăng ký", "tư vấn", "mua ngay", "nhận ngay", "đặt hàng"]:
        r = analyze_content(f"## Test\nHãy {word} để biết thêm.", "seo", "")
        assert _check_by_id(r, "cta").status == "pass", word


def test_internal_link_patterns():
    # Markdown relative link
    r1 = analyze_content("## A\nXem [bài này](/blog/seo).", "seo", "")
    assert _check_by_id(r1, "internal-link").status == "pass"

    # HTML href to relative
    r2 = analyze_content('## A\nXem <a href="/blog/seo">đây</a>.', "seo", "")
    assert _check_by_id(r2, "internal-link").status == "pass"

    # Markdown link to external URL
    r3 = analyze_content("## A\n[Google](https://google.com).", "seo", "")
    assert _check_by_id(r3, "internal-link").status == "pass"

    # Không có link
    r4 = analyze_content("## A\nKhông có link gì.", "seo", "")
    assert _check_by_id(r4, "internal-link").status == "fail"


def test_paragraph_and_sentence_length_warnings():
    long_para = " ".join(["word"] * 200)  # 200-word paragraph
    r1 = analyze_content(f"## H2\n\n{long_para}", "seo", "")
    assert _check_by_id(r1, "paragraph-length").status == "warn"

    long_sentence = " ".join(["word"] * 40) + "."
    r2 = analyze_content(f"## H2\n\n{long_sentence}", "seo", "")
    assert _check_by_id(r2, "sentence-length").status == "warn"


def test_tldr_requires_bullets():
    # TL;DR phrase but no bullets → fail
    r1 = analyze_content("## TL;DR\nTóm gọn lại bài viết này.", "seo", "")
    c1 = _check_by_id(r1, "tldr")
    assert c1.status == "fail"
    assert "thiếu bullet" in c1.detail.lower()

    # TL;DR + bullets → pass
    r2 = analyze_content("## TL;DR\n- Điểm 1\n- Điểm 2", "seo", "")
    assert _check_by_id(r2, "tldr").status == "pass"

    # No TL;DR → fail
    r3 = analyze_content("## H2\nNội dung.", "seo", "")
    c3 = _check_by_id(r3, "tldr")
    assert c3.status == "fail"
    assert "chưa có phần tóm tắt" in c3.detail.lower()


def test_has_h1_and_quality():
    r = analyze_content("# Tiêu đề ngắn chứa seo\n\n## H2", "seo", "")
    assert _check_by_id(r, "has-h1").status == "pass"
    assert _check_by_id(r, "h1-quality").status == "pass"

    # No H1
    r2 = analyze_content("## chỉ có H2\nNội dung.", "seo", "")
    assert _check_by_id(r2, "has-h1").status == "fail"
    assert _check_by_id(r2, "h1-quality").status == "fail"

    # H1 too long
    long_h1 = "# " + "x" * 100
    r3 = analyze_content(long_h1 + "\n\n## H2", "seo", "")
    assert _check_by_id(r3, "has-h1").status == "pass"
    assert _check_by_id(r3, "h1-quality").status == "warn"


def test_sapo_detection():
    sapo = (
        "Đây là đoạn mở bài giới thiệu về dịch vụ SEO tổng thể, "
        "cung cấp giải pháp tối ưu hoá website từ A đến Z, "
        "giúp doanh nghiệp tăng traffic và doanh thu một cách bền vững."
    )
    article = f"# Tiêu đề SEO\n\n{sapo}\n\n## H2\nNội dung."
    r = analyze_content(article, "dịch vụ SEO", "")
    c = _check_by_id(r, "sapo")
    assert c.status == "pass", c.detail

    # No sapo (paragraph after H1 is another heading)
    r2 = analyze_content("# Tiêu đề\n\n## H2 ngay\nNội dung.", "seo", "")
    assert _check_by_id(r2, "sapo").status == "warn"


def test_conclusion_detection():
    r1 = analyze_content("## Kết luận\nTóm tắt cuối bài.", "seo", "")
    assert _check_by_id(r1, "conclusion").status == "pass"

    r2 = analyze_content("## Tổng kết\nNội dung.", "seo", "")
    assert _check_by_id(r2, "conclusion").status == "pass"

    r3 = analyze_content("## H2 thường\nNội dung.", "seo", "")
    assert _check_by_id(r3, "conclusion").status == "warn"


def test_meta_keyword():
    # Meta empty → warn
    r1 = analyze_content("## H2\nNội dung.", "seo", "")
    assert _check_by_id(r1, "meta-keyword").status == "warn"

    # Meta present + chứa keyword → pass
    r2 = analyze_content("## H2\nNội dung.", "seo", "Mô tả về seo và lợi ích.")
    assert _check_by_id(r2, "meta-keyword").status == "pass"

    # Meta present nhưng không chứa keyword → fail
    r3 = analyze_content("## H2\nNội dung.", "seo", "Mô tả khác hoàn toàn.")
    assert _check_by_id(r3, "meta-keyword").status == "fail"


def test_bullet_list_threshold():
    # 0 bullets → warn
    r1 = analyze_content("## H\nNội dung.", "seo", "")
    assert _check_by_id(r1, "bullet-list").status == "warn"

    # 3+ bullets → pass
    r2 = analyze_content("## H\n- a\n- b\n- c", "seo", "")
    assert _check_by_id(r2, "bullet-list").status == "pass"


def test_bold_emphasis():
    r1 = analyze_content("## H\nNội dung **quan trọng** ở đây.", "seo", "")
    assert _check_by_id(r1, "bold-emphasis").status == "pass"

    r2 = analyze_content("## H\nKhông có in đậm.", "seo", "")
    assert _check_by_id(r2, "bold-emphasis").status == "warn"


def test_heading_question():
    r1 = analyze_content("## SEO là gì?\nGiải thích.", "seo", "")
    assert _check_by_id(r1, "heading-question").status == "pass"

    r2 = analyze_content("### Câu hỏi thường gặp?\nNội dung.", "seo", "")
    assert _check_by_id(r2, "heading-question").status == "pass"

    r3 = analyze_content("## SEO tổng quan\nNội dung.", "seo", "")
    assert _check_by_id(r3, "heading-question").status == "warn"


def test_lead_paragraph():
    # H2 + paragraph (good)
    r1 = analyze_content("## H2\nĐoạn dẫn dắt cho nội dung sau.\n\n- bullet", "seo", "")
    assert _check_by_id(r1, "lead-paragraph").status == "pass"

    # H2 + bullet ngay (no lead)
    r2 = analyze_content("## H2\n- bullet 1\n- bullet 2", "seo", "")
    assert _check_by_id(r2, "lead-paragraph").status == "warn"

    # H2 + H3 ngay (no lead)
    r3 = analyze_content("## H2\n\n### H3\nNội dung.", "seo", "")
    assert _check_by_id(r3, "lead-paragraph").status == "warn"


def test_paragraph_length_threshold_100():
    # 90 từ → pass (< 100)
    short = " ".join(["word"] * 90)
    r1 = analyze_content(f"## H2\n\n{short}", "seo", "")
    assert _check_by_id(r1, "paragraph-length").status == "pass"

    # 120 từ → warn
    long = " ".join(["word"] * 120)
    r2 = analyze_content(f"## H2\n\n{long}", "seo", "")
    assert _check_by_id(r2, "paragraph-length").status == "warn"


def test_configurable_rule_needs_config_warn():
    """Without input, configurable rules emit a 'needs-config' warn."""
    r = analyze_content("## H2\nNội dung.", "seo")
    sec = _check_by_id(r, "secondary-keywords")
    assert sec.status == "warn"
    assert "Chưa cấu hình" in sec.detail


def test_secondary_keywords_present_passes():
    cfg = AnalysisConfig(secondary_keywords=["seo", "tối ưu"])
    r = analyze_content(
        "## H2\nDịch vụ seo giúp tối ưu website.", "seo", config=cfg
    )
    assert _check_by_id(r, "secondary-keywords").status == "pass"


def test_secondary_keywords_missing_fails():
    cfg = AnalysisConfig(secondary_keywords=["nonexistent-word-xyz"])
    r = analyze_content("## H2\nNội dung.", "seo", config=cfg)
    sec = _check_by_id(r, "secondary-keywords")
    assert sec.status == "fail"
    assert "Thiếu" in sec.detail


def test_brand_pronoun_consistency():
    # "Bạn" only — pass
    cfg = AnalysisConfig(pronouns=["Bạn"])
    r1 = analyze_content("## H\nChào Bạn. Bạn có biết. Bạn thử ngay.", "seo", config=cfg)
    assert _check_by_id(r1, "brand-pronoun").status == "pass"

    # Mix Bạn + Anh — warn
    cfg2 = AnalysisConfig(pronouns=["Bạn", "Anh"])
    r2 = analyze_content("## H\nChào Bạn và Anh.", "seo", config=cfg2)
    assert _check_by_id(r2, "brand-pronoun").status == "warn"


def test_ad_forbidden_words_default():
    # Without explicit config, default forbidden list applies
    r = analyze_content("## H\nĐây là dịch vụ tốt nhất, số 1 thị trường.", "seo")
    c = _check_by_id(r, "ad-forbidden-words")
    assert c.status == "fail"
    assert "tốt nhất" in c.detail


def test_competitor_with_comparison_fails():
    cfg = AnalysisConfig(competitors=["xyz"])
    r = analyze_content("## H\nDịch vụ của ta hơn xyz nhiều.", "seo", config=cfg)
    c = _check_by_id(r, "competitor-mention")
    assert c.status == "fail"


def test_competitor_no_comparison_passes():
    cfg = AnalysisConfig(competitors=["xyz"])
    r = analyze_content("## H\nKhông nhắc ai cả.", "seo", config=cfg)
    assert _check_by_id(r, "competitor-mention").status == "pass"


def test_eeat_experience_passes_with_image_and_first_person():
    content = (
        "## H\n"
        "![sample](https://example.com/img.jpg)\n\n"
        "Tôi đã trải nghiệm dịch vụ này nhiều lần."
    )
    r = analyze_content(content, "seo")
    assert _check_by_id(r, "eeat-experience").status == "pass"


def test_eeat_trust_harvard_passes():
    r = analyze_content("## H\nTheo (Smith, 2024) và (Nguyễn, 2023).", "seo")
    assert _check_by_id(r, "eeat-trust-harvard").status == "pass"


def test_eeat_trust_citations_credible_domain():
    r = analyze_content(
        "## H\nXem [Google](https://developers.google.com/search).", "seo"
    )
    assert _check_by_id(r, "eeat-trust-citations").status == "pass"


def test_score_formula():
    # Score = round((pass + warn*0.5) / total * 100)
    r = analyze_content("", "", "")
    expected = round(
        (r.pass_count + r.warn_count * 0.5) / r.total_checks * 100
    )
    assert abs(r.score - expected) <= 1  # allow off-by-1 from rounding
