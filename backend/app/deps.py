from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import decode_access_token

from .services.session_service import validate_session

DeviceFingerprint = Annotated[
    str,
    Header(alias="X-Device-Fingerprint"),
]

def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    authorization: Annotated[str | None, Header()] = None,
    device_fingerprint: DeviceFingerprint = "",
) -> User:

    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if (
        authorization is None
        or
        not authorization.startswith("Bearer ")
    ):
        raise credentials_error

    token = authorization.split(" ", 1)[1]

    subject = decode_access_token(token)

    if subject is None:
        raise credentials_error

    user = db.get(User, int(subject))

    if user is None:
        raise credentials_error

    validate_session(
        db=db,
        user_id=user.id,
        fingerprint=device_fingerprint,
    )

    return user

def check_device(user: User, incoming_device_id: str | None):
    if user.plan == "free":
        if user.device_id is None:
            user.device_id = incoming_device_id
            return

        if user.device_id != incoming_device_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="این حساب فقط روی یک دستگاه فعال است"
            )


def require_backup_access(user: User):
    if user.plan == "free":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="بکاپ فقط برای پلن‌های پولی فعال است"
        )


def require_multi_device(user: User):
    if user.plan != "pro":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="چند دستگاه فقط در پلن pro فعال است"
        )
    
def require_paid_plan(user: User):
    if user.plan == "free":
        raise HTTPException(
            status_code=403,
            detail="این قابلیت نیاز به اشتراک دارد"
        )


def require_backup_access(user: User):
    if user.plan == "free":
        raise HTTPException(
            status_code=403,
            detail="بکاپ فقط برای کاربران اشتراکی فعال است"
        )

CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]
