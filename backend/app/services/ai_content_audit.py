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
from pydantic import BaseModel

from app.schemas.analysis import CheckIssue, CheckResult
from app.services.gemini import (
    extract_json,
    gemini_available,
    generate_grounded,
    generate_structured,
)
from app.services.web_fetcher import fetch_url_as_markdown

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
    inactive: str | None = None,
) -> CheckResult:
    return CheckResult(
        id=id_,
        label=label,
        category="trust-ai",
        status=status,  # type: ignore[arg-type]
        detail=detail,
        recommendation=recommendation,
        issues=issues or [],
        inactive=inactive,  # type: ignore[arg-type]
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

    # Chỉ coi là CHẾT khi không kết nối được hoặc trang thực sự không tồn tại
    # (404/410). 401/403/405/429/5xx thường là server chặn bot (vd mayoclinic,
    # cloudflare) — link vẫn mở được trên trình duyệt → không gắn cờ "chết".
    dead: list[CheckIssue] = []
    blocked: list[CheckIssue] = []
    for u, c in zip(links, codes):
        if c is None:
            dead.append(CheckIssue(kind="link", text=u, note="Không kết nối được (timeout/DNS)"))
        elif c in (404, 410):
            dead.append(CheckIssue(kind="link", text=u, note=f"Trang không tồn tại (HTTP {c})"))
        elif c >= 400:
            blocked.append(
                CheckIssue(
                    kind="link",
                    text=u,
                    note=f"Server chặn kiểm tra tự động (HTTP {c}) — hãy tự mở link xác nhận",
                )
            )
        # 2xx/3xx → còn sống, bỏ qua

    if dead:
        status = "fail"
    elif blocked:
        status = "warn"
    else:
        status = "pass"

    parts = [f"Kiểm tra {len(links)} link nguồn ngoài"]
    if dead:
        parts.append(f"{len(dead)} link chết")
    if blocked:
        parts.append(f"{len(blocked)} link chặn bot (không tự kiểm chứng được)")
    if not dead and not blocked:
        parts.append("tất cả còn truy cập được")

    if dead:
        rec = "Thay hoặc sửa các link nguồn đã chết (404 / không kết nối được)."
    elif blocked:
        rec = (
            "Một số nguồn chặn kiểm tra tự động (403…) — tự mở link trên trình duyệt "
            "để xác nhận còn sống & đúng nội dung."
        )
    else:
        rec = None

    return _check(
        id_="source-verification",
        label="Nguồn dẫn kiểm chứng được",
        status=status,
        detail=" · ".join(parts) + ".",
        recommendation=rec,
        issues=dead + blocked,
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
# 5. source-accuracy — nội dung có ĐÚNG theo nguồn dẫn không (Gemini)
# ──────────────────────────────────────────────────────────────────────


class _SrcMatch(BaseModel):
    index: int
    verdict: str  # supported | contradicted | unrelated
    note: str = ""


class _SrcMatchResult(BaseModel):
    results: list[_SrcMatch] = []


_SRC_SYSTEM = """Bạn kiểm tra ĐỘ CHÍNH XÁC: nội dung khẳng định trong bài có ĐÚNG \
theo nguồn dẫn kèm theo không (không chỉ kiểm tra có nguồn, mà nội dung có khớp nguồn).

User đưa danh sách mục, mỗi mục: index, claim (câu khẳng định trong bài, có dẫn 1 \
link nguồn), source (nội dung trích từ chính trang nguồn đó).

Với mỗi mục, verdict:
- "supported": nguồn xác nhận ĐÚNG nội dung/số liệu của claim.
- "contradicted": nguồn nói KHÁC / ngược (số liệu, sự kiện sai lệch so với claim).
- "unrelated": nguồn KHÔNG đề cập nội dung của claim (gán nguồn sai chỗ).
note: 1 câu ngắn nêu lý do nếu contradicted/unrelated. Trả JSON đúng schema."""

_MAX_SRC_CLAIMS: Final = 5
_SRC_SNIPPET: Final = 4_000


async def _source_content_match(content: str) -> CheckResult:
    label = "Nội dung khớp nguồn dẫn"
    if not gemini_available():
        return _check(
            "source-accuracy", label, "warn",
            "Cần GEMINI_API_KEY để đối chiếu nội dung bài với nguồn dẫn.",
            inactive="needs-api",
        )

    # Collect check-worthy claims (stat/authority) that cite a link.
    claims: list[tuple[str, str]] = []
    for s in _split_sentences(content):
        if not (_PCT_RE.search(s) or _NUM_UNIT_RE.search(s) or _AUTHORITY_RE.search(s)):
            continue
        urls = _extract_external_links(s)
        if urls:
            claims.append((s[:300], urls[0]))
        if len(claims) >= _MAX_SRC_CLAIMS:
            break

    if not claims:
        return _check(
            "source-accuracy", label, "pass",
            "Không có khẳng định nào kèm link nguồn để đối chiếu nội dung.",
        )

    async def _fetch(u: str) -> str:
        try:
            _, md = await fetch_url_as_markdown(u)
            return md
        except Exception:  # noqa: BLE001
            return ""

    mds = await asyncio.gather(*(_fetch(u) for _, u in claims))
    items = [
        (i, c, u, md)
        for i, ((c, u), md) in enumerate(zip(claims, mds))
        if md
    ]
    if not items:
        return _check(
            "source-accuracy", label, "warn",
            "Không đọc được trang nguồn để đối chiếu (link chặn bot / chết).",
        )

    parts = [
        f"### Mục {i}\nclaim: {c}\nsource ({u}): {md[:_SRC_SNIPPET]}"
        for i, c, u, md in items
    ]
    parsed = await generate_structured(
        _SRC_SYSTEM, "\n\n".join(parts), _SrcMatchResult, max_tokens=1024
    )
    if parsed is None:
        return _check(
            "source-accuracy", label, "warn",
            "Gemini free tier đang bận / chạm giới hạn — thử lại sau.",
            inactive="error",
        )

    by_idx = {i: (c, u) for i, c, u, _ in items}
    bad = [r for r in parsed.results if r.verdict in ("contradicted", "unrelated")]
    issues = []
    for r in bad:
        c, u = by_idx.get(r.index, ("", ""))
        tag = "SAI so với nguồn" if r.verdict == "contradicted" else "Nguồn không liên quan claim"
        issues.append(
            CheckIssue(kind="quote", text=c[:200], note=f"{tag}: {r.note} — {u}"[:280])
        )

    status = "fail" if bad else "pass"
    detail = (
        f"Đối chiếu {len(items)} khẳng định có nguồn — {len(bad)} chỗ nội dung KHÔNG khớp nguồn."
        if bad
        else f"Đối chiếu {len(items)} khẳng định có nguồn — nội dung khớp với nguồn dẫn."
    )
    return _check(
        "source-accuracy", label, status, detail,
        recommendation=None
        if not bad
        else "Sửa nội dung cho đúng với nguồn dẫn, hoặc thay nguồn cho khớp khẳng định.",
        issues=issues,
    )


# ──────────────────────────────────────────────────────────────────────
# Public entry
# ──────────────────────────────────────────────────────────────────────


async def audit_ai_content(content: str) -> list[CheckResult] | None:
    """Run trust-ai checks. Heuristic checks always run (free, no key); the
    Gemini-backed checks (fact-check, source-accuracy) degrade gracefully when
    no key. Returns the list of checks (never None for non-empty content)."""

    text = content[:_MAX_CONTENT_CHARS]

    source_check, fact_check, source_acc = await asyncio.gather(
        _heuristic_source_verification(text),
        _gemini_fact_check(text),
        _source_content_match(text),
    )

    checks: list[CheckResult] = [
        _heuristic_claim_sourcing(text),
        source_check,
        source_acc,
    ]
    if fact_check is not None:
        checks.append(fact_check)
    checks.append(_heuristic_ai_tone(text))

    return checks or None
