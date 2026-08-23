from fastapi import APIRouter, HTTPException

from ..deps import CurrentAdmin, CurrentUser, DbSession
from ..models import Industry
from ..schemas import (
    IndustryCreate,
    IndustryOut,
    IndustryUpdate,
)
from ..services.industry_service import (
    create_industry,
    delete_industry,
    get_industries,
    update_industry,
)

router = APIRouter(
    prefix="/industries",
    tags=["industries"],
)


@router.get(
    "",
    response_model=list[IndustryOut],
)
def list_industries(
    _: CurrentUser,
    db: DbSession,
):
    return get_industries(db)


@router.post(
    "",
    response_model=IndustryOut,
)
def create(
    payload: IndustryCreate,
    _: CurrentAdmin,
    db: DbSession,
):
    return create_industry(db, payload)


@router.patch(
    "/{industry_id}",
    response_model=IndustryOut,
)
def update(
    industry_id: int,
    payload: IndustryUpdate,
    _: CurrentAdmin,
    db: DbSession,
):
    industry = db.get(Industry, industry_id)

    if not industry:
        raise HTTPException(404)

    return update_industry(
        db,
        industry,
        payload,
    )


@router.delete("/{industry_id}")
def remove(
    industry_id: int,
    _: CurrentAdmin,
    db: DbSession,
):
    industry = db.get(Industry, industry_id)

    if not industry:
        raise HTTPException(404)

    delete_industry(
        db,
        industry,
    )

    return {"message": "deleted"}
