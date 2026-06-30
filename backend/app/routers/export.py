import csv
import io

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from ..deps import CurrentUser, DbSession
from ..models import InventoryTransaction, InventoryItem

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/products/json")
def export_products_json(
    current_user: CurrentUser,
    db: DbSession,
):
    products = list(
        db.scalars(
            select(InventoryItem).where(InventoryItem.user_id == current_user.id)
        )
    )

    return products


@router.get("/products/csv")
def export_products_csv(
    current_user: CurrentUser,
    db: DbSession,
):
    products = list(
        db.scalars(
            select(InventoryItem).where(InventoryItem.user_id == current_user.id)
        )
    )

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(
        ["ID", "Name", "Quantity", "Price", "Status", "Category"]
    )

    for p in products:
        writer.writerow([
            p.id,
            p.name,
            p.quantity,
            p.price,
            p.status,
            p.category_id,
        ])

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=products.csv"
        },
    )


@router.get("/inventory/csv")
def export_inventory_csv(
    current_user: CurrentUser,
    db: DbSession,
):
    movements = list(
        db.scalars(
            select(InventoryTransaction).where(
                InventoryTransaction.user_id == current_user.id
            )
        )
    )

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(
        ["ID", "Product", "Type", "Quantity", "Reason", "Created At"]
    )

    for m in movements:
        writer.writerow([
            m.id,
            m.product_id,
            m.type,
            m.quantity,
            m.reason,
            m.created_at,
        ])

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=inventory.csv"
        },
    )