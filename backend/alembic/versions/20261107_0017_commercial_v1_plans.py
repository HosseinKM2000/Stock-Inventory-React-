"""apply the final Commercial V1 plan catalog without deleting customer data

Revision ID: 20261107_0017
Revises: 20261106_0016
"""

import json

from alembic import op
import sqlalchemy as sa


revision = "20261107_0017"
down_revision = "20261106_0016"
branch_labels = None
depends_on = None


CAPABILITIES = (
    "inventory.read", "inventory.write", "categories.write", "labels.write",
    "inventory.bulk_edit", "import.xlsx", "export.local", "export.server",
    "catalog.use", "dashboard.analytics", "barcode.lookup", "barcode.manage",
    "label.print", "personnel", "backup", "sync", "media.recovery",
    "invoices.purchase", "invoices.sale",
)


def _features(*, cloud: bool, personnel: bool) -> dict[str, bool]:
    value = {key: True for key in CAPABILITIES}
    value["export.server"] = cloud
    value["sync"] = cloud
    value["personnel"] = personnel
    value["media.recovery"] = False
    return value


PLANS = {
    "free": {
        "name": "رایگان", "description": "ابزارهای کامل محلی برای شروع؛ همگام‌سازی و همکاری تیمی در طرح‌های پولی است.",
        "price_minor": 0, "duration": None, "duration_unit": None,
        "features": _features(cloud=False, personnel=False),
        "limits": {"inventory_items": 200, "catalog_items": 100, "active_personnel": 0, "devices": None},
    },
    "personal": {
        "name": "شخصی", "description": "برای یک مالک با همگام‌سازی ابری روی دستگاه‌های شخصی.",
        "price_minor": 4_900_000, "duration": 1, "duration_unit": "month",
        "features": _features(cloud=True, personnel=False),
        "limits": {"inventory_items": 3000, "catalog_items": 1000, "active_personnel": 0, "devices": None},
    },
    "pro": {
        "name": "حرفه‌ای", "description": "پیشنهاد اصلی برای فروشگاه‌های در حال رشد با ظرفیت و خدمات ابری بیشتر.",
        "price_minor": 9_900_000, "duration": 1, "duration_unit": "month",
        "features": _features(cloud=True, personnel=False),
        "limits": {"inventory_items": 15000, "catalog_items": 5000, "active_personnel": 0, "devices": None},
    },
    "vip": {
        "name": "تیم", "description": "برای مالک و حداکثر ۹ همکار با حساب، نقش و سابقه فعالیت مستقل.",
        "price_minor": 18_900_000, "duration": 1, "duration_unit": "month",
        "features": _features(cloud=True, personnel=True),
        "limits": {"inventory_items": 50000, "catalog_items": 15000, "active_personnel": 9, "devices": None},
    },
}


def _json(value: dict) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def upgrade() -> None:
    connection = op.get_bind()
    op.drop_constraint("ck_subscription_plans_offer_complete", "subscription_plans", type_="check")
    op.create_check_constraint(
        "ck_subscription_plans_offer_complete",
        "subscription_plans",
        "NOT is_offer_available OR (id IN ('personal','pro','vip') "
        "AND price_minor IS NOT NULL AND price_minor > 0 "
        "AND duration IS NOT NULL AND duration > 0 "
        "AND duration_unit IS NOT NULL AND duration_unit IN ('day','month','year'))",
    )

    # Every pre-existing/custom policy receives the new required capacity with
    # its prior inventory ceiling. No subscription assignment is rewritten.
    rows = connection.execute(sa.text("SELECT id, limits_json FROM subscription_plans")).mappings()
    for row in rows:
        limits = json.loads(row["limits_json"] or "{}")
        if "catalog_items" not in limits:
            limits["catalog_items"] = limits.get("inventory_items", 0)
            connection.execute(
                sa.text("UPDATE subscription_plans SET limits_json=:limits WHERE id=:id"),
                {"limits": _json(limits), "id": row["id"]},
            )

    for plan_id, definition in PLANS.items():
        exists = connection.scalar(sa.text("SELECT 1 FROM subscription_plans WHERE id=:id"), {"id": plan_id})
        values = {
            "id": plan_id, "name": definition["name"], "description": definition["description"],
            "price": definition["price_minor"], "duration": definition["duration"],
            "unit": definition["duration_unit"], "features": _json(definition["features"]),
            "limits": _json(definition["limits"]),
        }
        if exists:
            connection.execute(sa.text(
                "UPDATE subscription_plans SET name=:name, description=:description, price_minor=:price, "
                "duration=:duration, duration_unit=:unit, is_offer_available=false, is_active=true, "
                "features_json=:features, limits_json=:limits, policy_revision=policy_revision+1 WHERE id=:id"
            ), values)
        else:
            connection.execute(sa.text(
                "INSERT INTO subscription_plans "
                "(id,name,description,price_minor,currency,duration,duration_unit,is_offer_available,is_active,"
                "features_json,limits_json,policy_revision,commercial_status,created_at,updated_at) VALUES "
                "(:id,:name,:description,:price,'IRR',:duration,:unit,false,true,:features,:limits,1,"
                "'legacy_unapproved',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
            ), values)


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(sa.text("UPDATE subscription_plans SET is_active=false, is_offer_available=false WHERE id='personal'"))
    op.drop_constraint("ck_subscription_plans_offer_complete", "subscription_plans", type_="check")
    op.create_check_constraint(
        "ck_subscription_plans_offer_complete", "subscription_plans",
        "NOT is_offer_available OR (id IN ('pro','vip') AND price_minor IS NOT NULL AND price_minor > 0 "
        "AND duration IS NOT NULL AND duration > 0 AND duration_unit IS NOT NULL "
        "AND duration_unit IN ('day','month','year'))",
    )
