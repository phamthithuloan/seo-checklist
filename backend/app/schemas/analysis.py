from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas._base import CamelModel

CheckStatus = Literal["pass", "fail", "warn"]
CategoryId = Literal["technical", "readability", "branding", "cta"]
SourceType = Literal["paste", "file", "gdocs"]


class CheckResult(CamelModel):
    id: str
    label: str
    status: CheckStatus
    category: CategoryId
    detail: str
    recommendation: str | None = None
    example: str | None = None


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
