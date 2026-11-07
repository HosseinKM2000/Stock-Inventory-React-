"""Store workspaces, personnel roles, permissions, and activity.

Revision ID: 20261015_0005
Revises: 20261014_0004
"""
from collections.abc import Sequence
import json

from alembic import op
import sqlalchemy as sa

revision: str = "20261015_0005"
down_revision: str | None = "20261014_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "stores",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("owner_user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, unique=True),
        sa.Column("plan", sa.String(30), nullable=False, server_default="free"),
        sa.Column("subscription_started_at", sa.DateTime(timezone=True)),
        sa.Column("subscription_expires_at", sa.DateTime(timezone=True)),
        sa.Column("personnel_limit_override", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_stores_owner_user_id", "stores", ["owner_user_id"], unique=True)
    op.create_table(
        "store_roles",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger(), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("permissions_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("store_id", "name", name="uq_store_roles_store_name"),
    )
    op.create_index("ix_store_roles_store_id", "store_roles", ["store_id"])
    op.create_table(
        "store_memberships",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger(), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("role_id", sa.BigInteger(), sa.ForeignKey("store_roles.id", ondelete="RESTRICT")),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("is_owner", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("temporary_password_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("credentials_notice_viewed_at", sa.DateTime(timezone=True)),
        sa.Column("authorization_checked_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("store_id", "user_id", name="uq_store_memberships_store_user"),
        sa.CheckConstraint("status IN ('active', 'inactive')", name="ck_store_memberships_status"),
        sa.CheckConstraint("(is_owner AND role_id IS NULL) OR (NOT is_owner AND role_id IS NOT NULL)", name="ck_store_memberships_owner_role"),
    )
    for column in ("store_id", "user_id", "role_id", "status"):
        op.create_index(f"ix_store_memberships_{column}", "store_memberships", [column])
    op.create_table(
        "store_activity",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("store_id", sa.BigInteger(), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_user_id", sa.BigInteger(), nullable=False),
        sa.Column("actor_membership_id", sa.BigInteger(), nullable=False),
        sa.Column("actor_display_name", sa.String(250), nullable=False),
        sa.Column("actor_role_name", sa.String(100), nullable=False),
        sa.Column("operation_id", sa.String(80), nullable=False),
        sa.Column("target_entity", sa.String(50), nullable=False),
        sa.Column("target_id", sa.String(80)),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("before_json", sa.Text()), sa.Column("after_json", sa.Text()),
        sa.Column("outcome", sa.String(20), nullable=False),
        sa.Column("client_occurred_at", sa.DateTime(timezone=True)),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("store_id", "operation_id", name="uq_store_activity_operation"),
    )
    op.create_index("ix_store_activity_store_accepted", "store_activity", ["store_id", "accepted_at"])
    op.create_index("ix_store_activity_actor_user_id", "store_activity", ["actor_user_id"])
    op.create_index("ix_store_activity_actor_membership_id", "store_activity", ["actor_membership_id"])
    op.create_index("ix_store_activity_target_entity", "store_activity", ["target_entity"])
    op.create_index("ix_store_activity_action", "store_activity", ["action"])
    op.create_index("ix_store_activity_outcome", "store_activity", ["outcome"])

    # System/service identities deliberately do not become customer workspaces.
    op.execute(sa.text("""
        INSERT INTO stores (name, owner_user_id, plan, subscription_started_at, subscription_expires_at)
        SELECT TRIM(first_name || ' ' || last_name), id, plan, subscription_started_at, subscription_expires_at
        FROM users WHERE is_system_admin = false AND system_key IS NULL
    """))
    op.execute(sa.text("""
        INSERT INTO store_memberships (store_id, user_id, status, is_owner, authorization_checked_at)
        SELECT s.id, s.owner_user_id, 'active', true, CURRENT_TIMESTAMP FROM stores s
    """))
    templates = {
        "سرپرست": ["products.view", "products.create", "products.edit", "products.quantity.change", "products.price.change", "categories.manage", "labels.manage", "products.bulk", "dashboard.view", "tools.import", "tools.export", "tools.catalog"],
        "اپراتور موجودی": ["products.view", "products.create", "products.edit", "products.quantity.change", "categories.manage", "labels.manage", "dashboard.view"],
        "ویرایشگر قیمت": ["products.view", "products.price.change", "dashboard.view"],
        "مشاهده‌گر": ["products.view", "dashboard.view"],
    }
    connection = op.get_bind()
    stores = connection.execute(sa.text("SELECT id FROM stores")).fetchall()
    for (store_id,) in stores:
        for name, permissions in templates.items():
            connection.execute(sa.text("INSERT INTO store_roles (store_id, name, permissions_json, created_at, updated_at) VALUES (:store_id, :name, :permissions, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"), {"store_id": store_id, "name": name, "permissions": json.dumps(permissions)})

    for table in ("inventory_items", "categories", "labels", "custom_products", "inventory_transactions", "sync_operations", "sync_changes"):
        op.add_column(table, sa.Column("store_id", sa.BigInteger(), nullable=True))
        op.create_foreign_key(f"fk_{table}_store", table, "stores", ["store_id"], ["id"], ondelete="CASCADE")
        op.create_index(f"ix_{table}_store_id", table, ["store_id"])
        op.execute(sa.text(f"UPDATE {table} t SET store_id = s.id FROM stores s WHERE t.user_id = s.owner_user_id"))
        # Compatibility window: migrated rows are populated immediately, while
        # one older PWA release may still create legacy-shaped rows. The API
        # never authorizes by NULL; the column becomes NOT NULL after that
        # controlled-update window closes.
    op.add_column("sync_operations", sa.Column("actor_user_id", sa.BigInteger(), nullable=True))
    op.add_column("sync_changes", sa.Column("actor_user_id", sa.BigInteger(), nullable=True))
    op.add_column("inventory_transactions", sa.Column("actor_user_id", sa.BigInteger(), nullable=True))
    op.execute(sa.text("UPDATE sync_operations SET actor_user_id = user_id"))
    op.execute(sa.text("UPDATE sync_changes SET actor_user_id = user_id"))
    op.execute(sa.text("UPDATE inventory_transactions SET actor_user_id = user_id"))

    # Existing plan rows gain configuration-driven personnel policy.
    for plan_id, enabled, limit in (("free", False, 0), ("starter", False, 0), ("pro", False, 0), ("vip", True, 10)):
        row = connection.execute(sa.text("SELECT features_json, limits_json FROM subscription_plans WHERE id=:id"), {"id": plan_id}).fetchone()
        if row:
            features, limits = json.loads(row[0] or "{}"), json.loads(row[1] or "{}")
            features["personnel"], limits["active_personnel"] = enabled, limit
            connection.execute(sa.text("UPDATE subscription_plans SET features_json=:features, limits_json=:limits WHERE id=:id"), {"features": json.dumps(features), "limits": json.dumps(limits), "id": plan_id})


def downgrade() -> None:
    for table in ("inventory_transactions", "sync_changes", "sync_operations"):
        op.drop_column(table, "actor_user_id")
    for table in reversed(("inventory_items", "categories", "labels", "custom_products", "inventory_transactions", "sync_operations", "sync_changes")):
        op.drop_index(f"ix_{table}_store_id", table_name=table)
        op.drop_constraint(f"fk_{table}_store", table, type_="foreignkey")
        op.drop_column(table, "store_id")
    op.drop_table("store_activity")
    op.drop_table("store_memberships")
    op.drop_table("store_roles")
    op.drop_table("stores")
