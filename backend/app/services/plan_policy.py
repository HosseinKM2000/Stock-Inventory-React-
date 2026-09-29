from ..models import User
from sqlalchemy.orm import Session
from .authorization_service import is_admin
from .subscription_service import entitlement_for_user


def can_add_device(
    db: Session,
    user: User,
    active_sessions_count: int,
) -> bool:

    if is_admin(user):
        return True
    limit = entitlement_for_user(db, user)["limits"].get("devices")
    return limit is None or active_sessions_count < limit
