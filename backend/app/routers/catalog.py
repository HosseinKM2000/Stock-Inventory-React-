from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ..deps import CurrentUser, DbSession
from ..models import CatalogProduct, InventoryItem
from ..schemas import CatalogProductOut, InventoryCreate, InventoryOut

router = APIRouter(prefix="/catalog", tags=["catalog"])


# =========================================================
# LIST CATALOG (READ ONLY - USER ACCESS)
# =========================================================
@router.get("", response_model=list[CatalogProductOut])
def list_catalog(
    db: DbSession,
    search: str | None = None,
) -> list[CatalogProduct]:

    stmt = select(CatalogProduct)

    if search:
        stmt = stmt.where(
            CatalogProduct.name.ilike(f"%{search}%")
        )

    stmt = stmt.order_by(CatalogProduct.name.asc())

    return list(db.scalars(stmt))


# =========================================================
# GET SINGLE CATALOG ITEM (READ ONLY)
# =========================================================
@router.get("/{catalog_id}", response_model=CatalogProductOut)
def get_catalog_product(
    catalog_id: int,
    db: DbSession,
) -> CatalogProduct:

    product = db.get(CatalogProduct, catalog_id)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="محصول کاتالوگ یافت نشد",
        )

    return product


# =========================================================
# ADD TO USER INVENTORY (ONLY ACTION USER CAN DO)
# =========================================================
@router.post("/{catalog_id}/add", response_model=InventoryOut)
def add_catalog_to_inventory(
    catalog_id: int,
    payload: InventoryCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> InventoryItem:

    # 1. check catalog exists
    catalog_product = db.get(CatalogProduct, catalog_id)

    if not catalog_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="محصول کاتالوگ یافت نشد",
        )

    # 2. prevent duplicates in user inventory
    existing = db.scalar(
        select(InventoryItem).where(
            InventoryItem.user_id == current_user.id,
            InventoryItem.product_catalog_id == catalog_id,
        )
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="این محصول قبلا به انبار شما اضافه شده است",
        )

    # 3. create user-owned inventory item (COPY NOT ORIGINAL)
    item = InventoryItem(
        user_id=current_user.id,
        product_catalog_id=catalog_id,
        quantity=payload.quantity,
        price=payload.price,
        custom_label=payload.custom_label,
        note=payload.note,
        low_stock_threshold=payload.low_stock_threshold,
        low_stock_alert=payload.low_stock_alert,
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return item