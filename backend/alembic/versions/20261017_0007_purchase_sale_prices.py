"""add optional purchase and sale prices

Revision ID: 20261017_0007
Revises: 20261017_0006
"""

from alembic import op
import sqlalchemy as sa


revision = "20261017_0007"
down_revision = "20261017_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("inventory_items", sa.Column("sale_price", sa.BigInteger(), nullable=True))
    op.add_column("inventory_items", sa.Column("purchase_price", sa.BigInteger(), nullable=True))
    op.execute("UPDATE inventory_items SET sale_price = price")
    op.create_check_constraint("ck_inventory_items_sale_price", "inventory_items", "sale_price IS NULL OR sale_price >= 0")
    op.create_check_constraint("ck_inventory_items_purchase_price", "inventory_items", "purchase_price IS NULL OR purchase_price >= 0")


def downgrade() -> None:
    op.drop_constraint("ck_inventory_items_purchase_price", "inventory_items", type_="check")
    op.drop_constraint("ck_inventory_items_sale_price", "inventory_items", type_="check")
    op.drop_column("inventory_items", "purchase_price")
    op.drop_column("inventory_items", "sale_price")
