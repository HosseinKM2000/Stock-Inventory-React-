import base64
import hashlib
import json
import uuid

from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Industry, MediaAsset
from app.services.bootstrap_service import ensure_system_admin
from app.services.subscription_service import seed_default_plans


WEBP = base64.b64decode(
    "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA=="
)


def teardown_module():
    engine.dispose()


def _account(client: TestClient, suffix: str):
    with SessionLocal() as db:
        industry = Industry(name=f"Media {suffix}", description="media test")
        db.add(industry)
        db.commit()
        db.refresh(industry)
        industry_id = industry.id
    fingerprint = f"media-device-{suffix}"
    response = client.post("/api/auth/signup", json={
        "username": f"media-{suffix}", "password": "StrongPass123!",
        "device_fingerprint": fingerprint,
    })
    assert response.status_code == 201, response.text
    headers = {
        "Authorization": f"Bearer {response.json()['access_token']}",
        "X-Device-Fingerprint": fingerprint,
        "X-Client-Data-Schema": "3",
    }
    selected = client.patch("/api/auth/industry", headers=headers, json={"industry_id": industry_id})
    assert selected.status_code == 200, selected.text
    return headers


def _transfer(client: TestClient, headers: dict[str, str], transfer_id: str, content=WEBP, digest=None):
    return client.post(
        "/api/media/transfers", headers=headers,
        data={"transfer_id": transfer_id, "content_sha256": digest or hashlib.sha256(content).hexdigest()},
        files={"file": ("image.webp", content, "image/webp")},
    )


def _push(client: TestClient, headers: dict[str, str], operation: dict):
    return client.post(
        "/api/sync/batch", headers=headers,
        data={"operations_json": json.dumps({"operations": [operation]})},
    )


def test_durable_media_transfer_association_recovery_and_stale_protection():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_default_plans(db)
        ensure_system_admin(db)
    with TestClient(app) as client:
        owner = _account(client, uuid.uuid4().hex[:8])
        outsider = _account(client, uuid.uuid4().hex[:8])
        transfer_id = str(uuid.uuid4())
        first = _transfer(client, owner, transfer_id)
        assert first.status_code == 200, first.text
        asset = first.json()
        assert asset["content_sha256"] == hashlib.sha256(WEBP).hexdigest()
        assert (asset["width"], asset["height"]) == (1, 1)

        replay = _transfer(client, owner, transfer_id)
        assert replay.status_code == 200
        assert replay.json()["id"] == asset["id"]
        mismatch = _transfer(client, owner, transfer_id, WEBP + b"changed")
        assert mismatch.status_code == 409
        assert mismatch.json()["detail"] == "MEDIA_TRANSFER_PAYLOAD_MISMATCH"

        # Staged bytes are private and do not publish an association.
        assert client.get(asset["detail_url"], headers=owner).status_code == 404
        product_id = 1_700_000_130_001
        create = {
            "operation_id": str(uuid.uuid4()), "entity": "product",
            "entity_id": product_id, "operation": "CREATE",
            "payload": {
                "quantity": 1, "sale_price": 100, "custom_label": "Durable media",
                "low_stock_threshold": 0, "low_stock_alert": False, "is_hidden": False,
                "media_asset_id": asset["id"],
                "catalog_product": {"id": 0, "name": "Durable media"},
            },
        }
        created = _push(client, owner, create)
        assert created.status_code == 200, created.text
        record = created.json()["results"][0]["record"]
        assert record["media_asset_id"] == asset["id"]
        assert record["media_content_sha256"] == asset["content_sha256"]
        recovered = client.get(record["media_detail_url"], headers=owner)
        assert recovered.status_code == 200
        assert recovered.content == WEBP
        assert recovered.headers["x-content-sha256"] == asset["content_sha256"]
        assert client.get(record["media_detail_url"], headers=outsider).status_code == 404

        second_transfer = _transfer(client, owner, str(uuid.uuid4()))
        second_asset = second_transfer.json()
        update = {
            "operation_id": str(uuid.uuid4()), "entity": "product",
            "entity_id": product_id, "operation": "UPDATE", "base_version": record["version"],
            "payload": {"version": record["version"], "media_asset_id": second_asset["id"]},
        }
        updated = _push(client, owner, update).json()["results"][0]["record"]
        assert updated["media_asset_id"] == second_asset["id"]
        stale = {
            "operation_id": str(uuid.uuid4()), "entity": "product",
            "entity_id": product_id, "operation": "UPDATE", "base_version": record["version"],
            "payload": {"version": record["version"], "media_asset_id": asset["id"]},
        }
        stale_result = _push(client, owner, stale).json()["results"][0]
        assert stale_result["status"] == "conflict"
        assert stale_result["record"]["media_asset_id"] == second_asset["id"]

        deleted = _push(client, owner, {
            "operation_id": str(uuid.uuid4()), "entity": "product",
            "entity_id": product_id, "operation": "DELETE", "base_version": updated["version"],
        })
        assert deleted.json()["results"][0]["status"] == "applied"
        assert client.get(second_asset["detail_url"], headers=owner).status_code == 404
        with SessionLocal() as db:
            assert db.get(MediaAsset, second_asset["id"]) is not None


def test_media_rejects_claimed_type_with_invalid_bytes():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_default_plans(db)
        ensure_system_admin(db)
    with TestClient(app) as client:
        headers = _account(client, uuid.uuid4().hex[:8])
        content = b"not-an-image"
        response = _transfer(client, headers, str(uuid.uuid4()), content)
        assert response.status_code == 422
        assert response.json()["detail"] == "MEDIA_CONTENT_INVALID"
