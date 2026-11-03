import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Store, StoreMembership, StorePlanGrant, User, UserSession
from app.services.bootstrap_service import ensure_system_admin
from app.services.subscription_service import seed_default_plans
import app.services.auth_service as auth_service


@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_default_plans(db)
        ensure_system_admin(db)
    with TestClient(app) as value:
        yield value
    engine.dispose()


def minimal_payload(username: str) -> dict:
    return {
        "username": username,
        "password": "StrongPass123!",
        "device_fingerprint": f"device-{username}",
    }


def test_minimal_signup_atomically_provisions_solo_owner_without_grant(client: TestClient):
    username = f"minimal-{uuid.uuid4().hex[:10]}"
    created = client.post("/api/auth/signup", json=minimal_payload(username))
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["user"]["first_name"] is None
    assert body["user"]["last_name"] is None
    assert body["user"]["email"] is None
    assert body["user"]["phone"] is None
    assert body["user"]["plan"] == "free"

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        stores = list(db.scalars(select(Store).where(Store.owner_user_id == user.id)))
        memberships = list(db.scalars(select(StoreMembership).where(StoreMembership.user_id == user.id)))
        sessions = list(db.scalars(select(UserSession).where(UserSession.user_id == user.id)))
        assert len(stores) == len(memberships) == len(sessions) == 1
        assert stores[0].name == username
        assert stores[0].operating_mode == "solo"
        assert memberships[0].is_owner is True
        assert db.scalar(select(func.count(StorePlanGrant.id)).where(StorePlanGrant.store_id == stores[0].id)) == 0


def test_signup_retry_and_validation_failure_leave_no_partial_workspace(client: TestClient):
    username = f"retry-{uuid.uuid4().hex[:10]}"
    first = client.post("/api/auth/signup", json=minimal_payload(username))
    assert first.status_code == 201, first.text
    retry = client.post("/api/auth/signup", json=minimal_payload(username))
    assert retry.status_code == 409

    invalid_username = f"invalid-{uuid.uuid4().hex[:10]}"
    invalid = client.post("/api/auth/signup", json={
        **minimal_payload(invalid_username),
        "password": "short",
    })
    assert invalid.status_code == 422

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        assert db.scalar(select(func.count(User.id)).where(User.username == username)) == 1
        assert db.scalar(select(func.count(Store.id)).where(Store.owner_user_id == user.id)) == 1
        assert db.scalar(select(func.count(StoreMembership.id)).where(StoreMembership.user_id == user.id)) == 1
        assert db.scalar(select(func.count(User.id)).where(User.username == invalid_username)) == 0


def test_provisioning_failure_rolls_back_the_new_identity(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    username = f"rollback-{uuid.uuid4().hex[:10]}"

    def fail_provisioning(*_args, **_kwargs):
        raise RuntimeError("injected provisioning failure")

    monkeypatch.setattr(auth_service, "create_owner_store", fail_provisioning)
    with pytest.raises(RuntimeError, match="injected provisioning failure"):
        client.post("/api/auth/signup", json=minimal_payload(username))

    with SessionLocal() as db:
        assert db.scalar(select(func.count(User.id)).where(User.username == username)) == 0


def test_legacy_signup_shape_and_later_profile_completion_remain_compatible(client: TestClient):
    username = f"compatible-{uuid.uuid4().hex[:10]}"
    created = client.post("/api/auth/signup", json={
        **minimal_payload(username),
        "first_name": "Legacy",
        "last_name": "Client",
        "email": "legacy@example.com",
        "phone": "09120000000",
    })
    assert created.status_code == 201, created.text
    assert created.json()["user"]["first_name"] == "Legacy"

    minimal_username = f"profile-{uuid.uuid4().hex[:10]}"
    minimal = client.post("/api/auth/signup", json=minimal_payload(minimal_username))
    headers = {
        "Authorization": f"Bearer {minimal.json()['access_token']}",
        "X-Device-Fingerprint": f"device-{minimal_username}",
    }
    completed = client.patch("/api/auth/me", headers=headers, json={
        "first_name": "Profile",
        "last_name": "Owner",
        "email": "profile@example.com",
        "phone": "09121111111",
    })
    assert completed.status_code == 200, completed.text
    assert completed.json()["first_name"] == "Profile"
    assert completed.json()["email"] == "profile@example.com"
