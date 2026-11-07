"""centralize entitlement policy and auditable store grants

Revision ID: 20261102_0011
Revises: 20261102_0010
Create Date: 2026-11-02
"""

import json

from alembic import op
import sqlalchemy as sa

revision = "20261102_0011"
down_revision = "20261102_0010"
branch_labels = None
depends_on = None

# Freeze the 0011 vocabulary inside the migration. Importing application
# policy code would make a historical migration change behavior when a later
# release extends the live registry.
_CAPABILITIES = (
    "inventory.read", "inventory.write", "categories.write", "labels.write",
    "inventory.bulk_edit", "import.xlsx", "export.local", "export.server",
    "catalog.use", "dashboard.analytics", "barcode.lookup", "barcode.manage",
    "label.print", "personnel", "backup", "sync", "media.recovery",
    "invoices.purchase", "invoices.sale",
)
_CAPACITIES = ("inventory_items", "active_personnel", "devices")


def _normalize_0011_policy(features: dict, limits: dict) -> tuple[dict, dict]:
    normalized_features = {key: bool(features.get(key, False)) for key in _CAPABILITIES}
    for key in ("catalog.use", "dashboard.analytics", "sync"):
        if key not in features:
            normalized_features[key] = bool(features.get("inventory.read", False))
    for key in ("media.recovery", "invoices.purchase", "invoices.sale"):
        normalized_features[key] = False
    normalized_limits = {key: limits.get(key) for key in _CAPACITIES}
    if "inventory_items" not in limits:
        normalized_limits["inventory_items"] = 0
    if "active_personnel" not in limits:
        normalized_limits["active_personnel"] = 0
    if "devices" not in limits:
        normalized_limits["devices"] = None
    return normalized_features, normalized_limits


def upgrade() -> None:
    op.add_column("subscription_plans", sa.Column("policy_revision", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("subscription_plans", sa.Column("commercial_status", sa.String(30), nullable=False, server_default="legacy_unapproved"))
    op.create_check_constraint("ck_subscription_plans_revision", "subscription_plans", "policy_revision >= 1")
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, features_json, limits_json FROM subscription_plans FOR UPDATE")).mappings()
    for row in rows:
        try:
            features = json.loads(row["features_json"] or "{}")
            limits = json.loads(row["limits_json"] or "{}")
        except (TypeError, ValueError) as error:
            raise RuntimeError(f"ENTITLEMENT_PREFLIGHT:INVALID_JSON:plan={row['id']}") from error
        if not isinstance(features, dict) or not isinstance(limits, dict):
            raise RuntimeError(f"ENTITLEMENT_PREFLIGHT:INVALID_POLICY:plan={row['id']}")
        normalized_features, normalized_limits = _normalize_0011_policy(features, limits)
        bind.execute(sa.text("""
            UPDATE subscription_plans
            SET features_json=:features, limits_json=:limits,
                commercial_status=:status
            WHERE id=:plan_id
        """), {
            "features": json.dumps(normalized_features),
            "limits": json.dumps(normalized_limits),
            "status": "legacy_only" if row["id"] == "starter" else "legacy_unapproved",
            "plan_id": row["id"],
        })

    op.create_table(
        "store_plan_grants",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("request_id", sa.String(64), nullable=False),
        sa.Column("store_id", sa.BigInteger(), nullable=False),
        sa.Column("plan_id", sa.String(40), nullable=False),
        sa.Column("source", sa.String(40), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("granted_by_user_id", sa.BigInteger(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_by_user_id", sa.BigInteger(), nullable=True),
        sa.Column("revocation_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("ends_at > starts_at", name="ck_store_plan_grants_window"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["plan_id"], ["subscription_plans.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["granted_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["revoked_by_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("request_id", name="uq_store_plan_grants_request"),
    )
    op.create_index("ix_store_plan_grants_store_window", "store_plan_grants", ["store_id", "starts_at", "ends_at"])
    op.create_index("ix_store_plan_grants_plan_id", "store_plan_grants", ["plan_id"])
    op.create_index("ix_store_plan_grants_granted_by_user_id", "store_plan_grants", ["granted_by_user_id"])


def downgrade() -> None:
    op.drop_index("ix_store_plan_grants_granted_by_user_id", table_name="store_plan_grants")
    op.drop_index("ix_store_plan_grants_plan_id", table_name="store_plan_grants")
    op.drop_index("ix_store_plan_grants_store_window", table_name="store_plan_grants")
    op.drop_table("store_plan_grants")
    op.drop_constraint("ck_subscription_plans_revision", "subscription_plans", type_="check")
    op.drop_column("subscription_plans", "commercial_status")
    op.drop_column("subscription_plans", "policy_revision")
