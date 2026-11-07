from enum import Enum

from fastapi import HTTPException, status

from ..models import User


class RoleId(str, Enum):
    USER = "USER"
    ADMIN = "ADMIN"


class Permission(str, Enum):
    USERS_READ = "users.read"
    USERS_MANAGE = "users.manage"
    PLANS_MANAGE = "plans.manage"
    CATALOG_MANAGE = "catalog.manage"
    INDUSTRY_MANAGE = "industry.manage"


ROLE_PERMISSIONS: dict[RoleId, frozenset[Permission]] = {
    RoleId.USER: frozenset(),
    RoleId.ADMIN: frozenset(Permission),
}


def role_id(user: User) -> RoleId:
    if user.is_system_admin or user.role == RoleId.ADMIN.value or user.is_admin:
        return RoleId.ADMIN
    return RoleId.USER


def is_admin(user: User) -> bool:
    return role_id(user) is RoleId.ADMIN


def has_permission(user: User, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS[role_id(user)]


def require_permission(user: User, permission: Permission) -> None:
    if not has_permission(user, permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ADMIN_REQUIRED",
        )


def set_role(user: User, role: RoleId) -> None:
    if user.is_system_admin and role is not RoleId.ADMIN:
        raise HTTPException(status_code=409, detail="SYSTEM_ADMIN_IMMUTABLE")
    user.role = role.value
    # Maintained during the compatibility window for older clients/databases.
    user.is_admin = role is RoleId.ADMIN
