import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Store, User
from app.services.bootstrap_service import ensure_system_admin
from app.services.store_authorization import normalize_permissions
from app.services.subscription_service import seed_default_plans


@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_default_plans(db)
        ensure_system_admin(db)
    with TestClient(app) as value:
        yield value
    engine.dispose()


def signup(client: TestClient, username: str):
    response = client.post("/api/auth/signup", json={
        "first_name": "Store", "last_name": "Owner", "username": username,
        "password": "StrongPass123!", "device_fingerprint": f"device-{username}",
    })
    assert response.status_code == 201, response.text
    return response.json()


def headers(auth: dict, fingerprint: str):
    return {"Authorization": f"Bearer {auth['access_token']}", "X-Device-Fingerprint": fingerprint}


def test_permission_dependencies_are_expanded_and_unknown_values_denied():
    assert normalize_permissions(["tools.import"]) == ["products.create", "products.view", "tools.import"]
    with pytest.raises(Exception, match="UNKNOWN_PERMISSION"):
        normalize_permissions(["products.typo"])


def test_personnel_capacity_temporary_password_gate_and_attribution(client: TestClient):
    username = f"owner-{uuid.uuid4().hex[:8]}"
    auth = signup(client, username)
    owner_headers = headers(auth, f"device-{username}")
    with SessionLocal() as db:
        owner = db.get(User, auth["user"]["id"])
        owner.plan = "vip"
        store = db.scalar(select(Store).where(Store.owner_user_id == owner.id))
        store.personnel_limit_override = 1
        db.commit()

    roles = client.get("/api/store/roles", headers=owner_headers)
    assert roles.status_code == 200
    viewer = next(item for item in roles.json() if item["name"] == "مشاهده‌گر")
    created = client.post("/api/store/personnel", headers=owner_headers, json={
        "first_name": "Person", "last_name": "One", "role_id": viewer["id"],
    })
    assert created.status_code == 201, created.text
    credential = created.json()
    assert credential["temporary_password"]

    full = client.post("/api/store/personnel", headers=owner_headers, json={
        "first_name": "Person", "last_name": "Two", "role_id": viewer["id"],
    })
    assert full.status_code == 409
    assert full.json()["detail"] == "PERSONNEL_CAPACITY_REACHED"

    login = client.post("/api/auth/login", json={
        "username": credential["username"], "password": credential["temporary_password"],
        "device_fingerprint": "person-device",
    })
    assert login.status_code == 200
    person_headers = headers(login.json(), "person-device")
    blocked = client.get("/api/products", headers=person_headers)
    assert blocked.status_code == 428

    dismissed = client.post("/api/store/credentials-notice/viewed", headers=person_headers)
    assert dismissed.status_code == 204
    still_blocked = client.get("/api/products", headers=person_headers)
    assert still_blocked.status_code == 428

    changed = client.patch("/api/auth/me/password", headers=person_headers, json={
        "current_password": credential["temporary_password"], "new_password": "ChangedPass456!",
    })
    assert changed.status_code == 200
    allowed = client.get("/api/products", headers=person_headers)
    assert allowed.status_code == 200

    activity = client.get("/api/store/activity", headers=owner_headers)
    assert activity.status_code == 200
    assert any(item["action"] == "personnel.created" for item in activity.json()["items"])


def test_platform_administrator_has_unrestricted_store_access(client: TestClient):
    login = client.post("/api/auth/login", json={
        "username": "HosseinKM2000", "password": "Test-only-system-admin-password-123!",
        "device_fingerprint": "platform-admin-personnel-test",
    })
    assert login.status_code == 200
    auth = login.json()
    assert auth["user"]["is_store_owner"] is True
    assert auth["user"]["store_id"] is not None

    admin_headers = headers(auth, "platform-admin-personnel-test")
    assert client.get("/api/products", headers=admin_headers).status_code == 200
    assert client.get("/api/store/personnel", headers=admin_headers).status_code == 200

    capacity = client.get("/api/store/personnel/capacity", headers=admin_headers)
    assert capacity.status_code == 200
    assert capacity.json()["enabled"] is True
    assert capacity.json()["limit"] is None
    assert capacity.json()["available"] is None

    entitlement = client.get("/api/plans/current", headers=admin_headers)
    assert entitlement.status_code == 200
    assert all(entitlement.json()["capabilities"].values())
    assert all(value is None for value in entitlement.json()["limits"].values())
