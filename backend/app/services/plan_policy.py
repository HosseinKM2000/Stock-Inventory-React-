from ..models import User
from sqlalchemy.orm import Session
from .subscription_service import entitlement_for_user


def can_add_device(
    db: Session,
    user: User,
    active_sessions_count: int,
) -> bool:

    limit = effective_device_policy(db, user)["limit"]
    return limit is None or active_sessions_count < limit


def effective_device_policy(db: Session, user: User) -> dict[str, int | str | None]:
    if user.device_limit_mode == "unlimited":
        return {"limit": None, "source": "user", "mode": "unlimited"}
    if user.device_limit_mode == "limited":
        return {"limit": user.device_limit_override, "source": "user", "mode": "limited"}
    limit = entitlement_for_user(db, user)["limits"].get("devices")
    return {"limit": limit, "source": "plan", "mode": "unlimited" if limit is None else "limited"}
