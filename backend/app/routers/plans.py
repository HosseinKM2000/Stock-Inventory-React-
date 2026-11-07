from fastapi import APIRouter

from ..deps import CurrentUser, DbSession
from ..schemas import EntitlementOut, PlanDefinitionOut
from ..services.subscription_service import entitlement_for_user, list_plans, plan_payload

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("", response_model=list[PlanDefinitionOut])
def available_plans(_: CurrentUser, db: DbSession):
    return [plan_payload(plan) for plan in list_plans(db, active_only=True)]


@router.get("/current", response_model=EntitlementOut)
def current_plan(current_user: CurrentUser, db: DbSession):
    return entitlement_for_user(db, current_user)
