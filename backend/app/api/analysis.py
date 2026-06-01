import math
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
)
from app.core.config import get_settings
from app.services.ai_content_audit import audit_ai_content
from app.services.ai_proofread import proofread_content
from app.services.outline_ai_compare import analyze_outline_followthrough
from app.services.outline_compare import compare_outline
from app.services.report_export import render_analysis_html, render_analysis_markdown
from app.services.seo_analyzer import analyze_content

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

    # Optional AI add-ons — opt-in, cost API tokens. Both append checks; we
    # re-aggregate score/counts once after whichever ran.
    extra_added = False

    if data.ai_proofread:
        proofread = await proofread_content(data.content)
        if proofread is not None:
            grammar_check, spelling_check = proofread
            result.checks.extend([grammar_check, spelling_check])
            extra_added = True

    if data.ai_content_audit:
        audit_checks = await audit_ai_content(data.content)
        if audit_checks:
            result.checks.extend(audit_checks)
            extra_added = True

    if extra_added:
        result.total_checks = len(result.checks)
        result.pass_count = sum(1 for c in result.checks if c.status == "pass")
        result.fail_count = sum(1 for c in result.checks if c.status == "fail")
        result.warn_count = sum(1 for c in result.checks if c.status == "warn")
        result.score = (
            math.floor(
                ((result.pass_count + result.warn_count * 0.5) / result.total_checks)
                * 100
                + 0.5
            )
            if result.total_checks > 0
            else 0
        )

    # Optional outline comparison
    outline_comparison_dict = None
    outline_text = data.outline.strip() if data.outline else None
    if outline_text:
        comparison = compare_outline(outline_text, data.content)
        ai_analysis = await analyze_outline_followthrough(
            outline=outline_text, content=data.content
        )
        comparison.ai_analysis = ai_analysis
        if ai_analysis is None:
            comparison.ai_reason_unavailable = (
                "Backend chưa cấu hình GEMINI_API_KEY — phân tích "
                "follow-through outline cần Google Gemini."
                if not get_settings().gemini_api_key
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
