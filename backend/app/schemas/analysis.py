from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas._base import CamelModel

CheckStatus = Literal["pass", "fail", "warn"]
CategoryId = Literal[
    "technical",
    "readability",
    "branding",
    "cta",
    "ul-li",
    "ai-opt",
    "eeat",
    "grammar",
    "trust-ai",
]
SourceType = Literal["paste", "file", "gdocs", "url"]


OutlineHeadingStatus = Literal["match", "missing", "extra"]
OutlineFormat = Literal["text", "bullet", "table", "mixed", "empty"]


class OutlineHeading(CamelModel):
    """One row in the outline ↔ content comparison."""

    level: int
    title: str
    target_words: int | None = None
    target_format: OutlineFormat | None = None
    actual_words: int | None = None
    actual_format: OutlineFormat | None = None
    status: OutlineHeadingStatus
    note: str | None = None


OutlineDepthVerdict = Literal["sketchy", "adequate", "detailed"]


class OutlineAIAnalysis(CamelModel):
    """LLM-based semantic comparison: does the article follow the outline's
    intent (format, info coverage, depth)?"""

    format_followed: bool
    format_notes: str
    info_coverage_score: int
    missing_points: list[str]
    extra_depth_points: list[str]
    depth_verdict: OutlineDepthVerdict
    depth_summary: str


class OutlineComparison(CamelModel):
    total_outline_headings: int
    total_content_headings: int
    matched: int
    missing: int
    extra: int
    headings: list[OutlineHeading]
    ai_analysis: OutlineAIAnalysis | None = None
    ai_reason_unavailable: str | None = None


class CheckIssue(CamelModel):
    """A specific offending item surfaced by a check (e.g. a too-long sentence)."""

    kind: Literal["sentence", "paragraph", "heading", "link", "word", "quote", "text"] = "text"
    text: str
    note: str | None = None


InactiveReason = Literal["needs-config", "needs-api", "error"]


class CheckResult(CamelModel):
    id: str
    label: str
    status: CheckStatus
    category: CategoryId
    detail: str
    recommendation: str | None = None
    example: str | None = None
    issues: list[CheckIssue] = []
    # When set, the rule did not actually evaluate (no config input / no API key)
    # → it is shown separately and EXCLUDED from the score.
    inactive: InactiveReason | None = None


class AnalysisConfig(CamelModel):
    """User-supplied input for configurable rules.
    Empty / None values cause the corresponding rule to emit a 'needs-config' warn.
    """

    secondary_keywords: list[str] = Field(default_factory=list)
    pronouns: list[str] = Field(default_factory=list)
    brand_voice_keywords: list[str] = Field(default_factory=list)
    brand_message: str = ""
    ad_forbidden_words: list[str] = Field(default_factory=list)
    competitors: list[str] = Field(default_factory=list)
    persona_keywords: list[str] = Field(default_factory=list)
    awards_mentions: list[str] = Field(default_factory=list)
    product_urls: list[str] = Field(default_factory=list)
    lsi_keywords: list[str] = Field(default_factory=list)


class AnalysisResult(CamelModel):
    """In-memory output from the analyzer service."""

    score: int
    total_checks: int
    pass_count: int
    fail_count: int
    warn_count: int
    word_count: int
    keyword_density: float
    checks: list[CheckResult]


class AnalysisCreate(CamelModel):
    """Request body for POST /analysis."""

    keyword: str = Field(min_length=1, max_length=255)
    meta_description: str = Field(default="", max_length=500)
    content: str = Field(min_length=1)
    source_type: SourceType = "paste"
    source_url: str | None = Field(default=None, max_length=1024)
    title: str | None = Field(default=None, max_length=255)
    enabled_checks: list[str] | None = Field(default=None)
    config: AnalysisConfig | None = Field(default=None)
    outline: str | None = Field(default=None)
    ai_proofread: bool = Field(default=False)
    ai_content_audit: bool = Field(default=False)


class AnalysisOut(CamelModel):
    """Detail response — full DB row + checks."""

    id: UUID
    user_id: UUID
    title: str | None
    keyword: str
    meta_description: str
    content: str
    source_type: str
    source_url: str | None
    score: int
    total_checks: int
    pass_count: int
    warn_count: int
    fail_count: int
    word_count: int
    keyword_density: float
    checks: list[CheckResult]
    outline: str | None = None
    outline_comparison: OutlineComparison | None = None
    created_at: datetime


class AnalysisListItem(CamelModel):
    """Compact item for GET /analysis list view."""

    id: UUID
    title: str | None
    keyword: str
    source_type: str
    score: int
    pass_count: int
    warn_count: int
    fail_count: int
    word_count: int
    created_at: datetime
