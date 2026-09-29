"""Destructive migration/API checks for an explicitly named test database.

Run this module separately via ``pytest tests/test_postgresql.py``. It refuses
non-PostgreSQL URLs and databases whose name does not contain ``test``.
"""

import os
from datetime import datetime, timezone
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "").strip()
if not TEST_DATABASE_URL:
    pytest.skip("TEST_DATABASE_URL is not configured", allow_module_level=True)

url = make_url(TEST_DATABASE_URL)
if url.get_backend_name() != "postgresql" or "test" not in (url.database or "").lower():
    raise pytest.UsageError(
        "TEST_DATABASE_URL must name a PostgreSQL database containing 'test'"
    )

os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["ENVIRONMENT"] = "test"
os.environ["SECRET_KEY"] = "test-only-signing-key-never-use-in-production"
os.environ["SYSTEM_ADMIN_PASSWORD"] = "Test-only-system-admin-password-123!"

from fastapi.testclient import TestClient
from app.database import SessionLocal, engine
from app.main import app
from app.models import User
from app.services.bootstrap_service import ensure_system_admin
from app.services.subscription_service import seed_default_plans


EXPECTED_TABLES = {
    "admin_audit_logs", "catalog_products", "categories", "custom_products",
    "industries", "inventory_items", "inventory_transactions",
    "subscription_plans", "sync_changes", "sync_operations", "user_sessions", "users",
}


@pytest.fixture(scope="module", autouse=True)
def migrated_empty_database():
    reset_engine = create_engine(TEST_DATABASE_URL, isolation_level="AUTOCOMMIT")
    with reset_engine.connect() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
    reset_engine.dispose()

    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    command.upgrade(config, "head")
    yield


@pytest.fixture(autouse=True)
def clean_rows(migrated_empty_database):
    tables = [name for name in inspect(engine).get_table_names() if name != "alembic_version"]
    with engine.begin() as connection:
        connection.execute(text(
            "TRUNCATE TABLE " + ", ".join(f'"{name}"' for name in tables) +
            " RESTART IDENTITY CASCADE"
        ))


@pytest.fixture()
def client(clean_rows):
    with SessionLocal() as db:
        seed_default_plans(db)
        ensure_system_admin(db)
    with TestClient(app) as test_client:
        yield test_client


def signup(client: TestClient):
    return client.post("/api/auth/signup", json={
        "first_name": "Postgres", "last_name": "Tester",
        "username": "postgres-user", "password": "StrongPass123!",
        "device_fingerprint": "postgres-device",
    })


@pytest.mark.postgres
def test_migration_reaches_head_with_all_expected_tables(migrated_empty_database):
    assert EXPECTED_TABLES <= set(inspect(engine).get_table_names())
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "20260902_0001"


@pytest.mark.postgres
def test_postgresql_enforces_inventory_checks_and_foreign_keys(client):
    user_id = signup(client).json()["user"]["id"]
    with SessionLocal() as db:
        with pytest.raises(IntegrityError):
            db.execute(text(
                "INSERT INTO inventory_items "
                "(user_id, catalog_product_id, quantity, price, low_stock_threshold) "
                "VALUES (:user_id, 999999, -1, 0, 0)"
            ), {"user_id": user_id})
            db.commit()


@pytest.mark.postgres
def test_auth_session_logout_and_current_user(client):
    created = signup(client)
    assert created.status_code == 201, created.text
    headers = {
        "Authorization": f"Bearer {created.json()['access_token']}",
        "X-Device-Fingerprint": "postgres-device",
    }
    assert client.get("/api/auth/me", headers=headers).status_code == 200
    assert client.post("/api/auth/login", json={
        "username": "postgres-user", "password": "WrongPass123!",
        "device_fingerprint": "wrong-device",
    }).status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/logout", headers=headers).status_code == 200
    denied = client.get("/api/auth/me", headers=headers)
    assert denied.status_code == 403
    assert denied.json()["detail"] == "Invalid device session"


@pytest.mark.postgres
def test_system_admin_bootstrap_is_idempotent_and_immutable(client):
    with SessionLocal() as db:
        ensure_system_admin(db)
        assert db.query(User).filter(User.is_system_admin.is_(True)).count() == 1

    login = client.post("/api/auth/login", json={
        "username": "HosseinKM2000",
        "password": "Test-only-system-admin-password-123!",
        "device_fingerprint": "postgres-admin-device",
    })
    admin_id = login.json()["user"]["id"]
    headers = {
        "Authorization": f"Bearer {login.json()['access_token']}",
        "X-Device-Fingerprint": "postgres-admin-device",
    }
    for method, path, payload in (
        ("patch", f"/api/admin/users/{admin_id}/role", {"role": "USER"}),
        ("patch", f"/api/admin/users/{admin_id}/state", {"is_active": False}),
        ("delete", f"/api/admin/users/{admin_id}", None),
    ):
        response = client.request(method, path, headers=headers, json=payload)
        assert response.status_code == 409, response.text
        assert response.json()["detail"] == "SYSTEM_ADMIN_IMMUTABLE"


@pytest.mark.postgres
def test_expired_subscription_preserves_reads_and_blocks_writes(client):
    created = signup(client)
    user_id = created.json()["user"]["id"]
    headers = {
        "Authorization": f"Bearer {created.json()['access_token']}",
        "X-Device-Fingerprint": "postgres-device",
    }
    with SessionLocal() as db:
        user = db.get(User, user_id)
        assert user is not None
        user.plan = "pro"
        user.subscription_expires_at = datetime(2020, 1, 1, tzinfo=timezone.utc)
        db.commit()

    entitlement = client.get("/api/plans/current", headers=headers)
    assert entitlement.json()["status"] == "expired"
    assert entitlement.json()["capabilities"]["inventory.write"] is False
    assert client.get("/api/categories", headers=headers).status_code == 200
    assert client.post("/api/categories", headers=headers, json={"name": "Blocked"}).status_code == 403
