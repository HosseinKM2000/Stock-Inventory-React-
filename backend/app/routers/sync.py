import json
import uuid
import re
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload, selectinload

from ..config import settings
from ..deps import CurrentProductReader, DbSession
from ..models import (
    CatalogProduct,
    Category,
    InventoryItem,
    InventoryMovement,
    InventoryTransaction,
    Label,
    ProductBarcode,
    SyncChange,
    SyncOperation,
    User,
)
from ..services.subscription_service import entitlement_for_user
from ..services.tool_policy import tool_allowed
from ..services.authorization_service import is_admin
from ..services.activity_service import record_store_activity
from ..services.store_authorization import StorePermission, effective_permissions
from ..services.store_service import active_store_context
from ..schemas import (
    InventoryOut,
    InventoryMovementOut,
    BarcodeOut,
    BarcodeSnapshot,
    SyncBatchRequest,
    SyncBatchResponse,
    SyncChangeOut,
    SyncChangesResponse,
    SyncOperationIn,
    SyncOperationResult,
)

router = APIRouter(prefix="/sync", tags=["sync"])

_IMAGE_EXTENSIONS = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/gif": ".gif",
}
_MAX_IMAGE_BYTES = 10 * 1024 * 1024
_MINIMUM_CLIENT_DATA_SCHEMA = 2


def _require_store_aware_client(value: int | None) -> None:
    if value is None or value < _MINIMUM_CLIENT_DATA_SCHEMA:
        raise HTTPException(status_code=426, detail="CLIENT_UPDATE_REQUIRED:STORE_WORKSPACE")


def _authorize_operation(db: DbSession, user: User, operation: SyncOperationIn) -> None:
    permissions = effective_permissions(active_store_context(db, user))
    required: set[str]
    if operation.entity == "barcode":
        required = {StorePermission.BARCODE_MANAGE.value}
    elif operation.entity == "inventory_movement":
        required = {StorePermission.BARCODE_LOOKUP.value, StorePermission.QUANTITY_CHANGE.value}
    elif operation.entity == "label":
        required = {StorePermission.LABELS_MANAGE.value}
    elif operation.entity == "category":
        required = {StorePermission.CATEGORIES_MANAGE.value}
    elif operation.entity != "product":
        raise ValueError("UNKNOWN_SYNC_ENTITY")
    elif operation.operation == "DELETE":
        required = {StorePermission.PRODUCTS_DELETE.value}
    elif operation.operation == "CREATE":
        required = {StorePermission.PRODUCTS_CREATE.value}
    else:
        payload = operation.payload or {}
        required = set()
        if "quantity" in payload:
            required.add(StorePermission.QUANTITY_CHANGE.value)
        if "price" in payload:
            required.add(StorePermission.PRICE_CHANGE.value)
        if set(payload) - {"quantity", "price"}:
            required.add(StorePermission.PRODUCTS_EDIT.value)
    missing = required - permissions
    if missing:
        raise ValueError(f"PERMISSION_REQUIRED:{sorted(missing)[0]}")
    capabilities = entitlement_for_user(db, user)["capabilities"]
    feature = "barcode.manage" if operation.entity == "barcode" else "barcode.lookup" if operation.entity == "inventory_movement" else "inventory.write"
    if not capabilities.get(feature, False):
        raise ValueError(f"CAPABILITY_REQUIRED:{feature}")
    if not capabilities.get("inventory.write", False):
        raise ValueError("CAPABILITY_REQUIRED:inventory.write")


def _serialize(item: InventoryItem) -> dict:
    return InventoryOut.model_validate(item).model_dump(mode="json")


def _result_from_json(value: str) -> SyncOperationResult:
    return SyncOperationResult.model_validate_json(value)


def _packaging_values(
    payload: dict,
    current_packaged: bool = False,
    current_pack_size: int | None = None,
) -> tuple[bool, int | None]:
    is_packaged = payload.get("is_packaged", current_packaged)
    pack_size = payload.get("pack_size", current_pack_size)
    if not isinstance(is_packaged, bool):
        raise ValueError("PACKAGING_FLAG_INVALID")
    if not is_packaged:
        return False, None
    if isinstance(pack_size, bool) or not isinstance(pack_size, int) or pack_size < 1:
        raise ValueError("PACK_SIZE_REQUIRED")
    return True, pack_size


def _catalog_for_operation(
    db: DbSession,
    user: User,
    operation: SyncOperationIn,
) -> CatalogProduct:
    payload = operation.payload or {}
    catalog_payload = payload.get("catalog_product") or {}
    catalog_id = catalog_payload.get("id")

    if isinstance(catalog_id, int) and catalog_id > 0:
        catalog = db.get(CatalogProduct, catalog_id)
        if (
            catalog is not None
            and catalog.is_shared
            and catalog.is_active
            and catalog.industry_id == user.industry_id
        ):
            return catalog
        raise ValueError("CATALOG_PRODUCT_NOT_AVAILABLE")

    if user.industry_id is None:
        raise ValueError("An industry is required before creating a product")

    name = catalog_payload.get("name") or payload.get("custom_label")
    if not isinstance(name, str) or not name.strip():
        raise ValueError("Product name is required")

    is_packaged, pack_size = _packaging_values(catalog_payload)
    catalog = CatalogProduct(
        industry_id=user.industry_id,
        name=name.strip(),
        description=catalog_payload.get("description"),
        brand=catalog_payload.get("brand"),
        is_packaged=is_packaged,
        pack_size=pack_size,
        is_shared=False,
    )
    db.add(catalog)
    db.flush()
    return catalog


def _apply_fields(
    db: DbSession,
    user_id: int,
    item: InventoryItem,
    payload: dict,
) -> None:
    catalog_payload = payload.get("catalog_product") or {}
    if not isinstance(catalog_payload, dict):
        raise ValueError("CATALOG_PRODUCT_INVALID")
    if (
        not item.catalog_product.is_shared
        and ("is_packaged" in catalog_payload or "pack_size" in catalog_payload)
    ):
        is_packaged, pack_size = _packaging_values(
            catalog_payload,
            item.catalog_product.is_packaged,
            item.catalog_product.pack_size,
        )
        item.catalog_product.is_packaged = is_packaged
        item.catalog_product.pack_size = pack_size

    for field in ("quantity", "price", "low_stock_threshold"):
        if field in payload:
            value = payload[field]
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise ValueError(f"{field} must be a non-negative integer")
            setattr(item, field, value)

    for field in ("low_stock_alert", "is_hidden"):
        if field in payload:
            value = payload[field]
            if not isinstance(value, bool):
                raise ValueError(f"{field} must be a boolean")
            setattr(item, field, value)

    for field in ("custom_label", "note"):
        if field in payload:
            value = payload[field]
            if value is not None and not isinstance(value, str):
                raise ValueError(f"{field} must be text or null")
            setattr(item, field, value)

    if "category_id" in payload:
        value = payload["category_id"]
        if value is not None and (isinstance(value, bool) or not isinstance(value, int)):
            raise ValueError("category_id must be an integer or null")
        if value is not None:
            category = db.scalar(
                select(Category).where(
                    Category.id == value,
                    Category.user_id == user_id,
                )
            )
            if category is None:
                raise ValueError("CATEGORY_NOT_AVAILABLE")
        item.category_id = value

    if "label_ids" in payload:
        values = payload["label_ids"]
        if not isinstance(values, list) or any(isinstance(value, bool) or not isinstance(value, int) for value in values):
            raise ValueError("label_ids must be an integer list")
        unique_ids = list(dict.fromkeys(values))
        labels = list(db.scalars(select(Label).where(
            Label.user_id == user_id, Label.id.in_(unique_ids)
        ))) if unique_ids else []
        if len(labels) != len(unique_ids):
            raise ValueError("LABEL_NOT_AVAILABLE")
        item.labels = labels


def _normalize_label(value: str) -> tuple[str, str]:
    import unicodedata
    name = " ".join(unicodedata.normalize("NFC", value).strip().split())
    if not name or len(name) > 60:
        raise ValueError("LABEL_NAME_INVALID")
    return name, name.casefold()


def _apply_label(db: DbSession, user_id: int, operation: SyncOperationIn) -> SyncOperationResult:
    label = db.scalar(select(Label).where(Label.id == operation.entity_id, Label.user_id == user_id))
    if operation.operation == "DELETE":
        if label is not None:
            affected = list(label.inventory_items)
            for item in affected:
                item.labels = [existing for existing in item.labels if existing.id != label.id]
            db.flush()
            for item in affected:
                _record_change(db, user_id, item.id, "UPSERT", _serialize(item))
            db.delete(label)
        return SyncOperationResult(operation_id=operation.operation_id, status="applied", entity_id=operation.entity_id)
    payload = operation.payload or {}
    raw_name = payload.get("name")
    if not isinstance(raw_name, str):
        raise ValueError("LABEL_NAME_INVALID")
    name, normalized = _normalize_label(raw_name)
    duplicate = db.scalar(select(Label).where(
        Label.user_id == user_id, Label.normalized_name == normalized, Label.id != operation.entity_id
    ))
    if duplicate is not None:
        raise ValueError("LABEL_NAME_EXISTS")
    if label is None:
        if operation.operation == "UPDATE":
            raise ValueError("LABEL_NOT_FOUND")
        label = Label(id=operation.entity_id, user_id=user_id, name=name, normalized_name=normalized)
        db.add(label)
    else:
        if operation.base_version is not None and label.version != operation.base_version:
            return SyncOperationResult(operation_id=operation.operation_id, status="conflict", entity_id=label.id, error="Server record has a newer version")
        label.name = name
        label.normalized_name = normalized
        label.version += 1
    db.flush()
    return SyncOperationResult(
        operation_id=operation.operation_id, status="applied", entity_id=label.id,
        record={"id": label.id, "name": label.name, "normalized_name": label.normalized_name,
                "version": label.version, "created_at": label.created_at, "updated_at": label.updated_at},
    )


def _apply_category(db: DbSession, user_id: int, operation: SyncOperationIn) -> SyncOperationResult:
    category = db.scalar(select(Category).where(Category.id == operation.entity_id, Category.user_id == user_id))
    if operation.operation == "DELETE":
        if category is not None:
            for item in list(db.scalars(select(InventoryItem).where(
                InventoryItem.user_id == user_id, InventoryItem.category_id == category.id
            ))):
                item.category_id = None
                db.flush()
                _record_change(db, user_id, item.id, "UPSERT", _serialize(item))
            db.delete(category)
        return SyncOperationResult(operation_id=operation.operation_id, status="applied", entity_id=operation.entity_id)
    payload = operation.payload or {}
    name = payload.get("name")
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 120:
        raise ValueError("CATEGORY_NAME_INVALID")
    duplicate = db.scalar(select(Category).where(
        Category.user_id == user_id, Category.name == name.strip(), Category.id != operation.entity_id
    ))
    if duplicate is not None:
        raise ValueError("CATEGORY_NAME_EXISTS")
    if category is None:
        if operation.operation == "UPDATE":
            raise ValueError("CATEGORY_NOT_FOUND")
        category = Category(id=operation.entity_id, user_id=user_id, name=name.strip())
        db.add(category)
    category.name = name.strip()
    description = payload.get("description")
    if description is not None and not isinstance(description, str):
        raise ValueError("CATEGORY_DESCRIPTION_INVALID")
    category.description = description
    db.flush()
    return SyncOperationResult(
        operation_id=operation.operation_id, status="applied", entity_id=category.id,
        record={"id": category.id, "name": category.name, "description": category.description,
                "created_at": category.created_at, "updated_at": category.updated_at},
    )


_CODE128_ASCII = re.compile(r"^[\x20-\x7E]+$")
_BARCODE_LENGTHS = {"ean13": 13, "ean8": 8, "upca": 12, "upce": 8}


def _numeric_checksum(value: str) -> bool:
    digits = [int(value) for value in value]
    check = digits.pop()
    total = sum(digit * (3 if position % 2 == 0 else 1) for position, digit in enumerate(reversed(digits)))
    return (10 - total % 10) % 10 == check


def _expand_upce(value: str) -> str | None:
    if len(value) != 8 or not value.isdigit() or value[0] not in {"0", "1"}:
        return None
    number_system, body, check = value[0], value[1:7], value[7]
    last = body[5]
    if last in "012":
        return f"{number_system}{body[:2]}{last}0000{body[2:5]}{check}"
    if last == "3":
        return f"{number_system}{body[:3]}00000{body[3:5]}{check}"
    if last == "4":
        return f"{number_system}{body[:4]}00000{body[4]}{check}"
    return f"{number_system}{body[:5]}0000{last}{check}"


def _barcode_candidates(value: str, symbology: str) -> set[str]:
    values = {value}
    if symbology == "upca":
        values.add(f"0{value}")
    elif symbology == "ean13" and value.startswith("0") and _numeric_checksum(value[1:]):
        values.add(value[1:])
    return values


def _validate_barcode(value: object, symbology: object) -> tuple[str, str]:
    if not isinstance(value, str) or not value or len(value) > 64:
        raise ValueError("BARCODE_VALUE_INVALID")
    if not isinstance(symbology, str) or symbology not in {"code128", "ean13", "ean8", "upca", "upce", "unknown"}:
        raise ValueError("BARCODE_SYMBOLOGY_INVALID")
    if symbology in {"code128", "unknown"}:
        if _CODE128_ASCII.fullmatch(value) is None:
            raise ValueError("BARCODE_CHARSET_INVALID")
    elif not value.isascii() or not value.isdigit() or len(value) != _BARCODE_LENGTHS[symbology]:
        raise ValueError("BARCODE_FORMAT_INVALID")
    else:
        checksum_value = _expand_upce(value) if symbology == "upce" else value
        if checksum_value is None or not _numeric_checksum(checksum_value):
            raise ValueError("BARCODE_CHECKSUM_INVALID")
    return value, symbology


def _apply_barcode(db: DbSession, user: User, operation: SyncOperationIn) -> SyncOperationResult:
    barcode = db.scalar(select(ProductBarcode).where(
        ProductBarcode.id == operation.entity_id,
        ProductBarcode.store_id == user.store_id,
    ))
    if operation.operation == "DELETE":
        if barcode is not None:
            db.delete(barcode)
        return SyncOperationResult(operation_id=operation.operation_id, status="applied", entity_id=operation.entity_id)

    payload = operation.payload or {}
    value, symbology = _validate_barcode(payload.get("value"), payload.get("symbology", "code128"))
    product_id = payload.get("product_id")
    if isinstance(product_id, bool) or not isinstance(product_id, int):
        raise ValueError("BARCODE_PRODUCT_INVALID")
    product = db.scalar(select(InventoryItem).where(
        InventoryItem.id == product_id,
        InventoryItem.store_id == user.store_id,
        InventoryItem.deleted_at.is_(None),
    ))
    if product is None:
        raise ValueError("BARCODE_PRODUCT_NOT_FOUND")
    duplicate = db.scalar(select(ProductBarcode).where(
        ProductBarcode.store_id == user.store_id,
        ProductBarcode.value.in_(_barcode_candidates(value, symbology)),
        ProductBarcode.id != operation.entity_id,
    ))
    if duplicate is not None:
        return SyncOperationResult(operation_id=operation.operation_id, status="conflict", entity_id=operation.entity_id, error="BARCODE_ALREADY_ASSIGNED")
    created = barcode is None
    if created:
        if operation.operation == "UPDATE":
            raise ValueError("BARCODE_NOT_FOUND")
        barcode = ProductBarcode(id=operation.entity_id, store_id=user.store_id, product_id=product.id, value=value, source="manufacturer")
        db.add(barcode)
    elif operation.base_version is not None and barcode.version != operation.base_version:
        return SyncOperationResult(operation_id=operation.operation_id, status="conflict", entity_id=barcode.id, record=BarcodeOut.model_validate(barcode).model_dump(mode="json"), error="Server record has a newer version")

    source = payload.get("source")
    meaning = payload.get("meaning")
    scan_quantity = payload.get("scan_quantity")
    if source not in {"manufacturer", "tanzim"}:
        raise ValueError("BARCODE_SOURCE_INVALID")
    if meaning not in {"unit", "package"}:
        raise ValueError("BARCODE_MEANING_INVALID")
    if isinstance(scan_quantity, bool) or not isinstance(scan_quantity, int) or scan_quantity < 1:
        raise ValueError("BARCODE_SCAN_QUANTITY_INVALID")
    if meaning == "unit" and scan_quantity != 1:
        raise ValueError("UNIT_BARCODE_QUANTITY_INVALID")
    if source == "tanzim" and (symbology != "code128" or not value.startswith("TZ-")):
        raise ValueError("INTERNAL_BARCODE_INVALID")

    barcode.product_id = product.id
    barcode.value = value
    barcode.source = source
    barcode.symbology = symbology
    barcode.meaning = meaning
    barcode.scan_quantity = scan_quantity
    barcode.is_active = bool(payload.get("is_active", True))
    barcode.is_default = bool(payload.get("is_default", False))
    barcode.version = 1 if created else barcode.version + 1
    if barcode.is_default:
        for current in db.scalars(select(ProductBarcode).where(
            ProductBarcode.store_id == user.store_id,
            ProductBarcode.product_id == product.id,
            ProductBarcode.id != barcode.id,
            ProductBarcode.is_default.is_(True),
        )):
            current.is_default = False
            current.version += 1
    db.flush()
    return SyncOperationResult(
        operation_id=operation.operation_id,
        status="applied",
        entity_id=barcode.id,
        record=BarcodeOut.model_validate(barcode).model_dump(mode="json"),
    )


def _apply_inventory_movement(db: DbSession, user: User, operation: SyncOperationIn) -> SyncOperationResult:
    if operation.operation != "CREATE":
        raise ValueError("INVENTORY_MOVEMENT_IMMUTABLE")
    payload = operation.payload or {}
    product_id = payload.get("product_id")
    delta = payload.get("delta")
    kind = payload.get("kind")
    if isinstance(product_id, bool) or not isinstance(product_id, int):
        raise ValueError("MOVEMENT_PRODUCT_INVALID")
    if isinstance(delta, bool) or not isinstance(delta, int) or delta == 0:
        raise ValueError("MOVEMENT_DELTA_INVALID")
    if kind not in {"receive", "issue", "correction", "reversal"}:
        raise ValueError("MOVEMENT_KIND_INVALID")
    if (kind == "receive" and delta < 0) or (kind == "issue" and delta > 0):
        raise ValueError("MOVEMENT_DIRECTION_INVALID")

    item = db.scalar(
        select(InventoryItem)
        .options(joinedload(InventoryItem.catalog_product), selectinload(InventoryItem.labels))
        .where(InventoryItem.id == product_id, InventoryItem.store_id == user.store_id, InventoryItem.deleted_at.is_(None))
        .with_for_update()
    )
    if item is None:
        raise ValueError("PRODUCT_NOT_FOUND")
    if item.is_hidden:
        raise ValueError("PRODUCT_HIDDEN")

    before = item.quantity
    correction_quantity = payload.get("correction_quantity")
    if kind == "correction":
        expected = payload.get("before_quantity")
        if expected != before:
            return SyncOperationResult(operation_id=operation.operation_id, status="conflict", entity_id=operation.entity_id, error="CORRECTION_STALE")
        if isinstance(correction_quantity, bool) or not isinstance(correction_quantity, int) or correction_quantity < 0:
            raise ValueError("CORRECTION_QUANTITY_INVALID")
        after = correction_quantity
        if after - before != delta:
            raise ValueError("CORRECTION_DELTA_INVALID")
    else:
        after = before + delta
    if after < 0:
        return SyncOperationResult(operation_id=operation.operation_id, status="conflict", entity_id=operation.entity_id, error="INSUFFICIENT_STOCK")

    reverses = payload.get("reverses_operation_id")
    if kind == "reversal":
        if not isinstance(reverses, str):
            raise ValueError("REVERSAL_REFERENCE_REQUIRED")
        original = db.scalar(select(InventoryMovement).where(
            InventoryMovement.store_id == user.store_id,
            InventoryMovement.operation_id == reverses,
        ))
        if original is None or original.product_id != item.id or delta != -original.delta:
            raise ValueError("REVERSAL_REFERENCE_INVALID")
        already_reversed = db.scalar(select(InventoryMovement).where(
            InventoryMovement.store_id == user.store_id,
            InventoryMovement.reverses_operation_id == reverses,
        ))
        if already_reversed is not None:
            return SyncOperationResult(operation_id=operation.operation_id, status="conflict", entity_id=operation.entity_id, error="MOVEMENT_ALREADY_REVERSED")

    barcode_id = payload.get("barcode_id")
    scan_quantity = payload.get("scan_quantity", 1)
    if isinstance(scan_quantity, bool) or not isinstance(scan_quantity, int) or scan_quantity < 1:
        raise ValueError("MOVEMENT_SCAN_QUANTITY_INVALID")
    barcode = None
    if barcode_id is not None:
        barcode = db.scalar(select(ProductBarcode).where(
            ProductBarcode.id == barcode_id,
            ProductBarcode.store_id == user.store_id,
            ProductBarcode.product_id == item.id,
            ProductBarcode.is_active.is_(True),
        ))
        if barcode is None:
            raise ValueError("BARCODE_NOT_AVAILABLE")
        if barcode.value != payload.get("barcode_value") or barcode.scan_quantity != scan_quantity:
            raise ValueError("BARCODE_MEANING_MISMATCH")

    context = active_store_context(db, user)
    movement = InventoryMovement(
        id=operation.entity_id,
        store_id=context.store.id,
        product_id=item.id,
        actor_user_id=user.id,
        actor_membership_id=context.membership.id,
        operation_id=operation.operation_id,
        kind=kind,
        delta=delta,
        correction_quantity=correction_quantity if kind == "correction" else None,
        scan_source=payload.get("scan_source") if payload.get("scan_source") in {"manual", "hardware", "camera"} else "manual",
        barcode_id=barcode.id if barcode else None,
        barcode_value=barcode.value if barcode else None,
        scan_quantity=scan_quantity,
        before_quantity=before,
        after_quantity=after,
        reverses_operation_id=reverses,
        client_occurred_at=operation.client_occurred_at,
    )
    db.add(movement)
    item.quantity = after
    item.version = (item.version or 1) + 1
    db.add(InventoryTransaction(
        store_id=context.store.id,
        actor_user_id=user.id,
        user_id=user.data_owner_id,
        inventory_item_id=item.id,
        type="stock_in" if delta > 0 else "stock_out",
        quantity=abs(delta),
        before_quantity=before,
        after_quantity=after,
        note=f"barcode:{kind}",
    ))
    db.flush()
    record = _serialize(item)
    _record_change(db, user.data_owner_id, item.id, "UPSERT", record)
    return SyncOperationResult(
        operation_id=operation.operation_id,
        status="applied",
        entity_id=movement.id,
        record={
            "movement": InventoryMovementOut.model_validate(movement).model_dump(mode="json"),
            "product": record,
        },
    )


def _record_quantity_change(
    db: DbSession,
    user_id: int,
    item: InventoryItem,
    before_quantity: int,
) -> None:
    delta = item.quantity - before_quantity
    if delta == 0:
        return
    db.add(
        InventoryTransaction(
            user_id=user_id,
            inventory_item_id=item.id,
            type="stock_in" if delta > 0 else "stock_out",
            quantity=abs(delta),
            before_quantity=before_quantity,
            after_quantity=item.quantity,
            note="Recorded by offline synchronization",
        )
    )


async def _save_image(file: UploadFile, previous: str | None) -> str:
    extension = _IMAGE_EXTENSIONS.get(file.content_type or "")
    if extension is None:
        raise ValueError("Unsupported image format")

    content = await file.read()
    if len(content) > _MAX_IMAGE_BYTES:
        raise ValueError("Image is larger than 10 MB")

    filename = f"sync-{uuid.uuid4().hex}{extension}"
    (settings.UPLOAD_DIR / filename).write_bytes(content)

    if previous and previous.startswith("/uploads/"):
        (settings.UPLOAD_DIR / Path(previous).name).unlink(missing_ok=True)

    return f"/uploads/{filename}"


def _record_change(
    db: DbSession,
    user_id: int,
    entity_id: int,
    operation: str,
    payload: dict | None,
) -> SyncChange:
    change = SyncChange(
        user_id=user_id,
        entity="product",
        entity_id=entity_id,
        operation=operation,
        payload=json.dumps(payload) if payload is not None else None,
    )
    db.add(change)
    db.flush()
    return change


@router.post("/batch", response_model=SyncBatchResponse)
async def push_batch(
    operations_json: Annotated[str, Form()],
    current_user: CurrentProductReader,
    db: DbSession,
    files: Annotated[list[UploadFile] | None, File()] = None,
    client_data_schema: Annotated[int | None, Header(alias="X-Client-Data-Schema")] = None,
) -> SyncBatchResponse:
    _require_store_aware_client(client_data_schema)
    request = SyncBatchRequest.model_validate_json(operations_json)
    image_files = {file.filename: file for file in files or [] if file.filename}
    results: list[SyncOperationResult] = []

    for operation in request.operations:
        previous = db.scalar(
            select(SyncOperation).where(
                SyncOperation.user_id == current_user.data_owner_id,
                SyncOperation.operation_id == operation.operation_id,
            )
        )
        if previous is not None:
            results.append(_result_from_json(previous.result_payload))
            continue

        try:
            _authorize_operation(db, current_user, operation)
        except ValueError as error:
            result = SyncOperationResult(operation_id=operation.operation_id, status="fatal_error", entity_id=operation.entity_id, error=str(error))
            record_store_activity(db, current_user, action=f"sync.{operation.operation.lower()}", target_entity=operation.entity, target_id=operation.entity_id, operation_id=operation.operation_id, outcome="rejected", client_occurred_at=operation.client_occurred_at)
            db.add(SyncOperation(store_id=current_user.store_id, actor_user_id=current_user.id, user_id=current_user.data_owner_id, operation_id=operation.operation_id, result_payload=result.model_dump_json()))
            db.commit(); results.append(result); continue

        if operation.entity in {"barcode", "inventory_movement"}:
            try:
                if operation.entity == "barcode":
                    result = _apply_barcode(db, current_user, operation)
                else:
                    result = _apply_inventory_movement(db, current_user, operation)
            except ValueError as error:
                db.rollback()
                result = SyncOperationResult(operation_id=operation.operation_id, status="fatal_error", entity_id=operation.entity_id, error=str(error))
            action = (
                f"barcode.{operation.operation.lower()}"
                if operation.entity == "barcode"
                else f"inventory.scan.{(operation.payload or {}).get('kind', 'change')}"
            )
            record_store_activity(
                db,
                current_user,
                action=action,
                target_entity=operation.entity,
                target_id=operation.entity_id,
                operation_id=operation.operation_id,
                outcome="applied" if result.status == "applied" else ("conflict" if result.status == "conflict" else "rejected"),
                client_occurred_at=operation.client_occurred_at,
            )
            db.add(SyncOperation(store_id=current_user.store_id, actor_user_id=current_user.id, user_id=current_user.data_owner_id, operation_id=operation.operation_id, result_payload=result.model_dump_json()))
            db.commit()
            results.append(result)
            continue

        if operation.entity in {"label", "category"}:
            try:
                tool_id = "labels" if operation.entity == "label" else "categories"
                capability = "labels.write" if operation.entity == "label" else "categories.write"
                if not is_admin(current_user) and not entitlement_for_user(db, current_user)["capabilities"].get(capability, False):
                    raise ValueError(f"CAPABILITY_REQUIRED:{capability}")
                if not tool_allowed(db, current_user, tool_id):
                    raise ValueError(f"DOMAIN_TOOL_DISABLED:{tool_id}")
                result = (_apply_label if operation.entity == "label" else _apply_category)(
                    db, current_user.data_owner_id, operation
                )
                entity_model = Label if operation.entity == "label" else Category
                entity_record = db.get(entity_model, operation.entity_id)
                if entity_record is not None:
                    entity_record.store_id = current_user.store_id
            except ValueError as error:
                db.rollback()
                result = SyncOperationResult(operation_id=operation.operation_id, status="fatal_error", entity_id=operation.entity_id, error=str(error))
            record_store_activity(db, current_user, action=f"sync.{operation.operation.lower()}", target_entity=operation.entity, target_id=operation.entity_id, operation_id=operation.operation_id, outcome="applied" if result.status == "applied" else "rejected", client_occurred_at=operation.client_occurred_at)
            db.add(SyncOperation(store_id=current_user.store_id, actor_user_id=current_user.id, user_id=current_user.data_owner_id, operation_id=operation.operation_id, result_payload=result.model_dump_json()))
            db.commit()
            results.append(result)
            continue

        try:
            item = db.scalar(
                select(InventoryItem)
                .options(joinedload(InventoryItem.catalog_product), selectinload(InventoryItem.labels))
                .where(
                    InventoryItem.id == operation.entity_id,
                    InventoryItem.user_id == current_user.data_owner_id,
                )
            )

            if operation.operation == "DELETE":
                if item is not None:
                    if item.is_catalog_backed:
                        raise ValueError("CATALOG_BACKED_PRODUCT_DELETE_FORBIDDEN")
                    private_catalog = (
                        item.catalog_product
                        if not item.catalog_product.is_shared
                        else None
                    )
                    if item.image_url and item.image_url.startswith("/uploads/"):
                        (settings.UPLOAD_DIR / Path(item.image_url).name).unlink(missing_ok=True)
                    db.delete(item)
                    db.flush()
                    if private_catalog is not None:
                        db.delete(private_catalog)
                        db.flush()
                _record_change(db, current_user.data_owner_id, operation.entity_id, "DELETE", None)
                result = SyncOperationResult(
                    operation_id=operation.operation_id,
                    status="applied",
                    entity_id=operation.entity_id,
                )
            else:
                payload = operation.payload or {}
                if operation.operation == "UPDATE" and item is None:
                    # The server is authoritative for an item that previously
                    # existed but was permanently removed by an administrator.
                    # Return a terminal domain result instead of recreating it.
                    raise ValueError("PRODUCT_NOT_FOUND")
                if item is not None and operation.base_version is not None and item.version != operation.base_version:
                    result = SyncOperationResult(
                        operation_id=operation.operation_id,
                        status="conflict",
                        entity_id=operation.entity_id,
                        record=InventoryOut.model_validate(item),
                        error="Server record has a newer version",
                    )
                else:
                    created = item is None
                    if item is None:
                        limit = None if is_admin(current_user) else entitlement_for_user(db, current_user)["limits"]["inventory_items"]
                        count = db.scalar(
                            select(func.count(InventoryItem.id)).where(
                                InventoryItem.user_id == current_user.data_owner_id
                            )
                        ) or 0
                        if limit is not None and count >= limit:
                            raise ValueError("INVENTORY_LIMIT_REACHED")
                        catalog = _catalog_for_operation(db, current_user, operation)
                        item = InventoryItem(
                            store_id=current_user.store_id,
                            id=operation.entity_id,
                            user_id=current_user.data_owner_id,
                            catalog_product_id=catalog.id,
                            catalog_product=catalog,
                            is_catalog_backed=catalog.is_shared,
                        )
                        db.add(item)
                    before_quantity = item.quantity or 0
                    _apply_fields(db, current_user.data_owner_id, item, payload)
                    _record_quantity_change(
                        db,
                        current_user.data_owner_id,
                        item,
                        before_quantity,
                    )
                    if (
                        operation.operation == "UPDATE"
                        and "image_url" in payload
                        and payload.get("image_url") is None
                    ):
                        if item.image_url and item.image_url.startswith("/uploads/"):
                            (settings.UPLOAD_DIR / Path(item.image_url).name).unlink(missing_ok=True)
                        item.image_url = None
                    image = image_files.get(operation.operation_id)
                    if image is not None:
                        item.image_url = await _save_image(image, item.image_url)
                    item.version = 1 if created else (item.version or 1) + 1
                    db.flush()
                    db.refresh(item)
                    record = _serialize(item)
                    _record_change(db, current_user.data_owner_id, item.id, "UPSERT", record)
                    result = SyncOperationResult(
                        operation_id=operation.operation_id,
                        status="applied",
                        entity_id=item.id,
                        record=InventoryOut.model_validate(item),
                    )
        except ValueError as error:
            db.rollback()
            result = SyncOperationResult(
                operation_id=operation.operation_id,
                status="fatal_error",
                entity_id=operation.entity_id,
                error=str(error),
            )

        db.add(
            SyncOperation(
                store_id=current_user.store_id,
                actor_user_id=current_user.id,
                user_id=current_user.data_owner_id,
                operation_id=operation.operation_id,
                result_payload=result.model_dump_json(),
            )
        )
        record_store_activity(db, current_user, action=f"sync.{operation.operation.lower()}", target_entity=operation.entity, target_id=operation.entity_id, operation_id=operation.operation_id, outcome="applied" if result.status == "applied" else ("conflict" if result.status == "conflict" else "rejected"), client_occurred_at=operation.client_occurred_at)
        db.commit()
        results.append(result)

    cursor = db.scalar(
        select(func.max(SyncChange.id)).where(SyncChange.user_id == current_user.data_owner_id)
    ) or 0
    return SyncBatchResponse(results=results, cursor=cursor)


@router.get("/barcodes", response_model=BarcodeSnapshot)
def barcode_snapshot(
    current_user: CurrentProductReader,
    db: DbSession,
    client_data_schema: Annotated[int | None, Header(alias="X-Client-Data-Schema")] = None,
) -> BarcodeSnapshot:
    _require_store_aware_client(client_data_schema)
    permissions = effective_permissions(active_store_context(db, current_user))
    if StorePermission.BARCODE_LOOKUP.value not in permissions:
        raise HTTPException(status_code=403, detail=f"PERMISSION_REQUIRED:{StorePermission.BARCODE_LOOKUP.value}")
    if not entitlement_for_user(db, current_user)["capabilities"].get("barcode.lookup", False):
        raise HTTPException(status_code=403, detail="CAPABILITY_REQUIRED:barcode.lookup")
    items = list(db.scalars(select(ProductBarcode).where(ProductBarcode.store_id == current_user.store_id)))
    return BarcodeSnapshot(items=[BarcodeOut.model_validate(item) for item in items])


@router.get("/changes", response_model=SyncChangesResponse)
def pull_changes(
    current_user: CurrentProductReader,
    db: DbSession,
    cursor: int = 0,
    client_data_schema: Annotated[int | None, Header(alias="X-Client-Data-Schema")] = None,
) -> SyncChangesResponse:
    _require_store_aware_client(client_data_schema)
    latest = db.scalar(
        select(func.max(SyncChange.id)).where(SyncChange.user_id == current_user.data_owner_id)
    ) or 0

    if cursor == 0:
        items = list(
            db.scalars(
                select(InventoryItem)
                .options(joinedload(InventoryItem.catalog_product), selectinload(InventoryItem.labels))
                .where(InventoryItem.user_id == current_user.data_owner_id)
            )
        )
        return SyncChangesResponse(
            cursor=latest,
            changes=[
                SyncChangeOut(
                    cursor=latest,
                    entity="product",
                    entity_id=item.id,
                    operation="UPSERT",
                    record=InventoryOut.model_validate(item),
                )
                for item in items
            ],
        )

    changes = list(
        db.scalars(
            select(SyncChange)
            .where(SyncChange.user_id == current_user.data_owner_id, SyncChange.id > cursor)
            .order_by(SyncChange.id)
            .limit(500)
        )
    )
    return SyncChangesResponse(
        cursor=changes[-1].id if changes else latest,
        changes=[
            SyncChangeOut(
                cursor=change.id,
                entity="product",
                entity_id=change.entity_id,
                operation=change.operation,
                record=json.loads(change.payload) if change.payload else None,
            )
            for change in changes
        ],
    )
