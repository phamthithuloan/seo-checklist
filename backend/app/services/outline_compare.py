"""Compare an outline (intent / blueprint) against the actual article content.

Outline format auto-detects both:
  ## Tiêu đề H2
  ## Tiêu đề H2 (200 từ, bullet)
  ### H3 (150, table)

Per heading the user can supply:
- target word count (e.g. "200 từ", "300", "200 words")
- target format: text / bullet / table

The comparator walks outline + content headings, matches by normalised title,
and reports: match / missing / extra plus word & format deltas.
"""

import re
from typing import Literal

from app.schemas.analysis import (
    OutlineComparison,
    OutlineFormat,
    OutlineHeading,
)


_HEADING_RE = re.compile(r"^(#{1,4})\s+(.+?)\s*$", re.MULTILINE)
_ANNOTATION_RE = re.compile(r"^(.+?)\s*\(([^)]+)\)\s*$")
_NUMBER_RE = re.compile(r"\d+")
_BULLET_RE = re.compile(r"^\s*[-*+]\s+", re.MULTILINE)
_TABLE_RE = re.compile(r"^\s*\|.*\|\s*$", re.MULTILINE)
_WHITESPACE_RE = re.compile(r"\s+")


class OutlineSpec:
    """Internal parsed outline entry."""

    def __init__(
        self,
        level: int,
        title: str,
        target_words: int | None,
        target_format: OutlineFormat | None,
        topic_keywords: list[str] | None = None,
    ) -> None:
        self.level = level
        self.title = title
        self.target_words = target_words
        self.target_format = target_format
        self.topic_keywords = topic_keywords or []


def _normalize_title(s: str) -> str:
    return _WHITESPACE_RE.sub(" ", s.strip().lower())


def _parse_annotation(s: str) -> tuple[int | None, OutlineFormat | None, list[str]]:
    """Parse strings like '200 từ, bullet, topic: dịch vụ seo, tối ưu'.
    Returns (target_words, target_format, topic_keywords).
    'topic:' captures everything after it (up to end of annotation) as comma-separated keywords."""
    target_words: int | None = None
    target_format: OutlineFormat | None = None
    topic_keywords: list[str] = []

    # Pull "topic:" segment out first (it may itself contain commas).
    topic_match = re.search(r"\btopic\s*:\s*(.+?)$", s, re.IGNORECASE)
    rest = s
    if topic_match:
        topic_str = topic_match.group(1).strip()
        topic_keywords = [
            k.strip() for k in topic_str.split(",") if k.strip()
        ]
        rest = s[: topic_match.start()]

    for raw in rest.split(","):
        p = raw.strip().lower()
        if not p:
            continue
        num_match = _NUMBER_RE.search(p)
        if num_match and (
            "từ" in p or "word" in p or p == num_match.group(0)
        ):
            target_words = int(num_match.group(0))
            continue
        if "bullet" in p or p in ("list", "ul", "li", "danh sách"):
            target_format = "bullet"
        elif "table" in p or "bảng" in p:
            target_format = "table"
        elif "text" in p or "đoạn" in p or "văn bản" in p:
            target_format = "text"
    return target_words, target_format, topic_keywords


def _parse_headings(
    text: str, with_annotations: bool
) -> list[tuple[int, str, int, int, int | None, OutlineFormat | None, list[str]]]:
    """Return list of tuples (level, title, match_start, match_end,
    target_words, target_format, topic_keywords)."""
    out = []
    for m in _HEADING_RE.finditer(text):
        level = len(m.group(1))
        full = m.group(2).strip()
        target_words: int | None = None
        target_format: OutlineFormat | None = None
        topic_kws: list[str] = []
        title = full
        if with_annotations:
            ann = _ANNOTATION_RE.match(full)
            if ann:
                title = ann.group(1).strip()
                target_words, target_format, topic_kws = _parse_annotation(ann.group(2))
        out.append(
            (level, title, m.start(), m.end(), target_words, target_format, topic_kws)
        )
    return out


def parse_outline(text: str) -> list[OutlineSpec]:
    return [
        OutlineSpec(level, title, tw, tf, kws)
        for (level, title, _s, _e, tw, tf, kws) in _parse_headings(
            text, with_annotations=True
        )
    ]


def _count_words(text: str) -> int:
    return len([t for t in _WHITESPACE_RE.split(text.strip()) if t])


def _detect_format(text: str) -> OutlineFormat:
    if not text.strip():
        return "empty"
    has_table = bool(_TABLE_RE.search(text))
    has_bullet = bool(_BULLET_RE.search(text))
    # Plain text presence: any non-empty line that isn't a bullet/table row
    text_lines = [
        ln for ln in text.splitlines()
        if ln.strip()
        and not _BULLET_RE.match(ln)
        and not re.match(r"^\s*\|", ln)
    ]
    has_text = len(text_lines) > 0
    if has_table:
        return "table"
    if has_bullet and has_text:
        return "mixed"
    if has_bullet:
        return "bullet"
    if has_text:
        return "text"
    return "empty"


def _build_section_text(content: str, heading_end: int, next_start: int | None) -> str:
    end = next_start if next_start is not None else len(content)
    return content[heading_end:end]


def _count_bullets(text: str) -> int:
    return len(_BULLET_RE.findall(text))


def _count_subsections(
    parent_idx: int, parent_level: int, headings: list, end_idx: int
) -> int:
    """Count headings of level > parent_level between parent_idx+1 and end_idx (exclusive)
    that are children (i.e. before any sibling/uncle of equal-or-lesser level)."""
    count = 0
    for j in range(parent_idx + 1, end_idx):
        level = headings[j][0]
        if level <= parent_level:
            break
        count += 1
    return count


def compare_outline(outline_text: str, content: str) -> OutlineComparison:
    outline_specs = parse_outline(outline_text)
    outline_raw = _parse_headings(outline_text, with_annotations=True)

    # Parse content headings WITHOUT annotation (real article doesn't have `(200, bullet)`).
    content_raw = _parse_headings(content, with_annotations=False)

    # Subsection count per outline heading: count immediate children of higher level.
    outline_subcounts = []
    for i, (lvl, *_rest) in enumerate(outline_raw):
        sub = _count_subsections(i, lvl, outline_raw, len(outline_raw))
        outline_subcounts.append(sub)

    # Build content sections with associated text bodies + subsection count.
    sections: list[dict] = []
    for i, (level, title, start, end, _tw, _tf, _kws) in enumerate(content_raw):
        next_start = content_raw[i + 1][2] if i + 1 < len(content_raw) else None
        body = _build_section_text(content, end, next_start)
        sub_count = _count_subsections(i, level, content_raw, len(content_raw))
        sections.append({
            "level": level,
            "title": title,
            "norm_title": _normalize_title(title),
            "body": body,
            "actual_words": _count_words(body),
            "actual_format": _detect_format(body),
            "bullet_count": _count_bullets(body),
            "subsection_count": sub_count,
            "consumed": False,
        })

    headings_out: list[OutlineHeading] = []
    matched = missing = extra = 0

    for spec in outline_specs:
        ntitle = _normalize_title(spec.title)
        match = next(
            (s for s in sections if not s["consumed"] and s["norm_title"] == ntitle),
            None,
        )
        if match is None:
            headings_out.append(
                OutlineHeading(
                    level=spec.level,
                    title=spec.title,
                    target_words=spec.target_words,
                    target_format=spec.target_format,
                    actual_words=None,
                    actual_format=None,
                    status="missing",
                    note=None,
                )
            )
            missing += 1
            continue

        match["consumed"] = True
        notes: list[str] = []
        actual_words = match["actual_words"]
        actual_format = match["actual_format"]
        bullet_count = match["bullet_count"]
        sub_count = match["subsection_count"]

        if spec.target_words is not None and actual_words is not None:
            ratio = actual_words / max(1, spec.target_words)
            if ratio < 0.7:
                notes.append(
                    f"Ngắn hơn target ({actual_words}/{spec.target_words} từ, {int(ratio*100)}%)"
                )
            elif ratio > 1.5:
                notes.append(
                    f"Dài hơn target nhiều ({actual_words}/{spec.target_words} từ, {int(ratio*100)}%)"
                )

        if (
            spec.target_format is not None
            and actual_format is not None
            and actual_format != spec.target_format
            and actual_format != "empty"
        ):
            notes.append(
                f"Format hiện tại là {actual_format}, target là {spec.target_format}"
            )

        if actual_format == "empty":
            notes.append("Section trống — chưa có nội dung")

        # Bullet count check: if target format is bullet, expect ≥3 bullets
        if spec.target_format == "bullet" and actual_format in ("bullet", "mixed"):
            if bullet_count < 3:
                notes.append(
                    f"Chỉ có {bullet_count} bullet — bullet list nên có ≥3 dòng"
                )

        # Topic keyword coverage
        if spec.topic_keywords:
            body_lower = match["body"].lower()
            missing_topics = [k for k in spec.topic_keywords if k.lower() not in body_lower]
            if missing_topics:
                notes.append(
                    f"Chưa nhắc topic: {', '.join(missing_topics[:3])}"
                    + ("…" if len(missing_topics) > 3 else "")
                )

        # Subsection coverage: outline has children H3/H4, content should too
        outline_sub_count = outline_subcounts[outline_raw.index(
            next(r for r in outline_raw if r[1] == spec.title and r[0] == spec.level)
        )] if any(r[1] == spec.title and r[0] == spec.level for r in outline_raw) else 0
        if outline_sub_count > 0:
            if sub_count < outline_sub_count:
                notes.append(
                    f"Thiếu subsection: bài có {sub_count} con / outline có {outline_sub_count}"
                )

        headings_out.append(
            OutlineHeading(
                level=spec.level,
                title=spec.title,
                target_words=spec.target_words,
                target_format=spec.target_format,
                actual_words=actual_words,
                actual_format=actual_format,
                status="match",
                note="; ".join(notes) if notes else None,
            )
        )
        matched += 1

    # Anything left in sections that wasn't consumed = extra heading not in outline
    for s in sections:
        if s["consumed"]:
            continue
        headings_out.append(
            OutlineHeading(
                level=s["level"],
                title=s["title"],
                target_words=None,
                target_format=None,
                actual_words=s["actual_words"],
                actual_format=s["actual_format"],
                status="extra",
                note="Heading thừa — không có trong outline",
            )
        )
        extra += 1

    return OutlineComparison(
        total_outline_headings=len(outline_specs),
        total_content_headings=len(sections),
        matched=matched,
        missing=missing,
        extra=extra,
        headings=headings_out,
    )
