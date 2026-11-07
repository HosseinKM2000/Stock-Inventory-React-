from datetime import datetime, timezone
from typing import Any

from .entitlements import SUBSCRIPTION_CAPABILITIES, normalize_legacy_policy


# Plan behavior lives here as data. Callers check capabilities/limits instead
# of scattering plan-name comparisons throughout the application.
PLAN_CATALOG: dict[str, dict[str, Any]] = {
    "free": {
        "label": "رایگان",
        "price_minor": 0,
        "currency": "IRR",
        "duration_days": None,
        "limits": {"inventory_items": 200, "catalog_items": 100, "devices": None, "active_personnel": 0},
        "capabilities": {"inventory.read": True, "inventory.write": True,
            "categories.write": True, "export.local": True,
            "export.server": False, "backup": True, "inventory.bulk_edit": True,
            "import.xlsx": True, "labels.write": True, "personnel": False,
            "barcode.lookup": True, "barcode.manage": True, "label.print": True,
            "sync": False},
    },
    "starter": {
        "label": "Starter",
        "price_minor": None,
        "currency": "IRR",
        "duration_days": 30,
        "limits": {"inventory_items": 500, "catalog_items": 500, "devices": None, "active_personnel": 0},
        "capabilities": {"inventory.read": True, "inventory.write": True,
            "categories.write": True, "export.local": True,
            "export.server": True, "backup": True, "inventory.bulk_edit": True,
            "import.xlsx": True, "labels.write": True, "personnel": False,
            "barcode.lookup": True, "barcode.manage": True, "label.print": True,
            "sync": True},
    },
    "personal": {
        "label": "شخصی",
        "price_minor": 4_900_000,
        "currency": "IRR",
        "duration_days": 30,
        "limits": {"inventory_items": 3000, "catalog_items": 1000, "devices": None, "active_personnel": 0},
        "capabilities": {"inventory.read": True, "inventory.write": True,
            "categories.write": True, "export.local": True,
            "export.server": True, "backup": True, "inventory.bulk_edit": True,
            "import.xlsx": True, "labels.write": True, "personnel": False,
            "barcode.lookup": True, "barcode.manage": True, "label.print": True,
            "sync": True},
    },
    "pro": {
        "label": "حرفه‌ای",
        "price_minor": 9_900_000,
        "currency": "IRR",
        "duration_days": 30,
        "limits": {"inventory_items": 15000, "catalog_items": 5000, "devices": None, "active_personnel": 0},
        "capabilities": {"inventory.read": True, "inventory.write": True,
            "categories.write": True, "export.local": True,
            "export.server": True, "backup": True, "inventory.bulk_edit": True,
            "import.xlsx": True, "labels.write": True, "personnel": False,
            "barcode.lookup": True, "barcode.manage": True, "label.print": True,
            "sync": True},
    },
    "vip": {
        "label": "تیم",
        "price_minor": 18_900_000,
        "currency": "IRR",
        "duration_days": 30,
        "limits": {"inventory_items": 50000, "catalog_items": 15000, "devices": None, "active_personnel": 9},
        "capabilities": {"inventory.read": True, "inventory.write": True,
            "categories.write": True, "export.local": True,
            "export.server": True, "backup": True, "inventory.bulk_edit": True,
            "import.xlsx": True, "labels.write": True, "personnel": True,
            "barcode.lookup": True, "barcode.manage": True, "label.print": True,
            "sync": True},
    },
}

# Make the legacy observed allocations explicit for every canonical key.  This
# is compatibility data, not approval of the final V1 catalog.
for _definition in PLAN_CATALOG.values():
    _definition["capabilities"], _definition["limits"] = normalize_legacy_policy(
        _definition["capabilities"], _definition["limits"]
    )

# TZ-V1-02B1 approves only the invoice allocation. Other observed allocations
# remain compatibility data until their own commercial decision is accepted.
for _plan_id, _enabled in {"free": True, "starter": True, "personal": True, "pro": True, "vip": True}.items():
    PLAN_CATALOG[_plan_id]["capabilities"]["invoices.purchase"] = _enabled
    PLAN_CATALOG[_plan_id]["capabilities"]["invoices.sale"] = _enabled

# No paid price or billing term has been approved. A paid offer becomes
# available only after an administrator explicitly supplies both.
# Prices are launch recommendations stored in IRR (the UI displays toman).
# Checkout remains disabled until a payment provider is configured explicitly.


def subscription_expired(
    plan: str,
    expires_at: datetime | None,
    *,
    as_of: datetime | None = None,
) -> bool:
    if plan == "free" or expires_at is None:
        return False
    value = expires_at
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value <= (as_of or datetime.now(timezone.utc))
