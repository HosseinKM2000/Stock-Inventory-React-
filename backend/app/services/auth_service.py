import hashlib
import hmac
import json
from datetime import datetime, timezone
from urllib.parse import parse_qsl

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import User
from ..schemas import BaleAuthRequest, LoginRequest, TokenResponse, UserOut, SignupRequest, UserUpdate
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
            db=db,
            user_id=user.id,
        )

        if not can_add_device(
            user=user,
            active_sessions_count=len(active_sessions),
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Device limit reached.",
            )

        session = create_session(
            db=db,
            user_id=user.id,
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


def _validate_bale_init_data(init_data: str) -> dict:
    if not settings.BALE_BOT_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Bale bot token is not configured.",
        )

    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)

    if not received_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bale auth hash.",
        )

    data_check_string = "\n".join(
        f"{key}={value}"
        for key, value in sorted(pairs.items())
    )
    secret_keys = [
        hmac.new(
            b"WebAppData",
            settings.BALE_BOT_TOKEN.encode("utf-8"),
            hashlib.sha256,
        ).digest(),
        hmac.new(
            settings.BALE_BOT_TOKEN.encode("utf-8"),
            b"WebAppData",
            hashlib.sha256,
        ).digest(),
    ]
    calculated_hashes = [
        hmac.new(
            secret_key,
            data_check_string.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        for secret_key in secret_keys
    ]

    if not any(
        hmac.compare_digest(calculated_hash, received_hash)
        for calculated_hash in calculated_hashes
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Bale auth data.",
        )

    auth_date = int(pairs.get("auth_date", "0") or "0")
    now = int(datetime.now(timezone.utc).timestamp())

    if now - auth_date > 86400:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Expired Bale auth data.",
        )

    return pairs


def login_with_bale(
    db: Session,
    payload: BaleAuthRequest,
) -> TokenResponse:
    init_data = _validate_bale_init_data(payload.init_data)
    raw_user = init_data.get("user")

    if not raw_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bale user data is missing.",
        )

    bale_user = json.loads(raw_user)
    bale_id = bale_user.get("id")

    if not bale_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bale user id is missing.",
        )

    username = f"bale_{bale_id}"
    user = db.scalar(select(User).where(User.username == username))

    if user is None:
        user = User(
            first_name=bale_user.get("first_name") or "Bale",
            last_name=bale_user.get("last_name") or "-",
            username=username,
            hashed_password=hash_password(f"bale:{bale_id}:{settings.SECRET_KEY}"),
            plan="free",
        )
        db.add(user)
        db.flush()

    token = create_access_token(user.id)
    session = get_session_by_fingerprint(
        db=db,
        user_id=user.id,
        fingerprint=payload.device_fingerprint,
    )

    if session:
        update_last_seen(session)
        session.access_token = token
    else:
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
