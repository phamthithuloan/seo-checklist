"""Unit tests for SEO analyzer — Python port parity check."""

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
        f"hiện diện trực tuyến bền vững. "
        f"Đội ngũ chuyên gia phân tích từ khóa, đối thủ và hành vi người dùng "
        f"để định hình chiến lược nội dung. "
        f"Khi triển khai bài bản, website sẽ tăng thứ hạng trên Google và mang "
        f"về lượng truy cập chất lượng. "
        f"Mỗi giai đoạn đều có chỉ số đo lường rõ ràng, giúp khách hàng kiểm "
        f"soát ngân sách và đánh giá hiệu quả từng tuần. "
        f"Đây cũng là lý do nhiều doanh nghiệp lựa chọn đối tác lâu dài thay "
        f"vì thuê freelancer rời rạc."
    )

PERFECT_ARTICLE = (
    "# Hướng dẫn dịch vụ SEO tổng thể 2026\n\n"
    "## TL;DR\n"
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
    "## Quy trình triển khai\n"
    + _para(3) + "\n\n"
    + _para(4) + "\n\n"
    + _para(5) + "\n\n"
    + _para(6) + "\n\n"
    + _para(7) + "\n\n"
    "## FAQ\n"
    "**Mất bao lâu để thấy kết quả?** Thường 3-6 tháng tuỳ ngành.\n\n"
    "**Chi phí dịch vụ SEO bao nhiêu?** Phụ thuộc quy mô website và ngành nghề.\n\n"
    "## Liên hệ\n"
    "Liên hệ Seongon ngay để được tư vấn miễn phí về dịch vụ SEO của bạn.\n"
)


def test_perfect_article_scores_high_and_passes_all():
    r = analyze_content(
        content=PERFECT_ARTICLE,
        keyword="dịch vụ SEO",
        meta_description=(
            "Dịch vụ SEO tổng thể tại Seongon — audit, từ khóa, on-page, off-page. "
            "Liên hệ nhận tư vấn miễn phí."
        ),
    )
    assert r.total_checks == 11
    assert r.word_count >= 800
    assert r.fail_count == 0, [c.id for c in r.checks if c.status == "fail"]
    assert r.warn_count == 0, [c.id for c in r.checks if c.status == "warn"]
    assert r.pass_count == 11
    assert r.score == 100


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


def test_score_formula():
    # 11 checks total. Score = round((pass + warn*0.5) / 11 * 100)
    # All pass → 100
    # All fail → 0
    r = analyze_content("", "", "")
    expected = round((r.pass_count + r.warn_count * 0.5) / 11 * 100)
    assert abs(r.score - expected) <= 1  # allow off-by-1 from rounding
