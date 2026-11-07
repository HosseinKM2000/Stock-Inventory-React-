from ..models import User
from sqlalchemy.orm import Session


def can_add_device(
    db: Session,
    user: User,
    active_sessions_count: int,
) -> bool:
    # Commercial V1 keeps device admission unrestricted.  The typed policy
    # remains observable as an extension point but is not enforced here.
    return True


def effective_device_policy(db: Session, user: User) -> dict[str, int | str | None]:
    # The fields and registry key are retained for a later device-policy task,
    # but V1 deliberately has no admission restriction.
    return {"limit": None, "source": "plan", "mode": "unlimited"}
