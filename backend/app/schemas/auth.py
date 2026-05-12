from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field

from app.schemas._base import CamelModel


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


class UserOut(CamelModel):
    id: UUID
    email: EmailStr
    name: str | None
    created_at: datetime
