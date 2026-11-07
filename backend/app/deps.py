from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import decode_access_token
from .services.authorization_service import Permission, is_admin, require_permission
from .services.subscription_service import entitlement_for_user
from .services.session_service import validate_session
from .services.store_service import attach_store_context
from .services.store_authorization import StorePermission, require_store_permission
from .services.tool_policy import require_tool

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
    context = attach_store_context(db, user)
    if context is not None and context.membership.status == "active":
        from datetime import datetime, timezone
        context.membership.authorization_checked_at = datetime.now(timezone.utc)
        user.membership_authorization_checked_at = context.membership.authorization_checked_at
    # Persist last_seen even for otherwise read-only requests.
    db.commit()
    return user


def require_capability(db: Session, user: User, capability: str) -> None:
    if is_admin(user):
        return
    if not entitlement_for_user(db, user)["capabilities"].get(capability, False):
        raise HTTPException(status_code=403, detail=f"CAPABILITY_REQUIRED:{capability}")


def get_current_writable_user(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    require_capability(db, user, "inventory.write")
    require_store_permission(db, user, StorePermission.PRODUCTS_EDIT)
    return user


def get_current_product_reader(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    require_store_permission(db, user, StorePermission.PRODUCTS_VIEW)
    require_capability(db, user, "inventory.read")
    return user


def get_current_dashboard_user(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    require_store_permission(db, user, StorePermission.DASHBOARD_VIEW)
    require_capability(db, user, "inventory.read")
    return user


def get_current_product_creator(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> User:
    require_capability(db, user, "inventory.write")
    require_store_permission(db, user, StorePermission.PRODUCTS_CREATE)
    return user


def get_current_quantity_writer(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> User:
    require_capability(db, user, "inventory.write")
    require_store_permission(db, user, StorePermission.QUANTITY_CHANGE)
    return user


def get_current_product_deleter(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> User:
    require_capability(db, user, "inventory.write")
    require_store_permission(db, user, StorePermission.PRODUCTS_DELETE)
    return user


def get_current_category_writer(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    require_capability(db, user, "categories.write")
    require_store_permission(db, user, StorePermission.CATEGORIES_MANAGE)
    require_tool(db, user, "categories")
    return user


def get_current_category_user(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    require_tool(db, user, "categories")
    require_store_permission(db, user, StorePermission.PRODUCTS_VIEW)
    return user


def get_current_label_user(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    require_tool(db, user, "labels")
    require_store_permission(db, user, StorePermission.LABELS_MANAGE)
    return user


def get_current_catalog_user(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    require_tool(db, user, "catalog")
    # Platform administrators manage/read the global catalog, not a customer
    # workspace. Store permission applies only to store members.
    if not is_admin(user):
        require_store_permission(db, user, StorePermission.CATALOG_USE)
    return user


def get_current_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    require_permission(user, Permission.USERS_READ)
    return user


def get_current_user_manager(user: Annotated[User, Depends(get_current_user)]) -> User:
    require_permission(user, Permission.USERS_MANAGE)
    return user


def get_current_plan_manager(user: Annotated[User, Depends(get_current_user)]) -> User:
    require_permission(user, Permission.PLANS_MANAGE)
    return user


def get_current_catalog_manager(user: Annotated[User, Depends(get_current_user)]) -> User:
    require_permission(user, Permission.CATALOG_MANAGE)
    return user


def get_current_industry_manager(user: Annotated[User, Depends(get_current_user)]) -> User:
    require_permission(user, Permission.INDUSTRY_MANAGE)
    return user


def require_backup_access(db: Session, user: User) -> None:
    require_capability(db, user, "backup")
    require_store_permission(db, user, StorePermission.BACKUP_USE)


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentWritableUser = Annotated[User, Depends(get_current_writable_user)]
CurrentProductReader = Annotated[User, Depends(get_current_product_reader)]
CurrentDashboardUser = Annotated[User, Depends(get_current_dashboard_user)]
CurrentProductCreator = Annotated[User, Depends(get_current_product_creator)]
CurrentQuantityWriter = Annotated[User, Depends(get_current_quantity_writer)]
CurrentProductDeleter = Annotated[User, Depends(get_current_product_deleter)]
CurrentCategoryWriter = Annotated[User, Depends(get_current_category_writer)]
CurrentCategoryUser = Annotated[User, Depends(get_current_category_user)]
CurrentLabelUser = Annotated[User, Depends(get_current_label_user)]
CurrentCatalogUser = Annotated[User, Depends(get_current_catalog_user)]
CurrentAdmin = Annotated[User, Depends(get_current_admin)]
CurrentUserManager = Annotated[User, Depends(get_current_user_manager)]
CurrentPlanManager = Annotated[User, Depends(get_current_plan_manager)]
CurrentCatalogManager = Annotated[User, Depends(get_current_catalog_manager)]
CurrentIndustryManager = Annotated[User, Depends(get_current_industry_manager)]
DbSession = Annotated[Session, Depends(get_db)]
