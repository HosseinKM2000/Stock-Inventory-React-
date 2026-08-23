from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .plans import entitlement_for
from .security import decode_access_token
from .services.session_service import validate_session

DeviceFingerprint = Annotated[str, Header(alias="X-Device-Fingerprint")]


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
    if authorization is None or not authorization.startswith("Bearer "):
        raise credentials_error

    token = authorization.split(" ", 1)[1]
    subject = decode_access_token(token)
    if subject is None:
        raise credentials_error

    user = db.get(User, int(subject))
    if user is None:
        raise credentials_error
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail="ACCOUNT_DISABLED")

    validate_session(db=db, user_id=user.id, fingerprint=device_fingerprint, token=token)
    return user


def require_capability(user: User, capability: str) -> None:
    if not entitlement_for(user)["capabilities"].get(capability, False):
        raise HTTPException(status_code=403, detail=f"CAPABILITY_REQUIRED:{capability}")


def get_current_writable_user(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    require_capability(user, "inventory.write")
    return user


def get_current_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="ADMIN_REQUIRED")
    return user


def require_backup_access(user: User) -> None:
    require_capability(user, "backup")


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentWritableUser = Annotated[User, Depends(get_current_writable_user)]
CurrentAdmin = Annotated[User, Depends(get_current_admin)]
DbSession = Annotated[Session, Depends(get_db)]
