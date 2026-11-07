from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import SubscriptionPlan


TOMAN_TO_IRR = 10
MAX_PLAN_PRICE_TOMAN = 10_000_000_000
PAID_OFFER_PLANS = frozenset({"pro", "vip"})
INVOICE_CAPABILITIES = ("invoices.purchase", "invoices.sale")


def price_minor_from_toman(value: int | None) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool) or not 0 <= value <= MAX_PLAN_PRICE_TOMAN:
        raise HTTPException(422, detail="PLAN_PRICE_TOMAN_INVALID")
    return value * TOMAN_TO_IRR


def price_toman_from_minor(value: int | None) -> int | None:
    if value is None:
        return None
    if value < 0 or value % TOMAN_TO_IRR:
        raise HTTPException(422, detail="PLAN_PRICE_STORAGE_INVALID")
    return value // TOMAN_TO_IRR


def validate_offer_configuration(
    *, plan_id: str, price_minor: int | None, duration: int | None,
    duration_unit: str | None, is_offer_available: bool,
) -> None:
    if (duration is None) != (duration_unit is None):
        raise HTTPException(422, detail="PLAN_DURATION_INVALID")
    if duration is not None and duration < 1:
        raise HTTPException(422, detail="PLAN_DURATION_INVALID")
    if price_minor is not None:
        price_toman_from_minor(price_minor)
    if is_offer_available:
        if plan_id not in PAID_OFFER_PLANS:
            raise HTTPException(422, detail="PLAN_OFFER_NOT_ELIGIBLE")
        if price_minor is None or price_minor <= 0 or duration is None or duration_unit is None:
            raise HTTPException(422, detail="PLAN_OFFER_CONFIGURATION_INCOMPLETE")


def validate_invoice_allocation(plan_id: str, features: dict[str, bool]) -> None:
    expected = plan_id in PAID_OFFER_PLANS
    if any(features.get(key) is not expected for key in INVOICE_CAPABILITIES):
        raise HTTPException(422, detail=f"PLAN_INVOICE_ALLOCATION_FIXED:{plan_id}")


@dataclass(frozen=True)
class PlanOfferSnapshot:
    offer_id: str
    plan_id: str
    plan_revision: int
    amount_toman: int
    currency: str
    term_count: int
    term_unit: str
    captured_at: datetime


def capture_plan_offer(db: Session, plan_id: str) -> PlanOfferSnapshot:
    plan = db.get(SubscriptionPlan, plan_id)
    if plan is None or not plan.is_active:
        raise HTTPException(404, detail="PLAN_NOT_FOUND")
    validate_offer_configuration(
        plan_id=plan.id, price_minor=plan.price_minor, duration=plan.duration,
        duration_unit=plan.duration_unit, is_offer_available=plan.is_offer_available,
    )
    if not plan.is_offer_available:
        raise HTTPException(409, detail="PLAN_OFFER_UNAVAILABLE")
    amount_toman = price_toman_from_minor(plan.price_minor)
    assert amount_toman is not None and plan.duration is not None and plan.duration_unit is not None
    captured_at = datetime.now(timezone.utc)
    return PlanOfferSnapshot(
        offer_id=f"{plan.id}:r{plan.policy_revision}", plan_id=plan.id,
        plan_revision=plan.policy_revision, amount_toman=amount_toman,
        currency="TOMAN", term_count=plan.duration, term_unit=plan.duration_unit,
        captured_at=captured_at,
    )
