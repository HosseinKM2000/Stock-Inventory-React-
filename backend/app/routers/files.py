from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import or_, select

from ..config import settings
from ..deps import CurrentProductReader, DbSession
from ..models import CatalogProduct, InventoryItem

router = APIRouter(prefix="/files", tags=["protected files"])


@router.get("/{filename}")
def protected_product_image(filename: str, current_user: CurrentProductReader, db: DbSession):
    safe_name = Path(filename).name
    if safe_name != filename:
        raise HTTPException(status_code=404, detail="FILE_NOT_FOUND")
    image_url = f"/uploads/{safe_name}"
    allowed = db.scalar(
        select(InventoryItem.id)
        .join(CatalogProduct, CatalogProduct.id == InventoryItem.catalog_product_id)
        .where(
            InventoryItem.user_id == current_user.data_owner_id,
            or_(InventoryItem.image_url == image_url, CatalogProduct.image_url == image_url),
        )
        .limit(1)
    )
    path = settings.UPLOAD_DIR / safe_name
    if allowed is None or not path.is_file():
        raise HTTPException(status_code=404, detail="FILE_NOT_FOUND")
    return FileResponse(path)
