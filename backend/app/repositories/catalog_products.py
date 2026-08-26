from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from ..models import CatalogProduct
from ..schemas import (
    CatalogProductCreate,
    CatalogProductUpdate,
)


def get_catalog_products(
    db: Session,
    search: str | None = None,
    industry_id: int | None = None,
):
    stmt = (
        select(CatalogProduct)
        .options(joinedload(CatalogProduct.industry))
        .where(
            CatalogProduct.is_shared.is_(True),
            CatalogProduct.is_active.is_(True),
        )
    )

    if industry_id:
        stmt = stmt.where(
            CatalogProduct.industry_id == industry_id
        )

    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                CatalogProduct.name.ilike(term),
                CatalogProduct.brand.ilike(term),
                CatalogProduct.description.ilike(term),
            )
        )

    stmt = stmt.order_by(
        CatalogProduct.created_at.desc(),
        CatalogProduct.id.desc(),
    )

    return list(db.scalars(stmt))


def get_catalog_product(
    db: Session,
    catalog_id: int,
):
    return db.scalar(
        select(CatalogProduct)
        .options(joinedload(CatalogProduct.industry))
        .where(
            CatalogProduct.id == catalog_id,
            CatalogProduct.is_shared.is_(True),
            CatalogProduct.is_active.is_(True),
        )
    )


def get_catalog_product_any_state(
    db: Session,
    catalog_id: int,
):
    return db.scalar(
        select(CatalogProduct)
        .options(joinedload(CatalogProduct.industry))
        .where(
            CatalogProduct.id == catalog_id,
            CatalogProduct.is_shared.is_(True),
        )
    )


def create_catalog_product(
    db: Session,
    payload: CatalogProductCreate,
):
    product = CatalogProduct(
        industry_id=payload.industry_id,
        name=payload.name,
        description=payload.description,
        brand=payload.brand,
        image_url=payload.image_url,
        is_shared=True,
        is_active=True,
    )

    db.add(product)
    db.flush()
    db.refresh(product)

    return product


def update_catalog_product(
    db: Session,
    product: CatalogProduct,
    payload: CatalogProductUpdate,
):
    data = payload.model_dump(exclude_unset=True)

    for key, value in data.items():
        setattr(product, key, value)

    db.flush()
    db.refresh(product)

    return product


def archive_catalog_product(
    db: Session,
    product: CatalogProduct,
):
    product.is_active = False
    db.commit()
