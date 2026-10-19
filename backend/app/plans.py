from datetime import datetime, timezone
from typing import Any


SUBSCRIPTION_CAPABILITIES = frozenset({
    "inventory.read",
    "inventory.write",
    "categories.write",
    "export.local",
    "export.server",
    "backup",
    "inventory.bulk_edit",
    "import.xlsx",
    "labels.write",
    "personnel",
    "barcode.lookup",
    "barcode.manage",
    "label.print",
})


# Plan behavior lives here as data. Callers check capabilities/limits instead
# of scattering plan-name comparisons throughout the application.
PLAN_CATALOG: dict[str, dict[str, Any]] = {
    "free": {
        "label": "Free",
        "price_minor": 0,
        "currency": "IRR",
        "duration_days": None,
        "limits": {"inventory_items": 50, "devices": None, "active_personnel": 0},
        "capabilities": {"inventory.read": True, "inventory.write": True,
            "categories.write": True, "export.local": True,
            "export.server": True, "backup": False, "inventory.bulk_edit": True,
            "import.xlsx": True, "labels.write": True, "personnel": False,
            "barcode.lookup": True, "barcode.manage": True, "label.print": True},
    },
    "starter": {
        "label": "Starter",
        "price_minor": None,
        "currency": "IRR",
        "duration_days": 30,
        "limits": {"inventory_items": 500, "devices": None, "active_personnel": 0},
        "capabilities": {"inventory.read": True, "inventory.write": True,
            "categories.write": True, "export.local": True,
            "export.server": True, "backup": True, "inventory.bulk_edit": True,
            "import.xlsx": True, "labels.write": True, "personnel": False,
            "barcode.lookup": True, "barcode.manage": True, "label.print": True},
    },
    "pro": {
        "label": "Pro",
        "price_minor": None,
        "currency": "IRR",
        "duration_days": 30,
        "limits": {"inventory_items": 5000, "devices": None, "active_personnel": 0},
        "capabilities": {"inventory.read": True, "inventory.write": True,
            "categories.write": True, "export.local": True,
            "export.server": True, "backup": True, "inventory.bulk_edit": True,
            "import.xlsx": True, "labels.write": True, "personnel": False,
            "barcode.lookup": True, "barcode.manage": True, "label.print": True},
    },
    "vip": {
        "label": "VIP",
        "price_minor": None,
        "currency": "IRR",
        "duration_days": 30,
        "limits": {"inventory_items": None, "devices": None, "active_personnel": 10},
        "capabilities": {"inventory.read": True, "inventory.write": True,
            "categories.write": True, "export.local": True,
            "export.server": True, "backup": True, "inventory.bulk_edit": True,
            "import.xlsx": True, "labels.write": True, "personnel": True,
            "barcode.lookup": True, "barcode.manage": True, "label.print": True},
    },
}


def subscription_expired(plan: str, expires_at: datetime | None) -> bool:
    if plan == "free" or expires_at is None:
        return False
    value = expires_at
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value <= datetime.now(timezone.utc)
