"""persist canonical sync operation fingerprints

Revision ID: 20261101_0008
Revises: 20261017_0007
"""

from alembic import op
import sqlalchemy as sa


revision = "20261101_0008"
down_revision = "20261017_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Historical rows remain NULL because their original semantic request is
    # unavailable. Replays of those rows are rejected conservatively.
    op.add_column(
        "sync_operations",
        sa.Column("request_fingerprint", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sync_operations", "request_fingerprint")
