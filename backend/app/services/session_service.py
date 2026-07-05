from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import User, UserSession


PLAN_LIMITS = {
    "free": 1,
    "starter": 2,
    "pro": 3,
    "vip": 999,
}


def get_active_sessions(
    db: Session,
    user_id: int,
) -> list[UserSession]:
    stmt = select(UserSession).where(
        UserSession.user_id == user_id,
        UserSession.is_active.is_(True),
    )

    return list(db.scalars(stmt))


def get_session(
    db: Session,
    user_id: int,
    fingerprint: str,
) -> UserSession | None:

    stmt = select(UserSession).where(
        UserSession.user_id == user_id,
        UserSession.device_fingerprint == fingerprint,
        UserSession.is_active.is_(True),
    )

    return db.scalar(stmt)


def can_login_new_device(
    user: User,
    active_sessions: list[UserSession],
):
    limit = PLAN_LIMITS.get(user.plan, 1)

    if len(active_sessions) >= limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Device limit reached.",
        )


def create_session(
    db: Session,
    user: User,
    fingerprint: str,
    token: str,
):

    session = UserSession(
        user_id=user.id,
        device_fingerprint=fingerprint,
        access_token=token,
    )

    db.add(session)

    return session


def update_last_seen(
    session: UserSession,
):
    session.last_seen = datetime.now(timezone.utc)


def logout_session(
    session: UserSession,
):
    session.is_active = False


def validate_session(
    db: Session,
    user_id: int,
    fingerprint: str,
) -> UserSession:

    session = get_session(
        db,
        user_id,
        fingerprint,
    )

    if session is None:
        raise HTTPException(
            status_code=403,
            detail="Session not found.",
        )

    update_last_seen(session)

    return session