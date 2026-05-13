"""Fetch any public HTTP(S) URL and return clean Markdown.

Strategy:
- Validate URL is http/https only (basic SSRF guard against internal IPs).
- httpx GET with redirect follow + reasonable timeout + browser-like UA.
- Strip nav / aside / footer / script / style before html2text conversion.
- Extract title from <title> or first <h1>.
"""

import re
from typing import Final
from urllib.parse import urlparse

import html2text
import httpx
from fastapi import HTTPException, status

_TIMEOUT: Final = 15.0
_USER_AGENT: Final = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36"
)
_MAX_BYTES: Final = 5 * 1024 * 1024  # 5 MB

_TITLE_TAG_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_H1_TAG_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.IGNORECASE | re.DOTALL)
_HTML_TAG_STRIP_RE = re.compile(r"<[^>]+>")

_NOISE_BLOCK_RE = re.compile(
    r"<(?P<tag>script|style|noscript|nav|aside|footer|header|form|svg)\b[^>]*>"
    r".*?</(?P=tag)>",
    re.IGNORECASE | re.DOTALL,
)


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def _validate_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise _bad_request("URL phải bắt đầu với http:// hoặc https://")
    if not parsed.netloc:
        raise _bad_request("URL không hợp lệ.")
    host = parsed.netloc.lower().split(":")[0]
    blocked_prefixes = ("127.", "10.", "192.168.", "172.")
    if host in {"localhost", "0.0.0.0"} or host.startswith(blocked_prefixes):
        raise _bad_request("Không thể fetch URL nội bộ.")
    return url.strip()


def _make_converter() -> html2text.HTML2Text:
    h = html2text.HTML2Text()
    h.body_width = 0
    h.ignore_images = True
    h.ignore_links = False
    h.ignore_emphasis = False
    h.bypass_tables = False
    h.protect_links = True
    h.unicode_snob = True
    h.use_automatic_links = False
    h.mark_code = False
    h.skip_internal_links = True
    return h


def _extract_title(html: str) -> str | None:
    m = _TITLE_TAG_RE.search(html)
    if m:
        title = _HTML_TAG_STRIP_RE.sub("", m.group(1)).strip()
        if title:
            return title[:200]
    m = _H1_TAG_RE.search(html)
    if m:
        title = _HTML_TAG_STRIP_RE.sub("", m.group(1)).strip()
        if title:
            return title[:200]
    return None


async def fetch_url_as_markdown(url: str) -> tuple[str | None, str]:
    target = _validate_url(url)

    async with httpx.AsyncClient(
        timeout=_TIMEOUT,
        follow_redirects=True,
        headers={
            "User-Agent": _USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
        },
    ) as client:
        try:
            resp = await client.get(target)
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Hết thời gian chờ phản hồi từ URL.",
            ) from None
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Không truy cập được URL: {exc}",
            ) from None

    if resp.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="URL không tồn tại (404)."
        )
    if resp.status_code != 200:
        raise _bad_request(f"Server trả lỗi HTTP {resp.status_code}.")

    if len(resp.content) > _MAX_BYTES:
        raise _bad_request(
            f"Trang vượt quá {_MAX_BYTES // (1024 * 1024)} MB — quá lớn để xử lý."
        )

    content_type = resp.headers.get("content-type", "").lower()
    if "html" not in content_type and "text" not in content_type:
        raise _bad_request(
            f"URL trả {content_type or 'binary'} — chỉ hỗ trợ HTML / text."
        )

    raw = resp.text
    if not raw.strip():
        raise _bad_request("URL trả nội dung trống.")

    title = _extract_title(raw) if "html" in content_type else None

    cleaned = _NOISE_BLOCK_RE.sub("", raw)
    converter = _make_converter()
    markdown = converter.handle(cleaned)
    markdown = re.sub(r"\n{3,}", "\n\n", markdown).strip()

    if not markdown:
        raise _bad_request("Không trích xuất được nội dung text từ URL.")

    return title, markdown
