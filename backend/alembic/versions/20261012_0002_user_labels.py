"""Add user-owned labels and inventory associations.

Revision ID: 20261012_0002
Revises: 20260902_0001
"""
from collections.abc import Sequence
from alembic import op
import sqlalchemy as sa

revision: str = "20261012_0002"
down_revision: str | None = "20260902_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    op.create_table(
        "labels",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("normalized_name", sa.String(60), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "normalized_name", name="uq_labels_user_normalized_name"),
    )
    op.create_index("ix_labels_user_id", "labels", ["user_id"])
    op.create_table(
        "inventory_item_labels",
        sa.Column("inventory_item_id", sa.BigInteger(), nullable=False),
        sa.Column("label_id", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(["inventory_item_id"], ["inventory_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["label_id"], ["labels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("inventory_item_id", "label_id"),
    )
    op.create_index("ix_inventory_item_labels_label_id", "inventory_item_labels", ["label_id"])

def downgrade() -> None:
    op.drop_table("inventory_item_labels")
    op.drop_table("labels")
