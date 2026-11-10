"""add store-scoped online counterparties and invoice references

Revision ID: 20261110_0018
Revises: 20261107_0017
"""

from alembic import op
import sqlalchemy as sa


revision = "20261110_0018"
down_revision = "20261107_0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "counterparties",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger(), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False, server_default="person"),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("address", sa.String(length=300), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("kind IN ('person', 'organization')", name="ck_counterparties_kind"),
        sa.UniqueConstraint("id", "store_id", name="uq_counterparties_id_store"),
    )
    op.create_index("ix_counterparties_store_id", "counterparties", ["store_id"])
    op.create_index("ix_counterparties_store_name", "counterparties", ["store_id", "name"])
    op.add_column("invoices", sa.Column("counterparty_id", sa.BigInteger(), nullable=True))
    op.create_index("ix_invoices_counterparty_id", "invoices", ["counterparty_id"])
    op.create_foreign_key(
        "fk_invoices_counterparty",
        "invoices",
        "counterparties",
        ["counterparty_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_invoices_counterparty", "invoices", type_="foreignkey")
    op.drop_index("ix_invoices_counterparty_id", table_name="invoices")
    op.drop_column("invoices", "counterparty_id")
    op.drop_index("ix_counterparties_store_name", table_name="counterparties")
    op.drop_index("ix_counterparties_store_id", table_name="counterparties")
    op.drop_table("counterparties")
