import uuid
import hashlib

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Store, StoreMembership, StorePlanGrant, User, UserSession
from app.services.bootstrap_service import ensure_system_admin
from app.services.subscription_service import seed_default_plans
import app.services.auth_service as auth_service
from app.mobile import normalize_iranian_mobile


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
    digits = int(hashlib.sha256(username.encode()).hexdigest()[:12], 16) % 1_000_000_000
    return {
        "username": username,
        "phone": f"09{digits:09d}",
        "password": "StrongPass123!",
        "device_fingerprint": f"device-{username}",
    }


@pytest.mark.parametrize("value", [
    "09123456789", "+989123456789", "00989123456789",
    "۰۹۱۲۳۴۵۶۷۸۹", "٠٩١٢٣٤٥٦٧٨٩",
])
def test_equivalent_mobile_prefixes_and_digit_scripts_share_one_canonical_value(value: str):
    assert normalize_iranian_mobile(value) == "09123456789"


def test_minimal_signup_atomically_provisions_solo_owner_without_grant(client: TestClient):
    username = f"minimal-{uuid.uuid4().hex[:10]}"
    created = client.post("/api/auth/signup", json=minimal_payload(username))
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["user"]["first_name"] is None
    assert body["user"]["last_name"] is None
    assert body["user"]["email"] is None
    assert body["user"]["phone"] == minimal_payload(username)["phone"]
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


def test_signup_normalizes_equivalent_mobile_forms_and_profile_enforces_uniqueness(client: TestClient):
    username = f"compatible-{uuid.uuid4().hex[:10]}"
    created = client.post("/api/auth/signup", json={
        **minimal_payload(username),
        "first_name": "Legacy",
        "last_name": "Client",
        "email": "legacy@example.com",
        "phone": "+۹۸۹۱۲۳۴۵۶۷۸۹",
    })
    assert created.status_code == 201, created.text
    assert created.json()["user"]["first_name"] == "Legacy"
    assert created.json()["user"]["phone"] == "09123456789"

    minimal_username = f"profile-{uuid.uuid4().hex[:10]}"
    profile_payload = {**minimal_payload(minimal_username), "phone": "00989911111111"}
    minimal = client.post("/api/auth/signup", json=profile_payload)
    headers = {
        "Authorization": f"Bearer {minimal.json()['access_token']}",
        "X-Device-Fingerprint": f"device-{minimal_username}",
    }
    completed = client.patch("/api/auth/me", headers=headers, json={
        "first_name": "Profile",
        "last_name": "Owner",
        "email": "profile@example.com",
        "phone": "۰۹۹۱۱۱۱۱۱۱۱",
    })
    assert completed.status_code == 200, completed.text
    assert completed.json()["first_name"] == "Profile"
    assert completed.json()["email"] == "profile@example.com"
    assert completed.json()["phone"] == "09911111111"

    conflict = client.patch("/api/auth/me", headers=headers, json={"phone": "۰۹۱۲۳۴۵۶۷۸۹"})
    assert conflict.status_code == 409
    assert conflict.json()["detail"] == "این شماره موبایل قبلاً ثبت شده است."


def test_signup_rejects_missing_invalid_and_duplicate_mobile_with_stable_messages(client: TestClient):
    username = f"mobile-errors-{uuid.uuid4().hex[:8]}"
    missing_payload = minimal_payload(username)
    missing_payload.pop("phone")
    missing = client.post("/api/auth/signup", json=missing_payload)
    assert missing.status_code == 422
    assert missing.json()["detail"][0]["msg"] == "شماره موبایل معتبر نیست."

    for value in ("02112345678", "+12025550123", "09123abc789"):
        invalid = client.post("/api/auth/signup", json={**minimal_payload(username), "phone": value})
        assert invalid.status_code == 422
        assert invalid.json()["detail"][0]["msg"] == "شماره موبایل معتبر نیست."

    first = client.post("/api/auth/signup", json={**minimal_payload(username), "phone": "09128887766"})
    assert first.status_code == 201
    duplicate_username = f"duplicate-phone-{uuid.uuid4().hex[:8]}"
    duplicate = client.post(
        "/api/auth/signup",
        json={**minimal_payload(duplicate_username), "phone": "+۹۸۹۱۲۸۸۸۷۷۶۶"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "این شماره موبایل قبلاً ثبت شده است."
    with SessionLocal() as db:
        assert db.scalar(select(func.count(User.id)).where(User.username == duplicate_username)) == 0


def test_legacy_account_without_phone_can_still_login(client: TestClient):
    username = f"legacy-null-phone-{uuid.uuid4().hex[:8]}"
    created = client.post("/api/auth/signup", json=minimal_payload(username))
    assert created.status_code == 201
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.username == username))
        user.phone = None
        db.commit()
    logged_in = client.post("/api/auth/login", json={
        "username": username,
        "password": "StrongPass123!",
        "device_fingerprint": f"legacy-login-{username}",
    })
    assert logged_in.status_code == 200, logged_in.text
    assert logged_in.json()["user"]["phone"] is None


def test_login_accepts_username_and_equivalent_mobile_forms(client: TestClient):
    username = f"mobile-login-{uuid.uuid4().hex[:8]}"
    payload = minimal_payload(username)
    created = client.post("/api/auth/signup", json=payload)
    assert created.status_code == 201, created.text

    for identifier in (username, f"+98{payload['phone'][1:]}"):
        logged_in = client.post("/api/auth/login", json={
            "username": identifier,
            "password": payload["password"],
            "device_fingerprint": f"login-{uuid.uuid4().hex}",
        })
        assert logged_in.status_code == 200, logged_in.text
        assert logged_in.json()["user"]["username"] == username


@pytest.mark.parametrize("username", ["ab", "9owner", "owner name", "مالک"])
def test_signup_rejects_invalid_username_contract(client: TestClient, username: str):
    response = client.post("/api/auth/signup", json=minimal_payload(username))
    assert response.status_code == 422


@pytest.mark.parametrize("password", ["alllowercase1", "ALLUPPERCASE1", "NoNumberHere"])
def test_signup_rejects_weak_password_contract(client: TestClient, password: str):
    username = f"weak-{uuid.uuid4().hex[:8]}"
    response = client.post("/api/auth/signup", json={**minimal_payload(username), "password": password})
    assert response.status_code == 422
