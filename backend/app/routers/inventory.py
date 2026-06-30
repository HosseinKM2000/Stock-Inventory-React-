from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ..deps import CurrentUser, DbSession
from ..models import InventoryItem, InventoryTransaction
from ..schemas import (
    InventoryOut,
    InventoryUpdate,
    TransactionCreate,
    TransactionOut,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])


def _get_inventory_item(
    db: DbSession,
    item_id: int,
    user_id: int,
) -> InventoryItem:
    item = db.get(InventoryItem, item_id)

    if item is None or item.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="آیتم یافت نشد",
        )

    return item


@router.get("", response_model=list[InventoryOut])
def list_inventory(
    current_user: CurrentUser,
    db: DbSession,
) -> list[InventoryItem]:
    stmt = (
        select(InventoryItem)
        .where(InventoryItem.user_id == current_user.id)
        .order_by(InventoryItem.created_at.desc())
    )

    return list(db.scalars(stmt))


@router.get("/{item_id}", response_model=InventoryOut)
def get_inventory_item(
    item_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> InventoryItem:
    return _get_inventory_item(
        db,
        item_id,
        current_user.id,
    )


@router.patch("/{item_id}", response_model=InventoryOut)
def update_inventory_item(
    item_id: int,
    payload: InventoryUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> InventoryItem:
    item = _get_inventory_item(
        db,
        item_id,
        current_user.id,
    )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inventory_item(
    item_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    item = _get_inventory_item(
        db,
        item_id,
        current_user.id,
    )

    db.delete(item)
    db.commit()


@router.post("/{item_id}/transaction", response_model=TransactionOut)
def create_transaction(
    item_id: int,
    payload: TransactionCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> InventoryTransaction:
    item = _get_inventory_item(
        db,
        item_id,
        current_user.id,
    )

    if payload.type == "stock_in":
        item.quantity += payload.quantity

    elif payload.type == "stock_out":
        if item.quantity < payload.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="موجودی کافی نیست",
            )

        item.quantity -= payload.quantity

    transaction = InventoryTransaction(
        user_id=current_user.id,
        inventory_item_id=item.id,
        type=payload.type,
        quantity=payload.quantity,
        note=payload.note,
    )

    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    return transaction


@router.get("/{item_id}/transactions", response_model=list[TransactionOut])
def list_transactions(
    item_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> list[InventoryTransaction]:
    _get_inventory_item(
        db,
        item_id,
        current_user.id,
    )

    stmt = (
        select(InventoryTransaction)
        .where(
            InventoryTransaction.inventory_item_id == item_id
        )
        .order_by(InventoryTransaction.created_at.desc())
    )

    return list(db.scalars(stmt))