"""Trust audit for AI-written content — gộp dưới category 'trust-ai'.

Thiết kế "free-first":
  - claim-sourcing       : HEURISTIC (regex) — số liệu/khẳng định mạnh thiếu nguồn.
  - source-verification  : HEURISTIC (httpx) — link nguồn ngoài còn sống / chết.
  - ai-tone              : HEURISTIC (regex) — cụm từ sáo rỗng kiểu văn AI.
  - fact-check           : Google Gemini (free tier) + Google Search grounding.

3 check đầu chạy hoàn toàn local, không cần API key, không mất phí. fact-check
chỉ chạy khi GEMINI_API_KEY được cấu hình; nếu không, nó được bỏ qua (3 check
kia vẫn chạy). Hàm được gọi khi user bật cờ ai_content_audit.
"""

import asyncio
import logging
import re
from typing import Final

import httpx

from app.schemas.analysis import CheckIssue, CheckResult
from app.services.gemini import extract_json, generate_grounded

logger = logging.getLogger(__name__)

_MAX_CONTENT_CHARS: Final = 30_000
_MAX_LINKS: Final = 10
_LINK_TIMEOUT: Final = 8.0
_CONTEXT_CHARS: Final = 160

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?…])\s+|\n+")
_LEAD_MARKER_RE = re.compile(r"^[#>\-*\s\d.)]+")


def _check(
    id_: str,
    label: str,
    status: str,
    detail: str,
    recommendation: str | None = None,
    issues: list[CheckIssue] | None = None,
) -> CheckResult:
    return CheckResult(
        id=id_,
        label=label,
        category="trust-ai",
        status=status,  # type: ignore[arg-type]
        detail=detail,
        recommendation=recommendation,
        issues=issues or [],
    )


# ──────────────────────────────────────────────────────────────────────
# 1. claim-sourcing — heuristic
# ──────────────────────────────────────────────────────────────────────

# A sentence is "check-worthy" if it carries a statistic or an authority claim.
_PCT_RE = re.compile(r"\d+(?:[.,]\d+)?\s*%")
_NUM_UNIT_RE = re.compile(
    r"\b\d[\d.,]*\s*(?:lần|tỷ|tỉ|triệu|nghìn|ngàn|km|kg|tấn|usd|vnđ|đồng)\b",
    re.IGNORECASE,
)
_AUTHORITY_RE = re.compile(
    r"(?:nghiên cứu|khảo sát|thống kê|báo cáo|số liệu|dữ liệu)\s+"
    r"(?:cho thấy|chỉ ra|chứng minh|cho biết|ghi nhận)"
    r"|theo\s+(?:nghiên cứu|báo cáo|khảo sát|thống kê|số liệu)"
    r"|(?:các\s+)?chuyên gia\s+(?:cho rằng|khẳng định|nhận định|cho biết)"
    r"|(?:các\s+)?nhà khoa học\s+(?:cho rằng|đã|khẳng định)"
    r"|được\s+chứng minh\s+(?:rằng|là)"
    r"|tổ chức\s+y tế\s+thế giới",
    re.IGNORECASE,
)
# A nearby citation neutralises the flag.
_CITATION_RE = re.compile(
    r"https?://|\]\([^)]+\)|\([^)]*\b(?:19|20)\d{2}\)|\bnguồn\b\s*[:：]",
    re.IGNORECASE,
)


def _split_sentences(content: str) -> list[str]:
    out: list[str] = []
    for raw in _SENTENCE_SPLIT_RE.split(content):
        s = _LEAD_MARKER_RE.sub("", raw).strip()
        if s:
            out.append(s)
    return out


def _heuristic_claim_sourcing(content: str) -> CheckResult:
    flagged: list[CheckIssue] = []
    for s in _split_sentences(content):
        if _CITATION_RE.search(s):
            continue
        if _PCT_RE.search(s) or _NUM_UNIT_RE.search(s):
            note = "Có số liệu/thống kê nhưng không dẫn nguồn ngay cạnh."
        elif _AUTHORITY_RE.search(s):
            note = "Trích dẫn 'nghiên cứu/chuyên gia' nhưng không nêu nguồn cụ thể."
        else:
            continue
        flagged.append(CheckIssue(kind="quote", text=s[:200], note=note))
        if len(flagged) >= 12:
            break

    n = len(flagged)
    status = "pass" if n == 0 else ("warn" if n <= 2 else "fail")
    return _check(
        id_="claim-sourcing",
        label="Khẳng định có dẫn nguồn",
        status=status,
        detail=(
            "Không phát hiện số liệu/khẳng định mạnh nào thiếu nguồn."
            if n == 0
            else f"Phát hiện {n} câu có số liệu/khẳng định mạnh nhưng chưa dẫn nguồn."
        ),
        recommendation=(
            None
            if n == 0
            else "Bổ sung nguồn dẫn (link tới nghiên cứu/báo cáo/trang chính thống "
            "hoặc ghi rõ tên nguồn) cạnh mỗi số liệu hoặc trích dẫn chuyên gia."
        ),
        issues=flagged,
    )


# ──────────────────────────────────────────────────────────────────────
# 2. ai-tone — heuristic
# ──────────────────────────────────────────────────────────────────────

# Curated Vietnamese clichés/filler over-represented in AI-generated prose.
_AI_CLICHES: Final[tuple[str, ...]] = (
    "trong thế giới ngày nay",
    "trong thời đại ngày nay",
    "trong cuộc sống hiện đại",
    "trong xã hội hiện đại",
    "thế giới hiện đại ngày nay",
    "thời đại công nghệ số",
    "kỷ nguyên số",
    "không thể phủ nhận rằng",
    "không thể phủ nhận",
    "không thể không nhắc đến",
    "không thể không kể đến",
    "đóng vai trò vô cùng quan trọng",
    "đóng vai trò quan trọng",
    "ngày càng trở nên",
    "lợi ích tuyệt vời",
    "đa dạng và phong phú",
    "phong phú và đa dạng",
    "mang lại nhiều lợi ích",
    "vô vàn lợi ích",
    "tóm lại,",
    "nói tóm lại",
    "nhìn chung,",
    "có thể nói rằng",
    "có thể thấy rằng",
    "chính vì vậy,",
    "chính vì thế,",
    "hơn thế nữa,",
)


def _heuristic_ai_tone(content: str) -> CheckResult:
    low = content.lower()
    words = max(len(low.split()), 1)
    hits: list[CheckIssue] = []
    total = 0
    # Longest-first + blank-out matched spans so a short cliché ("không thể phủ
    # nhận") isn't double-counted inside a longer one ("... rằng").
    work = low
    for phrase in sorted(_AI_CLICHES, key=len, reverse=True):
        c = work.count(phrase)
        if c:
            total += c
            work = work.replace(phrase, " ")
            hits.append(
                CheckIssue(
                    kind="sentence",
                    text=phrase,
                    note=f"Cụm sáo rỗng kiểu văn AI (xuất hiện {c} lần)."
                    if c > 1
                    else "Cụm sáo rỗng kiểu văn AI — nên viết lại tự nhiên hơn.",
                )
            )
        if len(hits) >= 10:
            break

    # Density per 500 words keeps long articles from auto-failing.
    density = total / (words / 500.0)
    if total <= 1 or density < 1.0:
        status, verdict = "pass", "tự nhiên"
    elif total <= 4 and density < 2.5:
        status, verdict = "warn", "có vài dấu hiệu máy móc"
    else:
        status, verdict = "fail", "đậm chất văn AI"

    return _check(
        id_="ai-tone",
        label="Văn phong tự nhiên (không máy móc)",
        status=status,
        detail=(
            "Văn phong tự nhiên, không thấy cụm sáo rỗng đặc trưng."
            if status == "pass"
            else f"Văn phong {verdict}: bắt được {total} cụm sáo rỗng/khuôn mẫu."
        ),
        recommendation=(
            None
            if status == "pass"
            else "Viết lại các cụm sáo rỗng bằng câu cụ thể: thêm ví dụ thật, số liệu "
            "có nguồn, trải nghiệm; bỏ các câu chuyển ý khuôn mẫu."
        ),
        issues=hits,
    )


# ──────────────────────────────────────────────────────────────────────
# 3. source-verification — heuristic (httpx, no AI)
# ──────────────────────────────────────────────────────────────────────

_MD_LINK_RE = re.compile(r"\[([^\]]*)\]\((https?://[^)\s]+)\)")
_HTML_LINK_RE = re.compile(r"""href=["'](https?://[^"']+)["']""", re.IGNORECASE)
_BARE_URL_RE = re.compile(r"(?<![(\"'\]])https?://[^\s)\]\"'<>]+")


def _extract_external_links(content: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []

    def _add(url: str) -> None:
        url = url.rstrip(".,);")
        if url and url not in seen:
            seen.add(url)
            out.append(url)

    for m in _MD_LINK_RE.finditer(content):
        _add(m.group(2))
    for m in _HTML_LINK_RE.finditer(content):
        _add(m.group(1))
    for m in _BARE_URL_RE.finditer(content):
        _add(m.group(0))
    return out[:_MAX_LINKS]


async def _probe(client: httpx.AsyncClient, url: str) -> int | None:
    try:
        resp = await client.get(url)
        return resp.status_code
    except httpx.HTTPError:
        return None


async def _heuristic_source_verification(content: str) -> CheckResult:
    links = _extract_external_links(content)
    if not links:
        return _check(
            id_="source-verification",
            label="Nguồn dẫn kiểm chứng được",
            status="warn",
            detail="Bài không có link nguồn ngoài nào để kiểm chứng.",
            recommendation="Với bài AI, nên dẫn link tới nguồn gốc của số liệu/sự kiện "
            "để người đọc kiểm chứng được.",
        )

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36"
        )
    }
    async with httpx.AsyncClient(
        timeout=_LINK_TIMEOUT, follow_redirects=True, headers=headers, max_redirects=5
    ) as http:
        codes = await asyncio.gather(*(_probe(http, u) for u in links))

    dead = [
        CheckIssue(
            kind="link",
            text=u,
            note=f"Không truy cập được (HTTP {c})" if c else "Không kết nối được",
        )
        for u, c in zip(links, codes)
        if c is None or c >= 400
    ]

    status = "fail" if dead else "pass"
    detail = f"Kiểm tra {len(links)} link nguồn ngoài"
    detail += f" · {len(dead)} link chết." if dead else " · tất cả còn truy cập được."
    return _check(
        id_="source-verification",
        label="Nguồn dẫn kiểm chứng được",
        status=status,
        detail=detail,
        recommendation=(
            None
            if not dead
            else "Thay hoặc sửa các link nguồn đã chết — nguồn không truy cập được "
            "làm bài mất độ tin cậy."
        ),
        issues=dead,
    )


# ──────────────────────────────────────────────────────────────────────
# 4. fact-check — Google Gemini (free tier) + Google Search grounding
# ──────────────────────────────────────────────────────────────────────

_FACT_CHECK_SYSTEM = """Bạn là fact-checker. Người dùng đưa 1 bài viết (markdown).

Bước 1: chọn TỐI ĐA 6 khẳng định "đáng kiểm chứng nhất" — số liệu, thống kê, mốc \
thời gian, sự kiện, phát ngôn gán cho tổ chức/người cụ thể. Bỏ qua ý kiến, định nghĩa \
phổ thông, lời khuyên chung.

Bước 2: dùng Google Search để xác minh từng khẳng định.

Bước 3: kết thúc bằng DUY NHẤT một khối JSON (không thêm chữ nào sau đó):
{
  "findings": [
    {"claim": "trích nguyên văn (≤200 ký tự)",
     "verdict": "supported" | "unsupported" | "contradicted",
     "note": "kết luận ngắn + nguồn",
     "source": "https://..."}
  ]
}
verdict: supported = có nguồn uy tín xác nhận; unsupported = không tìm thấy nguồn xác \
nhận (đáng nghi); contradicted = nguồn uy tín cho thấy SAI. Nếu không có khẳng định \
nào đáng kiểm chứng, trả {"findings": []}."""


async def _gemini_fact_check(content: str) -> CheckResult | None:
    text = await generate_grounded(_FACT_CHECK_SYSTEM, content, max_tokens=4096)
    if text is None:
        return None  # no key / SDK missing / call failed

    obj = extract_json(text)
    if obj is None:
        logger.warning("Gemini fact-check: could not parse JSON")
        return None

    findings = obj.get("findings") or []
    contradicted = [f for f in findings if f.get("verdict") == "contradicted"]
    unsupported = [f for f in findings if f.get("verdict") == "unsupported"]

    status = "fail" if contradicted else ("warn" if unsupported else "pass")

    issues: list[CheckIssue] = []
    for f in contradicted + unsupported:
        tag = (
            "SAI/mâu thuẫn"
            if f.get("verdict") == "contradicted"
            else "Không xác minh được"
        )
        note = f"{tag}: {f.get('note', '')}".strip()
        if f.get("source"):
            note += f" — {f['source']}"
        issues.append(
            CheckIssue(kind="quote", text=str(f.get("claim", ""))[:200], note=note[:280])
        )

    if not findings:
        detail = "Không có khẳng định nào đáng kiểm chứng (hoặc tất cả đều ổn)."
    else:
        bits = []
        if contradicted:
            bits.append(f"{len(contradicted)} thông tin sai/mâu thuẫn")
        if unsupported:
            bits.append(f"{len(unsupported)} thông tin không xác minh được")
        if not bits:
            bits.append(f"{len(findings)} khẳng định đều có nguồn xác nhận")
        detail = "Gemini + Google Search: " + ", ".join(bits) + "."

    return _check(
        id_="fact-check",
        label="Không có thông tin sai / bịa",
        status=status,
        detail=detail,
        recommendation=(
            None
            if status == "pass"
            else "Đối chiếu lại các số liệu/sự kiện bị gắn cờ với nguồn gốc; sửa hoặc "
            "bỏ thông tin không kiểm chứng được."
        ),
        issues=issues,
    )


# ──────────────────────────────────────────────────────────────────────
# Public entry
# ──────────────────────────────────────────────────────────────────────


async def audit_ai_content(content: str) -> list[CheckResult] | None:
    """Run trust-ai checks. The 3 heuristic checks always run (free, no key);
    fact-check runs only if GEMINI_API_KEY is configured. Returns the list of
    checks (never None as long as content is non-empty)."""

    text = content[:_MAX_CONTENT_CHARS]

    source_check, fact_check = await asyncio.gather(
        _heuristic_source_verification(text),
        _gemini_fact_check(text),
    )

    checks: list[CheckResult] = [
        _heuristic_claim_sourcing(text),
        source_check,
    ]
    if fact_check is not None:
        checks.append(fact_check)
    checks.append(_heuristic_ai_tone(text))

    return checks or None
