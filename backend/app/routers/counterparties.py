from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select

from ..deps import CurrentUser, DbSession
from ..models import Counterparty
from ..schemas import CounterpartyCreate, CounterpartyOut, CounterpartyUpdate
from ..services.authorization_service import is_admin
from ..services.store_authorization import StorePermission, require_store_permission
from ..services.subscription_service import entitlement_for_store


router = APIRouter(prefix="/counterparties", tags=["counterparties"])


def _authorize(db: DbSession, user: CurrentUser, *, manage: bool = False):
    required = StorePermission.COUNTERPARTIES_MANAGE if manage else StorePermission.COUNTERPARTIES_VIEW
    context = require_store_permission(db, user, required)
    if not is_admin(user):
        capabilities = entitlement_for_store(db, context.store)["capabilities"]
        if not (capabilities.get("invoices.purchase") or capabilities.get("invoices.sale")):
            raise HTTPException(403, detail="CAPABILITY_REQUIRED:invoices.purchase|invoices.sale")
    return context


def _owned(db: DbSession, store_id: int, counterparty_id: int) -> Counterparty:
    row = db.scalar(select(Counterparty).where(
        Counterparty.id == counterparty_id,
        Counterparty.store_id == store_id,
    ))
    if row is None:
        raise HTTPException(404, detail="COUNTERPARTY_NOT_FOUND")
    return row


@router.get("", response_model=list[CounterpartyOut])
def list_counterparties(current_user: CurrentUser, db: DbSession):
    context = _authorize(db, current_user)
    return list(db.scalars(
        select(Counterparty)
        .where(Counterparty.store_id == context.store.id)
        .order_by(Counterparty.name, Counterparty.id)
    ))


@router.post("", response_model=CounterpartyOut, status_code=201)
def create_counterparty(payload: CounterpartyCreate, current_user: CurrentUser, db: DbSession):
    context = _authorize(db, current_user, manage=True)
    row = Counterparty(
        store_id=context.store.id,
        created_by_user_id=current_user.id,
        **payload.model_dump(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{counterparty_id}", response_model=CounterpartyOut)
def update_counterparty(counterparty_id: int, payload: CounterpartyUpdate, current_user: CurrentUser, db: DbSession):
    context = _authorize(db, current_user, manage=True)
    row = _owned(db, context.store.id, counterparty_id)
    changes = payload.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] is None:
        raise HTTPException(422, detail="COUNTERPARTY_NAME_REQUIRED")
    if "kind" in changes and changes["kind"] is None:
        raise HTTPException(422, detail="COUNTERPARTY_KIND_REQUIRED")
    for key, value in changes.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{counterparty_id}", status_code=204)
def delete_counterparty(counterparty_id: int, current_user: CurrentUser, db: DbSession):
    context = _authorize(db, current_user, manage=True)
    row = _owned(db, context.store.id, counterparty_id)
    db.delete(row)
    db.commit()
    return Response(status_code=204)
