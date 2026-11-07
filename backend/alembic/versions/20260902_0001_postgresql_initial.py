"""Create the initial PostgreSQL schema.

Revision ID: 20260902_0001
Revises:
Create Date: 2026-09-02
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260902_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _id_column() -> sa.Column:
    return sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True)


def _created_at() -> sa.Column:
    return sa.Column(
        "created_at",
        sa.DateTime(timezone=True),
        nullable=False,
        server_default=sa.text("CURRENT_TIMESTAMP"),
    )


def upgrade() -> None:
    op.create_table(
        "industries",
        _id_column(),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_industries_name", "industries", ["name"], unique=True)

    op.create_table(
        "subscription_plans",
        sa.Column("id", sa.String(40), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_minor", sa.BigInteger(), nullable=True),
        sa.Column("currency", sa.String(10), nullable=False, server_default="IRR"),
        sa.Column("duration", sa.Integer(), nullable=True),
        sa.Column("duration_unit", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("features_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("limits_json", sa.Text(), nullable=False, server_default="{}"),
        _created_at(),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    op.create_table(
        "users",
        _id_column(),
        sa.Column("first_name", sa.String(120), nullable=False),
        sa.Column("last_name", sa.String(120), nullable=False),
        sa.Column("username", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(40), nullable=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("plan", sa.String(30), nullable=False, server_default="free"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("role", sa.String(20), nullable=False, server_default="USER"),
        sa.Column("is_system_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("system_key", sa.String(80), nullable=True),
        sa.Column("subscription_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("subscription_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("industry_id", sa.BigInteger(), nullable=True),
        _created_at(),
        sa.ForeignKeyConstraint(["industry_id"], ["industries.id"]),
        sa.UniqueConstraint("system_key", name="uq_users_system_key"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_is_system_admin", "users", ["is_system_admin"])
    op.create_index("ix_users_industry_id", "users", ["industry_id"])

    op.create_table(
        "catalog_products",
        _id_column(),
        sa.Column("industry_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("brand", sa.String(120), nullable=True),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("is_packaged", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("pack_size", sa.Integer(), nullable=True),
        sa.Column("is_shared", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        _created_at(),
        sa.CheckConstraint(
            "(NOT is_packaged AND pack_size IS NULL) OR (is_packaged AND pack_size > 0)",
            name="ck_catalog_products_packaging",
        ),
        sa.ForeignKeyConstraint(["industry_id"], ["industries.id"]),
    )
    op.create_index("ix_catalog_products_industry_id", "catalog_products", ["industry_id"])
    op.create_index("ix_catalog_products_name", "catalog_products", ["name"])
    op.create_index("ix_catalog_products_is_shared", "catalog_products", ["is_shared"])
    op.create_index("ix_catalog_products_is_active", "catalog_products", ["is_active"])
    op.create_index(
        "ix_catalog_products_shared_active_industry_created",
        "catalog_products",
        ["is_shared", "is_active", "industry_id", "created_at"],
    )

    op.create_table(
        "admin_audit_logs",
        _id_column(),
        sa.Column("actor_user_id", sa.BigInteger(), nullable=True),
        sa.Column("target_user_id", sa.BigInteger(), nullable=True),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        _created_at(),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
    )
    op.create_index("ix_admin_audit_logs_actor_user_id", "admin_audit_logs", ["actor_user_id"])
    op.create_index("ix_admin_audit_logs_target_user_id", "admin_audit_logs", ["target_user_id"])
    op.create_index("ix_admin_audit_logs_action", "admin_audit_logs", ["action"])
    op.create_index("ix_admin_audit_logs_created_at", "admin_audit_logs", ["created_at"])

    op.create_table(
        "categories",
        _id_column(),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        _created_at(),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint("user_id", "name", name="uq_categories_user_name"),
    )
    op.create_index("ix_categories_user_id", "categories", ["user_id"])

    op.create_table(
        "custom_products",
        _id_column(),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("quantity", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("price", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("note", sa.Text(), nullable=True),
        _created_at(),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_custom_products_user_id", "custom_products", ["user_id"])

    op.create_table(
        "sync_changes",
        _id_column(),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("entity", sa.String(40), nullable=False),
        sa.Column("entity_id", sa.BigInteger(), nullable=False),
        sa.Column("operation", sa.String(20), nullable=False),
        sa.Column("payload", sa.Text(), nullable=True),
        _created_at(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_sync_changes_user_id", "sync_changes", ["user_id"])
    op.create_index("ix_sync_changes_entity", "sync_changes", ["entity"])
    op.create_index("ix_sync_changes_entity_id", "sync_changes", ["entity_id"])
    op.create_index("ix_sync_changes_user_cursor", "sync_changes", ["user_id", "id"])

    op.create_table(
        "sync_operations",
        _id_column(),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("operation_id", sa.String(64), nullable=False),
        sa.Column("result_payload", sa.Text(), nullable=False),
        _created_at(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.UniqueConstraint("user_id", "operation_id", name="uq_sync_user_operation"),
    )
    op.create_index("ix_sync_operations_user_id", "sync_operations", ["user_id"])
    op.create_index("ix_sync_operations_operation_id", "sync_operations", ["operation_id"])

    op.create_table(
        "user_sessions",
        _id_column(),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("device_fingerprint", sa.String(255), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        _created_at(),
        sa.Column(
            "last_seen",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])
    op.create_index("ix_user_sessions_device_fingerprint", "user_sessions", ["device_fingerprint"])
    op.create_index(
        "ix_user_sessions_user_fingerprint_active",
        "user_sessions",
        ["user_id", "device_fingerprint", "is_active"],
    )

    op.create_table(
        "inventory_items",
        _id_column(),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("catalog_product_id", sa.BigInteger(), nullable=False),
        sa.Column("category_id", sa.BigInteger(), nullable=True),
        sa.Column("quantity", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("price", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("is_catalog_backed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("custom_label", sa.String(200), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("low_stock_threshold", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("low_stock_alert", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        _created_at(),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint("quantity >= 0", name="ck_inventory_items_quantity"),
        sa.CheckConstraint("price >= 0", name="ck_inventory_items_price"),
        sa.CheckConstraint(
            "low_stock_threshold >= 0",
            name="ck_inventory_items_low_stock_threshold",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["catalog_product_id"], ["catalog_products.id"]),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.UniqueConstraint(
            "user_id",
            "catalog_product_id",
            name="uq_inventory_items_user_catalog",
        ),
    )
    op.create_index("ix_inventory_items_user_id", "inventory_items", ["user_id"])
    op.create_index("ix_inventory_items_catalog_product_id", "inventory_items", ["catalog_product_id"])
    op.create_index("ix_inventory_items_category_id", "inventory_items", ["category_id"])
    op.create_index("ix_inventory_items_is_catalog_backed", "inventory_items", ["is_catalog_backed"])
    op.create_index(
        "ix_inventory_items_user_visibility_created",
        "inventory_items",
        ["user_id", "deleted_at", "is_hidden", "created_at"],
    )

    op.create_table(
        "inventory_transactions",
        _id_column(),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("inventory_item_id", sa.BigInteger(), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("quantity", sa.BigInteger(), nullable=False),
        sa.Column("before_quantity", sa.BigInteger(), nullable=False),
        sa.Column("after_quantity", sa.BigInteger(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        _created_at(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["inventory_item_id"], ["inventory_items.id"]),
    )
    op.create_index("ix_inventory_transactions_user_id", "inventory_transactions", ["user_id"])
    op.create_index(
        "ix_inventory_transactions_inventory_item_id",
        "inventory_transactions",
        ["inventory_item_id"],
    )


def downgrade() -> None:
    op.drop_table("inventory_transactions")
    op.drop_table("inventory_items")
    op.drop_table("user_sessions")
    op.drop_table("sync_operations")
    op.drop_table("sync_changes")
    op.drop_table("custom_products")
    op.drop_table("categories")
    op.drop_table("admin_audit_logs")
    op.drop_table("catalog_products")
    op.drop_table("users")
    op.drop_table("subscription_plans")
    op.drop_table("industries")
