import csv
import io

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload

from ..deps import CurrentUser, DbSession, require_capability
from ..services.store_authorization import StorePermission, require_store_permission, effective_permissions, project_inventory_item
from ..services.store_service import active_store_context
from ..models import InventoryItem, InventoryTransaction
from ..schemas import InventoryOut
from ..services.tool_policy import require_tool
from ..services.jalali_date import format_jalali_datetime

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
    require_store_permission(db, current_user, StorePermission.EXPORT_USE)
    require_tool(db, current_user, "export")
    items = db.scalars(
        select(InventoryItem).options(joinedload(InventoryItem.catalog_product)).where(
            InventoryItem.store_id == current_user.store_id,
            InventoryItem.deleted_at.is_(None),
        ).order_by(InventoryItem.created_at.desc(), InventoryItem.id.desc())
    ).all()

    return [project_inventory_item(db, current_user, item) for item in items]


# =========================
# EXPORT INVENTORY (CSV)
# =========================
@router.get("/inventory/csv")
def export_inventory_csv(
    current_user: CurrentUser,
    db: DbSession,
):
    require_capability(db, current_user, "export.server")
    require_store_permission(db, current_user, StorePermission.EXPORT_USE)
    require_tool(db, current_user, "export")
    items = db.scalars(
        select(InventoryItem).options(selectinload(InventoryItem.barcodes)).where(
            InventoryItem.store_id == current_user.store_id,
            InventoryItem.deleted_at.is_(None),
        ).order_by(InventoryItem.created_at.desc(), InventoryItem.id.desc())
    ).all()

    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output)

    permissions = effective_permissions(active_store_context(db, current_user))
    include_purchase = StorePermission.PURCHASE_PRICE_VIEW.value in permissions
    writer.writerow([
        "ID",
        "Primary Barcode",
        "Product Name",
        "Quantity",
        "Is Packaged",
        "Pack Size",
        "Sale Price",
        *(["Purchase Price"] if include_purchase else []),
        "Status",
        "Custom Label",
        "Catalog ID",
    ])

    for item in items:
        active_barcodes = [barcode for barcode in item.barcodes if barcode.is_active]
        primary_barcode = next((barcode.value for barcode in active_barcodes if barcode.is_default), active_barcodes[0].value if active_barcodes else "")
        writer.writerow([
            item.id,
            primary_barcode,
            item.catalog_product.name if item.catalog_product else None,
            item.quantity,
            item.catalog_product.is_packaged if item.catalog_product else False,
            item.catalog_product.pack_size if item.catalog_product else None,
            item.sale_price if item.sale_price is not None else "",
            *([item.purchase_price if item.purchase_price is not None else ""] if include_purchase else []),
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
    require_store_permission(db, current_user, StorePermission.EXPORT_USE)
    require_tool(db, current_user, "export")
    transactions = db.scalars(
        select(InventoryTransaction).where(
            InventoryTransaction.store_id == current_user.store_id
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
            format_jalali_datetime(t.created_at),
        ])

    output.seek(0)

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"},
    )
