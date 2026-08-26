import json
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from ..config import settings
from ..deps import CurrentUser, CurrentWritableUser, DbSession
from ..models import CatalogProduct, InventoryItem, SyncChange, SyncOperation
from ..services.subscription_service import entitlement_for_user
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
    "image/gif": ".gif",
}
_MAX_IMAGE_BYTES = 10 * 1024 * 1024


def _serialize(item: InventoryItem) -> dict:
    return InventoryOut.model_validate(item).model_dump(mode="json")


def _result_from_json(value: str) -> SyncOperationResult:
    return SyncOperationResult.model_validate_json(value)


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

    catalog = CatalogProduct(
        industry_id=user.industry_id,
        name=name.strip(),
        description=catalog_payload.get("description"),
        brand=catalog_payload.get("brand"),
        is_shared=False,
    )
    db.add(catalog)
    db.flush()
    return catalog


def _apply_fields(item: InventoryItem, payload: dict) -> None:
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
        item.category_id = value


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

        try:
            item = db.scalar(
                select(InventoryItem)
                .options(joinedload(InventoryItem.catalog_product))
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
                            is_catalog_backed=catalog.is_shared,
                        )
                        db.add(item)
                    _apply_fields(item, payload)
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
                .options(joinedload(InventoryItem.catalog_product))
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
