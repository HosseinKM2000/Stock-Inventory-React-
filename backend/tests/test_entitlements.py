import pytest
from fastapi import HTTPException

from app.entitlements import (
    SUBSCRIPTION_CAPABILITIES,
    SUBSCRIPTION_CAPACITIES,
    normalize_legacy_policy,
    registry_payload,
    validate_policy,
)
from app.models import SubscriptionPlan
from app.plans import PLAN_CATALOG
from app.services.plan_pricing import (
    capture_plan_offer,
    price_minor_from_toman,
    validate_invoice_allocation,
    validate_offer_configuration,
)


def valid_policy():
    features = {key: False for key in SUBSCRIPTION_CAPABILITIES}
    features["inventory.read"] = True
    limits = {"inventory_items": 0, "catalog_items": 0, "active_personnel": 0, "devices": None}
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
    assert limits == {"inventory_items": 50, "catalog_items": 50, "devices": None, "active_personnel": 0}


def test_local_invoices_are_available_in_every_builtin_plan() -> None:
    for plan_id in ("free", "starter", "personal", "pro", "vip"):
        assert PLAN_CATALOG[plan_id]["capabilities"]["invoices.purchase"] is True
        assert PLAN_CATALOG[plan_id]["capabilities"]["invoices.sale"] is True
    validate_invoice_allocation("pro", PLAN_CATALOG["pro"]["capabilities"])
    with pytest.raises(HTTPException) as changed:
        validate_invoice_allocation("free", {"invoices.purchase": True, "invoices.sale": False})
    assert changed.value.detail == "PLAN_INVOICE_ALLOCATION_FIXED:free"


def test_final_plan_matrix_keeps_local_core_free_and_team_multi_user_only() -> None:
    free = PLAN_CATALOG["free"]
    assert free["limits"] == {"inventory_items": 200, "catalog_items": 100, "devices": None, "active_personnel": 0}
    assert free["capabilities"]["export.local"] is True
    assert free["capabilities"]["backup"] is True
    assert free["capabilities"]["barcode.lookup"] is True
    assert free["capabilities"]["sync"] is False
    assert free["capabilities"]["export.server"] is False
    assert PLAN_CATALOG["personal"]["limits"]["inventory_items"] == 3000
    assert PLAN_CATALOG["pro"]["limits"]["inventory_items"] == 15000
    assert PLAN_CATALOG["vip"]["limits"]["active_personnel"] == 9
    assert all(plan["limits"]["devices"] is None for plan in PLAN_CATALOG.values())


def test_offer_configuration_distinguishes_unconfigured_and_available_paid_plans() -> None:
    validate_offer_configuration(
        plan_id="pro", price_minor=None, duration=None,
        duration_unit=None, is_offer_available=False,
    )
    with pytest.raises(HTTPException) as incomplete:
        validate_offer_configuration(
            plan_id="pro", price_minor=None, duration=None,
            duration_unit=None, is_offer_available=True,
        )
    assert incomplete.value.detail == "PLAN_OFFER_CONFIGURATION_INCOMPLETE"
    with pytest.raises(HTTPException) as free_offer:
        validate_offer_configuration(
            plan_id="free", price_minor=0, duration=30,
            duration_unit="day", is_offer_available=True,
        )
    assert free_offer.value.detail == "PLAN_OFFER_NOT_ELIGIBLE"
    assert price_minor_from_toman(125_000) == 1_250_000


def test_server_offer_snapshot_is_immutable_and_checkout_independent() -> None:
    plan = SubscriptionPlan(
        id="pro", name="Pro", price_minor=1_250_000, currency="IRR",
        duration=1, duration_unit="month", is_offer_available=True,
        is_active=True, features_json="{}", limits_json="{}", policy_revision=7,
    )

    class Db:
        def get(self, model, plan_id):
            assert model is SubscriptionPlan and plan_id == "pro"
            return plan

    snapshot = capture_plan_offer(Db(), "pro")
    plan.price_minor = 2_000_000
    plan.policy_revision = 8
    assert snapshot.amount_toman == 125_000
    assert snapshot.plan_revision == 7
    assert snapshot.offer_id == "pro:r7"
