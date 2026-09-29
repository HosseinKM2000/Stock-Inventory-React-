import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import User
from ..security import hash_password
from .authorization_service import RoleId, set_role

logger = logging.getLogger(__name__)

SYSTEM_ADMIN_KEY = "primary-system-administrator"
SYSTEM_ADMIN_USERNAME = "HosseinKM2000"
SYSTEM_ADMIN_FIRST_NAME = "Hossein"
SYSTEM_ADMIN_LAST_NAME = "Kamari"
SYSTEM_ADMIN_EMAIL = "hoseinkmofficial@gmail.com"
SYSTEM_ADMIN_PHONE = "09032431761"


def ensure_system_admin(db: Session) -> bool:
    password = settings.SYSTEM_ADMIN_PASSWORD
    if not password:
        raise RuntimeError("SYSTEM_ADMIN_PASSWORD is required")
    if len(password) < 12:
        raise RuntimeError("SYSTEM_ADMIN_PASSWORD must contain at least 12 characters")

    existing = db.scalar(select(User).where(User.system_key == SYSTEM_ADMIN_KEY))
    if existing is not None:
        # An idempotent seed must never rotate credentials. Password changes
        # belong to the existing authenticated password-management flow.
        existing.is_system_admin = True
        existing.is_active = True
        set_role(existing, RoleId.ADMIN)
        db.commit()
        return True

    user = db.scalar(select(User).where(User.username == SYSTEM_ADMIN_USERNAME))
    if user is not None:
        raise RuntimeError(
            "The permanent administrator username is already assigned to a "
            "non-system account; refusing to overwrite that account"
        )

    user = User(
        first_name=SYSTEM_ADMIN_FIRST_NAME,
        last_name=SYSTEM_ADMIN_LAST_NAME,
        username=SYSTEM_ADMIN_USERNAME,
        email=SYSTEM_ADMIN_EMAIL,
        phone=SYSTEM_ADMIN_PHONE,
        hashed_password=hash_password(password),
        plan="free",
        is_active=True,
    )
    db.add(user)

    user.first_name = SYSTEM_ADMIN_FIRST_NAME
    user.last_name = SYSTEM_ADMIN_LAST_NAME
    user.email = SYSTEM_ADMIN_EMAIL
    user.phone = SYSTEM_ADMIN_PHONE
    user.system_key = SYSTEM_ADMIN_KEY
    user.is_system_admin = True
    set_role(user, RoleId.ADMIN)
    db.commit()
    logger.info("Permanent system administrator created")
    return True
