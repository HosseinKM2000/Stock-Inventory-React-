from fastapi import APIRouter
from sqlalchemy import select

from ..deps import CurrentLabelUser, DbSession
from ..models import Label
from ..schemas import LabelOut

router = APIRouter(prefix="/labels", tags=["labels"])

@router.get("", response_model=list[LabelOut])
def list_labels(current_user: CurrentLabelUser, db: DbSession) -> list[Label]:
    return list(db.scalars(
        select(Label).where(Label.user_id == current_user.id).order_by(Label.name, Label.id)
    ))
