"""add immutable atomic purchase and sale invoices

Revision ID: 20261104_0015
Revises: 20261104_0014
"""

from alembic import op
import sqlalchemy as sa


revision = "20261104_0015"
down_revision = "20261104_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "invoices",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("store_id", sa.BigInteger(), nullable=False),
        sa.Column("actor_user_id", sa.BigInteger(), nullable=False),
        sa.Column("actor_membership_id", sa.BigInteger(), nullable=False),
        sa.Column("invoice_type", sa.String(12), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("counterparty", sa.String(200), nullable=True),
        sa.Column("status", sa.String(12), nullable=False, server_default="posted"),
        sa.Column("total_amount", sa.BigInteger(), nullable=False),
        sa.Column("post_operation_id", sa.String(64), nullable=False),
        sa.Column("cancel_operation_id", sa.String(64), nullable=True),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_by_user_id", sa.BigInteger(), nullable=True),
        sa.Column("cancelled_by_membership_id", sa.BigInteger(), nullable=True),
        sa.CheckConstraint("invoice_type IN ('purchase', 'sale')", name="ck_invoices_type"),
        sa.CheckConstraint("status IN ('posted', 'cancelled')", name="ck_invoices_status"),
        sa.CheckConstraint("total_amount >= 0", name="ck_invoices_total_nonnegative"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["actor_membership_id"], ["store_memberships.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["cancelled_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["cancelled_by_membership_id"], ["store_memberships.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("store_id", "post_operation_id", name="uq_invoices_store_post_operation"),
        sa.UniqueConstraint("store_id", "cancel_operation_id", name="uq_invoices_store_cancel_operation"),
        sa.UniqueConstraint("id", "store_id", name="uq_invoices_id_store"),
    )
    op.create_index("ix_invoices_store_id", "invoices", ["store_id"])
    op.create_index("ix_invoices_actor_user_id", "invoices", ["actor_user_id"])
    op.create_index("ix_invoices_invoice_type", "invoices", ["invoice_type"])
    op.create_index("ix_invoices_status", "invoices", ["status"])
    op.create_index("ix_invoices_store_posted", "invoices", ["store_id", "posted_at"])

    op.create_table(
        "invoice_lines",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("invoice_id", sa.BigInteger(), nullable=False),
        sa.Column("store_id", sa.BigInteger(), nullable=False),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("product_name", sa.String(200), nullable=False),
        sa.Column("quantity", sa.BigInteger(), nullable=False),
        sa.Column("unit", sa.String(40), nullable=False),
        sa.Column("pack_size", sa.Integer(), nullable=True),
        sa.Column("base_quantity", sa.BigInteger(), nullable=False),
        sa.Column("unit_price", sa.BigInteger(), nullable=False),
        sa.Column("line_total", sa.BigInteger(), nullable=False),
        sa.Column("before_quantity", sa.BigInteger(), nullable=False),
        sa.Column("after_quantity", sa.BigInteger(), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_invoice_lines_quantity_positive"),
        sa.CheckConstraint("base_quantity > 0", name="ck_invoice_lines_base_quantity_positive"),
        sa.CheckConstraint("unit_price >= 0", name="ck_invoice_lines_price_nonnegative"),
        sa.CheckConstraint("line_total >= 0", name="ck_invoice_lines_total_nonnegative"),
        sa.ForeignKeyConstraint(["invoice_id", "store_id"], ["invoices.id", "invoices.store_id"], name="fk_invoice_lines_invoice_store", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id", "store_id"], ["inventory_items.id", "inventory_items.store_id"], name="fk_invoice_lines_product_store", ondelete="RESTRICT"),
        sa.UniqueConstraint("invoice_id", "product_id", name="uq_invoice_lines_invoice_product"),
        sa.UniqueConstraint("id", "store_id", name="uq_invoice_lines_id_store"),
    )
    op.create_index("ix_invoice_lines_invoice_id", "invoice_lines", ["invoice_id"])
    op.create_index("ix_invoice_lines_store_id", "invoice_lines", ["store_id"])
    op.create_index("ix_invoice_lines_product_id", "invoice_lines", ["product_id"])

    op.add_column("inventory_movements", sa.Column("invoice_id", sa.BigInteger(), nullable=True))
    op.add_column("inventory_movements", sa.Column("invoice_line_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key("fk_inventory_movements_invoice_store", "inventory_movements", "invoices", ["invoice_id", "store_id"], ["id", "store_id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_inventory_movements_invoice_line_store", "inventory_movements", "invoice_lines", ["invoice_line_id", "store_id"], ["id", "store_id"], ondelete="RESTRICT")
    op.create_index("ix_inventory_movements_invoice_id", "inventory_movements", ["invoice_id"])
    op.create_index("ix_inventory_movements_invoice_line_id", "inventory_movements", ["invoice_line_id"])


def downgrade() -> None:
    op.drop_index("ix_inventory_movements_invoice_line_id", table_name="inventory_movements")
    op.drop_index("ix_inventory_movements_invoice_id", table_name="inventory_movements")
    op.drop_constraint("fk_inventory_movements_invoice_line_store", "inventory_movements", type_="foreignkey")
    op.drop_constraint("fk_inventory_movements_invoice_store", "inventory_movements", type_="foreignkey")
    op.drop_column("inventory_movements", "invoice_line_id")
    op.drop_column("inventory_movements", "invoice_id")
    op.drop_table("invoice_lines")
    op.drop_table("invoices")
