from ..models import UserSession


PLAN_LIMITS = {
    "free": 1,
    "starter": 2,
    "pro": 3,
    "vip": 999,
}


def can_add_device(user, active_sessions_count: int) -> bool:
    limit = PLAN_LIMITS.get(user.plan, 1)
    return active_sessions_count < limit