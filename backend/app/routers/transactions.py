from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ..deps import CurrentUser, CurrentWritableUser, DbSession
from ..models import InventoryItem, InventoryTransaction
from ..schemas import TransactionCreate, TransactionOut

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _get_owned_product(
    db: DbSession,
    product_id: int,
    user_id: int,
) -> InventoryItem:
    product = db.get(InventoryItem, product_id)

    if product is None or product.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="محصول یافت نشد",
        )

    return product


@router.post(
    "/products/{product_id}",
    response_model=TransactionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_transaction(
    product_id: int,
    payload: TransactionCreate,
    current_user: CurrentWritableUser,
    db: DbSession,
) -> InventoryTransaction:

    product = _get_owned_product(db, product_id, current_user.id)

    # validation
    if payload.type == "stock_out" and payload.quantity > product.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="موجودی کافی نیست",
        )

    before_quantity = product.quantity

    # update stock
    if payload.type == "stock_in":
        product.quantity += payload.quantity
    else:
        product.quantity -= payload.quantity

    after_quantity = product.quantity

    # create transaction
    transaction = InventoryTransaction(
        inventory_item_id=product.id,
        user_id=current_user.id,
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


@router.get(
    "/products/{product_id}",
    response_model=list[TransactionOut],
)
def product_transactions(
    product_id: int,
    current_user: CurrentUser,
    db: DbSession,
) -> list[InventoryTransaction]:

    _get_owned_product(db, product_id, current_user.id)

    stmt = (
        select(InventoryTransaction)
        .where(
            InventoryTransaction.inventory_item_id == product_id,
            InventoryTransaction.user_id == current_user.id,
        )
        .order_by(
            InventoryTransaction.created_at.desc(),
            InventoryTransaction.id.desc(),
        )
    )

    return list(db.scalars(stmt))


@router.get("", response_model=list[TransactionOut])
def all_transactions(
    current_user: CurrentUser,
    db: DbSession,
) -> list[InventoryTransaction]:

    stmt = (
        select(InventoryTransaction)
        .where(InventoryTransaction.user_id == current_user.id)
        .order_by(
            InventoryTransaction.created_at.desc(),
            InventoryTransaction.id.desc(),
        )
    )

    return list(db.scalars(stmt))
