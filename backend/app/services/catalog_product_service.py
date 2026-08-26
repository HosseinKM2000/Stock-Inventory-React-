import json

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ..models import CatalogProduct, Industry, InventoryItem, SyncChange, User
from ..repositories import catalog_products as repository
from ..schemas import CatalogProductCreate, CatalogProductUpdate, InventoryOut


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
    db.commit()


def list_catalog_products(
    db: Session,
    search: str | None = None,
    industry_id: int | None = None,
):
    return repository.get_catalog_products(db, search, industry_id)


def get_catalog_product_or_404(db: Session, catalog_id: int) -> CatalogProduct:
    product = repository.get_catalog_product(db, catalog_id)
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


def create_catalog_product(db: Session, payload: CatalogProductCreate):
    _ensure_industry_exists(db, payload.industry_id)
    try:
        product = repository.create_catalog_product(db, payload)
        product = repository.get_catalog_product(db, product.id)
        _reconcile_catalog_assignments(db, product)
        return repository.get_catalog_product(db, product.id)
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
    product = get_catalog_product_or_404(db, catalog_id)
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

    try:
        product = repository.update_catalog_product(db, product, payload)
        product = repository.get_catalog_product(db, product.id)
        _reconcile_catalog_assignments(db, product)
        return repository.get_catalog_product(db, product.id)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CATALOG_PRODUCT_UPDATE_CONFLICT",
        ) from error


def delete_catalog_product(db: Session, catalog_id: int) -> None:
    product = repository.get_catalog_product_any_state(db, catalog_id)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CATALOG_PRODUCT_NOT_FOUND",
        )

    # Idempotent archive: user inventory rows retain the same foreign key and
    # all operational values. No InventoryItem is updated or deleted here.
    if not product.is_active:
        return

    repository.archive_catalog_product(db, product)
