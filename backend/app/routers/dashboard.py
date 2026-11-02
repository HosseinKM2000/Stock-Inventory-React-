from fastapi import APIRouter

from ..deps import CurrentDashboardUser, DbSession
from ..schemas import DashboardStats
from ..services.dashboard_service import get_dashboard

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
)


@router.get("", response_model=DashboardStats)
def dashboard(
    current_user: CurrentDashboardUser,
    db: DbSession,
):
    return get_dashboard(
        db=db,
        store_id=current_user.store_id,
    )
