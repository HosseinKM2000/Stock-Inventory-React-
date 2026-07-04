from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ..deps import CurrentUser, DbSession, check_device
from ..models import User
from ..schemas import (
    LoginRequest,
    PasswordUpdate,
    SignupRequest,
    TokenResponse,
    IndustrySelect,
    UserOut,
    UserUpdate,
)
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


# =========================================================
# CHECK USERNAME
# =========================================================
def _username_taken(db: DbSession, username: str, exclude_id: int | None = None) -> bool:
    stmt = select(User).where(User.username == username)

    if exclude_id:
        stmt = stmt.where(User.id != exclude_id)

    return db.scalar(stmt) is not None


# =========================================================
# SIGNUP
# =========================================================
@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: DbSession) -> TokenResponse:

    if _username_taken(db, payload.username):
        raise HTTPException(
            status_code=409,
            detail="Username already exists",
        )

    # create user
    user = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        username=payload.username,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
        plan="free",
        device_id=payload.device_id,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # device lock check (important)
    check_device(user, payload.device_id)

    token = create_access_token(user.id)

    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user)
    )


# =========================================================
# LOGIN
# =========================================================
@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession) -> TokenResponse:

    user = db.scalar(
        select(User).where(User.username == payload.username)
    )

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
        )

    token = create_access_token(user.id)

    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user)
    )


# =========================================================
# ME
# =========================================================
@router.get("/me", response_model=UserOut)
def me(current_user: CurrentUser):
    return current_user


# =========================================================
# UPDATE USER
# =========================================================
@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    current_user: CurrentUser,
    db: DbSession
):

    data = payload.model_dump(exclude_unset=True)

    new_username = data.get("username")

    if new_username and _username_taken(db, new_username, current_user.id):
        raise HTTPException(
            status_code=409,
            detail="Username already exists",
        )

    for k, v in data.items():
        setattr(current_user, k, v)

    db.commit()
    db.refresh(current_user)

    return current_user


# =========================================================
# PASSWORD UPDATE
# =========================================================
@router.patch("/me/password", status_code=204)
def update_password(
    payload: PasswordUpdate,
    current_user: CurrentUser,
    db: DbSession
):

    current_user.hashed_password = hash_password(payload.password)
    db.commit()


@router.patch("/industry", response_model=UserOut)
def set_industry(
    payload: IndustrySelect,
    current_user: CurrentUser,
    db: DbSession
):

    current_user.industry = payload.industry
    db.commit()
    db.refresh(current_user)

    return current_user