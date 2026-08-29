import csv
import io

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from ..deps import CurrentUser, DbSession, require_capability
from ..models import InventoryItem, InventoryTransaction
from ..schemas import InventoryOut

router = APIRouter(prefix="/export", tags=["export"])


# =========================
# EXPORT INVENTORY (JSON)
# =========================
@router.get("/inventory/json", response_model=list[InventoryOut])
def export_inventory_json(
    current_user: CurrentUser,
    db: DbSession,
):
    require_capability(db, current_user, "export.server")
    items = db.scalars(
        select(InventoryItem).options(joinedload(InventoryItem.catalog_product)).where(
            InventoryItem.user_id == current_user.id,
            InventoryItem.deleted_at.is_(None),
        ).order_by(InventoryItem.created_at.desc(), InventoryItem.id.desc())
    ).all()

    return items


# =========================
# EXPORT INVENTORY (CSV)
# =========================
@router.get("/inventory/csv")
def export_inventory_csv(
    current_user: CurrentUser,
    db: DbSession,
):
    require_capability(db, current_user, "export.server")
    items = db.scalars(
        select(InventoryItem).where(
            InventoryItem.user_id == current_user.id,
            InventoryItem.deleted_at.is_(None),
        ).order_by(InventoryItem.created_at.desc(), InventoryItem.id.desc())
    ).all()

    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output)

    writer.writerow([
        "ID",
        "Product Name",
        "Quantity",
        "Price",
        "Status",
        "Custom Label",
        "Catalog ID",
    ])

    for item in items:
        writer.writerow([
            item.id,
            item.catalog_product.name if item.catalog_product else None,
            item.quantity,
            item.price,
            item.status,
            item.custom_label,
            item.catalog_product_id,
        ])

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=inventory.csv"},
    )


# =========================
# EXPORT TRANSACTIONS (CSV)
# =========================
@router.get("/transactions/csv")
def export_transactions_csv(
    current_user: CurrentUser,
    db: DbSession,
):
    require_capability(db, current_user, "export.server")
    transactions = db.scalars(
        select(InventoryTransaction).where(
            InventoryTransaction.user_id == current_user.id
        ).order_by(
            InventoryTransaction.created_at.desc(),
            InventoryTransaction.id.desc(),
        )
    ).all()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "ID",
        "Inventory Item ID",
        "Type",
        "Quantity",
        "Note",
        "Created At",
    ])

    for t in transactions:
        writer.writerow([
            t.id,
            t.inventory_item_id,
            t.type,
            t.quantity,
            t.note,
            t.created_at,
        ])

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"},
    )
