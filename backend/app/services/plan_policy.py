from fastapi import HTTPException, status

from ..models import User, UserSession

PLAN_LIMITS = {
    "free": 1,
    "starter": 2,
    "pro": 3,
    "vip": 999,
}


def can_add_device(
    user: User,
    active_sessions_count: int,
) -> bool:

    limit = PLAN_LIMITS.get(user.plan, 1)

    return active_sessions_count < limit