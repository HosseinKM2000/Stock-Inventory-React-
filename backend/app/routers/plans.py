from fastapi import APIRouter

from ..deps import CurrentUser
from ..plans import PLAN_CATALOG, entitlement_for
from ..schemas import EntitlementOut, PlanDefinitionOut

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("", response_model=list[PlanDefinitionOut])
def available_plans(_: CurrentUser):
    return [{"id": plan_id, **definition} for plan_id, definition in PLAN_CATALOG.items()]


@router.get("/current", response_model=EntitlementOut)
def current_plan(current_user: CurrentUser):
    return entitlement_for(current_user)
