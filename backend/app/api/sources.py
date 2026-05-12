from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.sources import GoogleDocsIn, GoogleDocsOut
from app.services.google_docs import fetch_text

router = APIRouter(prefix="/sources", tags=["sources"])


@router.post("/google-docs", response_model=GoogleDocsOut)
async def fetch_google_docs(
    data: GoogleDocsIn,
    _user: User = Depends(get_current_user),
) -> GoogleDocsOut:
    title, text = await fetch_text(data.url)
    return GoogleDocsOut(title=title, text=text)
