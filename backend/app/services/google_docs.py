"""Fetch plain text from a publicly-shared Google Docs URL.

Strategy:
- Parse the doc ID from a `/document/d/{id}/...` URL.
- Hit the txt export endpoint: `https://docs.google.com/document/d/{id}/export?format=txt`.
- A public doc returns 200 + text/plain.
- A private doc returns either a redirect to sign-in (3xx) or 200 + text/html (login page).
- A missing doc returns 404.
"""

import re
from typing import Final

import httpx
from fastapi import HTTPException, status

_DOC_ID_RE: Final = re.compile(r"/document/d/([a-zA-Z0-9_-]+)")
_EXPORT_URL: Final = "https://docs.google.com/document/d/{id}/export?format=txt"
_TIMEOUT: Final = 15.0


def parse_doc_id(url: str) -> str | None:
    if not url:
        return None
    match = _DOC_ID_RE.search(url)
    return match.group(1) if match else None


def _bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


async def fetch_text(url: str) -> tuple[str | None, str]:
    """Return (title, text). Title = first non-empty line if short, else None."""

    doc_id = parse_doc_id(url)
    if doc_id is None:
        raise _bad_request("URL không hợp lệ. Hãy dán link Google Docs (.../document/d/...).")

    export_url = _EXPORT_URL.format(id=doc_id)
    async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=False) as client:
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

    # Google redirects unauthenticated requests for private docs.
    if 300 <= resp.status_code < 400:
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

    content_type = resp.headers.get("content-type", "").lower()

    # A private doc that doesn't redirect can still return an HTML sign-in page.
    if "html" in content_type:
        raise _bad_request(
            "Doc không công khai. Đặt quyền 'Anyone with link can view' rồi thử lại."
        )

    text = resp.text
    if not text.strip():
        raise _bad_request("Doc rỗng.")

    title: str | None = None
    for raw in text.splitlines():
        line = raw.strip()
        if line:
            if len(line) <= 200:
                title = line
            break

    return title, text
