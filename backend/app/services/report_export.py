"""Render an Analysis row to Markdown / HTML for export."""

from datetime import datetime
from typing import Any

from app.models.analysis import Analysis


_STATUS_LABEL = {
    "pass": "✅ Pass",
    "fail": "❌ Fail",
    "warn": "⚠️ Warning",
}

_CATEGORY_LABEL = {
    "technical": "Technical SEO",
    "readability": "Tốt cho người đọc",
    "ul-li": "UL-LI",
    "ai-opt": "Tối ưu AI",
    "branding": "Branding",
    "eeat": "E-E-A-T",
    "cta": "CTA",
    "grammar": "Ngữ pháp / Chính tả",
    "trust-ai": "Tin cậy & Kiểm chứng AI",
}

_OUTLINE_STATUS_LABEL = {
    "match": "✅ Match",
    "missing": "❌ Thiếu",
    "extra": "➕ Thừa",
}


def _format_dt(dt: datetime | None) -> str:
    if dt is None:
        return ""
    return dt.strftime("%d/%m/%Y %H:%M")


def render_analysis_markdown(a: Analysis) -> str:
    lines: list[str] = []
    title = a.title or a.keyword or "Bài phân tích SEO"
    lines.append(f"# Báo cáo SEO — {title}")
    lines.append("")
    lines.append(f"- **Từ khoá chính**: {a.keyword}")
    if a.meta_description:
        lines.append(f"- **Meta description** ({len(a.meta_description)} ký tự): {a.meta_description}")
    lines.append(f"- **Nguồn**: {a.source_type}" + (f" ({a.source_url})" if a.source_url else ""))
    lines.append(f"- **Tạo lúc**: {_format_dt(a.created_at)}")
    lines.append("")
    lines.append("## Điểm tổng")
    lines.append("")
    lines.append(f"- **Score**: {a.score}/100")
    lines.append(f"- **Tổng tiêu chí**: {a.total_checks}")
    lines.append(f"- **Pass / Warn / Fail**: {a.pass_count} / {a.warn_count} / {a.fail_count}")
    lines.append(f"- **Số từ**: {a.word_count}")
    lines.append(f"- **Keyword density**: {a.keyword_density:.2f}%")
    lines.append("")

    # Group checks by category
    by_cat: dict[str, list[dict[str, Any]]] = {}
    for c in (a.checks or []):
        by_cat.setdefault(c.get("category", "other"), []).append(c)

    lines.append("## Checklist chi tiết")
    lines.append("")

    for cat in [
        "technical",
        "readability",
        "ul-li",
        "ai-opt",
        "branding",
        "eeat",
        "grammar",
        "trust-ai",
        "cta",
    ]:
        rules = by_cat.get(cat)
        if not rules:
            continue
        cat_label = _CATEGORY_LABEL.get(cat, cat)
        passed = sum(1 for r in rules if r.get("status") == "pass")
        lines.append(f"### {cat_label} ({passed}/{len(rules)} pass)")
        lines.append("")
        for r in rules:
            status = _STATUS_LABEL.get(r.get("status", ""), r.get("status", ""))
            label = r.get("label", r.get("id", ""))
            lines.append(f"**{status}** · {label}")
            lines.append("")
            detail = r.get("detail", "").strip()
            if detail:
                lines.append(f"> {detail}")
                lines.append("")
            issues = r.get("issues") or []
            if issues:
                lines.append(f"*Chi tiết ({len(issues)} điểm):*")
                lines.append("")
                for it in issues[:20]:
                    note = f" — _{it['note']}_" if it.get("note") else ""
                    text = (it.get("text") or "").replace("\n", " ").strip()
                    if len(text) > 200:
                        text = text[:197] + "…"
                    lines.append(f"- {text}{note}")
                lines.append("")
            rec = r.get("recommendation")
            if rec:
                lines.append(f"💡 *Gợi ý:* {rec}")
                lines.append("")
            example = r.get("example")
            if example:
                lines.append("```")
                lines.append(example)
                lines.append("```")
                lines.append("")

    # Outline comparison
    oc = a.outline_comparison
    if oc and isinstance(oc, dict):
        lines.append("## So sánh với Outline")
        lines.append("")
        lines.append(
            f"- **Coverage**: {oc.get('matched', 0)}/{oc.get('total_outline_headings', 0)} match"
            f" · Thiếu: {oc.get('missing', 0)} · Thừa: {oc.get('extra', 0)}"
        )
        lines.append("")
        for h in oc.get("headings", []):
            status = _OUTLINE_STATUS_LABEL.get(h.get("status", ""), h.get("status", ""))
            level = h.get("level", 2)
            indent = "  " * max(0, level - 1)
            lines.append(f"{indent}- {status} **H{level}**: {h.get('title', '')}")
            details = []
            if h.get("actual_words") is not None or h.get("target_words") is not None:
                aw = h.get("actual_words", "—")
                tw = h.get("target_words")
                details.append(f"{aw}{f' / {tw}' if tw else ''} từ")
            if h.get("actual_format") or h.get("target_format"):
                af = h.get("actual_format") or "—"
                tf = h.get("target_format")
                details.append(f"format: {af}{f' / {tf}' if tf else ''}")
            if details:
                lines.append(f"{indent}  - {' · '.join(details)}")
            if h.get("note"):
                lines.append(f"{indent}  - ⚠ {h['note']}")
        lines.append("")

    # Original content at end
    lines.append("## Nội dung bài viết")
    lines.append("")
    lines.append(a.content)
    lines.append("")

    return "\n".join(lines)


def render_analysis_html(a: Analysis) -> str:
    """Minimal HTML wrapping the markdown report. Browsers + PDF tools can render it."""
    md = render_analysis_markdown(a)
    # Very lightweight: wrap in <pre> for monospace + escape HTML chars.
    import html as html_lib

    escaped = html_lib.escape(md)
    title = a.title or a.keyword or "Báo cáo SEO"
    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>{html_lib.escape(title)} — Báo cáo SEO</title>
<style>
body {{ font-family: -apple-system, sans-serif; max-width: 920px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #1f2937; }}
pre {{ white-space: pre-wrap; word-wrap: break-word; font-family: inherit; font-size: 14px; }}
</style>
</head>
<body>
<pre>{escaped}</pre>
</body>
</html>
"""
