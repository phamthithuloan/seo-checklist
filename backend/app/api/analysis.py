import asyncio
import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.analysis import Analysis
from app.models.user import User
from app.schemas.analysis import (
    AnalysisCreate,
    AnalysisListItem,
    AnalysisOut,
    AutoFixRequest,
    AutoFixResult,
    CheckResult,
    CompareRequest,
    CompareResult,
)
from app.core.config import get_settings
from app.services.ai_content_audit import audit_ai_content
from app.services.ai_proofread import proofread_content
from app.services.outline_ai_compare import analyze_outline_followthrough
from app.services.outline_compare import compare_outline
from app.services.auto_fix import autofix_article
from app.services.competitor_compare import compare_with_competitors
from app.services.gemini import gemini_available
from app.services.report_export import render_analysis_html, render_analysis_markdown
from app.services.seo_analyzer import analyze_content, score_checks


def _inactive_ai(id_: str, label: str, category: str, has_key: bool) -> CheckResult:
    """Placeholder for an AI feature that was requested but produced no result —
    visible in the checklist (greyed) but excluded from the score. Distinguishes
    'no API key' from 'temporary error/limit' so the message is accurate."""
    if has_key:
        reason = "error"
        detail = "Gemini free tier đang bận / chạm giới hạn (5 lượt/phút) — phân tích lại sau ít phút là có."
    else:
        reason = "needs-api"
        detail = "Cần GEMINI_API_KEY ở backend để chạy tính năng AI này."
    return CheckResult(
        id=id_,
        label=label,
        category=category,  # type: ignore[arg-type]
        status="warn",
        inactive=reason,  # type: ignore[arg-type]
        detail=detail,
    )

router = APIRouter(prefix="/analysis", tags=["analysis"])


async def _get_owned(
    analysis_id: UUID, user: User, db: AsyncSession
) -> Analysis:
    analysis = await db.get(Analysis, analysis_id)
    if analysis is None or analysis.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy bản phân tích",
        )
    return analysis


@router.post("", response_model=AnalysisOut, status_code=status.HTTP_201_CREATED)
async def create_analysis(
    data: AnalysisCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Analysis:
    result = analyze_content(
        content=data.content,
        keyword=data.keyword,
        meta_description=data.meta_description,
        enabled_checks=data.enabled_checks,
        config=data.config,
    )

    # Optional AI add-ons — opt-in, each a Gemini call. Run them CONCURRENTLY so
    # total wait ≈ slowest single call (not the sum). When a feature is requested
    # but unavailable (no key / transient error) we append an "inactive"
    # placeholder so the checklist shows it (greyed, not scored) instead of hiding.
    gemini_on = bool(get_settings().gemini_api_key)
    outline_text = data.outline.strip() if data.outline else None

    async def _run_proofread():
        return await proofread_content(data.content) if data.ai_proofread else None

    async def _run_audit():
        return await audit_ai_content(data.content) if data.ai_content_audit else None

    async def _run_outline():
        return (
            await analyze_outline_followthrough(outline=outline_text, content=data.content)
            if outline_text
            else None
        )

    proofread, audit_checks, outline_ai = await asyncio.gather(
        _run_proofread(), _run_audit(), _run_outline()
    )

    if data.ai_proofread:
        if proofread is not None:
            result.checks.extend(proofread)
        else:
            result.checks.append(
                _inactive_ai("grammar", "Ngữ pháp đúng, diễn đạt mạch lạc", "grammar", gemini_on)
            )
            result.checks.append(
                _inactive_ai("spelling", "Không có lỗi chính tả", "grammar", gemini_on)
            )

    if data.ai_content_audit:
        if audit_checks:
            result.checks.extend(audit_checks)
        if not any(c.id == "fact-check" for c in result.checks):
            result.checks.append(
                _inactive_ai("fact-check", "Không có thông tin sai / bịa", "trust-ai", gemini_on)
            )

    if data.ai_proofread or data.ai_content_audit:
        agg = score_checks(result.checks)
        result.total_checks = agg["total"]
        result.pass_count = agg["pass"]
        result.fail_count = agg["fail"]
        result.warn_count = agg["warn"]
        result.score = agg["score"]

    # Optional outline comparison (rule-based merge + AI follow-through computed above)
    outline_comparison_dict = None
    if outline_text:
        comparison = compare_outline(outline_text, data.content)
        comparison.ai_analysis = outline_ai
        if outline_ai is None:
            comparison.ai_reason_unavailable = (
                "Backend chưa cấu hình GEMINI_API_KEY — phân tích "
                "follow-through outline cần Google Gemini."
                if not gemini_on
                else "AI không trả về kết quả (lỗi tạm thời, thử lại lần phân tích sau)."
            )
        outline_comparison_dict = comparison.model_dump()

    analysis = Analysis(
        user_id=user.id,
        title=data.title,
        keyword=data.keyword,
        meta_description=data.meta_description,
        content=data.content,
        source_type=data.source_type,
        source_url=data.source_url,
        score=result.score,
        total_checks=result.total_checks,
        pass_count=result.pass_count,
        warn_count=result.warn_count,
        fail_count=result.fail_count,
        word_count=result.word_count,
        keyword_density=result.keyword_density,
        checks=[c.model_dump() for c in result.checks],
        outline=outline_text,
        outline_comparison=outline_comparison_dict,
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    return analysis


@router.post("/compare", response_model=CompareResult)
async def compare_competitors(
    data: CompareRequest,
    user: User = Depends(get_current_user),
) -> CompareResult:
    """Compare the article against competitor URLs on structural SEO metrics."""
    return await compare_with_competitors(
        content=data.content,
        keyword=data.keyword,
        competitor_urls=data.competitor_urls,
    )


@router.post("/autofix", response_model=AutoFixResult)
async def autofix(
    data: AutoFixRequest,
    user: User = Depends(get_current_user),
) -> AutoFixResult:
    """Rewrite the article fixing flagged issues (grammar, tone, structure) via
    Gemini, preserving meaning + sources. Returns improved Markdown."""
    if not gemini_available():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cần GEMINI_API_KEY ở backend để dùng tự động sửa bài.",
        )
    improved = await autofix_article(data.content, data.keyword, data.issues)
    if improved is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gemini tạm thời không xử lý được (bận / giới hạn) — thử lại sau.",
        )
    return AutoFixResult(content=improved)


@router.get("", response_model=list[AnalysisListItem])
async def list_analyses(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[Analysis]:
    stmt = (
        select(Analysis)
        .where(Analysis.user_id == user.id)
        .order_by(Analysis.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.scalars(stmt)
    return list(result.all())


@router.get("/{analysis_id}", response_model=AnalysisOut)
async def get_analysis(
    analysis_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Analysis:
    return await _get_owned(analysis_id, user, db)


@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_analysis(
    analysis_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    analysis = await _get_owned(analysis_id, user, db)
    await db.delete(analysis)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


_SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9_.\-]+")


def _safe_filename(name: str, ext: str) -> str:
    base = _SAFE_FILENAME_RE.sub("-", name.strip())[:80] or "bao-cao-seo"
    return f"{base}.{ext}"


@router.get("/{analysis_id}/export")
async def export_analysis(
    analysis_id: UUID,
    format: str = "markdown",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Export analysis as Markdown or HTML. ?format=markdown (default) | html."""
    analysis = await _get_owned(analysis_id, user, db)
    base_name = analysis.title or analysis.keyword or "bao-cao-seo"

    if format == "html":
        body = render_analysis_html(analysis)
        return Response(
            content=body,
            media_type="text/html; charset=utf-8",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="{_safe_filename(base_name, "html")}"'
                ),
            },
        )

    # default: markdown
    body = render_analysis_markdown(analysis)
    return Response(
        content=body,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{_safe_filename(base_name, "md")}"'
            ),
        },
    )
