"""add analyses.outline + analyses.outline_comparison

Revision ID: 0004_outline_columns
Revises: 0003_drop_manual_marks
Create Date: 2026-05-13

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004_outline_columns"
down_revision: str | None = "0003_drop_manual_marks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("analyses", sa.Column("outline", sa.Text(), nullable=True))
    op.add_column(
        "analyses",
        sa.Column("outline_comparison", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("analyses", "outline_comparison")
    op.drop_column("analyses", "outline")
