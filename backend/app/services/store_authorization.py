from enum import Enum

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import User
from .store_service import StoreContext, active_store_context
from .subscription_service import entitlement_for_store


class StorePermission(str, Enum):
    PRODUCTS_VIEW = "products.view"
    PRODUCTS_CREATE = "products.create"
    PRODUCTS_EDIT = "products.edit"
    QUANTITY_CHANGE = "products.quantity.change"
    PRICE_CHANGE = "products.price.change"
    SALE_PRICE_VIEW = "products.sale_price.view"
    SALE_PRICE_CHANGE = "products.sale_price.change"
    PURCHASE_PRICE_VIEW = "products.purchase_price.view"
    PURCHASE_PRICE_CHANGE = "products.purchase_price.change"
    FINANCE_VIEW = "finance.view"
    PRODUCTS_DELETE = "products.delete"
    CATEGORIES_MANAGE = "categories.manage"
    LABELS_MANAGE = "labels.manage"
    BULK_ACTIONS = "products.bulk"
    DASHBOARD_VIEW = "dashboard.view"
    IMPORT_USE = "tools.import"
    EXPORT_USE = "tools.export"
    CATALOG_USE = "tools.catalog"
    BACKUP_USE = "tools.backup"
    RESTORE_USE = "tools.restore"
    ACTIVITY_VIEW = "activity.view"
    BARCODE_LOOKUP = "barcodes.lookup"
    BARCODE_MANAGE = "barcodes.manage"
    LABEL_PRINT = "labels.print"


ALL_STORE_PERMISSIONS = frozenset(item.value for item in StorePermission)
PERMISSION_DEPENDENCIES: dict[str, frozenset[str]] = {
    StorePermission.PRODUCTS_CREATE.value: frozenset({StorePermission.PRODUCTS_VIEW.value}),
    StorePermission.PRODUCTS_EDIT.value: frozenset({StorePermission.PRODUCTS_VIEW.value}),
    StorePermission.QUANTITY_CHANGE.value: frozenset({StorePermission.PRODUCTS_VIEW.value}),
    StorePermission.PRICE_CHANGE.value: frozenset({StorePermission.PRODUCTS_VIEW.value}),
    StorePermission.SALE_PRICE_VIEW.value: frozenset({StorePermission.PRODUCTS_VIEW.value}),
    StorePermission.SALE_PRICE_CHANGE.value: frozenset({StorePermission.SALE_PRICE_VIEW.value}),
    StorePermission.PURCHASE_PRICE_VIEW.value: frozenset({StorePermission.PRODUCTS_VIEW.value}),
    StorePermission.PURCHASE_PRICE_CHANGE.value: frozenset({StorePermission.PURCHASE_PRICE_VIEW.value}),
    StorePermission.FINANCE_VIEW.value: frozenset({StorePermission.PURCHASE_PRICE_VIEW.value, StorePermission.SALE_PRICE_VIEW.value, StorePermission.DASHBOARD_VIEW.value}),
    StorePermission.PRODUCTS_DELETE.value: frozenset({StorePermission.PRODUCTS_VIEW.value}),
    StorePermission.BULK_ACTIONS.value: frozenset({StorePermission.PRODUCTS_VIEW.value}),
    StorePermission.IMPORT_USE.value: frozenset({StorePermission.PRODUCTS_VIEW.value, StorePermission.PRODUCTS_CREATE.value}),
    StorePermission.EXPORT_USE.value: frozenset({StorePermission.PRODUCTS_VIEW.value}),
    StorePermission.BACKUP_USE.value: frozenset({StorePermission.PRODUCTS_VIEW.value}),
    StorePermission.RESTORE_USE.value: frozenset({StorePermission.BACKUP_USE.value}),
    StorePermission.BARCODE_LOOKUP.value: frozenset({StorePermission.PRODUCTS_VIEW.value}),
    StorePermission.BARCODE_MANAGE.value: frozenset({StorePermission.BARCODE_LOOKUP.value, StorePermission.PRODUCTS_EDIT.value}),
    StorePermission.LABEL_PRINT.value: frozenset({StorePermission.BARCODE_LOOKUP.value}),
}


def normalize_permissions(values: list[str]) -> list[str]:
    unknown = set(values) - ALL_STORE_PERMISSIONS
    if unknown:
        raise HTTPException(status_code=422, detail=f"UNKNOWN_PERMISSION:{sorted(unknown)[0]}")
    expanded = set(values)
    changed = True
    while changed:
        before = len(expanded)
        for permission in tuple(expanded):
            expanded.update(PERMISSION_DEPENDENCIES.get(permission, ()))
        changed = len(expanded) != before
    return sorted(expanded)


def effective_permissions(context: StoreContext) -> frozenset[str]:
    if context.is_owner:
        return ALL_STORE_PERMISSIONS
    expanded = set(context.permissions)
    # Existing product viewers keep seeing the legacy sale price. Existing
    # price editors retain sale-price edit authority after the split.
    if StorePermission.PRODUCTS_VIEW.value in expanded:
        expanded.add(StorePermission.SALE_PRICE_VIEW.value)
    if StorePermission.PRICE_CHANGE.value in expanded:
        expanded.update({StorePermission.SALE_PRICE_VIEW.value, StorePermission.SALE_PRICE_CHANGE.value})
    changed = True
    while changed:
        before = len(expanded)
        for permission in tuple(expanded):
            expanded.update(PERMISSION_DEPENDENCIES.get(permission, ()))
        changed = len(expanded) != before
    return frozenset(expanded)


def require_store_permission(db: Session, user: User, permission: StorePermission) -> StoreContext:
    context = active_store_context(db, user)
    if context.membership.temporary_password_required:
        raise HTTPException(status_code=428, detail="TEMPORARY_PASSWORD_CHANGE_REQUIRED")
    if permission.value not in effective_permissions(context):
        raise HTTPException(status_code=403, detail=f"PERMISSION_REQUIRED:{permission.value}")
    entitlement = entitlement_for_store(db, context.store)
    if not context.is_owner and not entitlement["capabilities"].get("personnel", False):
        raise HTTPException(status_code=403, detail="PERSONNEL_ENTITLEMENT_REQUIRED")
    return context


def project_inventory_item(db: Session, user: User, item) -> dict:
    """Serialize an inventory item without leaking restricted commercial fields."""
    from ..schemas import InventoryOut

    permissions = effective_permissions(active_store_context(db, user))
    sale_price = item.sale_price
    record = InventoryOut.model_validate(item).model_dump(mode="json")
    record.update(
        sale_price=sale_price,
        purchase_price=item.purchase_price,
        price=sale_price or 0,
        price_missing=sale_price is None,
    )
    if StorePermission.PURCHASE_PRICE_VIEW.value not in permissions:
        record["purchase_price"] = None
    if StorePermission.SALE_PRICE_VIEW.value not in permissions:
        record.update(sale_price=None, price=0, price_missing=True)
    return record

