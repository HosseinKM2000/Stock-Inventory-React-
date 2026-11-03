import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Store, StoreMembership, StorePlanGrant, SubscriptionPlan, User
from .tool_policy import industry_tool_policy
from ..plans import PLAN_CATALOG, SUBSCRIPTION_CAPABILITIES, subscription_expired
from ..entitlements import CAPABILITY_REGISTRY, validate_policy
from .authorization_service import is_admin


def seed_default_plans(db: Session) -> None:
    for plan_id, definition in PLAN_CATALOG.items():
        existing = db.get(SubscriptionPlan, plan_id)
        if existing is not None:
            # Migration 0011 performs the one-time legacy normalization.
            # Startup must not silently repair or broaden an invalid policy;
            # administrators need the explicit configuration diagnostic.
            continue
        db.add(
            SubscriptionPlan(
                id=plan_id,
                name=definition["label"],
                description=None,
                price_minor=definition["price_minor"],
                currency=definition["currency"],
                duration=definition["duration_days"],
                duration_unit="day" if definition["duration_days"] else None,
                is_active=True,
                features_json=json.dumps(definition["capabilities"]),
                limits_json=json.dumps(definition["limits"]),
            )
        )
    db.commit()


def parse_json_object(value: str) -> dict[str, Any]:
    parsed = json.loads(value or "{}")
    return parsed if isinstance(parsed, dict) else {}


def plan_payload(plan: SubscriptionPlan) -> dict[str, Any]:
    features = parse_json_object(plan.features_json)
    limits = parse_json_object(plan.limits_json)
    configuration_errors: list[str] = []
    try:
        validate_policy(features, limits)
    except HTTPException as error:
        configuration_errors.append(str(error.detail))
    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "price_minor": plan.price_minor,
        "currency": plan.currency,
        "duration": plan.duration,
        "duration_unit": plan.duration_unit,
        "is_active": plan.is_active,
        "features": {key: features.get(key) is True for key in SUBSCRIPTION_CAPABILITIES},
        "limits": {key: limits.get(key) for key in ("inventory_items", "devices", "active_personnel")},
        "policy_revision": plan.policy_revision,
        "commercial_status": plan.commercial_status,
        "configuration_errors": configuration_errors,
        "created_at": plan.created_at,
        "updated_at": plan.updated_at,
    }


def list_plans(db: Session, active_only: bool = False) -> list[SubscriptionPlan]:
    statement = select(SubscriptionPlan).order_by(
        SubscriptionPlan.created_at.desc(),
        SubscriptionPlan.id.desc(),
    )
    if active_only:
        statement = statement.where(SubscriptionPlan.is_active.is_(True))
    return list(db.scalars(statement))


def entitlement_for_user(
    db: Session,
    user: User,
    *,
    as_of: datetime | None = None,
) -> dict[str, Any]:
    now = as_of or datetime.now(timezone.utc)
    if is_admin(user):
        return {
            "user_id": user.id,
            "store_id": getattr(user, "store_id", None),
            "plan": user.plan,
            "label": "Administrator",
            "status": "active",
            "account_status": "active",
            "started_at": user.subscription_started_at,
            "expires_at": None,
            "server_time": now,
            "synced_at": now,
            "capabilities": {
                key: definition.status == "implemented"
                for key, definition in CAPABILITY_REGISTRY.items()
            },
            "limits": {key: None for key in ("inventory_items", "devices", "active_personnel")},
            "tools": industry_tool_policy(None),
            "base_plan": user.plan, "entitlement_source": "administrator",
            "grant_id": None, "grant_expires_at": None, "policy_revision": 0,
        }
    membership = db.scalar(select(StoreMembership).where(StoreMembership.user_id == user.id).order_by(StoreMembership.is_owner.desc()))
    if membership is not None:
        store = db.get(Store, membership.store_id)
        if store is not None:
            value = entitlement_for_store(db, store, as_of=now)
            capabilities = dict(value["capabilities"])
            if not membership.is_owner and (membership.status != "active" or not capabilities.get("personnel", False)):
                capabilities = {key: False for key in capabilities}
            return {
                "user_id": user.id, "store_id": store.id, "plan": value["plan"],
                "label": value["label"], "status": value["status"], "account_status": "active",
                "started_at": value["started_at"], "expires_at": value["expires_at"],
                "server_time": now, "synced_at": now, "capabilities": capabilities,
                "limits": value["limits"], "tools": industry_tool_policy(store.owner.industry),
                "base_plan": value["base_plan"], "entitlement_source": value["entitlement_source"],
                "grant_id": value["grant_id"], "grant_expires_at": value["grant_expires_at"],
                "policy_revision": value["policy_revision"],
            }
    plan = db.get(SubscriptionPlan, user.plan) or db.get(SubscriptionPlan, "free")
    if plan is None:
        raise HTTPException(status_code=500, detail="PLAN_CONFIGURATION_MISSING")

    expired = subscription_expired(user.plan, user.subscription_expires_at, as_of=now)
    features = parse_json_object(plan.features_json)
    limits = parse_json_object(plan.limits_json)
    validate_policy(features, limits)
    capabilities = {key: features[key] is True for key in SUBSCRIPTION_CAPABILITIES}
    if expired:
        capabilities = {
            key: value if key == "inventory.read" else False
            for key, value in capabilities.items()
        }
    return {
        "user_id": user.id,
        "store_id": getattr(user, "store_id", None),
        "plan": plan.id,
        "label": plan.name,
        "status": "expired" if expired else "active",
        "account_status": "active",
        "started_at": user.subscription_started_at,
        "expires_at": user.subscription_expires_at,
        "server_time": now,
        "synced_at": now,
        "capabilities": capabilities,
        "limits": limits,
        "tools": industry_tool_policy(user.industry),
        "base_plan": user.plan, "entitlement_source": "subscription",
        "grant_id": None, "grant_expires_at": None, "policy_revision": plan.policy_revision,
    }


def entitlement_for_store(
    db: Session,
    store: Store,
    *,
    as_of: datetime | None = None,
) -> dict[str, Any]:
    """Store subscription is authoritative; owner columns remain a compatibility mirror."""
    now = as_of or datetime.now(timezone.utc)
    grant = db.scalar(
        select(StorePlanGrant)
        .where(
            StorePlanGrant.store_id == store.id,
            StorePlanGrant.revoked_at.is_(None),
            StorePlanGrant.starts_at <= now,
            StorePlanGrant.ends_at > now,
        )
        .order_by(StorePlanGrant.starts_at.desc(), StorePlanGrant.id.desc())
        .limit(1)
    )
    effective_plan_id = grant.plan_id if grant is not None else store.plan
    plan = db.get(SubscriptionPlan, effective_plan_id) or db.get(SubscriptionPlan, "free")
    if plan is None:
        raise HTTPException(status_code=500, detail="PLAN_CONFIGURATION_MISSING")
    features = parse_json_object(plan.features_json)
    limits = parse_json_object(plan.limits_json)
    validate_policy(features, limits)
    expires_at = grant.ends_at if grant is not None else store.subscription_expires_at
    expired = False if grant is not None else subscription_expired(store.plan, expires_at, as_of=now)
    capabilities = {key: features[key] is True for key in SUBSCRIPTION_CAPABILITIES}
    if expired:
        capabilities = {key: value if key == "inventory.read" else False for key, value in capabilities.items()}
    limits = {key: limits[key] for key in ("inventory_items", "devices", "active_personnel")}
    if store.personnel_limit_override is not None:
        limits["active_personnel"] = store.personnel_limit_override
    return {
        "store_id": store.id,
        "plan": plan.id,
        "label": plan.name,
        "status": "expired" if expired else "active",
        "started_at": grant.starts_at if grant is not None else store.subscription_started_at,
        "expires_at": expires_at,
        "capabilities": capabilities,
        "limits": limits,
        "base_plan": store.plan,
        "entitlement_source": "grant" if grant is not None else "subscription",
        "grant_id": grant.id if grant is not None else None,
        "grant_expires_at": grant.ends_at if grant is not None else None,
        "policy_revision": plan.policy_revision,
    }


def assign_subscription(
    db: Session,
    user: User,
    plan_id: str,
    started_at: datetime | None = None,
    expires_at: datetime | None = None,
) -> None:
    plan = db.get(SubscriptionPlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="PLAN_NOT_FOUND")
    if not plan.is_active:
        raise HTTPException(status_code=409, detail="PLAN_INACTIVE")
    if plan.commercial_status == "legacy_only" and user.plan != plan.id:
        raise HTTPException(status_code=409, detail="PLAN_LEGACY_ASSIGNMENT_FORBIDDEN")

    start = started_at or datetime.now(timezone.utc)
    expiration = expires_at
    if expiration is None and plan.duration is not None:
        if plan.duration_unit == "day":
            expiration = start + timedelta(days=plan.duration)
        elif plan.duration_unit == "month":
            expiration = start + timedelta(days=plan.duration * 30)
        elif plan.duration_unit == "year":
            expiration = start + timedelta(days=plan.duration * 365)

    user.plan = plan.id
    user.subscription_started_at = start if plan.id != "free" else None
    user.subscription_expires_at = expiration if plan.id != "free" else None
    store = db.scalar(select(Store).where(Store.owner_user_id == user.id))
    if store is not None:
        store.plan = user.plan
        store.subscription_started_at = user.subscription_started_at
        store.subscription_expires_at = user.subscription_expires_at


def locked_inventory_capacity(
    db: Session,
    user: User,
    *,
    as_of: datetime | None = None,
) -> int | None:
    """Serialize capacity admission on the authoritative store row."""
    store_id = getattr(user, "store_id", None)
    if store_id is None:
        raise HTTPException(status_code=409, detail="STORE_CONTEXT_REQUIRED")
    store = db.scalar(
        select(Store).where(Store.id == store_id).with_for_update().execution_options(populate_existing=True)
    )
    if store is None:
        raise HTTPException(status_code=404, detail="STORE_NOT_FOUND")
    accepted_at = as_of or getattr(user, "entitlement_as_of", None)
    return entitlement_for_store(db, store, as_of=accepted_at)["limits"]["inventory_items"]
