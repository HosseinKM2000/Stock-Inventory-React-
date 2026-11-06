from fastapi import APIRouter

from ..deps import CurrentUser, DbSession
from ..schemas import EntitlementOut, PlanDefinitionOut, PlanOfferOut
from ..services.plan_pricing import capture_plan_offer
from ..services.subscription_service import entitlement_for_user, list_plans, plan_payload

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("", response_model=list[PlanDefinitionOut])
def available_plans(_: CurrentUser, db: DbSession):
    # Starter remains readable for historical subscribers but is not an
    # approved V1 offering presented for new selection.
    return [plan_payload(plan) for plan in list_plans(db, active_only=True) if plan.id in {"free", "pro", "vip"}]


@router.get("/current", response_model=EntitlementOut)
def current_plan(current_user: CurrentUser, db: DbSession):
    return entitlement_for_user(db, current_user)


@router.get("/{plan_id}/offer", response_model=PlanOfferOut)
def plan_offer(plan_id: str, _: CurrentUser, db: DbSession):
    snapshot = capture_plan_offer(db, plan_id)
    return {**snapshot.__dict__, "checkout_available": False,
            "checkout_status": "PAYMENT_PROVIDER_NOT_CONFIGURED"}
