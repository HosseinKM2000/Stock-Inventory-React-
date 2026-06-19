from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ..deps import CurrentUser, DbSession
from ..models import Category
from ..schemas import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categories", tags=["categories"])


def _get_owned_category(db: DbSession, category_id: int, user_id: int) -> Category:
    category = db.get(Category, category_id)
    if category is None or category.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="دسته بندی یافت نشد"
        )
    return category


@router.get("", response_model=list[CategoryOut])
def list_categories(current_user: CurrentUser, db: DbSession) -> list[Category]:
    stmt = (
        select(Category)
        .where(Category.user_id == current_user.id)
        .order_by(Category.created_at.desc())
    )
    return list(db.scalars(stmt))


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate, current_user: CurrentUser, db: DbSession
) -> Category:
    category = Category(
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
    current_user: CurrentUser,
    db: DbSession,
) -> Category:
    category = _get_owned_category(db, category_id, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int, current_user: CurrentUser, db: DbSession
) -> None:
    category = _get_owned_category(db, category_id, current_user.id)
    db.delete(category)
    db.commit()
