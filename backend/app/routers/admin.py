import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select, update

from ..deps import CurrentAdmin, CurrentPlanManager, CurrentUserManager, DbSession
from ..config import settings
from ..models import (
    AdminAuditLog,
    CatalogProduct,
    SubscriptionPlan,
    SyncChange,
    SyncOperation,
    User,
)
from ..schemas import (
    AdminSubscriptionUpdate,
    AdminUserOut,
    AdminUserRoleUpdate,
    AdminUserStateUpdate,
    PlanCreate,
    PlanDefinitionOut,
    PlanPatch,
)
from ..services.audit_service import record_admin_action
from ..plans import PLAN_CATALOG, SUBSCRIPTION_CAPABILITIES
from ..services.authorization_service import RoleId, set_role
from ..services.subscription_service import (
    assign_subscription,
    entitlement_for_user,
    list_plans,
    plan_payload,
)

router = APIRouter(prefix="/admin", tags=["administration"])


def _validate_duration(duration: int | None, unit: str | None) -> None:
    if (duration is None) != (unit is None):
        raise HTTPException(status_code=422, detail="PLAN_DURATION_INVALID")


def _validate_features(features: dict[str, bool]) -> None:
    unknown = set(features) - SUBSCRIPTION_CAPABILITIES
    if unknown:
        raise HTTPException(status_code=422, detail="PLAN_CAPABILITY_INVALID")


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _user_or_404(db: DbSession, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND")
    return user


def _admin_user_payload(db: DbSession, user: User) -> dict:
    entitlement = entitlement_for_user(db, user)
    last_activity = max(
        (timestamp for session in user.sessions if (timestamp := _as_utc(session.last_seen)) is not None),
        default=None,
    )
    remaining_days = None
    if user.subscription_expires_at is not None:
        expiration = user.subscription_expires_at
        if expiration.tzinfo is None:
            expiration = expiration.replace(tzinfo=timezone.utc)
        remaining_days = max(0, (expiration - datetime.now(timezone.utc)).days)
    return {
        **AdminUserOut.model_validate(
            {
                **user.__dict__,
                "subscription_status": entitlement["status"],
                "last_activity_at": last_activity,
                "remaining_days": remaining_days,
            }
        ).model_dump(),
    }


@router.get("/users", response_model=list[AdminUserOut])
def list_users(_: CurrentAdmin, db: DbSession):
    users = list(
        db.scalars(select(User).order_by(User.created_at.desc(), User.id.desc()))
    )
    return [_admin_user_payload(db, user) for user in users]


@router.patch("/users/{user_id}/state", response_model=AdminUserOut)
def update_user_state(
    user_id: int,
    payload: AdminUserStateUpdate,
    admin: CurrentUserManager,
    db: DbSession,
):
    user = _user_or_404(db, user_id)
    if user.is_system_admin and not payload.is_active:
        raise HTTPException(status_code=409, detail="SYSTEM_ADMIN_IMMUTABLE")
    if user.id == admin.id and not payload.is_active:
        raise HTTPException(status_code=400, detail="CANNOT_DISABLE_SELF")

    user.is_active = payload.is_active
    if not user.is_active:
        for session in user.sessions:
            session.is_active = False
    record_admin_action(
        db,
        admin,
        "account.enabled" if payload.is_active else "account.disabled",
        user,
    )
    db.commit()
    db.refresh(user)
    return _admin_user_payload(db, user)


@router.patch("/users/{user_id}/role", response_model=AdminUserOut)
def update_user_role(
    user_id: int,
    payload: AdminUserRoleUpdate,
    admin: CurrentUserManager,
    db: DbSession,
):
    user = _user_or_404(db, user_id)
    role = RoleId(payload.role)
    if user.id == admin.id and not user.is_system_admin and role is not RoleId.ADMIN:
        raise HTTPException(status_code=400, detail="CANNOT_DEMOTE_SELF")
    set_role(user, role)
    record_admin_action(
        db,
        admin,
        "role.admin_granted" if role is RoleId.ADMIN else "role.admin_revoked",
        user,
    )
    db.commit()
    db.refresh(user)
    return _admin_user_payload(db, user)


@router.patch("/users/{user_id}/subscription", response_model=AdminUserOut)
def update_user_subscription(
    user_id: int,
    payload: AdminSubscriptionUpdate,
    admin: CurrentUserManager,
    db: DbSession,
):
    user = _user_or_404(db, user_id)
    previous = {
        "plan": user.plan,
        "started_at": (
            user.subscription_started_at.isoformat()
            if user.subscription_started_at
            else None
        ),
        "expires_at": (
            user.subscription_expires_at.isoformat()
            if user.subscription_expires_at
            else None
        ),
    }
    assign_subscription(
        db,
        user,
        payload.plan,
        payload.subscription_started_at,
        payload.subscription_expires_at,
    )
    record_admin_action(
        db,
        admin,
        "subscription.changed",
        user,
        {
            "previous_plan": previous["plan"],
            "plan": user.plan,
            "previous": previous,
            "current": {
                "plan": user.plan,
                "started_at": (
                    user.subscription_started_at.isoformat()
                    if user.subscription_started_at
                    else None
                ),
                "expires_at": (
                    user.subscription_expires_at.isoformat()
                    if user.subscription_expires_at
                    else None
                ),
            },
        },
    )
    db.commit()
    db.refresh(user)
    return _admin_user_payload(db, user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, admin: CurrentUserManager, db: DbSession) -> None:
    user = _user_or_404(db, user_id)
    if user.is_system_admin:
        raise HTTPException(status_code=409, detail="SYSTEM_ADMIN_IMMUTABLE")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="CANNOT_DELETE_SELF")
    inventory_items = list(user.inventory_items)
    private_catalogs = {
        item.catalog_product
        for item in inventory_items
        if not item.catalog_product.is_shared
    }
    uploaded_images = {
        path
        for path in [
            *(item.image_url for item in inventory_items),
            *(catalog.image_url for catalog in private_catalogs),
        ]
        if path and path.startswith("/uploads/")
    }

    try:
        # These historical sync rows intentionally have no ORM relationship;
        # remove them explicitly before deleting the user with FK checks enabled.
        db.execute(delete(SyncOperation).where(SyncOperation.user_id == user.id))
        db.execute(delete(SyncChange).where(SyncChange.user_id == user.id))
        # Audit history survives, but a deleted actor can no longer remain an FK.
        db.execute(
            update(AdminAuditLog)
            .where(AdminAuditLog.actor_user_id == user.id)
            .values(actor_user_id=None)
        )
        record_admin_action(db, admin, "user.deleted", user, {"username": user.username})
        db.flush()
        db.delete(user)
        db.flush()
        for catalog in private_catalogs:
            db.delete(catalog)
        db.commit()
    except Exception:
        db.rollback()
        raise

    for image_url in uploaded_images:
        try:
            (settings.UPLOAD_DIR / Path(image_url).name).unlink(missing_ok=True)
        except OSError:
            pass


@router.get("/plans", response_model=list[PlanDefinitionOut])
def admin_list_plans(_: CurrentPlanManager, db: DbSession):
    return [plan_payload(plan) for plan in list_plans(db)]


@router.get("/plans/{plan_id}/subscribers", response_model=list[AdminUserOut])
def plan_subscribers(plan_id: str, _: CurrentPlanManager, db: DbSession):
    if db.get(SubscriptionPlan, plan_id) is None:
        raise HTTPException(status_code=404, detail="PLAN_NOT_FOUND")
    users = list(
        db.scalars(
            select(User)
            .where(User.plan == plan_id)
            .order_by(User.created_at.desc(), User.id.desc())
        )
    )
    return [_admin_user_payload(db, user) for user in users]


@router.post("/plans", response_model=PlanDefinitionOut, status_code=201)
def create_plan(payload: PlanCreate, admin: CurrentPlanManager, db: DbSession):
    if db.get(SubscriptionPlan, payload.id) is not None:
        raise HTTPException(status_code=409, detail="PLAN_EXISTS")
    _validate_duration(payload.duration, payload.duration_unit)
    _validate_features(payload.features)
    plan = SubscriptionPlan(
        id=payload.id,
        name=payload.name,
        description=payload.description,
        price_minor=payload.price_minor,
        currency=payload.currency,
        duration=payload.duration,
        duration_unit=payload.duration_unit,
        is_active=payload.is_active,
        features_json=json.dumps(payload.features),
        limits_json=json.dumps(payload.limits),
    )
    db.add(plan)
    record_admin_action(db, admin, "plan.created", metadata={"plan": plan.id})
    db.commit()
    db.refresh(plan)
    return plan_payload(plan)


@router.patch("/plans/{plan_id}", response_model=PlanDefinitionOut)
def update_plan(
    plan_id: str,
    payload: PlanPatch,
    admin: CurrentPlanManager,
    db: DbSession,
):
    plan = db.get(SubscriptionPlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="PLAN_NOT_FOUND")
    values = payload.model_dump(exclude_unset=True)
    resulting_duration = values.get("duration", plan.duration)
    resulting_unit = values.get("duration_unit", plan.duration_unit)
    _validate_duration(resulting_duration, resulting_unit)
    if "features" in values:
        _validate_features(values["features"])
        plan.features_json = json.dumps(values.pop("features"))
    if "limits" in values:
        plan.limits_json = json.dumps(values.pop("limits"))
    for field, value in values.items():
        setattr(plan, field, value)
    record_admin_action(db, admin, "plan.changed", metadata={"plan": plan.id})
    db.commit()
    db.refresh(plan)
    return plan_payload(plan)


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(plan_id: str, admin: CurrentPlanManager, db: DbSession) -> None:
    plan = db.get(SubscriptionPlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="PLAN_NOT_FOUND")
    if plan_id in PLAN_CATALOG:
        raise HTTPException(status_code=409, detail="PLAN_BUILT_IN")
    if db.scalar(select(User.id).where(User.plan == plan_id).limit(1)) is not None:
        raise HTTPException(status_code=409, detail="PLAN_HAS_SUBSCRIBERS")
    record_admin_action(db, admin, "plan.deleted", metadata={"plan": plan.id})
    db.flush()
    db.delete(plan)
    db.commit()


@router.get("/audit")
def audit_log(_: CurrentAdmin, db: DbSession, limit: int = 100):
    records = list(
        db.scalars(
            select(AdminAuditLog)
            .order_by(AdminAuditLog.created_at.desc(), AdminAuditLog.id.desc())
            .limit(min(max(limit, 1), 500))
        )
    )
    return [
        {
            "id": item.id,
            "actor_user_id": item.actor_user_id,
            "target_user_id": item.target_user_id,
            "action": item.action,
            "metadata": json.loads(item.metadata_json) if item.metadata_json else None,
            "created_at": item.created_at,
        }
        for item in records
    ]
