"""Unit tests for the AI content audit — heuristics + opt-in fact-check.

The 3 heuristic checks run offline (no key, no network when the article has no
external links). The Gemini fact-check needs GEMINI_API_KEY + network, so we only
assert it is skipped when the key is absent.
"""

from app.core.config import get_settings
from app.services import ai_content_audit as mod
from app.services.gemini import extract_json


def _by_id(checks, cid):
    return next(c for c in checks if c.id == cid)


def test_extract_external_links_dedup():
    content = (
        "Theo [Moz](https://moz.com/report) traffic tăng. "
        'Xem <a href="https://ahrefs.com/blog">đây</a> và https://moz.com/report lại.'
    )
    assert mod._extract_external_links(content) == [
        "https://moz.com/report",
        "https://ahrefs.com/blog",
    ]


def test_extract_json_obj():
    assert extract_json('```json\n{"findings": []}\n```') == {"findings": []}
    assert extract_json('x {"a": 1} y') == {"a": 1}
    assert extract_json("no json") is None


def test_claim_sourcing_flags_unsourced_stat():
    content = "Uống trà xanh giúp đốt cháy tới 87% lượng mỡ thừa chỉ sau 2 tuần."
    c = mod._heuristic_claim_sourcing(content)
    assert c.status in ("warn", "fail")
    assert c.issues


def test_claim_sourcing_passes_with_citation():
    content = (
        "Uống trà xanh giúp đốt cháy 87% mỡ thừa "
        "([nguồn](https://example.org/study))."
    )
    c = mod._heuristic_claim_sourcing(content)
    assert c.status == "pass"
    assert not c.issues


def test_claim_sourcing_flags_authority_without_source():
    content = "Các chuyên gia khẳng định đây là phương pháp hiệu quả nhất."
    c = mod._heuristic_claim_sourcing(content)
    assert c.status in ("warn", "fail")


def test_ai_tone_detects_cliches():
    content = (
        "Trong thế giới ngày nay, không thể phủ nhận rằng trà xanh đóng vai trò "
        "quan trọng. Tóm lại, nó mang lại vô vàn lợi ích tuyệt vời. Nhìn chung, "
        "chính vì vậy, hơn thế nữa, có thể nói rằng nó rất tốt."
    )
    c = mod._heuristic_ai_tone(content)
    assert c.status in ("warn", "fail")
    assert c.issues


def test_ai_tone_passes_clean_text():
    content = (
        "Tôi pha trà xanh mỗi sáng. Lá trà từ Thái Nguyên cho vị chát nhẹ và hậu "
        "ngọt. Cách pha quyết định phần lớn hương vị của tách trà."
    )
    c = mod._heuristic_ai_tone(content)
    assert c.status == "pass"


async def test_audit_runs_heuristics_without_gemini_key(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "gemini_api_key", None)
    # No external links → source-verification returns 'warn' without any network.
    checks = await mod.audit_ai_content(
        "Theo nghiên cứu cho thấy 90% người dùng hài lòng. Tóm lại, rất tốt."
    )
    assert checks is not None
    ids = {c.id for c in checks}
    # Heuristics always run; source-accuracy shows as inactive needs-api (no key).
    assert ids == {"claim-sourcing", "source-verification", "ai-tone", "source-accuracy"}
    assert "fact-check" not in ids  # skipped without GEMINI_API_KEY
    sa = next(c for c in checks if c.id == "source-accuracy")
    assert sa.inactive == "needs-api"
