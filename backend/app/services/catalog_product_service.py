from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import CatalogProduct, Industry, InventoryItem
from ..repositories import catalog_products as repository
from ..schemas import CatalogProductCreate, CatalogProductUpdate


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
        return repository.get_catalog_product(db, product.id)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CATALOG_PRODUCT_UPDATE_CONFLICT",
        ) from error


def delete_catalog_product(db: Session, catalog_id: int) -> None:
    product = get_catalog_product_or_404(db, catalog_id)
    dependent_items = db.scalar(
        select(func.count(InventoryItem.id)).where(
            InventoryItem.catalog_product_id == product.id
        )
    )
    if dependent_items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CATALOG_PRODUCT_IN_USE",
        )

    try:
        repository.delete_catalog_product(db, product)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CATALOG_PRODUCT_IN_USE",
        ) from error
