from fastapi import APIRouter, HTTPException, status

from ..deps import CurrentCatalogManager, CurrentUser, DbSession

from ..schemas import (
    CatalogProductCreate,
    CatalogProductUpdate,
    CatalogProductOut,
)

from ..repositories.catalog_products import (
    get_catalog_products,
    get_catalog_product,
    create_catalog_product,
    update_catalog_product,
    delete_catalog_product,
)

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
    search: str | None = None,
    industry_id: int | None = None,
):
    return get_catalog_products(
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
    product = get_catalog_product(
        db,
        catalog_id,
    )

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catalog product not found",
        )

    return product


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
    return create_catalog_product(
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
    product = get_catalog_product(
        db,
        catalog_id,
    )

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catalog product not found",
        )

    return update_catalog_product(
        db,
        product,
        payload,
    )


# =========================================================
# DELETE
# =========================================================
@router.delete(
    "/{catalog_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_catalog(
    catalog_id: int,
    _: CurrentCatalogManager,
    db: DbSession,
):
    product = get_catalog_product(
        db,
        catalog_id,
    )

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Catalog product not found",
        )

    delete_catalog_product(
        db,
        product,
    )

    return
