from fastapi import APIRouter
from sqlalchemy import func, select

from ..deps import CurrentUser, DbSession
from ..models import Category, InventoryItem
from ..schemas import DashboardStats, CategoryBreakdown

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    current_user: CurrentUser,
    db: DbSession,
) -> DashboardStats:
    items = list(
        db.scalars(
            select(InventoryItem).where(
                InventoryItem.user_id == current_user.id
            )
        )
    )

    active_items = [
        i for i in items
        if i.deleted_at is None and not i.is_hidden
    ]

    total_products = len(active_items)

    low_stock_count = len([
        i for i in active_items
        if i.status == "low_stock"
    ])

    out_of_stock_count = len([
        i for i in active_items
        if i.status == "out_of_stock"
    ])

    inventory_value = sum([
        i.quantity * i.price
        for i in active_items
    ])

    category_stmt = (
        select(
            Category.name,
            func.count(InventoryItem.id)
        )
        .join(
            InventoryItem,
            InventoryItem.user_id == current_user.id,
            isouter=True,
        )
        .join(
            InventoryItem.catalog_product
        )
        .where(
            Category.id == InventoryItem.catalog_product.category_id
        )
        .group_by(Category.name)
    )

    category_rows = db.execute(category_stmt).all()

    category_breakdown = [
        CategoryBreakdown(
            name=row[0],
            value=row[1]
        )
        for row in category_rows
    ]

    return DashboardStats(
        total_products=total_products,
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
        inventory_value=inventory_value,
        category_breakdown=category_breakdown,
    )


@router.get("/hidden-count")
def hidden_count(
    current_user: CurrentUser,
    db: DbSession,
):
    count = db.scalar(
        select(func.count())
        .select_from(InventoryItem)
        .where(
            InventoryItem.user_id == current_user.id,
            InventoryItem.is_hidden.is_(True),
        )
    )

    return {
        "count": count
    }


@router.get("/trash-count")
def trash_count(
    current_user: CurrentUser,
    db: DbSession,
):
    count = db.scalar(
        select(func.count())
        .select_from(InventoryItem)
        .where(
            InventoryItem.user_id == current_user.id,
            InventoryItem.deleted_at.is_not(None),
        )
    )

    return {
        "count": count
    }