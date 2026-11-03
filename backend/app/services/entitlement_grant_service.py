from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Store, StorePlanGrant, SubscriptionPlan, User
from .audit_service import record_admin_action


PAID_GRANT_PLAN_IDS = frozenset({"pro", "vip"})


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def grant_payload(grant: StorePlanGrant) -> dict:
    return {
        "id": grant.id,
        "request_id": grant.request_id,
        "store_id": grant.store_id,
        "plan_id": grant.plan_id,
        "source": grant.source,
        "reason": grant.reason,
        "starts_at": grant.starts_at,
        "ends_at": grant.ends_at,
        "granted_by_user_id": grant.granted_by_user_id,
        "revoked_at": grant.revoked_at,
        "revoked_by_user_id": grant.revoked_by_user_id,
        "revocation_reason": grant.revocation_reason,
        "created_at": grant.created_at,
    }


def _matching_retry(
    grant: StorePlanGrant,
    *,
    store_id: int,
    plan_id: str,
    source: str,
    reason: str,
    starts_at: datetime,
    ends_at: datetime,
) -> StorePlanGrant:
    expected = (store_id, plan_id, source, reason, starts_at, ends_at)
    actual = (
        grant.store_id,
        grant.plan_id,
        grant.source,
        grant.reason,
        _utc(grant.starts_at),
        _utc(grant.ends_at),
    )
    if actual != expected:
        raise HTTPException(409, detail="GRANT_REQUEST_REUSE_MISMATCH")
    return grant


def create_store_grant(
    db: Session,
    admin: User,
    *,
    request_id: str,
    store_id: int,
    plan_id: str,
    source: str,
    reason: str,
    starts_at: datetime,
    ends_at: datetime,
) -> StorePlanGrant:
    starts_at, ends_at = _utc(starts_at), _utc(ends_at)
    existing = db.scalar(select(StorePlanGrant).where(StorePlanGrant.request_id == request_id))
    if existing is not None:
        return _matching_retry(
            existing, store_id=store_id, plan_id=plan_id, source=source,
            reason=reason, starts_at=starts_at, ends_at=ends_at,
        )
    if ends_at <= starts_at:
        raise HTTPException(422, detail="GRANT_WINDOW_INVALID")
    if plan_id not in PAID_GRANT_PLAN_IDS:
        raise HTTPException(422, detail="GRANT_PLAN_UNSUPPORTED")
    plan = db.get(SubscriptionPlan, plan_id)
    if plan is None or not plan.is_active:
        raise HTTPException(409, detail="GRANT_PLAN_INACTIVE")
    store = db.scalar(select(Store).where(Store.id == store_id).with_for_update())
    if store is None:
        raise HTTPException(404, detail="STORE_NOT_FOUND")
    # The first lookup is the fast retry path. Recheck after serializing this
    # store so simultaneous retries converge instead of reaching the unique
    # request-id constraint in separate transactions.
    existing = db.scalar(select(StorePlanGrant).where(StorePlanGrant.request_id == request_id))
    if existing is not None:
        return _matching_retry(
            existing, store_id=store_id, plan_id=plan_id, source=source,
            reason=reason, starts_at=starts_at, ends_at=ends_at,
        )
    overlap = db.scalar(
        select(StorePlanGrant.id).where(
            StorePlanGrant.store_id == store_id,
            StorePlanGrant.revoked_at.is_(None),
            StorePlanGrant.starts_at < ends_at,
            StorePlanGrant.ends_at > starts_at,
        ).limit(1)
    )
    if overlap is not None:
        raise HTTPException(409, detail="GRANT_OVERLAP_UNSUPPORTED")
    grant = StorePlanGrant(
        request_id=request_id, store_id=store_id, plan_id=plan_id,
        source=source, reason=reason, starts_at=starts_at, ends_at=ends_at,
        granted_by_user_id=admin.id,
    )
    db.add(grant)
    db.flush()
    audit = grant_payload(grant)
    for key in ("starts_at", "ends_at", "created_at", "revoked_at"):
        if audit.get(key) is not None:
            audit[key] = audit[key].isoformat()
    record_admin_action(db, admin, "entitlement_grant.created", metadata=audit)
    return grant


def revoke_store_grant(db: Session, admin: User, grant_id: int, reason: str) -> StorePlanGrant:
    grant = db.scalar(select(StorePlanGrant).where(StorePlanGrant.id == grant_id).with_for_update())
    if grant is None:
        raise HTTPException(404, detail="GRANT_NOT_FOUND")
    if grant.revoked_at is None:
        grant.revoked_at = datetime.now(timezone.utc)
        grant.revoked_by_user_id = admin.id
        grant.revocation_reason = reason
        record_admin_action(db, admin, "entitlement_grant.revoked", metadata={"grant_id": grant.id, "reason": reason})
    return grant
