from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, func

from ..deps import CurrentUser, CurrentWritableUser, DbSession
from ..models import Category, InventoryItem
from ..schemas import (
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    CategoryWithStats,
)

router = APIRouter(prefix="/categories", tags=["categories"])


def _get_owned_category(
    db: DbSession,
    category_id: int,
    user_id: int,
) -> Category:
    category = db.get(Category, category_id)

    if category is None or category.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="دسته بندی یافت نشد",
        )

    return category


def _category_exists(
    db: DbSession,
    name: str,
    user_id: int,
    exclude_id: int | None = None,
) -> bool:
    stmt = select(Category).where(
        Category.name == name,
        Category.user_id == user_id,
    )

    if exclude_id is not None:
        stmt = stmt.where(Category.id != exclude_id)

    return db.scalar(stmt) is not None


@router.get("", response_model=list[CategoryOut])
def list_categories(
    current_user: CurrentUser,
    db: DbSession,
) -> list[Category]:
    stmt = (
        select(Category)
        .where(Category.user_id == current_user.id)
        .order_by(Category.created_at.desc())
    )

    return list(db.scalars(stmt))


@router.post(
    "",
    response_model=CategoryOut,
    status_code=status.HTTP_201_CREATED,
)
def create_category(
    payload: CategoryCreate,
    current_user: CurrentWritableUser,
    db: DbSession,
) -> Category:
    if payload.id is not None:
        existing = db.get(Category, payload.id)
        if existing is not None:
            if existing.user_id == current_user.id:
                return existing
            raise HTTPException(status_code=409, detail="CATEGORY_ID_CONFLICT")

    if _category_exists(db, payload.name, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="این دسته بندی قبلا ثبت شده است",
        )

    category = Category(
        id=payload.id,
        name=payload.name,
        description=payload.description,
        user_id=current_user.id,
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    return category


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    current_user: CurrentWritableUser,
    db: DbSession,
) -> Category:
    category = _get_owned_category(
        db,
        category_id,
        current_user.id,
    )

    if payload.name and _category_exists(
        db,
        payload.name,
        current_user.id,
        exclude_id=category.id,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="این دسته بندی قبلا ثبت شده است",
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)

    return category


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_category(
    category_id: int,
    current_user: CurrentWritableUser,
    db: DbSession,
) -> None:
    category = _get_owned_category(
        db,
        category_id,
        current_user.id,
    )

    db.query(InventoryItem).filter(
        InventoryItem.user_id == current_user.id,
        InventoryItem.category_id == category.id,
    ).update({InventoryItem.category_id: None})

    db.delete(category)
    db.commit()


@router.get("/stats", response_model=list[CategoryWithStats])
def category_stats(
    current_user: CurrentUser,
    db: DbSession,
) -> list[CategoryWithStats]:
    rows = db.execute(
        select(
            Category,
            func.count(InventoryItem.id).label("product_count"),
            func.coalesce(
                func.sum(InventoryItem.quantity),
                0,
            ).label("total_quantity"),
        )
        .outerjoin(InventoryItem, InventoryItem.category_id == Category.id)
        .where(Category.user_id == current_user.id)
        .group_by(Category.id)
        .order_by(Category.created_at.desc())
    ).all()

    result = []

    for category, product_count, total_quantity in rows:
        result.append(
            CategoryWithStats(
                id=category.id,
                name=category.name,
                description=category.description,
                created_at=category.created_at,
                updated_at=category.updated_at,
                product_count=product_count,
                total_quantity=total_quantity,
            )
        )

    return result
