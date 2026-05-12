from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise _unauthorized("Not authenticated")

    payload = decode_token(credentials.credentials)
    if payload is None or "sub" not in payload:
        raise _unauthorized("Invalid token")

    try:
        user_id = UUID(payload["sub"])
    except (ValueError, TypeError):
        raise _unauthorized("Invalid token subject") from None

    user = await db.get(User, user_id)
    if user is None:
        raise _unauthorized("User not found")
    return user
