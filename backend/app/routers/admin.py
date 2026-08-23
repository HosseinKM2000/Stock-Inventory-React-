from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from ..deps import CurrentAdmin, DbSession
from ..models import User
from ..schemas import AdminUserStateUpdate, PlanUpdate, UserOut

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


@router.get("", response_model=list[UserOut])
def list_users(_: CurrentAdmin, db: DbSession) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at.desc())))


@router.patch("/{user_id}/state", response_model=UserOut)
def update_user_state(
    user_id: int, payload: AdminUserStateUpdate, admin: CurrentAdmin, db: DbSession
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND")
    if user.id == admin.id and not payload.is_active:
        raise HTTPException(status_code=400, detail="CANNOT_DISABLE_SELF")
    user.is_active = payload.is_active
    if not user.is_active:
        for session in user.sessions:
            session.is_active = False
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/plan", response_model=UserOut)
def update_user_plan(
    user_id: int, payload: PlanUpdate, _: CurrentAdmin, db: DbSession
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND")
    user.plan = payload.plan
    user.subscription_expires_at = payload.subscription_expires_at
    db.commit()
    db.refresh(user)
    return user
