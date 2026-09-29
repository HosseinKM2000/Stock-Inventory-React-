import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import SubscriptionPlan, User
from ..plans import PLAN_CATALOG, SUBSCRIPTION_CAPABILITIES, subscription_expired


def seed_default_plans(db: Session) -> None:
    for plan_id, definition in PLAN_CATALOG.items():
        if db.get(SubscriptionPlan, plan_id) is not None:
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
    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "price_minor": plan.price_minor,
        "currency": plan.currency,
        "duration": plan.duration,
        "duration_unit": plan.duration_unit,
        "is_active": plan.is_active,
        "features": {
            key: bool(value)
            for key, value in parse_json_object(plan.features_json).items()
            if key in SUBSCRIPTION_CAPABILITIES
        },
        "limits": parse_json_object(plan.limits_json),
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


def entitlement_for_user(db: Session, user: User) -> dict[str, Any]:
    plan = db.get(SubscriptionPlan, user.plan) or db.get(SubscriptionPlan, "free")
    if plan is None:
        raise HTTPException(status_code=500, detail="PLAN_CONFIGURATION_MISSING")

    expired = subscription_expired(user.plan, user.subscription_expires_at)
    capabilities = {
        key: bool(value)
        for key, value in parse_json_object(plan.features_json).items()
        if key in SUBSCRIPTION_CAPABILITIES
    }
    if expired:
        capabilities = {
            key: value if key == "inventory.read" else False
            for key, value in capabilities.items()
        }
    now = datetime.now(timezone.utc)
    return {
        "user_id": user.id,
        "plan": plan.id,
        "label": plan.name,
        "status": "expired" if expired else "active",
        "account_status": "active",
        "started_at": user.subscription_started_at,
        "expires_at": user.subscription_expires_at,
        "server_time": now,
        "synced_at": now,
        "capabilities": capabilities,
        "limits": parse_json_object(plan.limits_json),
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
