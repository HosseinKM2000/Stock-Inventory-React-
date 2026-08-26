import json

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..models import CatalogProduct, Industry, InventoryItem, SyncChange, User
from ..schemas import InventoryOut


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


def provision_industry_inventory(
    db: Session,
    user: User,
    industry_id: int,
) -> User:
    industry = db.get(Industry, industry_id)
    if industry is None or not industry.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="INDUSTRY_NOT_FOUND",
        )

    previous_industry_id = user.industry_id
    catalog_products = list(
        db.scalars(
            select(CatalogProduct)
            .options(joinedload(CatalogProduct.industry))
            .where(
                CatalogProduct.industry_id == industry.id,
                CatalogProduct.is_shared.is_(True),
                CatalogProduct.is_active.is_(True),
            )
            .order_by(CatalogProduct.id)
        )
    )
    existing_items = list(
        db.scalars(
            select(InventoryItem)
            .options(
                joinedload(InventoryItem.catalog_product).joinedload(
                    CatalogProduct.industry
                )
            )
            .where(InventoryItem.user_id == user.id)
        )
    )
    existing_by_catalog = {
        item.catalog_product_id: item for item in existing_items
    }
    changed: list[InventoryItem] = []

    # Preserve operational data when an industry changes. Old provisioned
    # products are hidden rather than deleted; user-created products are never
    # touched.
    if previous_industry_id is not None and previous_industry_id != industry.id:
        for item in existing_items:
            if (
                item.is_catalog_backed
                and item.catalog_product.industry_id != industry.id
                and not item.is_hidden
            ):
                item.is_hidden = True
                item.version = (item.version or 1) + 1
                changed.append(item)

    for catalog_product in catalog_products:
        existing = existing_by_catalog.get(catalog_product.id)
        if existing is not None:
            if not existing.is_catalog_backed:
                existing.is_catalog_backed = True
                existing.version = (existing.version or 1) + 1
                changed.append(existing)
            continue

        item = InventoryItem(
            user_id=user.id,
            catalog_product_id=catalog_product.id,
            catalog_product=catalog_product,
            is_catalog_backed=True,
        )
        db.add(item)
        changed.append(item)

    user.industry_id = industry.id
    db.flush()

    for item in changed:
        _record_inventory_change(db, item)

    db.commit()
    db.refresh(user)
    return user
