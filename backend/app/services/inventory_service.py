from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..models import InventoryItem


def get_inventory_item_or_404(
    db: Session,
    item_id: int,
    user_id: int,
) -> InventoryItem:

    stmt = (
        select(InventoryItem)
        .options(
            joinedload(InventoryItem.catalog_product)
        )
        .where(
            InventoryItem.id == item_id,
            InventoryItem.user_id == user_id,
        )
    )

    item = db.scalar(stmt)

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="آیتم یافت نشد",
        )

    return item


def update_inventory_item(
    item: InventoryItem,
    data: dict,
):
    for field, value in data.items():
        setattr(item, field, value)