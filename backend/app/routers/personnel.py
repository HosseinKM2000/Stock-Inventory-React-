import json
import secrets
import string
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..deps import CurrentUser, DbSession
from ..models import Store, StoreActivity, StoreMembership, StoreRole, User, UserSession
from ..schemas import (
    ActivityOut, ActivityPage, PersonnelCapacityOut, PersonnelCreate, PersonnelCreated,
    PersonnelOut, PersonnelUpdate, StoreRoleCreate, StoreRoleOut, StoreRoleUpdate,
)
from ..security import hash_password
from ..services.activity_service import record_store_activity
from ..services.auth_service import username_taken
from ..services.authorization_service import is_admin
from ..services.store_authorization import normalize_permissions
from ..services.store_service import active_personnel_count, active_store_context, owner_store_context
from ..services.subscription_service import entitlement_for_store

router = APIRouter(tags=["store personnel"])


def _role_out(db: Session, role: StoreRole) -> StoreRoleOut:
    assigned = int(db.scalar(select(func.count(StoreMembership.id)).where(StoreMembership.role_id == role.id)) or 0)
    return StoreRoleOut(id=role.id, name=role.name, permissions=json.loads(role.permissions_json), assigned_count=assigned)


def _personnel_out(db: Session, membership: StoreMembership) -> PersonnelOut:
    user = membership.user
    last_activity = db.scalar(select(func.max(UserSession.last_seen)).where(UserSession.user_id == user.id))
    return PersonnelOut(
        membership_id=membership.id, user_id=user.id, first_name=user.first_name,
        last_name=user.last_name, username=user.username, role_id=membership.role_id,
        role_name=membership.role.name, active=membership.status == "active",
        temporary_password_required=membership.temporary_password_required,
        credentials_notice_viewed=membership.credentials_notice_viewed_at is not None,
        created_at=membership.created_at, last_activity_at=last_activity,
    )


def _temporary_password() -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    while True:
        value = "".join(secrets.choice(alphabet) for _ in range(16))
        if any(c.isupper() for c in value) and any(c.islower() for c in value) and any(c.isdigit() for c in value):
            return value


def _username(db: Session, requested: str | None, first_name: str, last_name: str) -> str:
    if requested:
        if username_taken(db, requested):
            raise HTTPException(status_code=409, detail="USERNAME_TAKEN")
        return requested
    stem = "".join(c.lower() for c in f"{first_name}.{last_name}" if c.isascii() and (c.isalnum() or c == ".")) or "personnel"
    for _ in range(50):
        candidate = f"{stem}.{secrets.randbelow(100000):05d}"
        if not username_taken(db, candidate):
            return candidate
    raise HTTPException(status_code=503, detail="USERNAME_GENERATION_FAILED")


def _capacity(db: Session, store: Store, user: User) -> PersonnelCapacityOut:
    used = active_personnel_count(db, store.id)
    if is_admin(user):
        return PersonnelCapacityOut(enabled=True, used=used, limit=None, available=None)
    entitlement = entitlement_for_store(db, store)
    enabled = entitlement["capabilities"].get("personnel", False)
    limit = int(entitlement["limits"].get("active_personnel") or 0)
    return PersonnelCapacityOut(enabled=enabled, used=used, limit=limit, available=max(0, limit - used))


@router.get("/store/roles", response_model=list[StoreRoleOut])
def list_roles(current_user: CurrentUser, db: DbSession):
    context = owner_store_context(db, current_user)
    return [_role_out(db, role) for role in db.scalars(select(StoreRole).where(StoreRole.store_id == context.store.id).order_by(StoreRole.name))]


@router.post("/store/roles", response_model=StoreRoleOut, status_code=status.HTTP_201_CREATED)
def create_role(payload: StoreRoleCreate, current_user: CurrentUser, db: DbSession):
    context = owner_store_context(db, current_user)
    role = StoreRole(store_id=context.store.id, name=payload.name.strip(), permissions_json=json.dumps(normalize_permissions(payload.permissions)))
    db.add(role)
    db.flush()
    record_store_activity(db, current_user, action="role.created", target_entity="role", target_id=role.id, after={"name": role.name, "permissions": json.loads(role.permissions_json)})
    db.commit()
    return _role_out(db, role)


@router.patch("/store/roles/{role_id}", response_model=StoreRoleOut)
def update_role(role_id: int, payload: StoreRoleUpdate, current_user: CurrentUser, db: DbSession):
    context = owner_store_context(db, current_user)
    role = db.scalar(select(StoreRole).where(StoreRole.id == role_id, StoreRole.store_id == context.store.id))
    if role is None: raise HTTPException(status_code=404, detail="ROLE_NOT_FOUND")
    before = {"name": role.name, "permissions": json.loads(role.permissions_json)}
    if payload.name is not None: role.name = payload.name.strip()
    if payload.permissions is not None: role.permissions_json = json.dumps(normalize_permissions(payload.permissions))
    record_store_activity(db, current_user, action="role.updated", target_entity="role", target_id=role.id, before=before, after={"name": role.name, "permissions": json.loads(role.permissions_json)})
    db.commit()
    return _role_out(db, role)


@router.delete("/store/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(role_id: int, current_user: CurrentUser, db: DbSession):
    context = owner_store_context(db, current_user)
    role = db.scalar(select(StoreRole).where(StoreRole.id == role_id, StoreRole.store_id == context.store.id))
    if role is None: raise HTTPException(status_code=404, detail="ROLE_NOT_FOUND")
    if db.scalar(select(StoreMembership.id).where(StoreMembership.role_id == role.id).limit(1)):
        raise HTTPException(status_code=409, detail="ROLE_ASSIGNED")
    record_store_activity(db, current_user, action="role.deleted", target_entity="role", target_id=role.id, before={"name": role.name})
    db.delete(role); db.commit()


@router.get("/store/personnel/capacity", response_model=PersonnelCapacityOut)
def personnel_capacity(current_user: CurrentUser, db: DbSession):
    return _capacity(db, owner_store_context(db, current_user).store, current_user)


@router.get("/store/personnel", response_model=list[PersonnelOut])
def list_personnel(current_user: CurrentUser, db: DbSession):
    context = owner_store_context(db, current_user)
    memberships = db.scalars(select(StoreMembership).where(StoreMembership.store_id == context.store.id, StoreMembership.is_owner.is_(False)).order_by(StoreMembership.created_at)).all()
    return [_personnel_out(db, item) for item in memberships]


@router.post("/store/personnel", response_model=PersonnelCreated, status_code=status.HTTP_201_CREATED)
def create_personnel(payload: PersonnelCreate, current_user: CurrentUser, db: DbSession):
    context = owner_store_context(db, current_user)
    store = db.scalar(select(Store).where(Store.id == context.store.id).with_for_update())
    capacity = _capacity(db, store, current_user)
    if not capacity.enabled: raise HTTPException(status_code=403, detail="PERSONNEL_ENTITLEMENT_REQUIRED")
    if capacity.available is not None and capacity.available <= 0: raise HTTPException(status_code=409, detail="PERSONNEL_CAPACITY_REACHED")
    role = db.scalar(select(StoreRole).where(StoreRole.id == payload.role_id, StoreRole.store_id == store.id))
    if role is None: raise HTTPException(status_code=404, detail="ROLE_NOT_FOUND")
    password = _temporary_password()
    user = User(first_name=payload.first_name, last_name=payload.last_name, username=_username(db, payload.username, payload.first_name, payload.last_name), hashed_password=hash_password(password), plan="free", is_active=True, is_admin=False, role="USER")
    db.add(user); db.flush()
    membership = StoreMembership(store_id=store.id, user_id=user.id, role_id=role.id, status="active", is_owner=False, temporary_password_required=True)
    db.add(membership); db.flush()
    record_store_activity(db, current_user, action="personnel.created", target_entity="membership", target_id=membership.id, after={"user_id": user.id, "role_id": role.id, "status": "active"})
    db.commit()
    return PersonnelCreated(**_personnel_out(db, membership).model_dump(), temporary_password=password)


@router.patch("/store/personnel/{membership_id}", response_model=PersonnelOut)
def update_personnel(membership_id: int, payload: PersonnelUpdate, current_user: CurrentUser, db: DbSession):
    context = owner_store_context(db, current_user)
    membership = db.scalar(select(StoreMembership).where(StoreMembership.id == membership_id, StoreMembership.store_id == context.store.id, StoreMembership.is_owner.is_(False)).with_for_update())
    if membership is None: raise HTTPException(status_code=404, detail="PERSONNEL_NOT_FOUND")
    before = {"role_id": membership.role_id, "status": membership.status}
    if payload.role_id is not None:
        role = db.scalar(select(StoreRole).where(StoreRole.id == payload.role_id, StoreRole.store_id == context.store.id))
        if role is None: raise HTTPException(status_code=404, detail="ROLE_NOT_FOUND")
        membership.role_id = role.id
    if payload.active is not None:
        if payload.active and membership.status != "active":
            db.execute(select(Store).where(Store.id == context.store.id).with_for_update())
            available = _capacity(db, context.store, current_user).available
            if available is not None and available <= 0: raise HTTPException(status_code=409, detail="PERSONNEL_CAPACITY_REACHED")
        membership.status = "active" if payload.active else "inactive"
    record_store_activity(db, current_user, action="personnel.updated", target_entity="membership", target_id=membership.id, before=before, after={"role_id": membership.role_id, "status": membership.status})
    db.commit()
    return _personnel_out(db, membership)


@router.post("/store/personnel/{membership_id}/temporary-credentials", response_model=PersonnelCreated)
def reset_personnel_credentials(membership_id: int, current_user: CurrentUser, db: DbSession):
    context = owner_store_context(db, current_user)
    membership = db.scalar(select(StoreMembership).where(StoreMembership.id == membership_id, StoreMembership.store_id == context.store.id, StoreMembership.is_owner.is_(False)))
    if membership is None: raise HTTPException(status_code=404, detail="PERSONNEL_NOT_FOUND")
    password = _temporary_password(); membership.user.hashed_password = hash_password(password)
    membership.temporary_password_required = True; membership.credentials_notice_viewed_at = None
    for session in membership.user.sessions: session.is_active = False
    record_store_activity(db, current_user, action="personnel.credentials_reset", target_entity="membership", target_id=membership.id)
    db.commit()
    return PersonnelCreated(**_personnel_out(db, membership).model_dump(), temporary_password=password)


@router.post("/store/credentials-notice/viewed", status_code=status.HTTP_204_NO_CONTENT)
def credentials_notice_viewed(current_user: CurrentUser, db: DbSession):
    context = active_store_context(db, current_user)
    context.membership.credentials_notice_viewed_at = datetime.now(timezone.utc)
    db.commit()


@router.get("/store/activity/today-summary")
def today_activity(current_user: CurrentUser, db: DbSession):
    context = owner_store_context(db, current_user)
    now = datetime.now(ZoneInfo("Asia/Tehran"))
    start = now.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    count = int(db.scalar(select(func.count(StoreActivity.id)).where(StoreActivity.store_id == context.store.id, StoreActivity.accepted_at >= start)) or 0)
    return {"count": count}


@router.get("/store/activity", response_model=ActivityPage)
def activity(current_user: CurrentUser, db: DbSession, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100), actor_user_id: int | None = None, action: str | None = None, date_from: datetime | None = None, date_to: datetime | None = None):
    context = owner_store_context(db, current_user)
    stmt = select(StoreActivity).where(StoreActivity.store_id == context.store.id)
    if actor_user_id is not None: stmt = stmt.where(StoreActivity.actor_user_id == actor_user_id)
    if action is not None: stmt = stmt.where(StoreActivity.action == action)
    if date_from is not None: stmt = stmt.where(StoreActivity.accepted_at >= date_from)
    if date_to is not None: stmt = stmt.where(StoreActivity.accepted_at <= date_to)
    total = int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    rows = db.scalars(stmt.order_by(StoreActivity.accepted_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return ActivityPage(items=[ActivityOut(id=x.id, actor_user_id=x.actor_user_id, actor_membership_id=x.actor_membership_id, actor_display_name=x.actor_display_name, actor_role_name=x.actor_role_name, operation_id=x.operation_id, target_entity=x.target_entity, target_id=x.target_id, action=x.action, before=json.loads(x.before_json) if x.before_json else None, after=json.loads(x.after_json) if x.after_json else None, outcome=x.outcome, client_occurred_at=x.client_occurred_at, accepted_at=x.accepted_at) for x in rows], total=total, page=page, page_size=page_size)
