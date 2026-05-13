"""Email sender — Resend HTTP API.

Optional. If RESEND_API_KEY is empty, send_email() logs the message instead.
"""

import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def send_email(*, to: str, subject: str, html: str, text: str) -> bool:
    """Send an email. Returns True if sent via API, False if logged-only."""
    settings = get_settings()
    if not settings.resend_api_key:
        logger.warning(
            "[email-fallback] No RESEND_API_KEY set. Would have sent to %s:\n"
            "  Subject: %s\n  Body:\n%s",
            to, subject, text,
        )
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.email_from,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                    "text": text,
                },
            )
            r.raise_for_status()
            return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, e)
        return False


def render_reset_email(reset_url: str, user_name: str | None) -> tuple[str, str]:
    """Return (html, text) bodies for a password-reset email."""
    greeting = f"Chào {user_name}," if user_name else "Chào bạn,"
    text = (
        f"{greeting}\n\n"
        f"Bạn vừa yêu cầu đặt lại mật khẩu MindGate. Bấm vào link dưới đây "
        f"để đặt mật khẩu mới (link có hiệu lực 60 phút):\n\n"
        f"{reset_url}\n\n"
        f"Nếu bạn không yêu cầu, hãy bỏ qua email này.\n\n"
        f"— MindGate Team"
    )
    html = f"""\
<!doctype html>
<html><body style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 24px auto; color: #1e293b;">
  <h2 style="color: #0e7490;">Đặt lại mật khẩu MindGate</h2>
  <p>{greeting}</p>
  <p>Bạn vừa yêu cầu đặt lại mật khẩu. Bấm nút dưới để chọn mật khẩu mới (link có hiệu lực 60 phút):</p>
  <p style="margin: 24px 0;">
    <a href="{reset_url}"
       style="display:inline-block;background:#06b6d4;color:#fff;text-decoration:none;
              padding:12px 24px;border-radius:8px;font-weight:600;">
      Đặt lại mật khẩu
    </a>
  </p>
  <p style="font-size: 12px; color: #64748b;">Nếu nút không hoạt động, copy URL này vào trình duyệt:<br/>
  <code style="word-break:break-all;">{reset_url}</code></p>
  <p style="font-size: 12px; color: #64748b;">Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;"/>
  <p style="font-size: 11px; color: #94a3b8;">— MindGate · SEO Content Reviewer</p>
</body></html>
"""
    return html, text
