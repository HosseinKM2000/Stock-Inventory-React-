from fastapi import APIRouter, HTTPException

from ..deps import CurrentIndustryManager, CurrentUser, DbSession
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
    industry_payload,
    update_industry,
)
from ..services.audit_service import record_admin_action

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
    return [industry_payload(industry) for industry in get_industries(db)]


@router.post(
    "",
    response_model=IndustryOut,
)
def create(
    payload: IndustryCreate,
    actor: CurrentIndustryManager,
    db: DbSession,
):
    result = create_industry(db, payload)
    record_admin_action(db, actor, "industry.created", metadata={"industry_id": result["id"], "tools": result["tools"]})
    db.commit()
    return result


@router.patch(
    "/{industry_id}",
    response_model=IndustryOut,
)
def update(
    industry_id: int,
    payload: IndustryUpdate,
    actor: CurrentIndustryManager,
    db: DbSession,
):
    industry = db.get(Industry, industry_id)

    if not industry:
        raise HTTPException(404)

    result = update_industry(
        db,
        industry,
        payload,
    )
    record_admin_action(db, actor, "industry.updated", metadata={"industry_id": industry_id, "tools": result["tools"]})
    db.commit()
    return result


@router.delete("/{industry_id}")
def remove(
    industry_id: int,
    _: CurrentIndustryManager,
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
