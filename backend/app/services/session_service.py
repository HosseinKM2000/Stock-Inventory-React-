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
    )

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