import json
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload, selectinload

from ..config import settings
from ..deps import CurrentUser, CurrentWritableUser, DbSession
from ..models import (
    CatalogProduct,
    Category,
    InventoryItem,
    InventoryTransaction,
    Label,
    SyncChange,
    SyncOperation,
)
from ..services.subscription_service import entitlement_for_user
from ..services.tool_policy import tool_allowed
from ..services.authorization_service import is_admin
from ..schemas import (
    InventoryOut,
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
    user: CurrentUser,
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
    current_user: CurrentWritableUser,
    db: DbSession,
    files: Annotated[list[UploadFile] | None, File()] = None,
) -> SyncBatchResponse:
    request = SyncBatchRequest.model_validate_json(operations_json)
    image_files = {file.filename: file for file in files or [] if file.filename}
    results: list[SyncOperationResult] = []

    for operation in request.operations:
        previous = db.scalar(
            select(SyncOperation).where(
                SyncOperation.user_id == current_user.id,
                SyncOperation.operation_id == operation.operation_id,
            )
        )
        if previous is not None:
            results.append(_result_from_json(previous.result_payload))
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
                    db, current_user.id, operation
                )
            except ValueError as error:
                db.rollback()
                result = SyncOperationResult(operation_id=operation.operation_id, status="fatal_error", entity_id=operation.entity_id, error=str(error))
            db.add(SyncOperation(user_id=current_user.id, operation_id=operation.operation_id, result_payload=result.model_dump_json()))
            db.commit()
            results.append(result)
            continue

        try:
            item = db.scalar(
                select(InventoryItem)
                .options(joinedload(InventoryItem.catalog_product), selectinload(InventoryItem.labels))
                .where(
                    InventoryItem.id == operation.entity_id,
                    InventoryItem.user_id == current_user.id,
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
                _record_change(db, current_user.id, operation.entity_id, "DELETE", None)
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
                                InventoryItem.user_id == current_user.id
                            )
                        ) or 0
                        if limit is not None and count >= limit:
                            raise ValueError("INVENTORY_LIMIT_REACHED")
                        catalog = _catalog_for_operation(db, current_user, operation)
                        item = InventoryItem(
                            id=operation.entity_id,
                            user_id=current_user.id,
                            catalog_product_id=catalog.id,
                            catalog_product=catalog,
                            is_catalog_backed=catalog.is_shared,
                        )
                        db.add(item)
                    before_quantity = item.quantity or 0
                    _apply_fields(db, current_user.id, item, payload)
                    _record_quantity_change(
                        db,
                        current_user.id,
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
                    _record_change(db, current_user.id, item.id, "UPSERT", record)
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
                user_id=current_user.id,
                operation_id=operation.operation_id,
                result_payload=result.model_dump_json(),
            )
        )
        db.commit()
        results.append(result)

    cursor = db.scalar(
        select(func.max(SyncChange.id)).where(SyncChange.user_id == current_user.id)
    ) or 0
    return SyncBatchResponse(results=results, cursor=cursor)


@router.get("/changes", response_model=SyncChangesResponse)
def pull_changes(
    current_user: CurrentUser,
    db: DbSession,
    cursor: int = 0,
) -> SyncChangesResponse:
    latest = db.scalar(
        select(func.max(SyncChange.id)).where(SyncChange.user_id == current_user.id)
    ) or 0

    if cursor == 0:
        items = list(
            db.scalars(
                select(InventoryItem)
                .options(joinedload(InventoryItem.catalog_product), selectinload(InventoryItem.labels))
                .where(InventoryItem.user_id == current_user.id)
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
            .where(SyncChange.user_id == current_user.id, SyncChange.id > cursor)
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
