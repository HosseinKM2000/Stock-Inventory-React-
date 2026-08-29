import uuid
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select

from ..config import settings
from ..deps import CurrentUser, CurrentWritableUser, DbSession
from ..models import CatalogProduct, Category, InventoryItem
from sqlalchemy.orm import joinedload
from ..schemas import InventoryOut, PaginatedInventory, InventoryStats, PaginationMeta
from ..services.subscription_service import entitlement_for_user
from ..services.authorization_service import is_admin

router = APIRouter(prefix="/products", tags=["products"])

_ALLOWED_IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/gif": ".gif",
}
MAX_FILE_SIZE = 5 * 1024 * 1024

SortOption = Literal["newest", "price_desc", "price_asc", "name"]


def _get_owned_product(db: DbSession, product_id: int, user_id: int) -> InventoryItem:
    product = db.get(InventoryItem, product_id)
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
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="حجم فایل بیش از حد مجاز است"
        )
    dest.write_bytes(content)
    return f"/uploads/{filename}"


def _delete_image(image_url: str | None) -> None:
    if not image_url or not image_url.startswith("/uploads/"):
        return
    path = settings.UPLOAD_DIR / Path(image_url).name
    path.unlink(missing_ok=True)


@router.get("", response_model=PaginatedInventory)
def list_products(
    current_user: CurrentUser,
    db: DbSession,
    search: str | None = None,
    sort: SortOption = "newest",
    category_id: int | None = None,
    status_filter: Literal["in_stock","low_stock","out_of_stock"] | None = None,
    page: int = 1,
    limit: int = 10,
) -> PaginatedInventory:
    stmt = select(InventoryItem).options(joinedload(InventoryItem.catalog_product)).where(InventoryItem.user_id == current_user.id)

    if search:
        stmt = stmt.join(CatalogProduct).where(
            (CatalogProduct.name.ilike(f"%{search}%")) |
            (InventoryItem.custom_label.ilike(f"%{search}%"))
        )

    if category_id is not None:
        stmt = stmt.where(InventoryItem.category_id == category_id)

    products = list(db.scalars(stmt))

    if status_filter:
        products = [p for p in products if p.status == status_filter]

    products.sort(
        key=lambda p: {
            "newest": p.created_at.timestamp(),
            "price_desc": p.price,
            "price_asc": p.price,
            "name": (p.custom_label or p.catalog_product.name).lower(),
        }[sort],
        reverse=sort in ["newest", "price_desc"],
    )

    total = len(products)

    start = (page - 1) * limit
    end = start + limit

    paginated = products[start:end]

    return PaginatedInventory(
    items=paginated,
    meta=PaginationMeta(
        total=total,
        page=page,
        limit=limit,
    ),
    )


@router.post("", response_model=InventoryOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    current_user: CurrentWritableUser,
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
) -> InventoryItem:
    _validate_category(db, category_id, current_user.id)

    limit = None if is_admin(current_user) else entitlement_for_user(db, current_user)["limits"]["inventory_items"]
    count = db.scalar(select(func.count(InventoryItem.id)).where(InventoryItem.user_id == current_user.id)) or 0
    if limit is not None and count >= limit:
        raise HTTPException(status_code=403, detail="INVENTORY_LIMIT_REACHED")

    image_url = await _save_image(image) if image is not None else None

    if current_user.industry_id is None:
        raise HTTPException(status_code=400, detail="INDUSTRY_REQUIRED")
    catalog = CatalogProduct(
        industry_id=current_user.industry_id,
        name=name,
        description=description,
        is_shared=False,
    )
    db.add(catalog)
    db.flush()
    product = InventoryItem(
        catalog_product_id=catalog.id,
        custom_label=name,
        note=description,
        quantity=quantity,
        price=price,
        low_stock_threshold=low_stock_threshold,
        low_stock_alert=low_stock_alert,
        category_id=category_id,
        image_url=image_url,
        user_id=current_user.id,
        is_catalog_backed=False,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/{product_id}", response_model=InventoryOut)
async def update_product(
    product_id: int,
    current_user: CurrentWritableUser,
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
) -> InventoryItem:
    product = _get_owned_product(db, product_id, current_user.id)

    if category_id is not None:
        _validate_category(db, category_id, current_user.id)

    updates = {
        "custom_label": name,
        "quantity": quantity,
        "price": price,
        "note": description,
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
    product_id: int, current_user: CurrentWritableUser, db: DbSession
) -> None:
    product = _get_owned_product(db, product_id, current_user.id)
    if product.is_catalog_backed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CATALOG_BACKED_PRODUCT_DELETE_FORBIDDEN",
        )
    private_catalog = (
        product.catalog_product if not product.catalog_product.is_shared else None
    )
    _delete_image(product.image_url)
    db.delete(product)
    db.flush()
    if private_catalog is not None:
        db.delete(private_catalog)
    db.commit()


@router.get("/stats", response_model=InventoryStats)
def product_stats(
    current_user: CurrentUser,
    db: DbSession,
) -> InventoryStats:
    products = list(
        db.scalars(
            select(InventoryItem).where(InventoryItem.user_id == current_user.id)
        )
    )

    total_products = len(products)
    total_quantity = sum(p.quantity for p in products)
    inventory_value = sum(p.price * p.quantity for p in products)
    low_stock_count = sum(1 for p in products if p.status == "low_stock")
    out_of_stock_count = sum(1 for p in products if p.status == "out_of_stock")

    most_expensive = max(products, key=lambda p: p.price, default=None)
    cheapest = min(products, key=lambda p: p.price, default=None)

    return InventoryStats(
        total_items=total_products,
        total_quantity=total_quantity,
        inventory_value=inventory_value,
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
        most_expensive_price=most_expensive.price if most_expensive else None,
        cheapest_price=cheapest.price if cheapest else None,
    )


@router.get("/alerts/low-stock", response_model=list[InventoryOut])
def low_stock_alerts(
    current_user: CurrentUser,
    db: DbSession,
) -> list[InventoryItem]:
    products = list(
        db.scalars(
            select(InventoryItem).where(InventoryItem.user_id == current_user.id)
        )
    )

    alerts = [
        p
        for p in products
        if p.low_stock_alert
        and p.low_stock_threshold > 0
        and p.quantity <= p.low_stock_threshold
    ]

    return alerts


@router.get("/alerts/count")
def alerts_count(
    current_user: CurrentUser,
    db: DbSession,
):
    products = list(
        db.scalars(
            select(InventoryItem).where(InventoryItem.user_id == current_user.id)
        )
    )

    count = sum(
        1
        for p in products
        if p.low_stock_alert
        and p.low_stock_threshold > 0
        and p.quantity <= p.low_stock_threshold
    )

    return {"count": count}


@router.get("/{product_id}", response_model=InventoryOut)
def get_product(
    product_id: int, current_user: CurrentUser, db: DbSession
) -> InventoryItem:
    return _get_owned_product(db, product_id, current_user.id)

