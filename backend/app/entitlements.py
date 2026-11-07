"""Canonical Commercial V1 entitlement registry and validation.

Commercial allocations live in plan rows.  This module defines only the
stable vocabulary, types, dependencies and enforcement metadata; it does not
turn the observed legacy allocations into approved launch policy.
"""

from dataclasses import asdict, dataclass
from typing import Any, Literal

from fastapi import HTTPException


CapabilityStatus = Literal["implemented", "planned"]


@dataclass(frozen=True)
class CapabilityDefinition:
    key: str
    label_fa: str
    status: CapabilityStatus
    dependencies: tuple[str, ...] = ()
    permissions: tuple[str, ...] = ()
    enforcement: tuple[str, ...] = ()


@dataclass(frozen=True)
class CapacityDefinition:
    key: str
    label_fa: str
    unit: str
    minimum: int
    maximum: int
    supports_unlimited: bool
    capability: str | None = None
    enforcement: tuple[str, ...] = ()


CAPABILITY_REGISTRY: dict[str, CapabilityDefinition] = {
    item.key: item for item in (
        CapabilityDefinition("inventory.read", "مشاهده موجودی", "implemented", permissions=("products.view",), enforcement=("products", "sync.pull", "backup.read")),
        CapabilityDefinition("inventory.write", "مدیریت محصولات", "implemented", ("inventory.read",), ("products.create", "products.edit", "products.delete"), ("products", "sync.acceptance")),
        CapabilityDefinition("categories.write", "مدیریت دسته‌بندی", "implemented", ("inventory.read",), ("categories.manage",), ("categories", "sync.acceptance")),
        CapabilityDefinition("labels.write", "مدیریت برچسب", "implemented", ("inventory.read",), ("labels.manage",), ("labels", "sync.acceptance")),
        CapabilityDefinition("inventory.bulk_edit", "ویرایش گروهی", "implemented", ("inventory.write",), ("products.bulk",), ("client.intent", "sync.acceptance")),
        CapabilityDefinition("import.xlsx", "ورود از اکسل", "implemented", ("inventory.write",), ("tools.import",), ("client.import", "sync.acceptance")),
        CapabilityDefinition("export.local", "خروجی محلی", "implemented", ("inventory.read",), ("tools.export",), ("client.export",)),
        CapabilityDefinition("export.server", "خروجی سرور", "implemented", ("inventory.read",), ("tools.export",), ("server.export",)),
        CapabilityDefinition("catalog.use", "کاتالوگ مشترک", "implemented", ("inventory.read",), ("tools.catalog",), ("catalog", "sync.acceptance")),
        CapabilityDefinition("dashboard.analytics", "تحلیل داشبورد", "implemented", ("inventory.read",), ("dashboard.view",), ("dashboard",)),
        CapabilityDefinition("barcode.lookup", "جست‌وجوی بارکد", "implemented", ("inventory.read",), ("products.view",), ("barcode",)),
        CapabilityDefinition("barcode.manage", "مدیریت بارکد", "implemented", ("inventory.write",), ("products.edit",), ("barcode", "sync.acceptance")),
        CapabilityDefinition("label.print", "چاپ لیبل", "implemented", ("barcode.lookup",), ("products.view",), ("label.print",)),
        CapabilityDefinition("personnel", "پرسنل و فعالیت", "implemented", ("inventory.read",), (), ("personnel", "store.authorization", "sync.acceptance")),
        CapabilityDefinition("backup", "پشتیبان‌گیری و بازیابی", "implemented", ("inventory.read",), ("tools.backup", "tools.restore"), ("backup", "recovery")),
        CapabilityDefinition("sync", "همگام‌سازی", "implemented", ("inventory.read",), (), ("sync.acceptance", "sync.pull")),
        CapabilityDefinition("media.recovery", "بازیابی رسانه روی دستگاه تازه", "planned", ("backup",), (), ()),
        CapabilityDefinition("invoices.purchase", "فاکتور خرید", "planned", ("inventory.read",), (), ()),
        CapabilityDefinition("invoices.sale", "فاکتور فروش", "planned", ("inventory.read",), (), ()),
    )
}

CAPACITY_REGISTRY: dict[str, CapacityDefinition] = {
    item.key: item for item in (
        CapacityDefinition("inventory_items", "تعداد کالا", "record", 0, 10_000_000, True, "inventory.write", ("products.create", "sync.acceptance")),
        CapacityDefinition("active_personnel", "پرسنل فعال", "membership", 0, 100_000, False, "personnel", ("personnel.create", "personnel.reactivate")),
        # V1 keeps every tier unrestricted.  The extension point remains typed.
        CapacityDefinition("devices", "دستگاه فعال", "session", 0, 100_000, True, None, ("session.admission",)),
    )
}

SUBSCRIPTION_CAPABILITIES = frozenset(CAPABILITY_REGISTRY)
SUBSCRIPTION_CAPACITIES = frozenset(CAPACITY_REGISTRY)


def registry_payload() -> dict[str, Any]:
    return {
        "capabilities": [asdict(value) for value in CAPABILITY_REGISTRY.values()],
        "capacities": [asdict(value) for value in CAPACITY_REGISTRY.values()],
        "semantics": {
            "capability_disabled": False,
            "capacity_zero": "enabled capability with no new admissions",
            "capacity_finite": "integer within the declared range",
            "capacity_unlimited": None,
            "capacity_unset": "invalid configuration; deny the affected operation",
        },
    }


def validate_policy(features: dict[str, Any], limits: dict[str, Any]) -> None:
    unknown_features = set(features) - SUBSCRIPTION_CAPABILITIES
    unknown_limits = set(limits) - SUBSCRIPTION_CAPACITIES
    if unknown_features:
        raise HTTPException(422, detail=f"PLAN_CAPABILITY_UNKNOWN:{','.join(sorted(unknown_features))}")
    if unknown_limits:
        raise HTTPException(422, detail=f"PLAN_CAPACITY_UNKNOWN:{','.join(sorted(unknown_limits))}")
    if set(features) != SUBSCRIPTION_CAPABILITIES:
        missing = SUBSCRIPTION_CAPABILITIES - set(features)
        raise HTTPException(422, detail=f"PLAN_CAPABILITY_UNSET:{','.join(sorted(missing))}")
    if set(limits) != SUBSCRIPTION_CAPACITIES:
        missing = SUBSCRIPTION_CAPACITIES - set(limits)
        raise HTTPException(422, detail=f"PLAN_CAPACITY_UNSET:{','.join(sorted(missing))}")
    for key, value in features.items():
        if not isinstance(value, bool):
            raise HTTPException(422, detail=f"PLAN_CAPABILITY_INVALID:{key}")
        definition = CAPABILITY_REGISTRY[key]
        if value and definition.status != "implemented":
            raise HTTPException(422, detail=f"PLAN_CAPABILITY_PLANNED:{key}")
        for dependency in definition.dependencies:
            if value and features.get(dependency) is not True:
                raise HTTPException(422, detail=f"PLAN_CAPABILITY_DEPENDENCY:{key}:{dependency}")
    for key, value in limits.items():
        definition = CAPACITY_REGISTRY[key]
        if value is None:
            if not definition.supports_unlimited:
                raise HTTPException(422, detail=f"PLAN_CAPACITY_UNLIMITED_UNSUPPORTED:{key}")
            continue
        if isinstance(value, bool) or not isinstance(value, int) or not definition.minimum <= value <= definition.maximum:
            raise HTTPException(422, detail=f"PLAN_CAPACITY_INVALID:{key}")


def normalize_legacy_policy(features: dict[str, Any], limits: dict[str, Any]) -> tuple[dict[str, bool], dict[str, int | None]]:
    """Preserve observed behavior while making every registry value explicit."""
    normalized_features = {key: bool(features.get(key, False)) for key in SUBSCRIPTION_CAPABILITIES}
    # Capabilities that were reachable through inventory.read before 02A stay reachable.
    for key in ("catalog.use", "dashboard.analytics", "sync"):
        if key not in features:
            normalized_features[key] = bool(features.get("inventory.read", False))
    for key in ("media.recovery", "invoices.purchase", "invoices.sale"):
        normalized_features[key] = False
    normalized_limits = {key: limits.get(key) for key in SUBSCRIPTION_CAPACITIES}
    if "active_personnel" not in limits:
        normalized_limits["active_personnel"] = 0
    if "devices" not in limits:
        normalized_limits["devices"] = None
    if "inventory_items" not in limits:
        normalized_limits["inventory_items"] = 0
    return normalized_features, normalized_limits
