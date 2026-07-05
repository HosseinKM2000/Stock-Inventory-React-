from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, UserSession
from .security import decode_access_token


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not authorization or not authorization.lower().startswith("bearer "):
        raise credentials_error

    token = authorization.split(" ", 1)[1].strip()

    subject = decode_access_token(token)

    if subject is None:
        raise credentials_error

    user = db.get(User, int(subject))

    if user is None:
        raise credentials_error

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
    
def validate_session(db, user_id: int, fingerprint: str):
    session = db.scalar(
        select(UserSession).where(
            UserSession.user_id == user_id,
            UserSession.device_fingerprint == fingerprint,
            UserSession.is_active == True
        )
    )

    if not session:
        raise HTTPException(status_code=403, detail="Session invalid")


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_db)]