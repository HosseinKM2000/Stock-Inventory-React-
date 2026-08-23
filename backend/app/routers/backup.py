from fastapi import APIRouter
from sqlalchemy import select

from ..deps import CurrentUser, DbSession, require_backup_access
from ..models import InventoryItem
from ..schemas import InventoryOut, MessageResponse

router = APIRouter(prefix="/backup", tags=["backup"])


@router.get("", response_model=list[InventoryOut])
def get_backup(
    current_user: CurrentUser,
    db: DbSession,
):
    require_backup_access(db, current_user)

    stmt = (
        select(InventoryItem)
        .where(
            InventoryItem.user_id == current_user.id,
            InventoryItem.deleted_at.is_(None),
        )
        .order_by(InventoryItem.created_at.desc())
    )

    return list(db.scalars(stmt))


@router.post("/restore", response_model=MessageResponse)
def restore_backup(
    current_user: CurrentUser,
    db: DbSession,
):
    require_backup_access(db, current_user)

    return MessageResponse(
        message="بکاپ با موفقیت بازیابی شد"
    )
