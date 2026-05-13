"""add users.phone, users.avatar_color, users.notification_prefs

Revision ID: 0005_user_settings
Revises: 0004_outline_columns
Create Date: 2026-05-13

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0005_user_settings"
down_revision: str | None = "0004_outline_columns"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_DEFAULT_PREFS = {
    "email_enabled": True,
    "push_enabled": False,
    "analysis_done": True,
    "weekly_report": False,
    "critical_errors": True,
    "product_news": False,
}


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(length=32), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "avatar_color",
            sa.String(length=16),
            nullable=False,
            server_default="emerald",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "notification_prefs",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text(
                "'"
                + (
                    '{"email_enabled": true, "push_enabled": false, '
                    '"analysis_done": true, "weekly_report": false, '
                    '"critical_errors": true, "product_news": false}'
                )
                + "'::jsonb"
            ),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "notification_prefs")
    op.drop_column("users", "avatar_color")
    op.drop_column("users", "phone")
