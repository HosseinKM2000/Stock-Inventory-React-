from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Store, StoreModeTransition, User
from ..schemas import StoreOperatingModeOut, SyncOperationIn, TeamActivationRequest
from .authorization_service import is_admin
from .store_service import StoreContext, active_store_context, owner_store_context
from .subscription_service import entitlement_for_store


POLICY_CONTEXT_REQUIRED = "STORE_POLICY_CONTEXT_REQUIRED"
POLICY_STALE = "STORE_POLICY_STALE"
TEAM_SERVER_ACCEPTANCE_REQUIRED = "TEAM_SERVER_ACCEPTANCE_REQUIRED"


def _locked_store(db: Session, store_id: int) -> Store:
    store = db.scalar(select(Store).where(Store.id == store_id).with_for_update())
    if store is None:
        raise HTTPException(status_code=404, detail="STORE_NOT_FOUND")
    return store


def team_eligible(db: Session, store: Store, actor: User) -> bool:
    return is_admin(actor) or bool(
        entitlement_for_store(db, store)["capabilities"].get("personnel", False)
    )


def mode_payload(db: Session, context: StoreContext, actor: User) -> StoreOperatingModeOut:
    store = context.store
    return StoreOperatingModeOut(
        operating_mode=store.operating_mode,
        policy_version=store.policy_version,
        changed_at=store.policy_changed_at,
        changed_by_user_id=store.policy_changed_by_user_id,
        team_eligible=team_eligible(db, store, actor),
    )


def require_direct_mutation_allowed(db: Session, actor: User) -> StoreContext:
    context = active_store_context(db, actor)
    store = _locked_store(db, context.store.id)
    if store.operating_mode == "team":
        raise HTTPException(status_code=409, detail=TEAM_SERVER_ACCEPTANCE_REQUIRED)
    if not context.is_owner:
        raise HTTPException(status_code=403, detail="TEAM_MODE_REQUIRED_FOR_PERSONNEL_WRITE")
    return StoreContext(store=store, membership=context.membership, permissions=context.permissions)


def validate_sync_acceptance(
    db: Session,
    actor: User,
    operation: SyncOperationIn,
) -> StoreContext:
    context = active_store_context(db, actor)
    store = _locked_store(db, context.store.id)
    if store.operating_mode == "solo":
        if not context.is_owner:
            raise ValueError("TEAM_MODE_REQUIRED_FOR_PERSONNEL_WRITE")
        # Schema-2 owner operations remain accepted during the controlled client
        # upgrade. Explicit forged team context is never accepted in solo mode.
        if operation.execution_mode not in {None, "solo"}:
            raise ValueError(POLICY_STALE)
        if operation.policy_version is not None and operation.policy_version != store.policy_version:
            raise ValueError(POLICY_STALE)
        return StoreContext(store=store, membership=context.membership, permissions=context.permissions)

    if operation.execution_mode is None or operation.policy_version is None:
        raise ValueError(POLICY_CONTEXT_REQUIRED)
    if operation.execution_mode != "team" or operation.policy_version != store.policy_version:
        raise ValueError(POLICY_STALE)
    return StoreContext(store=store, membership=context.membership, permissions=context.permissions)


def activate_team_mode(
    db: Session,
    actor: User,
    payload: TeamActivationRequest,
) -> StoreOperatingModeOut:
    context = owner_store_context(db, actor)
    store = _locked_store(db, context.store.id)
    previous = db.scalar(select(StoreModeTransition).where(
        StoreModeTransition.store_id == store.id,
        StoreModeTransition.transition_id == payload.transition_id,
    ))
    if previous is not None:
        if previous.actor_user_id != actor.id or previous.to_mode != "team":
            raise HTTPException(status_code=409, detail="MODE_TRANSITION_ID_REUSED")
        return mode_payload(db, StoreContext(store, context.membership, context.permissions), actor)
    if store.operating_mode == "team":
        raise HTTPException(status_code=409, detail="TEAM_MODE_ALREADY_ACTIVE")
    if store.policy_version != payload.expected_policy_version:
        raise HTTPException(status_code=409, detail=POLICY_STALE)
    if not team_eligible(db, store, actor):
        raise HTTPException(status_code=403, detail="TEAM_MODE_ENTITLEMENT_REQUIRED")

    now = datetime.now(timezone.utc)
    before_version = store.policy_version
    store.operating_mode = "team"
    store.policy_version += 1
    store.policy_changed_at = now
    store.policy_changed_by_user_id = actor.id
    db.add(StoreModeTransition(
        store_id=store.id,
        actor_user_id=actor.id,
        actor_membership_id=context.membership.id,
        transition_id=payload.transition_id,
        from_mode="solo",
        to_mode="team",
        from_policy_version=before_version,
        to_policy_version=store.policy_version,
        created_at=now,
    ))
    db.flush()
    return mode_payload(db, StoreContext(store, context.membership, context.permissions), actor)
