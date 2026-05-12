from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.analysis import Analysis
from app.models.user import User
from app.schemas.analysis import AnalysisCreate, AnalysisListItem, AnalysisOut
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
    )

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
