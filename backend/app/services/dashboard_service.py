from sqlalchemy import select

from ..models import InventoryItem


def get_dashboard(
    db,
    user_id: int,
):

    items = list(
        db.scalars(
            select(InventoryItem).where(
                InventoryItem.user_id == user_id
            )
        )
    )

    active = [
        i
        for i in items
        if i.deleted_at is None
    ]

    hidden = [
        i
        for i in active
        if i.is_hidden
    ]

    trash = [
        i
        for i in items
        if i.deleted_at is not None
    ]

    low_stock = [
        i
        for i in active
        if i.status == "low_stock"
    ]

    out_of_stock = [
        i
        for i in active
        if i.status == "out_of_stock"
    ]

    inventory_value = sum(
        i.quantity * i.price
        for i in active
    )

    return {
        "total_products": len(active),
        "hidden_products": len(hidden),
        "deleted_products": len(trash),
        "inventory_value": inventory_value,
        "low_stock": len(low_stock),
        "out_of_stock": len(out_of_stock),
    }