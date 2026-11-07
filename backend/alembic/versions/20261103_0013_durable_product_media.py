"""add durable store-scoped product media

Revision ID: 20261103_0013
Revises: 20261103_0012
Create Date: 2026-11-03
"""

from alembic import op
import sqlalchemy as sa


revision = "20261103_0013"
down_revision = "20261103_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "media_assets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("store_id", sa.BigInteger(), nullable=False),
        sa.Column("actor_user_id", sa.BigInteger(), nullable=False),
        sa.Column("transfer_id", sa.String(36), nullable=False),
        sa.Column("content_sha256", sa.String(64), nullable=False),
        sa.Column("storage_key", sa.String(500), nullable=False),
        sa.Column("mime_type", sa.String(80), nullable=False),
        sa.Column("byte_size", sa.BigInteger(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
        sa.UniqueConstraint("store_id", "actor_user_id", "transfer_id", name="uq_media_assets_store_actor_transfer"),
    )
    op.create_index("ix_media_assets_store_id", "media_assets", ["store_id"])
    op.create_index("ix_media_assets_actor_user_id", "media_assets", ["actor_user_id"])
    op.create_index("ix_media_assets_store_created", "media_assets", ["store_id", "created_at"])
    op.add_column("inventory_items", sa.Column("media_asset_id", sa.String(36), nullable=True))
    op.create_index("ix_inventory_items_media_asset_id", "inventory_items", ["media_asset_id"])
    op.create_foreign_key(
        "fk_inventory_items_media_asset",
        "inventory_items", "media_assets", ["media_asset_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_inventory_items_media_asset", "inventory_items", type_="foreignkey")
    op.drop_index("ix_inventory_items_media_asset_id", table_name="inventory_items")
    op.drop_column("inventory_items", "media_asset_id")
    op.drop_index("ix_media_assets_store_created", table_name="media_assets")
    op.drop_index("ix_media_assets_actor_user_id", table_name="media_assets")
    op.drop_index("ix_media_assets_store_id", table_name="media_assets")
    op.drop_table("media_assets")
