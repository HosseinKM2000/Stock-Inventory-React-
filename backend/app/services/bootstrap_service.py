import logging
import secrets

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
    if password and len(password) < 12:
        raise RuntimeError("SYSTEM_ADMIN_PASSWORD must contain at least 12 characters")

    existing = db.scalar(select(User).where(User.system_key == SYSTEM_ADMIN_KEY))
    if existing is not None:
        existing.is_system_admin = True
        existing.is_active = True
        set_role(existing, RoleId.ADMIN)
        if password:
            existing.hashed_password = hash_password(password)
        db.commit()
        return True

    user = db.scalar(select(User).where(User.username == SYSTEM_ADMIN_USERNAME))
    if user is not None and not password:
        identity_matches = (
            user.first_name == SYSTEM_ADMIN_FIRST_NAME
            and user.last_name == SYSTEM_ADMIN_LAST_NAME
            and user.phone == SYSTEM_ADMIN_PHONE
        )
        if not identity_matches:
            raise RuntimeError(
                "The permanent administrator username is already registered "
                "to a different identity. Set SYSTEM_ADMIN_PASSWORD to "
                "authorize its secure adoption."
            )

    generated_credential = user is None and not password
    if user is None:
        # A fresh database always receives the immutable administrator record.
        # Until a deployment secret is provided, its generated password is
        # intentionally unknown and the account cannot be used to sign in.
        initial_password = password or secrets.token_urlsafe(48)
        user = User(
            first_name=SYSTEM_ADMIN_FIRST_NAME,
            last_name=SYSTEM_ADMIN_LAST_NAME,
            username=SYSTEM_ADMIN_USERNAME,
            email=SYSTEM_ADMIN_EMAIL,
            phone=SYSTEM_ADMIN_PHONE,
            hashed_password=hash_password(initial_password),
            plan="free",
            is_active=True,
        )
        db.add(user)
    elif password:
        user.hashed_password = hash_password(password)

    user.first_name = SYSTEM_ADMIN_FIRST_NAME
    user.last_name = SYSTEM_ADMIN_LAST_NAME
    user.email = SYSTEM_ADMIN_EMAIL
    user.phone = SYSTEM_ADMIN_PHONE
    user.system_key = SYSTEM_ADMIN_KEY
    user.is_system_admin = True
    set_role(user, RoleId.ADMIN)
    db.commit()
    if generated_credential:
        logger.warning(
            "Permanent system administrator was created with an inaccessible "
            "generated credential. Set SYSTEM_ADMIN_PASSWORD and restart the "
            "backend before the first administrator login."
        )
        return False
    return True
