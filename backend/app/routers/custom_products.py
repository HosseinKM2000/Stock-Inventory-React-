from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ..deps import CurrentUser, DbSession
from ..models import CustomProduct
from ..schemas import (
    CustomProductCreate,
    CustomProductUpdate,
    CustomProductOut,
)

router = APIRouter(
    prefix="/custom-products",
    tags=["custom-products"]
)


def _get_custom_product(
    db: DbSession,
    product_id: int,
    user_id: int,
) -> CustomProduct:
    product = db.get(CustomProduct, product_id)

    if product is None or product.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="محصول یافت نشد"
        )

    return product


@router.get("", response_model=list[CustomProductOut])
def list_custom_products(
    current_user: CurrentUser,
    db: DbSession,
) -> list[CustomProduct]:
    stmt = (
        select(CustomProduct)
        .where(CustomProduct.user_id == current_user.id)
        .order_by(CustomProduct.created_at.desc())
    )

    return list(db.scalars(stmt))


@router.get("/{product_id}", response_model=CustomProductOut)
def get_custom_product(
    product_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> CustomProduct:
    return _get_custom_product(
        db,
        product_id,
        current_user.id,
    )


@router.post(
    "",
    response_model=CustomProductOut,
    status_code=status.HTTP_201_CREATED,
)
def create_custom_product(
    payload: CustomProductCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> CustomProduct:
    product = CustomProduct(
        user_id=current_user.id,
        name=payload.name,
        description=payload.description,
        image_url=payload.image_url,
        quantity=payload.quantity,
        price=payload.price,
        note=payload.note,
    )

    db.add(product)
    db.commit()
    db.refresh(product)

    return product


@router.patch("/{product_id}", response_model=CustomProductOut)
def update_custom_product(
    product_id: int,
    payload: CustomProductUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> CustomProduct:
    product = _get_custom_product(
        db,
        product_id,
        current_user.id,
    )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)

    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_custom_product(
    product_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    product = _get_custom_product(
        db,
        product_id,
        current_user.id,
    )

    db.delete(product)
    db.commit()