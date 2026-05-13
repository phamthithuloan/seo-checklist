from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.sources import GoogleDocsIn, GoogleDocsOut, UrlIn, UrlOut
from app.services.google_docs import fetch_text
from app.services.web_fetcher import fetch_url_as_markdown

router = APIRouter(prefix="/sources", tags=["sources"])


@router.post("/google-docs", response_model=GoogleDocsOut)
async def fetch_google_docs(
    data: GoogleDocsIn,
    _user: User = Depends(get_current_user),
) -> GoogleDocsOut:
    title, text = await fetch_text(data.url)
    return GoogleDocsOut(title=title, text=text)


@router.post("/url", response_model=UrlOut)
async def fetch_generic_url(
    data: UrlIn,
    _user: User = Depends(get_current_user),
) -> UrlOut:
    """Fetch any public HTTP(S) URL and return Markdown for SEO analysis."""
    title, text = await fetch_url_as_markdown(data.url)
    return UrlOut(title=title, text=text)
