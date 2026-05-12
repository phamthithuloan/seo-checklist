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


async def test_fetch_text_public_returns_title_and_text(monkeypatch):
    _patch_get(
        monkeypatch,
        httpx.Response(
            200,
            headers={"content-type": "text/plain; charset=utf-8"},
            text="Tiêu đề chính\n\nĐoạn nội dung đầu tiên.\n\nĐoạn nữa.",
        ),
    )
    title, text = await fetch_text("https://docs.google.com/document/d/abc123/edit")
    assert title == "Tiêu đề chính"
    assert "Đoạn nội dung đầu tiên." in text


async def test_fetch_text_private_redirect_raises_400(monkeypatch):
    _patch_get(
        monkeypatch,
        httpx.Response(302, headers={"location": "https://accounts.google.com/..."}),
    )
    with pytest.raises(HTTPException) as exc:
        await fetch_text("https://docs.google.com/document/d/private123/edit")
    assert exc.value.status_code == 400
    assert "không công khai" in exc.value.detail.lower()


async def test_fetch_text_private_html_response_raises_400(monkeypatch):
    _patch_get(
        monkeypatch,
        httpx.Response(
            200,
            headers={"content-type": "text/html; charset=utf-8"},
            text="<html><body>Sign in to Google</body></html>",
        ),
    )
    with pytest.raises(HTTPException) as exc:
        await fetch_text("https://docs.google.com/document/d/private/edit")
    assert exc.value.status_code == 400
    assert "không công khai" in exc.value.detail.lower()


async def test_fetch_text_404_propagates(monkeypatch):
    _patch_get(
        monkeypatch,
        httpx.Response(404, text="Not found"),
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
        httpx.Response(200, headers={"content-type": "text/plain"}, text="\n\n  \n"),
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
