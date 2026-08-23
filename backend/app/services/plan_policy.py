from ..models import User
from ..plans import plan_definition


def can_add_device(
    user: User,
    active_sessions_count: int,
) -> bool:

    limit = plan_definition(user.plan)["limits"]["devices"]
    return limit is None or active_sessions_count < limit
