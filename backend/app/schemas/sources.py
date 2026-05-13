from pydantic import Field

from app.schemas._base import CamelModel


class GoogleDocsIn(CamelModel):
    url: str = Field(min_length=1, max_length=2048)


class GoogleDocsOut(CamelModel):
    title: str | None
    text: str


class UrlIn(CamelModel):
    url: str = Field(min_length=1, max_length=2048)


class UrlOut(CamelModel):
    title: str | None
    text: str
