"""Destructive migration/API checks for an explicitly named test database.

Run this module separately via ``pytest tests/test_postgresql.py``. It refuses
non-PostgreSQL URLs and databases whose name does not contain ``test``.
"""

import os
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, func, inspect, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError, SQLAlchemyError


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
from app.models import CatalogProduct, Category, Industry, InventoryItem, Label, Store, SyncOperation, User
from app.routers.sync import _duplicate_result
from app.schemas import SyncOperationIn
from app.services.catalog_product_service import _reconcile_catalog_assignments
from app.services.bootstrap_service import ensure_system_admin
from app.services.subscription_service import seed_default_plans


EXPECTED_TABLES = {
    "admin_audit_logs", "catalog_products", "categories", "custom_products",
    "industries", "inventory_items", "inventory_transactions",
    "subscription_plans", "sync_changes", "sync_operations", "user_sessions", "users",
    "labels", "inventory_item_labels",
    "stores", "store_roles", "store_memberships", "store_activity",
    "product_barcodes", "inventory_movements",
}
MIGRATION_EVIDENCE = {}


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
    command.upgrade(config, "20261101_0008")
    legacy_operation = SyncOperationIn(
        operation_id="legacy-replay",
        entity="product",
        entity_id=9101,
        operation="CREATE",
        payload={"quantity": 23},
    )
    canonical = json.dumps(
        legacy_operation.model_dump(mode="json"),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    legacy_fingerprint = hashlib.sha256(canonical).hexdigest()
    MIGRATION_EVIDENCE["fingerprint"] = legacy_fingerprint
    # Representative legacy state: one valid owner-owned history chain plus a
    # personnel-shaped duplicate assignment that must block rather than merge.
    with reset_engine.begin() as connection:
        connection.execute(text("INSERT INTO industries (id,name) VALUES (9101,'Legacy migration')"))
        connection.execute(text("""
            INSERT INTO users (id,first_name,last_name,username,hashed_password,industry_id)
            VALUES (9101,'Legacy','Owner','legacy-owner','hash',9101),
                   (9102,'Legacy','Member','legacy-member','hash',9101)
        """))
        connection.execute(text("""
            INSERT INTO stores (id,name,owner_user_id) VALUES (9101,'Legacy store',9101)
        """))
        connection.execute(text("""
            INSERT INTO store_roles (id,store_id,name,permissions_json)
            VALUES (9101,9101,'Legacy role','[]')
        """))
        connection.execute(text("""
            INSERT INTO store_memberships (id,store_id,user_id,role_id,status,is_owner)
            VALUES (9101,9101,9101,NULL,'active',true),
                   (9102,9101,9102,9101,'active',false)
        """))
        connection.execute(text("""
            INSERT INTO catalog_products (id,industry_id,name) VALUES (9101,9101,'Legacy catalog')
        """))
        connection.execute(text("""
            INSERT INTO categories (id,store_id,user_id,name) VALUES (9101,9101,9101,'Legacy category')
        """))
        connection.execute(text("""
            INSERT INTO inventory_items
                (id,store_id,user_id,catalog_product_id,category_id,quantity,price,sale_price,purchase_price,low_stock_threshold)
            VALUES (9101,9101,9101,9101,9101,23,4500,4500,3200,4),
                   (9102,NULL,9102,9101,NULL,9,8000,8000,7000,1)
        """))
        connection.execute(text("""
            INSERT INTO inventory_transactions
                (id,store_id,actor_user_id,user_id,inventory_item_id,type,quantity,before_quantity,after_quantity)
            VALUES (9101,9101,9101,9101,9101,'stock_in',3,20,23)
        """))
        connection.execute(text("""
            INSERT INTO sync_operations
                (id,store_id,actor_user_id,user_id,operation_id,request_fingerprint,result_payload)
            VALUES (9101,9101,9101,9101,'legacy-replay',:fingerprint,:result)
        """), {
            "fingerprint": legacy_fingerprint,
            "result": '{"operation_id":"legacy-replay","status":"applied","entity_id":9101,"record":null,"error":null}',
        })
        connection.execute(text("""
            INSERT INTO sync_changes
                (id,store_id,actor_user_id,user_id,entity,entity_id,operation,payload)
            VALUES (9101,9101,9101,9101,'product',9101,'UPSERT','{}')
        """))
    try:
        command.upgrade(config, "head")
    except Exception as error:
        diagnostic = str(error)
        MIGRATION_EVIDENCE["blocked"] = "DUPLICATE_CATALOG_ASSIGNMENT" in diagnostic
        MIGRATION_EVIDENCE["diagnostic"] = diagnostic
    else:
        raise AssertionError("Ambiguous legacy catalog assignments must block migration")
    with reset_engine.connect() as connection:
        MIGRATION_EVIDENCE["rollback"] = (
            connection.scalar(text("SELECT version_num FROM alembic_version")),
            "industry_id" not in {
                column["name"] for column in inspect(connection).get_columns("stores")
            },
            connection.scalar(text("SELECT count(*) FROM inventory_items WHERE id IN (9101,9102)")),
        )
    with reset_engine.begin() as connection:
        connection.execute(text("DELETE FROM inventory_items WHERE id=9102"))
    command.upgrade(config, "head")
    with reset_engine.connect() as connection:
        row = connection.execute(text("""
            SELECT i.id,i.store_id,i.quantity,i.sale_price,i.purchase_price,i.category_id,
                   t.id,t.actor_user_id,o.id,o.actor_user_id,o.request_fingerprint,s.industry_id
            FROM inventory_items i
            JOIN inventory_transactions t ON t.inventory_item_id=i.id
            JOIN sync_operations o ON o.operation_id='legacy-replay'
            JOIN stores s ON s.id=i.store_id
            WHERE i.id=9101
        """)).one()
        MIGRATION_EVIDENCE["preserved"] = tuple(row)
    with SessionLocal() as db:
        stored = db.get(SyncOperation, 9101)
        replay = _duplicate_result(stored, legacy_operation, legacy_fingerprint)
        MIGRATION_EVIDENCE["replay"] = (
            replay.status,
            db.query(InventoryItem).filter_by(id=9101).count(),
            db.get(InventoryItem, 9101).quantity,
        )
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
    assert MIGRATION_EVIDENCE["blocked"] is True
    assert "record_ids" in MIGRATION_EVIDENCE["diagnostic"]
    assert "9101" in MIGRATION_EVIDENCE["diagnostic"]
    assert "9102" in MIGRATION_EVIDENCE["diagnostic"]
    assert MIGRATION_EVIDENCE["rollback"] == ("20261101_0008", True, 2)
    assert MIGRATION_EVIDENCE["preserved"] == (
        9101, 9101, 23, 4500, 3200, 9101,
        9101, 9101, 9101, 9101, MIGRATION_EVIDENCE["fingerprint"], 9101,
    )
    assert len(MIGRATION_EVIDENCE["preserved"][10]) == 64
    assert MIGRATION_EVIDENCE["replay"] == ("applied", 1, 23)
    assert EXPECTED_TABLES <= set(inspect(engine).get_table_names())
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "20261101_0009"
        columns = {column["name"] for column in inspect(engine).get_columns("industries")}
        assert "tools_json" in columns
        inventory_columns = {column["name"] for column in inspect(engine).get_columns("inventory_items")}
        assert {"sale_price", "purchase_price"} <= inventory_columns
        operation_columns = {column["name"] for column in inspect(engine).get_columns("sync_operations")}
        assert "request_fingerprint" in operation_columns
        assert next(column for column in inspect(engine).get_columns("inventory_items") if column["name"] == "store_id")["nullable"] is False


@pytest.mark.postgres
def test_postgresql_enforces_inventory_checks_and_foreign_keys(client):
    user_id = signup(client).json()["user"]["id"]
    with SessionLocal() as db:
        store_id = db.scalar(select(Store.id).where(Store.owner_user_id == user_id))
        with pytest.raises(IntegrityError):
            db.execute(text(
                "INSERT INTO inventory_items "
                "(store_id, user_id, catalog_product_id, quantity, price, low_stock_threshold) "
                "VALUES (:store_id, :user_id, 999999, -1, 0, 0)"
            ), {"store_id": store_id, "user_id": user_id})
            db.commit()


@pytest.mark.postgres
def test_concurrent_catalog_reconciliation_creates_one_store_assignment(client):
    created = signup(client)
    user_id = created.json()["user"]["id"]
    headers = {
        "Authorization": f"Bearer {created.json()['access_token']}",
        "X-Device-Fingerprint": "postgres-device",
    }
    with SessionLocal() as db:
        industry = Industry(name="Concurrent provisioning", is_active=True)
        db.add(industry)
        db.commit()
        industry_id = industry.id
    selected = client.patch("/api/auth/industry", headers=headers, json={"industry_id": industry_id})
    assert selected.status_code == 200, selected.text
    with SessionLocal() as db:
        product = CatalogProduct(
            industry_id=industry_id,
            name="Concurrent assignment",
            is_shared=True,
            is_active=True,
        )
        db.add(product)
        db.flush()
        product_id = product.id
        store_id = db.scalar(select(Store.id).where(Store.owner_user_id == user_id))
        existing = InventoryItem(
            store_id=store_id,
            user_id=user_id,
            catalog_product_id=product_id,
            quantity=31,
            custom_label="concurrent override",
            note="must survive concurrent reconciliation",
            is_hidden=True,
        )
        second_owner = User(
            first_name="Concurrent",
            last_name="Second",
            username="postgres-concurrent-second",
            hashed_password="test-only-unused-hash",
        )
        db.add_all([existing, second_owner])
        db.flush()
        second_store = Store(
            name="Concurrent second store",
            owner_user_id=second_owner.id,
            industry_id=industry_id,
        )
        db.add(second_store)
        db.commit()
        second_store_id = second_store.id

    def reconcile():
        with SessionLocal() as db:
            _reconcile_catalog_assignments(db, db.get(CatalogProduct, product_id))
            db.commit()
            return db.scalar(select(func.count(InventoryItem.id)).where(
                InventoryItem.catalog_product_id == product_id
            ))

    with ThreadPoolExecutor(max_workers=2) as pool:
        counts = list(pool.map(lambda _: reconcile(), range(2)))

    with SessionLocal() as db:
        assignments = list(db.scalars(select(InventoryItem).where(
            InventoryItem.catalog_product_id == product_id,
        )))
        assert counts == [2, 2]
        assert {(item.store_id, item.catalog_product_id) for item in assignments} == {
            (store_id, product_id),
            (second_store_id, product_id),
        }
        preserved = next(item for item in assignments if item.store_id == store_id)
        assert (
            preserved.quantity,
            preserved.custom_label,
            preserved.note,
            preserved.is_hidden,
        ) == (
            31,
            "concurrent override",
            "must survive concurrent reconciliation",
            True,
        )


@pytest.mark.postgres
def test_cross_store_relationship_constraints_reject_existing_ids(client):
    first = signup(client)
    second = client.post("/api/auth/signup", json={
        "first_name": "Other", "last_name": "Store",
        "username": "postgres-other", "password": "StrongPass123!",
        "device_fingerprint": "postgres-other-device",
    })
    assert first.status_code == second.status_code == 201
    with SessionLocal() as db:
        first_store = db.scalar(select(Store).where(Store.owner_user_id == first.json()["user"]["id"]))
        second_store = db.scalar(select(Store).where(Store.owner_user_id == second.json()["user"]["id"]))
        industry = Industry(name="Constraint industry", is_active=True)
        db.add(industry)
        db.flush()
        first_store.industry_id = second_store.industry_id = industry.id
        catalog_a = CatalogProduct(industry_id=industry.id, name="Constraint A", is_shared=False)
        catalog_b = CatalogProduct(industry_id=industry.id, name="Constraint B", is_shared=False)
        db.add_all([catalog_a, catalog_b])
        db.flush()
        category_b = Category(
            store_id=second_store.id,
            user_id=second_store.owner_user_id,
            name="Other category",
        )
        label_b = Label(
            store_id=second_store.id,
            user_id=second_store.owner_user_id,
            name="Other label",
            normalized_name="other label",
        )
        item_a = InventoryItem(
            store_id=first_store.id,
            user_id=first_store.owner_user_id,
            catalog_product_id=catalog_a.id,
        )
        item_b = InventoryItem(
            store_id=second_store.id,
            user_id=second_store.owner_user_id,
            catalog_product_id=catalog_b.id,
        )
        db.add_all([category_b, label_b, item_a, item_b])
        db.commit()
        ids = {
            "first_store": first_store.id, "second_store": second_store.id,
            "category_b": category_b.id, "label_b": label_b.id,
            "item_a": item_a.id, "item_b": item_b.id,
            "first_user": first_store.owner_user_id,
        }

    with pytest.raises(IntegrityError):
        with engine.begin() as connection:
            connection.execute(text(
                "UPDATE inventory_items SET category_id=:category WHERE id=:item"
            ), {"category": ids["category_b"], "item": ids["item_a"]})
    with pytest.raises(SQLAlchemyError):
        with engine.begin() as connection:
            connection.execute(text(
                "INSERT INTO inventory_item_labels (inventory_item_id,label_id) VALUES (:item,:label)"
            ), {"item": ids["item_a"], "label": ids["label_b"]})
    with pytest.raises(IntegrityError):
        with engine.begin() as connection:
            connection.execute(text("""
                INSERT INTO inventory_transactions
                    (store_id,actor_user_id,user_id,inventory_item_id,type,quantity,before_quantity,after_quantity)
                VALUES (:store,:actor,:actor,:item,'stock_in',1,0,1)
            """), {
                "store": ids["first_store"], "actor": ids["first_user"],
                "item": ids["item_b"],
            })


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
def test_concurrent_device_admission_respects_user_limit(client):
    created = signup(client)
    user_id = created.json()["user"]["id"]
    admin_login = client.post("/api/auth/login", json={
        "username": "HosseinKM2000", "password": "Test-only-system-admin-password-123!",
        "device_fingerprint": "device-policy-admin",
    })
    admin_headers = {
        "Authorization": f"Bearer {admin_login.json()['access_token']}",
        "X-Device-Fingerprint": "device-policy-admin",
    }
    policy = client.patch(
        f"/api/admin/users/{user_id}/device-policy", headers=admin_headers,
        json={"mode": "limited", "limit": 2},
    )
    assert policy.status_code == 200, policy.text

    def login(fingerprint: str):
        return client.post("/api/auth/login", json={
            "username": "postgres-user", "password": "StrongPass123!",
            "device_fingerprint": fingerprint,
        }).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(login, ["concurrent-device-a", "concurrent-device-b"]))
    assert sorted(statuses) == [200, 403]


@pytest.mark.postgres
def test_concurrent_equivalent_sync_submission_applies_once(client):
    created = signup(client)
    user_id = created.json()["user"]["id"]
    headers = {
        "Authorization": f"Bearer {created.json()['access_token']}",
        "X-Device-Fingerprint": "postgres-device",
        "X-Client-Data-Schema": "2",
    }
    operation = {
        "operation_id": "postgres-concurrent-category",
        "entity": "category",
        "entity_id": 1_700_000_880_001,
        "operation": "CREATE",
        "payload": {"name": "Concurrent category", "description": "one effect"},
    }

    def submit():
        return client.post(
            "/api/sync/batch",
            headers=headers,
            data={"operations_json": __import__("json").dumps({"operations": [operation]})},
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: submit(), range(2)))

    assert [response.status_code for response in responses] == [200, 200]
    assert responses[0].json()["results"] == responses[1].json()["results"]
    assert responses[0].json()["results"][0]["status"] == "applied"
    with SessionLocal() as db:
        assert db.query(Category).filter_by(id=operation["entity_id"]).count() == 1
        stored = db.query(SyncOperation).filter_by(
            user_id=user_id,
            operation_id=operation["operation_id"],
        ).one()
        assert stored.request_fingerprint is not None


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
