from fastapi import APIRouter, Query, status

from ..deps import CurrentCatalogManager, CurrentUser, DbSession

from ..schemas import (
    CatalogProductCreate,
    CatalogProductUpdate,
    CatalogProductOut,
)

from ..services import catalog_product_service

router = APIRouter(
    prefix="/catalog-products",
    tags=["catalog-products"],
)


# =========================================================
# LIST
# =========================================================
@router.get(
    "",
    response_model=list[CatalogProductOut],
)
def list_catalog_products(
    _: CurrentUser,
    db: DbSession,
    search: str | None = Query(default=None, max_length=200),
    industry_id: int | None = Query(default=None, gt=0),
):
    return catalog_product_service.list_catalog_products(
        db=db,
        search=search,
        industry_id=industry_id,
    )


# =========================================================
# ARCHIVED LIST (ADMIN)
# =========================================================
@router.get(
    "/archived",
    response_model=list[CatalogProductOut],
)
def list_archived_catalog_products(
    _: CurrentCatalogManager,
    db: DbSession,
    search: str | None = Query(default=None, max_length=200),
    industry_id: int | None = Query(default=None, gt=0),
):
    return catalog_product_service.list_archived_catalog_products(
        db=db,
        search=search,
        industry_id=industry_id,
    )


# =========================================================
# GET ONE
# =========================================================
@router.get(
    "/{catalog_id}",
    response_model=CatalogProductOut,
)
def get_catalog(
    catalog_id: int,
    _: CurrentUser,
    db: DbSession,
):
    return catalog_product_service.get_catalog_product_or_404(db, catalog_id)


# =========================================================
# CREATE
# =========================================================
@router.post(
    "",
    response_model=CatalogProductOut,
    status_code=status.HTTP_201_CREATED,
)
def create_catalog(
    payload: CatalogProductCreate,
    _: CurrentCatalogManager,
    db: DbSession,
):
    return catalog_product_service.create_catalog_product(
        db,
        payload,
    )


# =========================================================
# UPDATE
# =========================================================
@router.patch(
    "/{catalog_id}",
    response_model=CatalogProductOut,
)
def update_catalog(
    catalog_id: int,
    payload: CatalogProductUpdate,
    _: CurrentCatalogManager,
    db: DbSession,
):
    return catalog_product_service.update_catalog_product(
        db,
        catalog_id,
        payload,
    )


# =========================================================
# ARCHIVE / RESTORE
# =========================================================
@router.patch(
    "/{catalog_id}/archive",
    response_model=CatalogProductOut,
)
def archive_catalog(
    catalog_id: int,
    admin: CurrentCatalogManager,
    db: DbSession,
):
    return catalog_product_service.archive_catalog_product(db, catalog_id, admin)


@router.patch(
    "/{catalog_id}/restore",
    response_model=CatalogProductOut,
)
def restore_catalog(
    catalog_id: int,
    admin: CurrentCatalogManager,
    db: DbSession,
):
    return catalog_product_service.restore_catalog_product(db, catalog_id, admin)


# =========================================================
# PERMANENT DELETE
# =========================================================
@router.delete(
    "/{catalog_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_catalog(
    catalog_id: int,
    admin: CurrentCatalogManager,
    db: DbSession,
):
    catalog_product_service.permanently_delete_catalog_product(
        db,
        catalog_id,
        admin,
    )

    return
