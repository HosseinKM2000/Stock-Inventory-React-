from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..security import hash_password

from ..models import User
from ..schemas import (
    SignupRequest,
    LoginRequest,
    UserUpdate,
)
from ..security import (
    hash_password,
    verify_password,
    create_access_token,
)

from .session_service import (
    get_active_sessions,
    get_session,
    can_login_new_device,
    create_session,
    update_last_seen,
)


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

    return token, user


def login(
    db: Session,
    payload: LoginRequest,
):

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
            status_code=401,
            detail="Invalid credentials",
        )

    session = get_session(
        db,
        user.id,
        payload.device_fingerprint,
    )

    if session:

        update_last_seen(session)

        token = create_access_token(user.id)

        session.access_token = token

    else:

        active = get_active_sessions(
            db,
            user.id,
        )

        can_login_new_device(
            user,
            active,
        )

        token = create_access_token(user.id)

        create_session(
            db,
            user,
            payload.device_fingerprint,
            token,
        )

    db.commit()

    return token, user


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