import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordIn,
    LoginIn,
    NotificationPrefs,
    PasswordChange,
    RegisterIn,
    ResetPasswordIn,
    TokenOut,
    UserOut,
    UserUpdate,
)
from app.services.email import render_reset_email, send_email

logger = logging.getLogger(__name__)


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterIn, db: AsyncSession = Depends(get_db)) -> TokenOut:
    existing = await db.scalar(select(User).where(User.email == str(data.email)))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email đã đăng ký",
        )

    user = User(
        email=str(data.email),
        password_hash=hash_password(data.password),
        name=data.name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenOut(access_token=create_access_token(str(user.id)))


@router.post("/login", response_model=TokenOut)
async def login(data: LoginIn, db: AsyncSession = Depends(get_db)) -> TokenOut:
    user = await db.scalar(select(User).where(User.email == str(data.email)))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không đúng",
        )
    return TokenOut(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    if data.email is not None and str(data.email) != current_user.email:
        existing = await db.scalar(
            select(User).where(User.email == str(data.email))
        )
        if existing is not None and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email đã được sử dụng bởi tài khoản khác",
            )
        current_user.email = str(data.email)

    if data.name is not None:
        current_user.name = data.name.strip() or None
    if data.phone is not None:
        current_user.phone = data.phone.strip() or None
    if data.avatar_color is not None:
        current_user.avatar_color = data.avatar_color

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/password/change", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không đúng",
        )
    current_user.password_hash = hash_password(data.new_password)
    await db.commit()


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
async def forgot_password(
    data: ForgotPasswordIn,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Issue a reset token for the email. Always returns 204 to avoid
    leaking whether the email is registered."""
    settings = get_settings()
    user = await db.scalar(select(User).where(User.email == str(data.email)))
    if user is not None:
        raw_token = secrets.token_urlsafe(32)
        user.reset_token_hash = _hash_reset_token(raw_token)
        user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=settings.reset_token_expire_minutes
        )
        await db.commit()

        reset_url = (
            f"{settings.frontend_url.rstrip('/')}/reset-password?token={raw_token}"
        )
        html, text = render_reset_email(reset_url, user.name)
        sent = await send_email(
            to=user.email,
            subject="Đặt lại mật khẩu MindGate",
            html=html,
            text=text,
        )
        if not sent:
            logger.warning(
                "[password-reset] No email service configured. "
                "Reset link for %s: %s",
                user.email, reset_url,
            )
    # Always 204, whether user exists or not.


@router.post("/reset-password", response_model=TokenOut)
async def reset_password(
    data: ResetPasswordIn,
    db: AsyncSession = Depends(get_db),
) -> TokenOut:
    token_hash = _hash_reset_token(data.token)
    user = await db.scalar(
        select(User).where(User.reset_token_hash == token_hash)
    )
    if (
        user is None
        or user.reset_token_expires_at is None
        or user.reset_token_expires_at < datetime.now(timezone.utc)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Link không hợp lệ hoặc đã hết hạn. Hãy yêu cầu lại.",
        )

    user.password_hash = hash_password(data.new_password)
    user.reset_token_hash = None
    user.reset_token_expires_at = None
    await db.commit()
    await db.refresh(user)
    return TokenOut(access_token=create_access_token(str(user.id)))


@router.put("/me/notifications", response_model=UserOut)
async def update_notification_prefs(
    prefs: NotificationPrefs,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    # Force a new dict instance so SQLAlchemy detects the JSONB change.
    current_user.notification_prefs = prefs.model_dump()
    await db.commit()
    await db.refresh(current_user)
    return current_user
