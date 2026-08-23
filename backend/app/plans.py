from datetime import datetime, timezone
from typing import Any


# Plan behavior lives here as data. Callers check capabilities/limits instead
# of scattering plan-name comparisons throughout the application.
PLAN_CATALOG: dict[str, dict[str, Any]] = {
    "free": {
        "label": "Free",
        "price_minor": 0,
        "currency": "IRR",
        "duration_days": None,
        "limits": {"inventory_items": 50, "devices": 1},
        "capabilities": {"inventory.read": True, "inventory.write": True,
            "categories.write": True, "catalog.manage": False,
            "industry.manage": False, "export.local": True,
            "export.server": True, "backup": False},
    },
    "starter": {
        "label": "Starter",
        "price_minor": None,
        "currency": "IRR",
        "duration_days": 30,
        "limits": {"inventory_items": 500, "devices": 2},
        "capabilities": {"inventory.read": True, "inventory.write": True,
            "categories.write": True, "catalog.manage": False,
            "industry.manage": False, "export.local": True,
            "export.server": True, "backup": True},
    },
    "pro": {
        "label": "Pro",
        "price_minor": None,
        "currency": "IRR",
        "duration_days": 30,
        "limits": {"inventory_items": 5000, "devices": 3},
        "capabilities": {"inventory.read": True, "inventory.write": True,
            "categories.write": True, "catalog.manage": True,
            "industry.manage": False, "export.local": True,
            "export.server": True, "backup": True},
    },
    "vip": {
        "label": "VIP",
        "price_minor": None,
        "currency": "IRR",
        "duration_days": 30,
        "limits": {"inventory_items": None, "devices": None},
        "capabilities": {"inventory.read": True, "inventory.write": True,
            "categories.write": True, "catalog.manage": True,
            "industry.manage": True, "export.local": True,
            "export.server": True, "backup": True},
    },
}


def subscription_expired(plan: str, expires_at: datetime | None) -> bool:
    if plan == "free" or expires_at is None:
        return False
    value = expires_at
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value <= datetime.now(timezone.utc)
