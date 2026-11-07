from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from ..deps import CurrentProductReader, DbSession
from ..models import Invoice
from ..services.invoice_service import invoice_record
from ..services.store_authorization import StorePermission, effective_permissions
from ..services.store_service import active_store_context


router = APIRouter(prefix="/invoices", tags=["invoices"])


def _read_context(db: DbSession, user: CurrentProductReader):
    permissions = effective_permissions(active_store_context(db, user))
    if StorePermission.INVOICES_VIEW.value not in permissions:
        raise HTTPException(403, detail=f"PERMISSION_REQUIRED:{StorePermission.INVOICES_VIEW.value}")
    # Historical invoices remain readable after a downgrade. New posting,
    # cancellation, reports and output still require the current capability.
    return permissions


@router.get("")
def list_invoices(current_user: CurrentProductReader, db: DbSession) -> list[dict]:
    permissions = _read_context(db, current_user)
    rows = db.execute(
        select(Invoice)
        .options(joinedload(Invoice.lines))
        .where(Invoice.store_id == current_user.store_id)
        .order_by(Invoice.posted_at.desc(), Invoice.id.desc())
    ).unique().scalars().all()
    show_purchase = StorePermission.PURCHASE_PRICE_VIEW.value in permissions
    return [invoice_record(row, include_purchase_prices=show_purchase) for row in rows]


@router.get("/{invoice_id}")
def get_invoice(invoice_id: int, current_user: CurrentProductReader, db: DbSession) -> dict:
    permissions = _read_context(db, current_user)
    row = db.execute(
        select(Invoice)
        .options(joinedload(Invoice.lines))
        .where(Invoice.id == invoice_id, Invoice.store_id == current_user.store_id)
    ).unique().scalar_one_or_none()
    if row is None:
        raise HTTPException(404, detail="INVOICE_NOT_FOUND")
    return invoice_record(
        row,
        include_purchase_prices=StorePermission.PURCHASE_PRICE_VIEW.value in permissions,
    )
