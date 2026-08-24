from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from fastapi import Header

from ..deps import CurrentUser, DbSession, DeviceFingerprint
from ..models import User, Industry, CatalogProduct, InventoryItem
from ..schemas import (
    IndustrySelect,
    LoginRequest,
    MessageResponse,
    PasswordUpdate,
    SignupRequest,
    TokenResponse,
    UserOut,
    UserUpdate,
)

from ..services.auth_service import (
    signup as signup_service,
    login as login_service,
    logout,
    update_user,
    update_password as update_password_service,
)

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


# =========================================================
# CHECK USERNAME
# =========================================================

def _username_taken(
    db: DbSession,
    username: str,
    exclude_id: int | None = None,
) -> bool:

    stmt = select(User).where(User.username == username)

    if exclude_id:
        stmt = stmt.where(User.id != exclude_id)

    return db.scalar(stmt) is not None


# =========================================================
# SIGNUP
# =========================================================

@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def signup(
    payload: SignupRequest,
    db: DbSession,
):

    if _username_taken(db, payload.username):
        raise HTTPException(
            status_code=409,
            detail="Username already exists",
        )

    return signup_service(
        db=db,
        payload=payload,
    )


# =========================================================
# LOGIN
# =========================================================

@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    payload: LoginRequest,
    db: DbSession,
):

    return login_service(
        db=db,
        payload=payload,
    )


# =========================================================
# CURRENT USER
# =========================================================

@router.get(
    "/me",
    response_model=UserOut,
)
def me(
    current_user: CurrentUser,
):
    return current_user


# =========================================================
# UPDATE PROFILE
# =========================================================

@router.patch(
    "/me",
    response_model=UserOut,
)
def update_me(
    payload: UserUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    if (
        payload.username
        and _username_taken(
            db,
            payload.username,
            current_user.id,
        )
    ):
        raise HTTPException(
            status_code=409,
            detail="Username already exists",
        )

    return update_user(
        db=db,
        user=current_user,
        payload=payload,
    )

# =========================================================
# CHANGE PASSWORD
# =========================================================

@router.patch(
    "/me/password",
    response_model=MessageResponse,
)
def update_password(
    payload: PasswordUpdate,
    current_user: CurrentUser,
    db: DbSession,
    device_fingerprint: DeviceFingerprint,
):

    update_password_service(
        db=db,
        user=current_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
        current_fingerprint=device_fingerprint,
    )

    return MessageResponse(
        message="Password updated successfully.",
    )


# =========================================================
# SET INDUSTRY
# =========================================================

@router.patch(
    "/industry",
    response_model=UserOut,
)
def set_industry(
    payload: IndustrySelect,
    current_user: CurrentUser,
    db: DbSession,
):
    industry = db.get(
        Industry,
        payload.industry_id,
    )

    if industry is None:
        raise HTTPException(
            status_code=404,
            detail="Industry not found",
        )

    # -----------------------------
    # Update user's industry
    # -----------------------------
    current_user.industry_id = industry.id

    # -----------------------------
    # Remove previous inventory
    # -----------------------------
    db.query(InventoryItem).filter(
        InventoryItem.user_id == current_user.id
    ).delete()

    # -----------------------------
    # Load catalog of selected industry
    # -----------------------------
    catalog_products = list(
        db.scalars(
            select(CatalogProduct).where(
                CatalogProduct.industry_id  == industry.id
            )
        )
    )

    # -----------------------------
    # Create user's inventory
    # -----------------------------
    inventory_items = [
        InventoryItem(
            user_id=current_user.id,
            catalog_product_id=product.id,
        )
        for product in catalog_products
    ]

    db.bulk_save_objects(inventory_items)

    db.commit()
    db.refresh(current_user)

    return current_user

@router.post("/logout")
def logout_endpoint(
    current_user: CurrentUser,
    db: DbSession,
    device_fingerprint: str = Header(
        alias="X-Device-Fingerprint"
    ),
):
    logout(
        db=db,
        current_user=current_user,
        fingerprint=device_fingerprint,
    )

    return {
        "message": "Logged out successfully"
    }
