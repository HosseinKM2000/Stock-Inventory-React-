from ..limits import PLAN_LIMITS


def get_user_limits(user):
    return PLAN_LIMITS.get(user.plan, PLAN_LIMITS["free"])