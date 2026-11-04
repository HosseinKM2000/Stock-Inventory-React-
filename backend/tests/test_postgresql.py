"""Destructive migration/API checks for an explicitly named test database.

Run this module separately via ``pytest tests/test_postgresql.py``. It refuses
non-PostgreSQL URLs and databases whose name does not contain ``test``.
"""

import os
import base64
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
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
from app.models import CatalogProduct, Category, Industry, InventoryItem, Label, MediaAsset, Store, StoreMembership, StoreModeTransition, StorePlanGrant, SubscriptionPlan, SyncOperation, User, UserSession
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
    "store_mode_transitions",
    "store_plan_grants",
    "media_assets",
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
        {
            key: value for key, value in legacy_operation.model_dump(mode="json").items()
            if key not in {"execution_mode", "policy_version"}
        },
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
                   (9102,'Legacy','Member','legacy-member','hash',9101),
                   (9201,'Solo','Owner','legacy-solo-owner','hash',9101),
                   (9202,'Inactive','Member','legacy-inactive-member','hash',9101)
        """))
        connection.execute(text("""
            INSERT INTO stores (id,name,owner_user_id)
            VALUES (9101,'Legacy store',9101), (9201,'Legacy solo store',9201)
        """))
        connection.execute(text("""
            INSERT INTO store_roles (id,store_id,name,permissions_json)
            VALUES (9101,9101,'Legacy role','[]'),
                   (9201,9201,'Inactive role','[]')
        """))
        connection.execute(text("""
            INSERT INTO store_memberships (id,store_id,user_id,role_id,status,is_owner)
            VALUES (9101,9101,9101,NULL,'active',true),
                   (9102,9101,9102,9101,'active',false),
                   (9201,9201,9201,NULL,'active',true),
                   (9202,9201,9202,9201,'inactive',false)
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
    command.upgrade(config, "20261101_0009")
    with reset_engine.begin() as connection:
        connection.execute(text("""
            INSERT INTO subscription_plans
                (id,name,currency,is_active,features_json,limits_json)
            VALUES
                ('starter','Legacy Starter','IRR',true,:features,:limits)
        """), {
            "features": json.dumps({"inventory.read": True, "inventory.write": True}),
            "limits": json.dumps({"inventory_items": 500, "devices": None}),
        })
        connection.execute(text("""
            UPDATE users
            SET plan='starter', subscription_started_at='2026-01-02T03:04:05+00:00'
            WHERE id=9101
        """))
        connection.execute(text("""
            UPDATE stores
            SET plan='starter', subscription_started_at='2026-01-02T03:04:05+00:00'
            WHERE id=9101
        """))
        connection.execute(text(
            "INSERT INTO users (id,first_name,last_name,username,hashed_password) "
            "VALUES (9301,'Ambiguous','Owner','ambiguous-owner','hash'), "
            "       (9401,'Missing','Owner','missing-owner','hash')"
        ))
        connection.execute(text(
            "INSERT INTO stores (id,name,owner_user_id) VALUES (9401,'Missing owner membership',9401)"
        ))
        connection.execute(text(
            "INSERT INTO store_memberships (id,store_id,user_id,status,is_owner) "
            "VALUES (9301,9201,9301,'active',true)"
        ))
    try:
        command.upgrade(config, "head")
    except Exception as error:
        MIGRATION_EVIDENCE["mode_preflight"] = str(error)
    else:
        raise AssertionError("Multiple active owners must block operating-mode migration")
    with reset_engine.connect() as connection:
        MIGRATION_EVIDENCE["mode_rollback"] = (
            connection.scalar(text("SELECT version_num FROM alembic_version")),
            "operating_mode" not in {column["name"] for column in inspect(connection).get_columns("stores")},
        )
    with reset_engine.begin() as connection:
        connection.execute(text("DELETE FROM store_memberships WHERE id=9301"))
        connection.execute(text("DELETE FROM users WHERE id=9301"))
        connection.execute(text(
            "INSERT INTO store_memberships (id,store_id,user_id,status,is_owner) "
            "VALUES (9401,9401,9401,'active',true)"
        ))
    command.upgrade(config, "20261103_0013")
    with reset_engine.begin() as connection:
        connection.execute(text(
            "UPDATE users SET phone=CASE id "
            "WHEN 9101 THEN '+۹۸۹۱۲۳۴۵۶۷۸۹' "
            "WHEN 9201 THEN '09123456789' "
            "WHEN 9401 THEN '02112345678' END "
            "WHERE id IN (9101,9201,9401)"
        ))
    try:
        command.upgrade(config, "head")
    except Exception as error:
        MIGRATION_EVIDENCE["mobile_preflight"] = str(error)
    else:
        raise AssertionError("Malformed and duplicate canonical mobile values must block migration")
    with reset_engine.connect() as connection:
        MIGRATION_EVIDENCE["mobile_rollback"] = (
            connection.scalar(text("SELECT version_num FROM alembic_version")),
            tuple(connection.execute(text(
                "SELECT id,phone FROM users WHERE id IN (9101,9201,9401) ORDER BY id"
            )).all()),
        )
    with reset_engine.begin() as connection:
        connection.execute(text("UPDATE users SET phone=NULL WHERE id=9401"))
        connection.execute(text("UPDATE users SET phone='00989911111111' WHERE id=9201"))
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
        MIGRATION_EVIDENCE["legacy_mode"] = connection.execute(text(
            "SELECT operating_mode, policy_version, policy_changed_by_user_id FROM stores WHERE id=9101"
        )).one()
        MIGRATION_EVIDENCE["legacy_solo_mode"] = connection.execute(text(
            "SELECT operating_mode, policy_version, policy_changed_by_user_id FROM stores WHERE id=9201"
        )).one()
        MIGRATION_EVIDENCE["remediated_missing_owner_mode"] = connection.execute(text(
            "SELECT operating_mode, policy_version, policy_changed_by_user_id FROM stores WHERE id=9401"
        )).one()
        MIGRATION_EVIDENCE["legacy_plan"] = connection.execute(text(
            "SELECT commercial_status, policy_revision, features_json, limits_json FROM subscription_plans WHERE id='starter'"
        )).one()
        MIGRATION_EVIDENCE["starter_assignment"] = connection.execute(text("""
            SELECT u.plan, s.plan, u.subscription_started_at, s.subscription_started_at,
                   s.operating_mode,
                   (SELECT count(*) FROM store_plan_grants WHERE store_id=s.id)
            FROM users u JOIN stores s ON s.owner_user_id=u.id WHERE u.id=9101
        """)).one()
        MIGRATION_EVIDENCE["canonical_phones"] = tuple(connection.execute(text(
            "SELECT id,phone FROM users WHERE id IN (9101,9201,9401) ORDER BY id"
        )).all())
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
        "phone": "09120000001",
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
    assert "STORE_MODE_PREFLIGHT:ACTIVE_OWNER" in MIGRATION_EVIDENCE["mode_preflight"]
    assert "9201" in MIGRATION_EVIDENCE["mode_preflight"]
    assert "9401" in MIGRATION_EVIDENCE["mode_preflight"]
    assert MIGRATION_EVIDENCE["mode_rollback"] == ("20261101_0009", True)
    assert EXPECTED_TABLES <= set(inspect(engine).get_table_names())
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "20261104_0014"
        assert "MOBILE_PHONE_PREFLIGHT" in MIGRATION_EVIDENCE["mobile_preflight"]
        assert "malformed_count=1:user_ids=9401" in MIGRATION_EVIDENCE["mobile_preflight"]
        assert "duplicate_groups=1:user_ids=9101,9201" in MIGRATION_EVIDENCE["mobile_preflight"]
        assert "+۹۸۹۱۲۳۴۵۶۷۸۹" not in MIGRATION_EVIDENCE["mobile_preflight"]
        assert MIGRATION_EVIDENCE["mobile_rollback"][0] == "20261103_0013"
        assert MIGRATION_EVIDENCE["mobile_rollback"][1][0][1] == "+۹۸۹۱۲۳۴۵۶۷۸۹"
        assert MIGRATION_EVIDENCE["canonical_phones"] == (
            (9101, "09123456789"), (9201, "09911111111"), (9401, None),
        )
        assert any(
            constraint["name"] == "uq_users_phone_canonical"
            for constraint in inspect(engine).get_unique_constraints("users")
        )
        user_columns = {column["name"]: column for column in inspect(engine).get_columns("users")}
        assert user_columns["first_name"]["nullable"] is True
        assert user_columns["last_name"]["nullable"] is True
        columns = {column["name"] for column in inspect(engine).get_columns("industries")}
        assert "tools_json" in columns
        inventory_columns = {column["name"] for column in inspect(engine).get_columns("inventory_items")}
        assert {"sale_price", "purchase_price", "media_asset_id"} <= inventory_columns
        media_columns = {column["name"] for column in inspect(engine).get_columns("media_assets")}
        assert {"store_id", "actor_user_id", "transfer_id", "content_sha256", "storage_key", "available_at"} <= media_columns
        operation_columns = {column["name"] for column in inspect(engine).get_columns("sync_operations")}
        assert {"request_fingerprint", "execution_mode", "policy_version"} <= operation_columns
        assert next(column for column in inspect(engine).get_columns("inventory_items") if column["name"] == "store_id")["nullable"] is False
        assert tuple(MIGRATION_EVIDENCE["legacy_mode"]) == ("team", 1, 9101)
        assert tuple(MIGRATION_EVIDENCE["legacy_solo_mode"]) == ("solo", 1, 9201)
        assert tuple(MIGRATION_EVIDENCE["remediated_missing_owner_mode"]) == ("solo", 1, 9401)
        legacy_plan = MIGRATION_EVIDENCE["legacy_plan"]
        assert legacy_plan[0:2] == ("legacy_only", 1)
        assert json.loads(legacy_plan[2])["invoices.sale"] is False
        assert json.loads(legacy_plan[3])["active_personnel"] == 0
        starter_assignment = MIGRATION_EVIDENCE["starter_assignment"]
        assert starter_assignment[0:2] == ("starter", "starter")
        assert starter_assignment[2] == starter_assignment[3]
        assert starter_assignment[4:] == ("team", 0)
        plan_columns = {column["name"] for column in inspect(engine).get_columns("subscription_plans")}
        assert {"policy_revision", "commercial_status"} <= plan_columns


@pytest.mark.postgres
def test_concurrent_equivalent_mobile_signup_provisions_one_complete_workspace(client):
    usernames = ("postgres-mobile-concurrent-a", "postgres-mobile-concurrent-b")
    payloads = ({
        "username": usernames[0], "phone": "۰۹۱۲۰۰۰۰۰۰۲",
        "password": "StrongPass123!", "device_fingerprint": "postgres-mobile-device-a",
    }, {
        "username": usernames[1], "phone": "+989120000002",
        "password": "StrongPass123!", "device_fingerprint": "postgres-mobile-device-b",
    })

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda payload: client.post("/api/auth/signup", json=payload), payloads))

    assert sorted(response.status_code for response in responses) == [201, 409]
    rejected = next(response for response in responses if response.status_code == 409)
    assert rejected.json()["detail"] == "این شماره موبایل قبلاً ثبت شده است."
    with SessionLocal() as db:
        users = list(db.scalars(select(User).where(User.username.in_(usernames))))
        assert len(users) == 1
        user = users[0]
        assert user is not None
        assert user.phone == "09120000002"
        assert user.first_name is None and user.last_name is None
        stores = list(db.scalars(select(Store).where(Store.owner_user_id == user.id)))
        memberships = list(db.scalars(select(StoreMembership).where(StoreMembership.user_id == user.id)))
        sessions = list(db.scalars(select(UserSession).where(UserSession.user_id == user.id)))
        assert len(stores) == len(memberships) == len(sessions) == 1
        assert stores[0].name == user.username
        assert stores[0].operating_mode == "solo"
        assert memberships[0].is_owner is True
        assert db.scalar(select(func.count(StorePlanGrant.id)).where(StorePlanGrant.store_id == stores[0].id)) == 0


@pytest.mark.postgres
def test_concurrent_equivalent_media_transfer_converges_once(client):
    created = signup(client)
    assert created.status_code == 201
    headers = {
        "Authorization": f"Bearer {created.json()['access_token']}",
        "X-Device-Fingerprint": "postgres-device",
        "X-Client-Data-Schema": "3",
    }
    content = base64.b64decode(
        "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA=="
    )
    transfer_id = "70c45fa5-8664-4fef-94d0-49536b441c39"
    digest = hashlib.sha256(content).hexdigest()

    def submit():
        return client.post(
            "/api/media/transfers", headers=headers,
            data={"transfer_id": transfer_id, "content_sha256": digest},
            files={"file": ("image.webp", content, "image/webp")},
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: submit(), range(2)))

    assert [response.status_code for response in responses] == [200, 200]
    assert len({response.json()["id"] for response in responses}) == 1
    with SessionLocal() as db:
        assert db.scalar(select(func.count(MediaAsset.id)).where(MediaAsset.transfer_id == transfer_id)) == 1


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
        "phone": "09120000004",
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
def test_v1_device_admission_remains_unrestricted(client):
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
    assert policy.status_code == 409, policy.text
    assert policy.json()["detail"] == "DEVICE_RESTRICTION_NOT_AVAILABLE_V1"

    def login(fingerprint: str):
        return client.post("/api/auth/login", json={
            "username": "postgres-user", "password": "StrongPass123!",
            "device_fingerprint": fingerprint,
        }).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(login, ["concurrent-device-a", "concurrent-device-b"]))
    assert statuses == [200, 200]


@pytest.mark.postgres
def test_concurrent_grants_reject_overlap_and_preserve_base_subscription(client):
    created = signup(client)
    user_id = created.json()["user"]["id"]
    admin_login = client.post("/api/auth/login", json={
        "username": "HosseinKM2000", "password": "Test-only-system-admin-password-123!",
        "device_fingerprint": "grant-admin-device",
    })
    admin_headers = {
        "Authorization": f"Bearer {admin_login.json()['access_token']}",
        "X-Device-Fingerprint": "grant-admin-device",
    }
    with SessionLocal() as db:
        store = db.scalar(select(Store).where(Store.owner_user_id == user_id))
        store.plan = "free"
        store_id = store.id
        db.commit()
    starts_at = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    ends_at = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()

    def create_grant(index: int):
        return client.post("/api/admin/grants", headers=admin_headers, json={
            "request_id": f"postgres-concurrent-grant-{index}", "store_id": store_id,
            "plan_id": "pro" if index == 1 else "vip", "source": "support",
            "reason": f"Concurrent grant {index}", "starts_at": starts_at, "ends_at": ends_at,
        })

    with ThreadPoolExecutor(max_workers=2) as pool:
        retries = list(pool.map(create_grant, [1, 1]))
    assert [response.status_code for response in retries] == [201, 201]
    assert len({response.json()["id"] for response in retries}) == 1
    overlap = create_grant(2)
    assert overlap.status_code == 409
    assert overlap.json()["detail"] == "GRANT_OVERLAP_UNSUPPORTED"
    with SessionLocal() as db:
        assert db.query(StorePlanGrant).filter_by(store_id=store_id).count() == 1
        assert db.get(Store, store_id).plan == "free"


@pytest.mark.postgres
def test_concurrent_inventory_admission_respects_finite_capacity_atomically(client):
    created = signup(client)
    user_id = created.json()["user"]["id"]
    headers = {
        "Authorization": f"Bearer {created.json()['access_token']}",
        "X-Device-Fingerprint": "postgres-device", "X-Client-Data-Schema": "2",
    }
    with SessionLocal() as db:
        industry = Industry(name="Capacity industry", is_active=True)
        db.add(industry)
        db.flush()
        user = db.get(User, user_id)
        store = db.scalar(select(Store).where(Store.owner_user_id == user_id))
        user.industry_id = store.industry_id = industry.id
        free = db.get(SubscriptionPlan, "free")
        limits = json.loads(free.limits_json)
        limits["inventory_items"] = 1
        free.limits_json = json.dumps(limits)
        db.commit()
        store_id = store.id

    def create_product(index: int):
        operation = {
            "operation_id": f"capacity-product-{index}", "entity": "product",
            "entity_id": 1_700_002_000_000 + index, "operation": "CREATE",
            "payload": {
                "quantity": 1, "price": 100, "custom_label": f"Capacity {index}",
                "low_stock_threshold": 0, "low_stock_alert": False, "is_hidden": False,
                "catalog_product": {"id": 0, "name": f"Capacity {index}"},
            },
        }
        return client.post("/api/sync/batch", headers=headers, data={
            "operations_json": json.dumps({"operations": [operation]}),
        })

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(create_product, [1, 2]))
    assert all(response.status_code == 200 for response in responses)
    results = [response.json()["results"][0] for response in responses]
    assert sorted(result["status"] for result in results) == ["applied", "fatal_error"]
    assert next(result for result in results if result["status"] == "fatal_error")["error"] == "INVENTORY_LIMIT_REACHED"
    with SessionLocal() as db:
        assert db.scalar(select(func.count(InventoryItem.id)).where(InventoryItem.store_id == store_id)) == 1


@pytest.mark.postgres
def test_concurrent_personnel_admission_respects_finite_capacity_atomically(client):
    created = signup(client)
    user_id = created.json()["user"]["id"]
    headers = {
        "Authorization": f"Bearer {created.json()['access_token']}",
        "X-Device-Fingerprint": "postgres-device",
    }
    with SessionLocal() as db:
        user = db.get(User, user_id)
        store = db.scalar(select(Store).where(Store.owner_user_id == user_id))
        user.plan = store.plan = "vip"
        store.personnel_limit_override = 1
        db.commit()
    mode = client.get("/api/store/operating-mode", headers=headers).json()
    activated = client.post("/api/store/operating-mode/activate-team", headers=headers, json={
        "expected_policy_version": mode["policy_version"],
        "transition_id": "postgres-personnel-capacity-activation",
    })
    assert activated.status_code == 200, activated.text
    role_id = client.get("/api/store/roles", headers=headers).json()[0]["id"]

    def create_personnel(index: int):
        return client.post("/api/store/personnel", headers=headers, json={
            "first_name": "Concurrent",
            "last_name": f"Person {index}",
            "role_id": role_id,
        })

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(create_personnel, [1, 2]))
    assert sorted(response.status_code for response in responses) == [201, 409]
    assert next(response for response in responses if response.status_code == 409).json()["detail"] == "PERSONNEL_CAPACITY_REACHED"
    with SessionLocal() as db:
        store_id = db.scalar(select(Store.id).where(Store.owner_user_id == user_id))
        count = db.scalar(select(func.count(StoreMembership.id)).where(
            StoreMembership.store_id == store_id,
            StoreMembership.is_owner.is_(False),
            StoreMembership.status == "active",
        ))
        assert count == 1


@pytest.mark.postgres
def test_concurrent_admin_plan_edits_have_one_atomic_audited_winner(client):
    admin_login = client.post("/api/auth/login", json={
        "username": "HosseinKM2000", "password": "Test-only-system-admin-password-123!",
        "device_fingerprint": "plan-admin-device",
    })
    headers = {
        "Authorization": f"Bearer {admin_login.json()['access_token']}",
        "X-Device-Fingerprint": "plan-admin-device",
    }
    free = next(item for item in client.get("/api/admin/plans", headers=headers).json() if item["id"] == "free")

    def update_plan(index: int):
        return client.patch("/api/admin/plans/free", headers=headers, json={
            "expected_revision": free["policy_revision"],
            "reason": f"Concurrent policy edit {index}",
            "description": f"winner {index}",
        })

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(update_plan, [1, 2]))
    assert sorted(response.status_code for response in responses) == [200, 409]
    with SessionLocal() as db:
        plan = db.get(SubscriptionPlan, "free")
        assert plan.policy_revision == free["policy_revision"] + 1
        audit_count = db.scalar(text("SELECT count(*) FROM admin_audit_logs WHERE action='plan.changed'"))
        assert audit_count == 1


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
def test_team_activation_serializes_with_inflight_solo_mutation(client):
    created = signup(client)
    user_id = created.json()["user"]["id"]
    headers = {
        "Authorization": f"Bearer {created.json()['access_token']}",
        "X-Device-Fingerprint": "postgres-device",
        "X-Client-Data-Schema": "2",
    }
    with SessionLocal() as db:
        db.get(User, user_id).plan = "vip"
        db.commit()
    mode = client.get("/api/store/operating-mode", headers=headers).json()
    operation = {
        "operation_id": "activation-race-category",
        "entity": "category",
        "entity_id": 1_700_000_990_001,
        "operation": "CREATE",
        "payload": {"name": "Activation race"},
    }

    def activate():
        return client.post("/api/store/operating-mode/activate-team", headers=headers, json={
            "expected_policy_version": mode["policy_version"],
            "transition_id": "activation-race-transition",
        })

    def mutate():
        return client.post("/api/sync/batch", headers=headers, data={
            "operations_json": json.dumps({"operations": [operation]}),
        })

    with ThreadPoolExecutor(max_workers=2) as pool:
        activation_response, mutation_response = list(pool.map(lambda fn: fn(), [activate, mutate]))

    assert activation_response.status_code == 200, activation_response.text
    mutation_result = mutation_response.json()["results"][0]
    assert mutation_result["status"] in {"applied", "fatal_error"}
    if mutation_result["status"] == "fatal_error":
        assert mutation_result["error"] == "STORE_POLICY_CONTEXT_REQUIRED"
    with SessionLocal() as db:
        store = db.scalar(select(Store).where(Store.owner_user_id == user_id))
        assert store.operating_mode == "team"
        expected_count = 1 if mutation_result["status"] == "applied" else 0
        assert db.query(Category).filter_by(id=operation["entity_id"]).count() == expected_count


@pytest.mark.postgres
def test_concurrent_team_activation_requests_converge_once(client):
    created = signup(client)
    user_id = created.json()["user"]["id"]
    headers = {
        "Authorization": f"Bearer {created.json()['access_token']}",
        "X-Device-Fingerprint": "postgres-device",
    }
    with SessionLocal() as db:
        db.get(User, user_id).plan = "vip"
        db.commit()
    mode = client.get("/api/store/operating-mode", headers=headers).json()

    def activate(transition_id: str):
        return client.post("/api/store/operating-mode/activate-team", headers=headers, json={
            "expected_policy_version": mode["policy_version"],
            "transition_id": transition_id,
        })

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(activate, ["concurrent-activation-a", "concurrent-activation-b"]))

    assert all(response.status_code == 200 for response in responses), [response.text for response in responses]
    assert {response.json()["operating_mode"] for response in responses} == {"team"}
    assert {response.json()["policy_version"] for response in responses} == {mode["policy_version"] + 1}
    with SessionLocal() as db:
        store_id = db.scalar(select(Store.id).where(Store.owner_user_id == user_id))
        assert db.query(StoreModeTransition).filter_by(store_id=store_id).count() == 1


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
    blocked = client.post("/api/categories", headers=headers, json={"name": "Blocked"})
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == "ENTITLEMENT_EXPIRED"
