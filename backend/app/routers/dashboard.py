from fastapi import APIRouter
from sqlalchemy import func, select

from ..deps import CurrentUser, DbSession
from ..models import Category, InventoryItem
from ..schemas import CategoryBreakdown, DashboardStats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def stats(current_user: CurrentUser, db: DbSession) -> DashboardStats:
    products = list(
        db.scalars(select(InventoryItem).where(InventoryItem.user_id == current_user.id))
    )

    total_products = len(products)
    low_stock_count = sum(1 for p in products if p.status == "low_stock")
    out_of_stock_count = sum(1 for p in products if p.status == "out_of_stock")
    inventory_value = sum(p.price * p.quantity for p in products)

    # Sum of quantity grouped by category name (uncategorized bucket included).
    breakdown_rows = db.execute(
        select(
            func.coalesce(Category.name, "بدون دسته بندی"),
            func.coalesce(func.sum(InventoryItem.quantity), 0),
        )
        .select_from(InventoryItem)
        .outerjoin(Category, InventoryItem.category_id == Category.id)
        .where(InventoryItem.user_id == current_user.id)
        .group_by(Category.name)
        .order_by(func.sum(InventoryItem.quantity).desc())
    ).all()

    category_breakdown = [
        CategoryBreakdown(name=name, value=int(value))
        for name, value in breakdown_rows
    ]

    return DashboardStats(
        total_products=total_products,
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
        inventory_value=inventory_value,
        category_breakdown=category_breakdown,
    )
