from typing import Literal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ..deps import CurrentUser, DbSession
from ..models import InventoryMovement, Product
from ..schemas import InventoryMovementCreate, InventoryMovementOut

router = APIRouter(prefix="/inventory", tags=["inventory"])

MovementType = Literal["in", "out", "adjust"]


def _get_owned_product(db: DbSession, product_id: int, user_id: int) -> Product:
    product = db.get(Product, product_id)

    if product is None or product.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="محصول یافت نشد",
        )

    return product


@router.post("", response_model=InventoryMovementOut)
def create_inventory_movement(
    payload: InventoryMovementCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> InventoryMovement:
    product = _get_owned_product(db, payload.product_id, current_user.id)

    if payload.type == "in":
        product.quantity += payload.quantity

    elif payload.type == "out":
        if product.quantity < payload.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="موجودی کافی نیست",
            )
        product.quantity -= payload.quantity

    elif payload.type == "adjust":
        product.quantity = payload.quantity

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="نوع عملیات نامعتبر است",
        )

    movement = InventoryMovement(
        type=payload.type,
        quantity=payload.quantity,
        reason=payload.reason,
        product_id=payload.product_id,
        user_id=current_user.id,
    )

    db.add(movement)
    db.commit()
    db.refresh(movement)

    return movement


@router.get("", response_model=list[InventoryMovementOut])
def list_inventory_movements(
    current_user: CurrentUser,
    db: DbSession,
) -> list[InventoryMovement]:
    stmt = (
        select(InventoryMovement)
        .where(InventoryMovement.user_id == current_user.id)
        .order_by(InventoryMovement.created_at.desc())
    )

    return list(db.scalars(stmt))


@router.get("/{product_id}", response_model=list[InventoryMovementOut])
def get_product_inventory_history(
    product_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> list[InventoryMovement]:
    _get_owned_product(db, product_id, current_user.id)

    stmt = (
        select(InventoryMovement)
        .where(
            InventoryMovement.product_id == product_id,
            InventoryMovement.user_id == current_user.id,
        )
        .order_by(InventoryMovement.created_at.desc())
    )

    return list(db.scalars(stmt))