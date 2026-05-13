"""Unit tests for Google Docs service — mock httpx responses."""

import httpx
import pytest
from fastapi import HTTPException

from app.services import google_docs
from app.services.google_docs import fetch_text, parse_doc_id


def test_parse_doc_id_variants():
    cases = [
        ("https://docs.google.com/document/d/abc123_-/edit", "abc123_-"),
        ("https://docs.google.com/document/d/XYZ/view?usp=sharing", "XYZ"),
        ("https://docs.google.com/document/d/1A2B3C/edit?tab=t.0", "1A2B3C"),
        ("docs.google.com/document/d/short", "short"),
        ("https://example.com/foo", None),
        ("not a url", None),
        ("", None),
    ]
    for url, expected in cases:
        assert parse_doc_id(url) == expected, url


def _patch_get(monkeypatch, response: httpx.Response) -> None:
    async def fake_get(self, _url, **_kwargs):  # type: ignore[no-untyped-def]
        return response

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)


def _response_from(url: str, status_code: int, *, content_type: str, text: str = "") -> httpx.Response:
    """Build a Response whose `.url` reflects the final destination after redirects."""
    return httpx.Response(
        status_code,
        headers={"content-type": content_type},
        text=text,
        request=httpx.Request("GET", url),
    )


async def test_fetch_text_public_returns_markdown(monkeypatch):
    # Google now returns HTML — html2text converts to Markdown.
    html = """<!DOCTYPE html><html><body>
        <h1>Tiêu đề chính</h1>
        <h2>Phần 1</h2>
        <p>Đoạn nội dung đầu tiên.</p>
        <ul><li>điểm 1</li><li>điểm 2</li></ul>
        <p><strong>In đậm</strong> và <em>nghiêng</em>.</p>
    </body></html>"""
    _patch_get(
        monkeypatch,
        _response_from(
            "https://doc-00-xx-docs.googleusercontent.com/export/abc?format=html",
            200,
            content_type="text/html; charset=utf-8",
            text=html,
        ),
    )
    title, md = await fetch_text("https://docs.google.com/document/d/abc123/edit")
    assert title == "Tiêu đề chính"
    assert "# Tiêu đề chính" in md
    assert "## Phần 1" in md
    assert "điểm 1" in md
    assert "**In đậm**" in md


async def test_fetch_text_private_redirects_to_signin(monkeypatch):
    # Private doc → final URL is the sign-in page.
    _patch_get(
        monkeypatch,
        _response_from(
            "https://accounts.google.com/v3/signin/identifier?continue=...",
            200,
            content_type="text/html; charset=utf-8",
            text="<html>Sign in</html>",
        ),
    )
    with pytest.raises(HTTPException) as exc:
        await fetch_text("https://docs.google.com/document/d/private123/edit")
    assert exc.value.status_code == 400
    assert "không công khai" in exc.value.detail.lower()


async def test_fetch_text_signin_form_treated_as_private(monkeypatch):
    # Final URL stays on docs.google.com but body is a sign-in HTML page with <form ... signin ...>
    _patch_get(
        monkeypatch,
        _response_from(
            "https://docs.google.com/document/d/private/edit",
            200,
            content_type="text/html; charset=utf-8",
            text='<html><body><form action="/signin">Sign in</form></body></html>',
        ),
    )
    with pytest.raises(HTTPException) as exc:
        await fetch_text("https://docs.google.com/document/d/private/edit")
    assert exc.value.status_code == 400
    assert "không công khai" in exc.value.detail.lower()


async def test_fetch_text_404_propagates(monkeypatch):
    _patch_get(
        monkeypatch,
        _response_from(
            "https://docs.google.com/document/d/missing/export?format=txt",
            404,
            content_type="text/html",
            text="Not found",
        ),
    )
    with pytest.raises(HTTPException) as exc:
        await fetch_text("https://docs.google.com/document/d/missing/edit")
    assert exc.value.status_code == 404


async def test_fetch_text_invalid_url_raises_400():
    with pytest.raises(HTTPException) as exc:
        await fetch_text("https://example.com/random")
    assert exc.value.status_code == 400
    assert "không hợp lệ" in exc.value.detail.lower()


async def test_fetch_text_empty_doc_raises_400(monkeypatch):
    _patch_get(
        monkeypatch,
        _response_from(
            "https://doc-00-xx-docstext.googleusercontent.com/export/empty?format=txt",
            200,
            content_type="text/plain",
            text="\n\n  \n",
        ),
    )
    with pytest.raises(HTTPException) as exc:
        await fetch_text("https://docs.google.com/document/d/empty/edit")
    assert exc.value.status_code == 400
    assert "rỗng" in exc.value.detail.lower()


async def test_fetch_text_timeout_raises_504(monkeypatch):
    async def fake_get(self, _url, **_kwargs):  # type: ignore[no-untyped-def]
        raise httpx.TimeoutException("timeout")

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get)

    with pytest.raises(HTTPException) as exc:
        await fetch_text("https://docs.google.com/document/d/x/edit")
    assert exc.value.status_code == 504
