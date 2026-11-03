"""allow profile names to be completed after signup

Revision ID: 20261103_0012
Revises: 20261102_0011
Create Date: 2026-11-03
"""

from alembic import op
import sqlalchemy as sa

revision = "20261103_0012"
down_revision = "20261102_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "first_name", existing_type=sa.String(120), nullable=True)
    op.alter_column("users", "last_name", existing_type=sa.String(120), nullable=True)


def downgrade() -> None:
    connection = op.get_bind()
    missing = connection.execute(sa.text(
        "SELECT id FROM users WHERE first_name IS NULL OR last_name IS NULL ORDER BY id LIMIT 20"
    )).scalars().all()
    if missing:
        raise RuntimeError(f"PROFILE_NAME_PREFLIGHT:user_ids={','.join(map(str, missing))}")
    op.alter_column("users", "last_name", existing_type=sa.String(120), nullable=False)
    op.alter_column("users", "first_name", existing_type=sa.String(120), nullable=False)
