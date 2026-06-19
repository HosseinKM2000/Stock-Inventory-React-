import uuid
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select

from ..config import settings
from ..deps import CurrentUser, DbSession
from ..models import Category, Product
from ..schemas import ProductOut

router = APIRouter(prefix="/products", tags=["products"])

_ALLOWED_IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

SortOption = Literal["newest", "price_desc", "price_asc", "name"]


def _get_owned_product(db: DbSession, product_id: int, user_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None or product.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="محصول یافت نشد"
        )
    return product


def _validate_category(db: DbSession, category_id: int | None, user_id: int) -> None:
    if category_id is None:
        return
    category = db.get(Category, category_id)
    if category is None or category.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="دسته بندی نامعتبر است"
        )


async def _save_image(image: UploadFile) -> str:
    ext = _ALLOWED_IMAGE_TYPES.get(image.content_type or "")
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="فرمت تصویر پشتیبانی نمی شود",
        )
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = settings.UPLOAD_DIR / filename
    content = await image.read()
    dest.write_bytes(content)
    return f"/uploads/{filename}"


def _delete_image(image_url: str | None) -> None:
    if not image_url or not image_url.startswith("/uploads/"):
        return
    path = settings.UPLOAD_DIR / Path(image_url).name
    path.unlink(missing_ok=True)


@router.get("", response_model=list[ProductOut])
def list_products(
    current_user: CurrentUser,
    db: DbSession,
    search: str | None = None,
    sort: SortOption = "newest",
    category_id: int | None = None,
) -> list[Product]:
    stmt = select(Product).where(Product.user_id == current_user.id)

    if search:
        like = f"%{search}%"
        stmt = stmt.where(Product.name.ilike(like))
    if category_id is not None:
        stmt = stmt.where(Product.category_id == category_id)

    order = {
        "newest": Product.created_at.desc(),
        "price_desc": Product.price.desc(),
        "price_asc": Product.price.asc(),
        "name": Product.name.asc(),
    }[sort]
    stmt = stmt.order_by(order)

    return list(db.scalars(stmt))


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int, current_user: CurrentUser, db: DbSession
) -> Product:
    return _get_owned_product(db, product_id, current_user.id)


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    current_user: CurrentUser,
    db: DbSession,
    name: Annotated[str, Form(min_length=1)],
    quantity: Annotated[int, Form(ge=0)] = 0,
    price: Annotated[int, Form(ge=0)] = 0,
    description: Annotated[str | None, Form()] = None,
    unit: Annotated[str | None, Form()] = None,
    category_id: Annotated[int | None, Form()] = None,
    low_stock_threshold: Annotated[int, Form(ge=0)] = 0,
    low_stock_alert: Annotated[bool, Form()] = False,
    image: Annotated[UploadFile | None, File()] = None,
) -> Product:
    _validate_category(db, category_id, current_user.id)

    image_url = await _save_image(image) if image is not None else None

    product = Product(
        name=name,
        description=description,
        unit=unit,
        quantity=quantity,
        price=price,
        low_stock_threshold=low_stock_threshold,
        low_stock_alert=low_stock_alert,
        category_id=category_id,
        image_url=image_url,
        user_id=current_user.id,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    current_user: CurrentUser,
    db: DbSession,
    name: Annotated[str | None, Form()] = None,
    quantity: Annotated[int | None, Form(ge=0)] = None,
    price: Annotated[int | None, Form(ge=0)] = None,
    description: Annotated[str | None, Form()] = None,
    unit: Annotated[str | None, Form()] = None,
    category_id: Annotated[int | None, Form()] = None,
    low_stock_threshold: Annotated[int | None, Form(ge=0)] = None,
    low_stock_alert: Annotated[bool | None, Form()] = None,
    image: Annotated[UploadFile | None, File()] = None,
    remove_image: Annotated[bool, Form()] = False,
) -> Product:
    product = _get_owned_product(db, product_id, current_user.id)

    if category_id is not None:
        _validate_category(db, category_id, current_user.id)

    updates = {
        "name": name,
        "quantity": quantity,
        "price": price,
        "description": description,
        "unit": unit,
        "category_id": category_id,
        "low_stock_threshold": low_stock_threshold,
        "low_stock_alert": low_stock_alert,
    }
    for field, value in updates.items():
        if value is not None:
            setattr(product, field, value)

    if image is not None:
        _delete_image(product.image_url)
        product.image_url = await _save_image(image)
    elif remove_image:
        _delete_image(product.image_url)
        product.image_url = None

    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int, current_user: CurrentUser, db: DbSession
) -> None:
    product = _get_owned_product(db, product_id, current_user.id)
    _delete_image(product.image_url)
    db.delete(product)
    db.commit()
