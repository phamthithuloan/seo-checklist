from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import EmailStr, Field

from app.schemas._base import CamelModel

AvatarColor = Literal[
    "emerald", "sky", "violet", "rose", "amber", "indigo", "slate", "teal"
]


class RegisterIn(CamelModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=120)


class LoginIn(CamelModel):
    email: EmailStr
    password: str


class TokenOut(CamelModel):
    access_token: str
    token_type: str = "bearer"


class NotificationPrefs(CamelModel):
    email_enabled: bool = True
    push_enabled: bool = False
    analysis_done: bool = True
    weekly_report: bool = False
    critical_errors: bool = True
    product_news: bool = False


class UserOut(CamelModel):
    id: UUID
    email: EmailStr
    name: str | None
    phone: str | None = None
    avatar_color: AvatarColor = "emerald"
    notification_prefs: NotificationPrefs = NotificationPrefs()
    created_at: datetime


class UserUpdate(CamelModel):
    """PATCH /me — all fields optional."""

    name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    avatar_color: AvatarColor | None = None


class PasswordChange(CamelModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
