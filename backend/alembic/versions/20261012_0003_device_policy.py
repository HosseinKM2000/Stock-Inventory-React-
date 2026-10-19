"""Add explicit per-user device policy and make built-in plans unlimited.

Revision ID: 20261012_0003
Revises: 20261012_0002
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "20261012_0003"
down_revision: str | None = "20261012_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    op.add_column("users", sa.Column("device_limit_mode", sa.String(20), nullable=False, server_default="inherit"))
    op.add_column("users", sa.Column("device_limit_override", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_users_device_limit_policy", "users",
        "(device_limit_mode IN ('inherit', 'unlimited') AND device_limit_override IS NULL) OR "
        "(device_limit_mode = 'limited' AND device_limit_override > 0)",
    )
    op.execute(sa.text("""
        UPDATE subscription_plans
        SET limits_json = regexp_replace(limits_json, '\"devices\"\\s*:\\s*[0-9]+', '\"devices\": null', 'g')
        WHERE id IN ('free', 'starter', 'pro', 'vip')
    """))

def downgrade() -> None:
    op.drop_constraint("ck_users_device_limit_policy", "users", type_="check")
    op.drop_column("users", "device_limit_override")
    op.drop_column("users", "device_limit_mode")
