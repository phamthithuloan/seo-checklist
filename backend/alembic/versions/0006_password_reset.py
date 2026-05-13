"""add reset_token_hash + reset_token_expires_at to users

Revision ID: 0006_password_reset
Revises: 0005_user_settings
Create Date: 2026-05-13

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006_password_reset"
down_revision: str | None = "0005_user_settings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("reset_token_hash", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "reset_token_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "reset_token_expires_at")
    op.drop_column("users", "reset_token_hash")
