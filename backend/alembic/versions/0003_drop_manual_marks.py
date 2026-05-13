"""drop analyses.manual_marks

Manual marks were replaced with configurable rules (Loại C redesign).
Score is computed purely from auto + configurable + heuristic checks now.

Revision ID: 0003_drop_manual_marks
Revises: 0002_manual_marks
Create Date: 2026-05-13

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003_drop_manual_marks"
down_revision: str | None = "0002_manual_marks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("analyses", "manual_marks")


def downgrade() -> None:
    op.add_column(
        "analyses",
        sa.Column(
            "manual_marks",
            postgresql.JSONB(),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )
