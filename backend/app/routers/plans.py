from fastapi import APIRouter

from ..deps import CurrentUser, DbSession
from ..schemas import PlanUpdate, UserOut

router = APIRouter(prefix="/plans", tags=["plans"])


@router.patch("/upgrade", response_model=UserOut)
def upgrade_plan(
    payload: PlanUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    current_user.plan = payload.plan

    if payload.plan != "free":
        current_user.device_id = None

    db.commit()
    db.refresh(current_user)

    return current_user