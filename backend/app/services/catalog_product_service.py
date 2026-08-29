import json
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ..config import settings
from ..models import CatalogProduct, Industry, InventoryItem, SyncChange, User
from ..repositories import catalog_products as repository
from ..schemas import CatalogProductCreate, CatalogProductUpdate, InventoryOut
from .audit_service import record_admin_action


def _record_inventory_change(db: Session, item: InventoryItem) -> None:
    db.add(
        SyncChange(
            user_id=item.user_id,
            entity="product",
            entity_id=item.id,
            operation="UPSERT",
            payload=json.dumps(
                InventoryOut.model_validate(item).model_dump(mode="json")
            ),
        )
    )


def _record_inventory_delete(db: Session, item: InventoryItem) -> None:
    db.add(
        SyncChange(
            user_id=item.user_id,
            entity="product",
            entity_id=item.id,
            operation="DELETE",
            payload=None,
        )
    )


def _reconcile_catalog_assignments(db: Session, product: CatalogProduct) -> None:
    items = list(
        db.scalars(
            select(InventoryItem)
            .options(
                joinedload(InventoryItem.catalog_product).joinedload(
                    CatalogProduct.industry
                ),
                joinedload(InventoryItem.owner),
            )
            .where(InventoryItem.catalog_product_id == product.id)
        )
    )
    by_user = {item.user_id: item for item in items}
    changed: list[InventoryItem] = []

    for item in items:
        if item.owner.industry_id != product.industry_id and not item.is_hidden:
            item.is_hidden = True
        item.is_catalog_backed = True
        changed.append(item)

    users = list(
        db.scalars(select(User).where(User.industry_id == product.industry_id))
    )
    for user in users:
        if user.id in by_user:
            continue
        item = InventoryItem(
            user_id=user.id,
            catalog_product_id=product.id,
            catalog_product=product,
            owner=user,
            is_catalog_backed=True,
        )
        db.add(item)
        changed.append(item)

    db.flush()
    for item in changed:
        _record_inventory_change(db, item)
    db.flush()


def list_catalog_products(
    db: Session,
    search: str | None = None,
    industry_id: int | None = None,
):
    return repository.get_catalog_products(db, search, industry_id, is_active=True)


def list_archived_catalog_products(
    db: Session,
    search: str | None = None,
    industry_id: int | None = None,
):
    return repository.get_catalog_products(db, search, industry_id, is_active=False)


def get_catalog_product_or_404(db: Session, catalog_id: int) -> CatalogProduct:
    product = repository.get_catalog_product(db, catalog_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CATALOG_PRODUCT_NOT_FOUND",
        )
    return product


def get_catalog_product_any_state_or_404(
    db: Session,
    catalog_id: int,
) -> CatalogProduct:
    product = repository.get_catalog_product_any_state(db, catalog_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CATALOG_PRODUCT_NOT_FOUND",
        )
    return product


def _ensure_industry_exists(db: Session, industry_id: int) -> None:
    if db.get(Industry, industry_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CATALOG_INDUSTRY_NOT_FOUND",
        )


def _ensure_catalog_name_available(
    db: Session,
    industry_id: int,
    name: str,
    exclude_id: int | None = None,
) -> None:
    statement = select(CatalogProduct.id).where(
        CatalogProduct.industry_id == industry_id,
        CatalogProduct.is_shared.is_(True),
        func.lower(CatalogProduct.name) == name.lower(),
    )
    if exclude_id is not None:
        statement = statement.where(CatalogProduct.id != exclude_id)
    if db.scalar(statement.limit(1)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CATALOG_PRODUCT_EXISTS",
        )


def create_catalog_product(db: Session, payload: CatalogProductCreate):
    _ensure_industry_exists(db, payload.industry_id)
    _ensure_catalog_name_available(db, payload.industry_id, payload.name)
    try:
        product = repository.create_catalog_product(db, payload)
        product = repository.get_catalog_product(db, product.id)
        _reconcile_catalog_assignments(db, product)
        db.commit()
        return repository.get_catalog_product_any_state(db, product.id)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CATALOG_PRODUCT_CREATE_CONFLICT",
        ) from error


def update_catalog_product(
    db: Session,
    catalog_id: int,
    payload: CatalogProductUpdate,
):
    product = get_catalog_product_any_state_or_404(db, catalog_id)
    if "name" in payload.model_fields_set and payload.name is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CATALOG_NAME_REQUIRED",
        )
    if "industry_id" in payload.model_fields_set and payload.industry_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CATALOG_INDUSTRY_REQUIRED",
        )
    if payload.industry_id is not None:
        _ensure_industry_exists(db, payload.industry_id)

    _ensure_catalog_name_available(
        db,
        payload.industry_id or product.industry_id,
        payload.name or product.name,
        exclude_id=product.id,
    )

    try:
        product = repository.update_catalog_product(db, product, payload)
        if product.is_active:
            _reconcile_catalog_assignments(db, product)
        db.commit()
        return repository.get_catalog_product_any_state(db, product.id)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CATALOG_PRODUCT_UPDATE_CONFLICT",
        ) from error


def archive_catalog_product(
    db: Session,
    catalog_id: int,
    actor: User,
) -> CatalogProduct:
    product = get_catalog_product_any_state_or_404(db, catalog_id)
    if not product.is_active:
        return product

    try:
        repository.archive_catalog_product(db, product)
        record_admin_action(
            db,
            actor,
            "catalog.archived",
            metadata={"catalog_product_id": product.id, "name": product.name},
        )
        db.commit()
        return repository.get_catalog_product_any_state(db, catalog_id)
    except Exception:
        db.rollback()
        raise


def restore_catalog_product(
    db: Session,
    catalog_id: int,
    actor: User,
) -> CatalogProduct:
    product = get_catalog_product_any_state_or_404(db, catalog_id)
    if product.is_active:
        return product

    try:
        repository.restore_catalog_product(db, product)
        # Provision users who joined the industry while this product was
        # archived. Existing assignments are keyed by catalog_product_id and
        # therefore cannot be duplicated.
        _reconcile_catalog_assignments(db, product)
        record_admin_action(
            db,
            actor,
            "catalog.restored",
            metadata={"catalog_product_id": product.id, "name": product.name},
        )
        db.commit()
        return repository.get_catalog_product_any_state(db, catalog_id)
    except Exception:
        db.rollback()
        raise


def permanently_delete_catalog_product(
    db: Session,
    catalog_id: int,
    actor: User,
) -> None:
    product = get_catalog_product_any_state_or_404(db, catalog_id)
    inventory_items = list(
        db.scalars(
            select(InventoryItem).where(
                InventoryItem.catalog_product_id == product.id
            )
        )
    )
    uploaded_images = {
        value
        for value in [product.image_url, *(item.image_url for item in inventory_items)]
        if value and value.startswith("/uploads/")
    }

    try:
        # Explicit deletes are intentional: InventoryItem.transactions uses
        # its existing ORM delete-orphan cascade, while one durable sync
        # tombstone is recorded for every affected user inventory row.
        for item in inventory_items:
            _record_inventory_delete(db, item)
            db.delete(item)

        db.flush()
        record_admin_action(
            db,
            actor,
            "catalog.deleted",
            metadata={
                "catalog_product_id": product.id,
                "name": product.name,
                "inventory_items_deleted": len(inventory_items),
            },
        )
        repository.permanently_delete_catalog_product(db, product)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CATALOG_PERMANENT_DELETE_CONFLICT",
        ) from error
    except Exception:
        # Catalog, inventory rows, transaction rows, tombstones and audit entry
        # all share this transaction. No partial database delete can commit.
        db.rollback()
        raise

    # Filesystem cleanup happens only after the atomic database commit. A
    # missing file is harmless and must not turn a committed delete into 500.
    for image_url in uploaded_images:
        try:
            (settings.UPLOAD_DIR / Path(image_url).name).unlink(missing_ok=True)
        except OSError:
            pass
