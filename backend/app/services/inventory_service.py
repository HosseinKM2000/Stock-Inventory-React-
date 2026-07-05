from sqlalchemy import select
from fastapi import HTTPException, status
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from ..models import InventoryItem, InventoryTransaction

def get_inventory_item_or_404(
    db: Session,
    item_id: int,
    user_id: int,
) -> InventoryItem:
    item = db.get(InventoryItem, item_id)

    if item is None or item.user_id != user_id:
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
