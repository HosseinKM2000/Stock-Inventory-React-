import pytest
from fastapi import HTTPException

from app.entitlements import (
    SUBSCRIPTION_CAPABILITIES,
    SUBSCRIPTION_CAPACITIES,
    normalize_legacy_policy,
    registry_payload,
    validate_policy,
)


def valid_policy():
    features = {key: False for key in SUBSCRIPTION_CAPABILITIES}
    features["inventory.read"] = True
    limits = {"inventory_items": 0, "active_personnel": 0, "devices": None}
    return features, limits


def test_registry_marks_planned_capabilities_and_declares_capacity_semantics() -> None:
    payload = registry_payload()
    planned = {item["key"] for item in payload["capabilities"] if item["status"] == "planned"}
    assert planned == {"media.recovery"}
    implemented = {item["key"] for item in payload["capabilities"] if item["status"] == "implemented"}
    assert {"invoices.purchase", "invoices.sale"} <= implemented
    assert set(item["key"] for item in payload["capacities"]) == SUBSCRIPTION_CAPACITIES
    assert payload["semantics"]["capacity_unlimited"] is None


@pytest.mark.parametrize(
    ("mutate", "code"),
    [
        (lambda features, limits: features.update({"unknown": True}), "PLAN_CAPABILITY_UNKNOWN"),
        (lambda features, limits: features.pop("inventory.read"), "PLAN_CAPABILITY_UNSET"),
        (lambda features, limits: limits.pop("inventory_items"), "PLAN_CAPACITY_UNSET"),
        (lambda features, limits: features.update({"media.recovery": True}), "PLAN_CAPABILITY_PLANNED"),
        (lambda features, limits: features.update({"inventory.write": True, "inventory.read": False}), "PLAN_CAPABILITY_DEPENDENCY"),
        (lambda features, limits: limits.update({"active_personnel": None}), "PLAN_CAPACITY_UNLIMITED_UNSUPPORTED"),
        (lambda features, limits: limits.update({"inventory_items": -1}), "PLAN_CAPACITY_INVALID"),
    ],
)
def test_invalid_or_unset_policy_fails_closed(mutate, code: str) -> None:
    features, limits = valid_policy()
    mutate(features, limits)
    with pytest.raises(HTTPException) as error:
        validate_policy(features, limits)
    assert str(error.value.detail).startswith(code)


def test_zero_finite_and_explicit_unlimited_are_distinct_valid_values() -> None:
    features, limits = valid_policy()
    validate_policy(features, limits)
    limits["inventory_items"] = 25
    validate_policy(features, limits)
    limits["inventory_items"] = None
    validate_policy(features, limits)


def test_legacy_normalization_preserves_values_without_enabling_planned_work() -> None:
    features, limits = normalize_legacy_policy(
        {"inventory.read": True, "inventory.write": True},
        {"inventory_items": 50, "devices": None},
    )
    assert features["inventory.write"] is True
    assert features["dashboard.analytics"] is True
    assert features["invoices.sale"] is False
    assert limits == {"inventory_items": 50, "devices": None, "active_personnel": 0}
