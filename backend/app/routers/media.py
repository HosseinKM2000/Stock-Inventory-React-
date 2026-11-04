import hashlib
import re
import struct
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select

from ..deps import CurrentProductReader, DbSession, require_capability
from ..media_storage import media_storage
from ..models import InventoryItem, MediaAsset
from ..services.authorization_service import is_admin
from ..services.store_authorization import StorePermission, effective_permissions
from ..services.store_service import active_store_context


router = APIRouter(prefix="/media", tags=["durable product media"])
MAX_MEDIA_BYTES = 3 * 1024 * 1024
MAX_PIXELS = 16_000_000
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


def _webp_dimensions(content: bytes) -> tuple[int, int]:
    if len(content) < 30 or content[:4] != b"RIFF" or content[8:12] != b"WEBP":
        raise ValueError("MEDIA_CONTENT_INVALID")
    chunk = content[12:16]
    if chunk == b"VP8X":
        width = 1 + int.from_bytes(content[24:27], "little")
        height = 1 + int.from_bytes(content[27:30], "little")
    elif chunk == b"VP8L" and len(content) >= 25 and content[20] == 0x2F:
        bits = int.from_bytes(content[21:25], "little")
        width = (bits & 0x3FFF) + 1
        height = ((bits >> 14) & 0x3FFF) + 1
    elif chunk == b"VP8 " and len(content) >= 30 and content[23:26] == b"\x9d\x01\x2a":
        width, height = struct.unpack_from("<HH", content, 26)
        width &= 0x3FFF
        height &= 0x3FFF
    else:
        raise ValueError("MEDIA_CONTENT_INVALID")
    if width < 1 or height < 1 or width * height > MAX_PIXELS:
        raise ValueError("MEDIA_DIMENSIONS_INVALID")
    return width, height


def _serialize(asset: MediaAsset) -> dict:
    return {
        "id": asset.id,
        "transfer_id": asset.transfer_id,
        "version": asset.version,
        "content_sha256": asset.content_sha256,
        "mime_type": asset.mime_type,
        "byte_size": asset.byte_size,
        "width": asset.width,
        "height": asset.height,
        "available_at": asset.available_at,
        "preview_url": f"/api/media/{asset.id}/preview",
        "detail_url": f"/api/media/{asset.id}/detail",
    }


def _serialize_transfer(db: DbSession, store_id: int, actor_id: int, transfer_id: str) -> None:
    if db.bind is None or db.bind.dialect.name != "postgresql":
        return
    digest = hashlib.sha256(f"media:{store_id}:{actor_id}:{transfer_id}".encode()).digest()
    key = int.from_bytes(digest[:8], byteorder="big", signed=True)
    db.execute(select(func.pg_advisory_xact_lock(key)))


@router.post("/transfers")
async def transfer_product_media(
    transfer_id: Annotated[str, Form()],
    content_sha256: Annotated[str, Form()],
    file: Annotated[UploadFile, File()],
    current_user: CurrentProductReader,
    db: DbSession,
):
    require_capability(db, current_user, "inventory.write")
    if not is_admin(current_user):
        permissions = effective_permissions(active_store_context(db, current_user))
        if not ({StorePermission.PRODUCTS_EDIT.value, StorePermission.PRODUCTS_CREATE.value} & permissions):
            raise HTTPException(status_code=403, detail="PERMISSION_REQUIRED:products.edit")
    try:
        normalized_transfer_id = str(uuid.UUID(transfer_id))
    except ValueError as error:
        raise HTTPException(status_code=422, detail="MEDIA_TRANSFER_ID_INVALID") from error
    digest = content_sha256.lower()
    if not SHA256_RE.fullmatch(digest):
        raise HTTPException(status_code=422, detail="MEDIA_HASH_INVALID")
    _serialize_transfer(db, current_user.store_id, current_user.id, normalized_transfer_id)
    existing = db.scalar(select(MediaAsset).where(
        MediaAsset.store_id == current_user.store_id,
        MediaAsset.actor_user_id == current_user.id,
        MediaAsset.transfer_id == normalized_transfer_id,
    ))
    if existing is not None:
        if existing.content_sha256 != digest:
            raise HTTPException(status_code=409, detail="MEDIA_TRANSFER_PAYLOAD_MISMATCH")
        return _serialize(existing)

    content = await file.read(MAX_MEDIA_BYTES + 1)
    if len(content) > MAX_MEDIA_BYTES:
        raise HTTPException(status_code=413, detail="MEDIA_TOO_LARGE")
    if file.content_type != "image/webp":
        raise HTTPException(status_code=415, detail="MEDIA_TYPE_UNSUPPORTED")
    actual_digest = hashlib.sha256(content).hexdigest()
    if actual_digest != digest:
        raise HTTPException(status_code=422, detail="MEDIA_HASH_MISMATCH")
    try:
        width, height = _webp_dimensions(content)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    storage_key = f"stores/{current_user.store_id}/{actual_digest[:2]}/{actual_digest}.webp"
    # Durable write completes before availability is committed. A crash can
    # leave an unreferenced content-addressed file, never a false success.
    media_storage.put_if_absent(storage_key, content)
    asset = MediaAsset(
        id=str(uuid.uuid4()), store_id=current_user.store_id,
        actor_user_id=current_user.id, transfer_id=normalized_transfer_id,
        content_sha256=actual_digest, storage_key=storage_key,
        mime_type="image/webp", byte_size=len(content), width=width, height=height,
        version=1, available_at=datetime.now(timezone.utc),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return _serialize(asset)


def _authorized_asset(asset_id: str, current_user, db: DbSession) -> MediaAsset:
    asset = db.scalar(select(MediaAsset).where(
        MediaAsset.id == asset_id, MediaAsset.store_id == current_user.store_id,
    ))
    if asset is None:
        raise HTTPException(status_code=404, detail="MEDIA_NOT_FOUND")
    association = db.scalar(select(InventoryItem.id).where(
        InventoryItem.store_id == current_user.store_id,
        InventoryItem.media_asset_id == asset.id,
    ).limit(1))
    if association is None:
        raise HTTPException(status_code=404, detail="MEDIA_NOT_FOUND")
    return asset


@router.get("/{asset_id}/{variant}")
def read_product_media(
    asset_id: str,
    variant: str,
    current_user: CurrentProductReader,
    db: DbSession,
):
    if variant not in {"preview", "detail"}:
        raise HTTPException(status_code=404, detail="MEDIA_VARIANT_NOT_FOUND")
    asset = _authorized_asset(asset_id, current_user, db)
    try:
        path = media_storage.path_for(asset.storage_key)
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail="MEDIA_BYTES_UNAVAILABLE") from error
    return FileResponse(
        path, media_type=asset.mime_type,
        headers={
            "ETag": f'"{asset.content_sha256}"',
            "X-Content-SHA256": asset.content_sha256,
            "X-Media-Version": str(asset.version),
            "Cache-Control": "private, max-age=31536000, immutable",
        },
    )
