"""Unit tests for outline comparator."""

from app.services.outline_compare import (
    _detect_format,
    _parse_annotation,
    compare_outline,
    parse_outline,
)


def test_parse_annotation_words_only():
    assert _parse_annotation("200 từ") == (200, None, [])
    assert _parse_annotation("300") == (300, None, [])
    assert _parse_annotation("150 words") == (150, None, [])


def test_parse_annotation_format_only():
    assert _parse_annotation("bullet") == (None, "bullet", [])
    assert _parse_annotation("bảng") == (None, "table", [])
    assert _parse_annotation("text") == (None, "text", [])


def test_parse_annotation_combined():
    assert _parse_annotation("200 từ, bullet") == (200, "bullet", [])
    assert _parse_annotation("300, bảng") == (300, "table", [])


def test_parse_annotation_with_topic():
    tw, tf, kws = _parse_annotation("200 từ, bullet, topic: dịch vụ seo, tối ưu")
    assert tw == 200
    assert tf == "bullet"
    assert kws == ["dịch vụ seo", "tối ưu"]


def test_compare_bullet_count_warns():
    outline = "## Section (50, bullet)"
    content = "## Section\n" + " ".join(["word"] * 50) + "\n\n- chỉ có 1 bullet"
    cmp_ = compare_outline(outline, content)
    h = cmp_.headings[0]
    assert h.note is not None
    assert "bullet" in h.note.lower()


def test_compare_topic_keyword_missing():
    outline = "## Phần 1 (topic: dịch vụ seo, on-page)"
    content = "## Phần 1\nNội dung khác hoàn toàn về marketing."
    cmp_ = compare_outline(outline, content)
    h = cmp_.headings[0]
    assert h.note is not None
    assert "topic" in h.note.lower()


def test_compare_subsection_missing():
    outline = "## H2 A\n### H3 A1\n### H3 A2\n## H2 B"
    content = "## H2 A\nNội dung.\n### H3 A1\nChi tiết.\n## H2 B\nNội dung."
    cmp_ = compare_outline(outline, content)
    h2a = next(h for h in cmp_.headings if h.title == "H2 A")
    assert h2a.note is not None
    assert "subsection" in h2a.note.lower()


def test_parse_outline_with_annotations():
    text = (
        "# Tiêu đề\n"
        "## H2 first (200 từ, bullet)\n"
        "### H3 detail (100)\n"
        "## H2 second\n"
    )
    specs = parse_outline(text)
    assert len(specs) == 4
    assert specs[0].level == 1
    assert specs[0].title == "Tiêu đề"
    assert specs[1].title == "H2 first"
    assert specs[1].target_words == 200
    assert specs[1].target_format == "bullet"
    assert specs[2].target_words == 100
    assert specs[3].title == "H2 second"
    assert specs[3].target_words is None


def test_detect_format():
    assert _detect_format("- a\n- b\n- c") == "bullet"
    assert _detect_format("Đoạn văn bình thường.") == "text"
    assert _detect_format("| a | b |\n| 1 | 2 |") == "table"
    assert _detect_format("Đoạn văn\n- bullet 1") == "mixed"
    assert _detect_format("") == "empty"


def test_compare_outline_full_match():
    outline = "## A\n## B (50)\n## C (100, bullet)"
    content = (
        "## A\n"
        "Đoạn A đủ ngắn.\n\n"
        "## B\n"
        + " ".join(["word"] * 50)
        + "\n\n"
        "## C\n"
        "- một\n"
        "- hai\n"
        "- ba\n"
        + " ".join(["word"] * 100)
    )
    cmp_ = compare_outline(outline, content)
    assert cmp_.matched == 3
    assert cmp_.missing == 0
    assert cmp_.extra == 0


def test_compare_missing_heading():
    outline = "## A\n## B\n## C"
    content = "## A\nNội dung.\n\n## C\nNội dung."
    cmp_ = compare_outline(outline, content)
    assert cmp_.matched == 2
    assert cmp_.missing == 1
    statuses = {h.title: h.status for h in cmp_.headings}
    assert statuses["B"] == "missing"


def test_compare_extra_heading():
    outline = "## A"
    content = "## A\nNội dung.\n\n## B thừa\nNội dung khác."
    cmp_ = compare_outline(outline, content)
    assert cmp_.matched == 1
    assert cmp_.extra == 1
    assert any(h.status == "extra" and h.title == "B thừa" for h in cmp_.headings)


def test_compare_target_words_short():
    outline = "## Section (200)"
    content = "## Section\n" + " ".join(["word"] * 50)
    cmp_ = compare_outline(outline, content)
    h = cmp_.headings[0]
    assert h.status == "match"
    assert h.actual_words == 50
    assert "Ngắn hơn target" in (h.note or "")


def test_compare_target_format_mismatch():
    outline = "## Section (50, bullet)"
    content = "## Section\nĐây là đoạn văn thông thường có đủ từ để vượt qua threshold."
    cmp_ = compare_outline(outline, content)
    h = cmp_.headings[0]
    assert h.note is not None
    assert "Format hiện tại" in h.note


def test_compare_normalizes_case():
    outline = "## DỊCH VỤ SEO"
    content = "## dịch vụ seo\nNội dung."
    cmp_ = compare_outline(outline, content)
    assert cmp_.matched == 1
