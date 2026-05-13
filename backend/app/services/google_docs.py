"""Fetch and convert a publicly-shared Google Docs URL to Markdown.

Strategy:
- Parse the doc ID from a `/document/d/{id}/...` URL.
- Export as HTML (preserves heading levels, bullet lists, bold/italic).
- Pipe HTML → markdown via html2text so analyzer sees `## H2`, `- bullet`, `**bold**`.
- Private docs redirect to `accounts.google.com` sign-in → return 400.
- Missing docs → 404.
"""

import re
from typing import Final

import html2text
import httpx
from fastapi import HTTPException, status

_DOC_ID_RE: Final = re.compile(r"/document/d/([a-zA-Z0-9_-]+)")
_EXPORT_URL: Final = "https://docs.google.com/document/d/{id}/export?format=html"
_TIMEOUT: Final = 15.0


def _new_md_converter() -> html2text.HTML2Text:
    h = html2text.HTML2Text()
    h.body_width = 0  # don't wrap long lines
    # Google Docs embeds images as inline base64 — would bloat response
    # by hundreds of KB and provide no SEO value. Strip them.
    h.ignore_images = True
    h.ignore_links = False
    h.ignore_emphasis = False
    h.bypass_tables = False
    h.protect_links = True
    h.unicode_snob = True  # preserve unicode (Vietnamese)
    h.use_automatic_links = False
    h.mark_code = False
    return h


def parse_doc_id(url: str) -> str | None:
    if not url:
        return None
    match = _DOC_ID_RE.search(url)
    return match.group(1) if match else None


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


async def fetch_text(url: str) -> tuple[str | None, str]:
    """Return (title, text). Title = first non-empty line if short, else None.

    Google's export endpoint always redirects (typically 302) to a signed URL on
    `docs.googleusercontent.com`. For private docs the redirect target is the
    `accounts.google.com` sign-in page instead. We follow redirects and inspect
    the final URL + content-type to tell them apart.
    """

    doc_id = parse_doc_id(url)
    if doc_id is None:
        raise _bad_request("URL không hợp lệ. Hãy dán link Google Docs (.../document/d/...).")

    export_url = _EXPORT_URL.format(id=doc_id)
    async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
        try:
            resp = await client.get(export_url)
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Hết thời gian chờ Google Docs.",
            ) from None
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Không truy cập được Google Docs: {exc}",
            ) from None

    final_host = (resp.url.host or "").lower()

    # Private doc → Google redirected us to the sign-in page.
    if "accounts.google.com" in final_host:
        raise _bad_request(
            "Doc không công khai. Đặt quyền 'Anyone with link can view' rồi thử lại."
        )

    if resp.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy Google Doc với link đã cho.",
        )

    if resp.status_code != 200:
        raise _bad_request(f"Google Docs trả lỗi HTTP {resp.status_code}.")

    html_text = resp.text
    if not html_text.strip():
        raise _bad_request("Doc rỗng.")

    # Sanity check: if Google returned a login page instead of doc HTML.
    if "<form" in html_text.lower() and "signin" in html_text.lower():
        raise _bad_request(
            "Doc không công khai. Đặt quyền 'Anyone with link can view' rồi thử lại."
        )

    # Convert HTML → Markdown. Headings become `# / ## / ###`, lists become `- `,
    # bold becomes `**text**`, links `[text](url)`.
    converter = _new_md_converter()
    markdown = converter.handle(html_text)
    # Cleanup: collapse 3+ blank lines and trim
    markdown = re.sub(r"\n{3,}", "\n\n", markdown).strip()

    if not markdown.strip():
        raise _bad_request("Doc rỗng.")

    # Title = first H1 if present, else first non-empty line (truncated).
    # Note: use [ \t]+ not \s+ — \s matches newlines, which would cause the
    # regex to skip blank H1 lines and capture wrong content.
    title: str | None = None
    h1_match = re.search(r"^#[ \t]+(.+)$", markdown, re.MULTILINE)
    if h1_match:
        title = h1_match.group(1).strip()
    else:
        for raw in markdown.splitlines():
            line = raw.strip().lstrip("#").strip()
            if not line:
                continue
            if re.fullmatch(r"Tab\s+\d+", line):
                continue
            if len(line) <= 200:
                title = line
            break

    return title, markdown
