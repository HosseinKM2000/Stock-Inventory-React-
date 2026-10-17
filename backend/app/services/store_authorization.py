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
    return ALL_STORE_PERMISSIONS if context.is_owner else context.permissions


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

