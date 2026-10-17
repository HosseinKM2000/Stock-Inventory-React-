"""store barcodes and idempotent inventory movements

Revision ID: 20261017_0006
Revises: 20261015_0005
"""

from alembic import op
import sqlalchemy as sa


revision = "20261017_0006"
down_revision = "20261015_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "product_barcodes",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("store_id", sa.BigInteger(), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("inventory_item_id", sa.BigInteger(), sa.ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("value", sa.String(64), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("symbology", sa.String(20), nullable=False, server_default="code128"),
        sa.Column("meaning", sa.String(20), nullable=False, server_default="unit"),
        sa.Column("scan_quantity", sa.BigInteger(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("source IN ('manufacturer', 'tanzim')", name="ck_product_barcodes_source"),
        sa.CheckConstraint("meaning IN ('unit', 'package')", name="ck_product_barcodes_meaning"),
        sa.CheckConstraint("scan_quantity > 0", name="ck_product_barcodes_scan_quantity"),
        sa.UniqueConstraint("store_id", "value", name="uq_product_barcodes_store_value"),
    )
    op.create_index("ix_product_barcodes_store_id", "product_barcodes", ["store_id"])
    op.create_index("ix_product_barcodes_inventory_item_id", "product_barcodes", ["inventory_item_id"])
    op.create_index("ix_product_barcodes_store_active_value", "product_barcodes", ["store_id", "is_active", "value"])

    op.create_table(
        "inventory_movements",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("store_id", sa.BigInteger(), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.BigInteger(), sa.ForeignKey("inventory_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("actor_membership_id", sa.BigInteger(), sa.ForeignKey("store_memberships.id"), nullable=False),
        sa.Column("operation_id", sa.String(64), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("delta", sa.BigInteger(), nullable=False),
        sa.Column("correction_quantity", sa.BigInteger(), nullable=True),
        sa.Column("scan_source", sa.String(20), nullable=False),
        sa.Column("barcode_id", sa.BigInteger(), sa.ForeignKey("product_barcodes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("barcode_value", sa.String(64), nullable=True),
        sa.Column("scan_quantity", sa.BigInteger(), nullable=False, server_default="1"),
        sa.Column("before_quantity", sa.BigInteger(), nullable=False),
        sa.Column("after_quantity", sa.BigInteger(), nullable=False),
        sa.Column("reverses_operation_id", sa.String(64), nullable=True),
        sa.Column("client_occurred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("kind IN ('receive', 'issue', 'correction', 'reversal')", name="ck_inventory_movements_kind"),
        sa.CheckConstraint("delta <> 0", name="ck_inventory_movements_delta"),
        sa.CheckConstraint("before_quantity >= 0 AND after_quantity >= 0", name="ck_inventory_movements_nonnegative"),
        sa.UniqueConstraint("store_id", "operation_id", name="uq_inventory_movements_store_operation"),
        sa.UniqueConstraint("store_id", "reverses_operation_id", name="uq_inventory_movements_store_reversal"),
    )
    op.create_index("ix_inventory_movements_store_id", "inventory_movements", ["store_id"])
    op.create_index("ix_inventory_movements_product_id", "inventory_movements", ["product_id"])
    op.create_index("ix_inventory_movements_actor_user_id", "inventory_movements", ["actor_user_id"])
    op.create_index("ix_inventory_movements_actor_membership_id", "inventory_movements", ["actor_membership_id"])


def downgrade() -> None:
    op.drop_table("inventory_movements")
    op.drop_table("product_barcodes")
