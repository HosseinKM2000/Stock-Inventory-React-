"""Add per-industry tool policy while preserving current availability.

Revision ID: 20261014_0004
Revises: 20261012_0003
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "20261014_0004"
down_revision: str | None = "20261012_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    op.add_column("industries", sa.Column("tools_json", sa.Text(), nullable=True))

def downgrade() -> None:
    op.drop_column("industries", "tools_json")
