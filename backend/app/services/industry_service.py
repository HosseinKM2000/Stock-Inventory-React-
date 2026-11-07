from fastapi import HTTPException
import json
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import CatalogProduct, Industry, User
from ..schemas import IndustryCreate, IndustryUpdate
from .tool_policy import industry_tool_policy, normalize_tool_policy


def _ensure_name_available(
    db: Session,
    name: str,
    exclude_id: int | None = None,
) -> None:
    statement = select(Industry.id).where(func.lower(Industry.name) == name.lower())
    if exclude_id is not None:
        statement = statement.where(Industry.id != exclude_id)
    if db.scalar(statement.limit(1)) is not None:
        raise HTTPException(status_code=409, detail="INDUSTRY_EXISTS")


def get_industries(db: Session):
    # Industries predate created_at tracking; the monotonic primary key is the
    # reliable creation-order source for both legacy and new records.
    return list(db.scalars(select(Industry).order_by(Industry.id.desc())))


def industry_payload(industry: Industry) -> dict:
    return {
        "id": industry.id,
        "name": industry.name,
        "description": industry.description,
        "is_active": industry.is_active,
        "tools": industry_tool_policy(industry),
    }


def create_industry(
    db: Session,
    payload: IndustryCreate,
):
    _ensure_name_available(db, payload.name)
    industry = Industry(
        name=payload.name,
        is_active=payload.is_active,
        description=payload.description,
        tools_json=json.dumps(normalize_tool_policy(payload.tools)),
    )

    db.add(industry)
    db.commit()
    db.refresh(industry)

    return industry_payload(industry)


def update_industry(
    db: Session,
    industry: Industry,
    payload: IndustryUpdate,
):
    data = payload.model_dump(exclude_unset=True)
    tools = data.pop("tools", None)

    if payload.name is not None:
        _ensure_name_available(db, payload.name, exclude_id=industry.id)

    for key, value in data.items():
        setattr(industry, key, value)
    if tools is not None:
        try:
            industry.tools_json = json.dumps(normalize_tool_policy(tools))
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    db.commit()
    db.refresh(industry)

    return industry_payload(industry)


def delete_industry(
    db: Session,
    industry: Industry,
):
    dependent_products = db.scalar(
        select(func.count(CatalogProduct.id)).where(
            CatalogProduct.industry_id == industry.id
        )
    )
    if dependent_products:
        raise HTTPException(status_code=409, detail="INDUSTRY_HAS_CATALOG_PRODUCTS")

    dependent_users = db.scalar(
        select(func.count(User.id)).where(User.industry_id == industry.id)
    )
    if dependent_users:
        raise HTTPException(status_code=409, detail="INDUSTRY_HAS_USERS")

    db.delete(industry)
    db.commit()
