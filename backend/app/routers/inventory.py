from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from ..services.inventory_service import (
    get_inventory_item_or_404,
    update_inventory_item
)

from ..deps import CurrentUser, DbSession
from ..models import InventoryItem, InventoryTransaction
from ..schemas import (
    InventoryBulkSync,
    InventoryOut,
    InventoryListResponse,
    InventoryMeta,
    InventoryUpdate,
    MessageResponse,
    TransactionCreate,
    TransactionOut,
)

router = APIRouter(prefix="/inventory", tags=["inventory"])




@router.get("", response_model=InventoryListResponse)
def list_inventory(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    base_query = (
        select(InventoryItem)
        .where(
            InventoryItem.user_id == current_user.id,
            InventoryItem.deleted_at.is_(None),
            InventoryItem.is_hidden.is_(False),
        )
    )

    total = db.scalar(
        select(func.count())
        .select_from(base_query.subquery())
    )

    items = list(
        db.scalars(
            base_query
            .options(
                joinedload(InventoryItem.catalog_product)
            )
            .order_by(InventoryItem.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    )

    return InventoryListResponse(
        items=items,
        meta=InventoryMeta(
            page=page,
            limit=limit,
            total=total or 0,
        ),
    )

@router.get("/{item_id}", response_model=InventoryOut)
def get_inventory_item(
    item_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> InventoryItem:
    return get_inventory_item_or_404(
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
    item = get_inventory_item_or_404(
        db,
        item_id,
        current_user.id,
    )

    update_inventory_item(
        item,
        payload.model_dump(exclude_unset=True),
    )

    db.commit()
    db.refresh(item)

    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inventory_item(
    item_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    item = get_inventory_item_or_404(
        db,
        item_id,
        current_user.id,
    )

    item.deleted_at = datetime.now(timezone.utc)

    db.commit()


@router.post("/{item_id}/transaction", response_model=TransactionOut)
def create_transaction(
    item_id: int,
    payload: TransactionCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> InventoryTransaction:
    item = get_inventory_item_or_404(
        db,
        item_id,
        current_user.id,
    )

    before_quantity = item.quantity

    if payload.type == "stock_in":
        item.quantity += payload.quantity

    elif payload.type == "stock_out":
        if item.quantity < payload.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="موجودی کافی نیست",
            )

        item.quantity -= payload.quantity

    after_quantity = item.quantity

    transaction = InventoryTransaction(
        user_id=current_user.id,
        inventory_item_id=item.id,
        type=payload.type,
        quantity=payload.quantity,
        before_quantity=before_quantity,
        after_quantity=after_quantity,
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
    get_inventory_item_or_404(
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


@router.patch("/{item_id}/hide", response_model=InventoryOut)
def hide_inventory_item(
    item_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> InventoryItem:
    item = get_inventory_item_or_404(
        db,
        item_id,
        current_user.id,
    )

    item.is_hidden = True

    db.commit()
    db.refresh(item)

    return item


@router.patch("/{item_id}/restore", response_model=InventoryOut)
def restore_inventory_item(
    item_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> InventoryItem:
    item = get_inventory_item_or_404(
        db,
        item_id,
        current_user.id,
    )

    item.is_hidden = False
    item.deleted_at = None

    db.commit()
    db.refresh(item)

    return item


@router.delete("/{item_id}/force", response_model=MessageResponse)
def force_delete_inventory_item(
    item_id: int,
    current_user: CurrentUser,
    db: DbSession,
):
    item = get_inventory_item_or_404(
        db,
        item_id,
        current_user.id,
    )

    db.delete(item)
    db.commit()

    return MessageResponse(
        message="آیتم برای همیشه حذف شد"
    )


@router.get("/trash", response_model=list[InventoryOut])
def trash_inventory(
    current_user: CurrentUser,
    db: DbSession,
) -> list[InventoryItem]:
    stmt = (
        select(InventoryItem)
        .where(
            InventoryItem.user_id == current_user.id,
            InventoryItem.deleted_at.is_not(None),
        )
        .order_by(InventoryItem.created_at.desc())
    )

    return list(db.scalars(stmt))


@router.post("/sync", response_model=MessageResponse)
def bulk_sync_inventory(
    payload: InventoryBulkSync,
    current_user: CurrentUser,
    db: DbSession,
):
    for sync_item in payload.items:
        item = db.get(InventoryItem, sync_item.id)

        if item is None:
            continue

        if item.user_id != current_user.id:
            continue

        if item.deleted_at is not None:
            continue

        item.quantity = sync_item.quantity
        item.price = sync_item.price
        item.custom_label = sync_item.custom_label
        item.note = sync_item.note

    db.commit()

    return MessageResponse(
        message="همگام‌سازی با موفقیت انجام شد"
    )