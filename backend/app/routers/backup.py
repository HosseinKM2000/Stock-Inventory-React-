from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ..deps import CurrentUser, DbSession, require_backup_access
from ..services.store_service import owner_store_context
from ..models import InventoryItem
from ..schemas import InventoryOut
from ..services.store_authorization import project_inventory_item

router = APIRouter(prefix="/backup", tags=["backup"])


@router.get("", response_model=list[InventoryOut])
def get_backup(
    current_user: CurrentUser,
    db: DbSession,
):
    require_backup_access(db, current_user)
    owner_store_context(db, current_user)

    stmt = (
        select(InventoryItem)
        .where(
            InventoryItem.user_id == current_user.data_owner_id,
            InventoryItem.deleted_at.is_(None),
        )
        .order_by(InventoryItem.created_at.desc(), InventoryItem.id.desc())
    )

    return [project_inventory_item(db, current_user, item) for item in db.scalars(stmt)]


@router.post("/restore")
def restore_backup(
    current_user: CurrentUser,
    db: DbSession,
):
    require_backup_access(db, current_user)
    owner_store_context(db, current_user)

    # This endpoint has no snapshot/version input and therefore cannot perform
    # a safe restore. Return an intentional response instead of claiming that
    # data was restored when no mutation occurred.
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="BACKUP_RESTORE_NOT_IMPLEMENTED",
    )
