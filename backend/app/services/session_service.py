from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import User, UserSession

def get_active_sessions(
    db: Session,
    user_id: int,
) -> list[UserSession]:
    stmt = select(UserSession).where(
        UserSession.user_id == user_id,
        UserSession.is_active.is_(True),
    ).order_by(UserSession.created_at.desc(), UserSession.id.desc())

    return list(db.scalars(stmt))


def get_session_by_fingerprint(
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


def deactivate_session(
    session: UserSession,
):
    session.is_active = False

def deactivate_all_sessions(
    db: Session,
    user_id: int,
):
    sessions = get_active_sessions(db, user_id)

    for session in sessions:
        session.is_active = False


def session_exists(
    db: Session,
    user_id: int,
    fingerprint: str,
) -> bool:
    return (
        get_session_by_fingerprint(
            db,
            user_id,
            fingerprint,
        )
        is not None
    )

def validate_session(
    db: Session,
    user_id: int,
    fingerprint: str,
    token: str,
) -> UserSession:

    session = get_session_by_fingerprint(
        db,
        user_id,
        fingerprint,
    )

    if session is None:
        raise HTTPException(
            status_code=403,
            detail="Invalid device session",
        )

    if (
        not session.is_active
        or session.access_token != token
    ):
        raise HTTPException(
            status_code=403,
            detail="Session expired",
        )
    if not session.is_active:
        raise HTTPException(
            status_code=403,
            detail="Session inactive",
        )

    update_last_seen(session)

    return session
