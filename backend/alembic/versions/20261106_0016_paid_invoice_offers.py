"""approve paid invoice access and add explicit paid offer configuration

Revision ID: 20261106_0016
Revises: 20261104_0015
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "20261106_0016"
down_revision = "20261104_0015"
branch_labels = None
depends_on = None


def _set_invoice_allocation(enabled_by_plan: dict[str, bool]) -> None:
    connection = op.get_bind()
    rows = connection.execute(sa.text(
        "SELECT id, features_json FROM subscription_plans WHERE id IN ('free','starter','pro','vip')"
    )).mappings()
    for row in rows:
        features = json.loads(row["features_json"] or "{}")
        enabled = enabled_by_plan[row["id"]]
        features["invoices.purchase"] = enabled
        features["invoices.sale"] = enabled
        connection.execute(
            sa.text("UPDATE subscription_plans SET features_json=:features WHERE id=:id"),
            {"features": json.dumps(features, separators=(",", ":")), "id": row["id"]},
        )


def upgrade() -> None:
    op.add_column(
        "subscription_plans",
        sa.Column("is_offer_available", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_check_constraint(
        "ck_subscription_plans_price_toman_storage",
        "subscription_plans",
        "price_minor IS NULL OR (price_minor >= 0 AND MOD(price_minor, 10) = 0)",
    )
    op.create_check_constraint(
        "ck_subscription_plans_duration_pair",
        "subscription_plans",
        "(duration IS NULL AND duration_unit IS NULL) OR "
        "(duration > 0 AND duration_unit IN ('day','month','year'))",
    )
    op.create_check_constraint(
        "ck_subscription_plans_offer_complete",
        "subscription_plans",
        "NOT is_offer_available OR (id IN ('pro','vip') "
        "AND price_minor IS NOT NULL AND price_minor > 0 "
        "AND duration IS NOT NULL AND duration > 0 "
        "AND duration_unit IS NOT NULL AND duration_unit IN ('day','month','year'))",
    )
    _set_invoice_allocation({"free": False, "starter": False, "pro": True, "vip": True})
    # Remove only untouched illustrative 30-day terms. Explicit administrator
    # configuration (a revised policy or a non-null price) is preserved.
    op.execute(sa.text(
        "UPDATE subscription_plans SET duration=NULL, duration_unit=NULL "
        "WHERE id IN ('pro','vip') AND policy_revision=1 "
        "AND commercial_status='legacy_unapproved' AND price_minor IS NULL "
        "AND duration=30 AND duration_unit='day'"
    ))


def downgrade() -> None:
    _set_invoice_allocation({"free": False, "starter": False, "pro": False, "vip": False})
    op.drop_constraint("ck_subscription_plans_offer_complete", "subscription_plans", type_="check")
    op.drop_constraint("ck_subscription_plans_duration_pair", "subscription_plans", type_="check")
    op.drop_constraint("ck_subscription_plans_price_toman_storage", "subscription_plans", type_="check")
    op.drop_column("subscription_plans", "is_offer_available")
