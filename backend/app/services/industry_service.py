from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import CatalogProduct, Industry
from ..schemas import IndustryCreate, IndustryUpdate


def get_industries(db: Session):
    return list(db.scalars(select(Industry).order_by(Industry.name)))


def create_industry(
    db: Session,
    payload: IndustryCreate,
):
    industry = Industry(
        name=payload.name,
        is_active=payload.is_active,
        description=payload.description,
    )

    db.add(industry)
    db.commit()
    db.refresh(industry)

    return industry


def update_industry(
    db: Session,
    industry: Industry,
    payload: IndustryUpdate,
):
    data = payload.model_dump(exclude_unset=True)

    for key, value in data.items():
        setattr(industry, key, value)

    db.commit()
    db.refresh(industry)

    return industry


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

    db.delete(industry)
    db.commit()
