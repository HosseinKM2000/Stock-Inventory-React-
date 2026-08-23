from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import User
from ..schemas import LoginRequest, TokenResponse, UserOut, SignupRequest, UserUpdate
from ..security import create_access_token, verify_password
from .plan_policy import can_add_device

from ..security import (
    hash_password,
    verify_password,
    create_access_token,
)

from .session_service import (
    get_active_sessions,
    get_session_by_fingerprint,
    create_session,
    update_last_seen,
)
from ..config import settings


def username_taken(
    db: Session,
    username: str,
    exclude_id: int | None = None,
):
    stmt = select(User).where(User.username == username)

    if exclude_id:
        stmt = stmt.where(User.id != exclude_id)

    return db.scalar(stmt) is not None


def signup(
    db: Session,
    payload: SignupRequest,
):

    if username_taken(db, payload.username):
        raise HTTPException(
            status_code=409,
            detail="Username already exists",
        )

    user = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        username=payload.username,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
        plan="free",
        is_admin=payload.username in settings.ADMIN_USERNAMES,
    )

    db.add(user)
    db.flush()

    token = create_access_token(user.id)

    create_session(
        db,
        user,
        payload.device_fingerprint,
        token,
    )

    db.commit()
    db.refresh(user)

    return TokenResponse(
    access_token=token,
    token_type="bearer",
    user=UserOut.model_validate(user),
)


def login(
    db: Session,
    payload: LoginRequest,
) -> TokenResponse:

    # ----------------------------------------------------
    # Authenticate User
    # ----------------------------------------------------
    user = db.scalar(
        select(User).where(
            User.username == payload.username
        )
    )

    if (
        user is None
        or
        not verify_password(
            payload.password,
            user.hashed_password,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not user.is_active:
        raise HTTPException(status_code=423, detail="ACCOUNT_DISABLED")

    if user.username in settings.ADMIN_USERNAMES:
        user.is_admin = True

    # ----------------------------------------------------
    # Device Session
    # ----------------------------------------------------
    session = get_session_by_fingerprint(
        db=db,
        user_id=user.id,
        fingerprint=payload.device_fingerprint,
    )

    # ----------------------------------------------------
    # Create JWT
    # ----------------------------------------------------
    token = create_access_token(user.id)

    if session:

        update_last_seen(session)

        session.access_token = token

    else:

        active_sessions = get_active_sessions(
            db,
            user.id,
        )

        if not can_add_device(
            user,
            len(active_sessions),
        ):
            raise HTTPException(
                status_code=403,
                detail="Device limit reached for your plan.",
            )

        create_session(
            db=db,
            user=user,
            fingerprint=payload.device_fingerprint,
            token=token,
        )

    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )

def update_user(
    db: Session,
    user: User,
    payload: UserUpdate,
):

    data = payload.model_dump(
        exclude_unset=True,
    )

    username = data.get("username")

    if username:

        if username_taken(
            db,
            username,
            user.id,
        ):
            raise HTTPException(
                
                status_code=409,
                detail="Username already exists",
            )

    for k, v in data.items():
        setattr(user, k, v)

    db.commit()
    db.refresh(user)

    return user


def update_password(
    db: Session,
    user: User,
    new_password: str,
):
    user.hashed_password = hash_password(new_password)

    db.commit()
    db.refresh(user)

from ..services.session_service import (
    get_session_by_fingerprint,
    deactivate_session,
)


def logout(
    db: Session,
    current_user: User,
    fingerprint: str,
):
    session = get_session_by_fingerprint(
        db=db,
        user_id=current_user.id,
        fingerprint=fingerprint,
    )

    if session:
        deactivate_session(session)

    db.commit()
