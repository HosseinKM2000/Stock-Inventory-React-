import json
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Industry, Store, StoreMembership, StoreRole, User


@dataclass(frozen=True)
class StoreContext:
    store: Store
    membership: StoreMembership
    permissions: frozenset[str]

    @property
    def is_owner(self) -> bool:
        return self.membership.is_owner


def _role_permissions(role: StoreRole | None) -> frozenset[str]:
    if role is None:
        return frozenset()
    try:
        value = json.loads(role.permissions_json or "[]")
    except json.JSONDecodeError:
        return frozenset()
    return frozenset(item for item in value if isinstance(item, str))


def create_owner_store(db: Session, user: User) -> StoreContext:
    """Create the one V1 workspace for an independently registered customer."""
    store = Store(
        name=" ".join(part for part in (user.first_name, user.last_name) if part).strip() or user.username,
        owner_user_id=user.id,
        plan=user.plan,
        subscription_started_at=user.subscription_started_at,
        subscription_expires_at=user.subscription_expires_at,
        industry_id=user.industry_id,
    )
    db.add(store)
    db.flush()
    templates = {
        "سرپرست": ["products.view", "products.create", "products.edit", "products.quantity.change", "products.price.change", "categories.manage", "labels.manage", "products.bulk", "barcodes.lookup", "barcodes.manage", "labels.print", "dashboard.view", "tools.import", "tools.export", "tools.catalog"],
        "اپراتور موجودی": ["products.view", "products.create", "products.edit", "products.quantity.change", "categories.manage", "labels.manage", "barcodes.lookup", "dashboard.view"],
        "ویرایشگر قیمت": ["products.view", "products.price.change", "products.sale_price.view", "products.sale_price.change", "dashboard.view"],
        "مشاهده‌گر": ["products.view", "dashboard.view"],
    }
    for name, permissions in templates.items():
        db.add(StoreRole(store_id=store.id, name=name, permissions_json=json.dumps(permissions)))
    membership = StoreMembership(
        store_id=store.id,
        user_id=user.id,
        is_owner=True,
        status="active",
        role_id=None,
        authorization_checked_at=datetime.now(timezone.utc),
    )
    db.add(membership)
    db.flush()
    return StoreContext(store, membership, frozenset())


def ensure_owner_store(db: Session, user: User) -> StoreContext | None:
    """Compatibility bridge for databases created before TZ-012."""
    memberships = list(db.scalars(
        select(StoreMembership)
        .where(StoreMembership.user_id == user.id)
        .order_by(StoreMembership.is_owner.desc(), StoreMembership.id)
    ))
    active_memberships = [item for item in memberships if item.status == "active"]
    if len(active_memberships) > 1:
        raise HTTPException(status_code=409, detail="STORE_CONTEXT_AMBIGUOUS")
    membership = active_memberships[0] if active_memberships else (memberships[0] if memberships else None)
    if membership is not None:
        store = db.get(Store, membership.store_id)
        if store is None:
            return None
        return StoreContext(store, membership, _role_permissions(membership.role))
    # Serialize lazy workspace creation. Two first requests for the same
    # administrator/customer must not both observe an empty membership set and
    # race the unique owner-store constraint.
    db.scalar(
        select(User)
        .where(User.id == user.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    membership = db.scalar(
        select(StoreMembership)
        .where(StoreMembership.user_id == user.id)
        .order_by(StoreMembership.is_owner.desc(), StoreMembership.id)
        .limit(1)
    )
    if membership is not None:
        store = db.get(Store, membership.store_id)
        return None if store is None else StoreContext(store, membership, _role_permissions(membership.role))
    # Platform administrators get an isolated owner workspace as a safe
    # operational sandbox. This lets them exercise every customer workflow
    # without implicitly reading or mutating another store's data.
    return create_owner_store(db, user)


def active_store_context(db: Session, user: User) -> StoreContext:
    context = ensure_owner_store(db, user)
    if context is None:
        raise HTTPException(status_code=403, detail="STORE_MEMBERSHIP_REQUIRED")
    if context.membership.status != "active":
        raise HTTPException(status_code=403, detail="STORE_MEMBERSHIP_INACTIVE")
    return context


def owner_store_context(db: Session, user: User) -> StoreContext:
    context = active_store_context(db, user)
    if not context.is_owner:
        raise HTTPException(status_code=403, detail="STORE_OWNER_REQUIRED")
    return context


def store_data_owner_id(db: Session, user: User) -> int:
    """Legacy data columns continue to point at the original store owner."""
    return active_store_context(db, user).store.owner_user_id


def active_personnel_count(db: Session, store_id: int) -> int:
    return int(db.scalar(
        select(func.count(StoreMembership.id)).where(
            StoreMembership.store_id == store_id,
            StoreMembership.is_owner.is_(False),
            StoreMembership.status == "active",
        )
    ) or 0)


def attach_store_context(db: Session, user: User) -> StoreContext | None:
    from .store_authorization import effective_permissions

    context = ensure_owner_store(db, user)
    if context is None:
        return None
    role = context.membership.role
    user.store_id = context.store.id
    user.membership_id = context.membership.id
    user.store_role_id = context.membership.role_id
    user.store_role_name = "مالک" if context.is_owner else (role.name if role else None)
    user.store_permissions = sorted(effective_permissions(context))
    user.is_store_owner = context.is_owner
    user.temporary_password_required = context.membership.temporary_password_required
    user.credentials_notice_viewed = context.membership.credentials_notice_viewed_at is not None
    user.membership_authorization_checked_at = context.membership.authorization_checked_at
    user.store_operating_mode = context.store.operating_mode
    user.store_policy_version = context.store.policy_version
    user.store_policy_changed_at = context.store.policy_changed_at
    # `data_owner_id` remains a legacy wire/write compatibility value only.
    # Authorization and operational queries use the authenticated store id.
    user.data_owner_id = context.store.owner_user_id
    user.industry_id = context.store.industry_id
    if context.store.industry_id is not None:
        user.industry = db.get(Industry, context.store.industry_id)
    # During the older-client compatibility window, owner subscription columns
    # remain the write-compatible mirror. Personnel always inherit the store.
    if context.is_owner:
        context.store.plan = user.plan
        context.store.subscription_started_at = user.subscription_started_at
        context.store.subscription_expires_at = user.subscription_expires_at
    else:
        user.plan = context.store.plan
        user.subscription_started_at = context.store.subscription_started_at
        user.subscription_expires_at = context.store.subscription_expires_at
    return context

