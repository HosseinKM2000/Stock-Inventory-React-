import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

_database_path = Path(tempfile.mktemp(suffix="-inventory-test.db"))
os.environ["DATABASE_URL"] = f"sqlite:///{_database_path.as_posix()}"

from fastapi.testclient import TestClient

from app.database import SessionLocal, engine
from app.main import app
from app.models import Industry, User


class SyncApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

        with SessionLocal() as db:
            industry = Industry(name="Sync Test", description="Test industry")
            db.add(industry)
            db.commit()
            db.refresh(industry)
            cls.industry_id = industry.id

        signup = cls.client.post(
            "/api/auth/signup",
            json={
                "first_name": "Offline",
                "last_name": "Tester",
                "username": "offline-sync-test",
                "password": "StrongPass123!",
                "device_fingerprint": "sync-test-device",
            },
        )
        assert signup.status_code == 201, signup.text
        cls.headers = {
            "Authorization": f"Bearer {signup.json()['access_token']}",
            "X-Device-Fingerprint": "sync-test-device",
        }
        selected = cls.client.patch(
            "/api/auth/industry",
            headers=cls.headers,
            json={"industry_id": cls.industry_id},
        )
        assert selected.status_code == 200, selected.text

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client.close()
        engine.dispose()
        _database_path.unlink(missing_ok=True)

    def push(self, operations: list[dict], files=None):
        return self.client.post(
            "/api/sync/batch",
            headers=self.headers,
            data={"operations_json": json.dumps({"operations": operations})},
            files=files,
        )

    def test_batch_is_idempotent_and_conflicts_are_explicit(self) -> None:
        entity_id = 1_700_000_000_001
        create = {
            "operation_id": "create-product-1",
            "entity": "product",
            "entity_id": entity_id,
            "operation": "CREATE",
            "payload": {
                "quantity": 10,
                "price": 250,
                "custom_label": "Local product",
                "low_stock_threshold": 3,
                "low_stock_alert": True,
                "is_hidden": False,
                "catalog_product": {"id": 0, "name": "Local product"},
            },
        }

        first = self.push([create])
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.json()["results"][0]["status"], "applied")
        self.assertEqual(first.json()["results"][0]["record"]["version"], 1)

        replay = self.push([create])
        self.assertEqual(replay.status_code, 200, replay.text)
        self.assertEqual(replay.json()["results"], first.json()["results"])

        update = {
            **create,
            "operation_id": "update-product-1",
            "operation": "UPDATE",
            "base_version": 1,
            "payload": {**create["payload"], "quantity": 2, "version": 1},
        }
        updated = self.push([update])
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()["results"][0]["record"]["version"], 2)

        conflict = {
            **update,
            "operation_id": "stale-update-product-1",
            "payload": {**update["payload"], "quantity": 99},
        }
        conflicted = self.push([conflict])
        self.assertEqual(conflicted.status_code, 200, conflicted.text)
        self.assertEqual(conflicted.json()["results"][0]["status"], "conflict")
        self.assertEqual(conflicted.json()["results"][0]["record"]["quantity"], 2)

        initial_pull = self.client.get(
            "/api/sync/changes?cursor=0", headers=self.headers
        )
        self.assertEqual(initial_pull.status_code, 200, initial_pull.text)
        self.assertTrue(
            any(
                change["entity_id"] == entity_id
                for change in initial_pull.json()["changes"]
            )
        )

        cursor = initial_pull.json()["cursor"]
        deleted = self.push(
            [
                {
                    "operation_id": "delete-product-1",
                    "entity": "product",
                    "entity_id": entity_id,
                    "operation": "DELETE",
                }
            ]
        )
        self.assertEqual(deleted.status_code, 200, deleted.text)

        changes = self.client.get(
            f"/api/sync/changes?cursor={cursor}", headers=self.headers
        )
        self.assertEqual(changes.status_code, 200, changes.text)
        self.assertTrue(
            any(
                change["entity_id"] == entity_id
                and change["operation"] == "DELETE"
                for change in changes.json()["changes"]
            )
        )

    def test_image_upload_is_linked_and_removed(self) -> None:
        entity_id = 1_700_000_000_002
        operation_id = "create-product-image"
        create = {
            "operation_id": operation_id,
            "entity": "product",
            "entity_id": entity_id,
            "operation": "CREATE",
            "payload": {
                "quantity": 1,
                "price": 1,
                "custom_label": "Image product",
                "low_stock_threshold": 0,
                "low_stock_alert": False,
                "is_hidden": False,
                "catalog_product": {"id": 0, "name": "Image product"},
            },
        }
        created = self.push(
            [create],
            files=[("files", (operation_id, b"test-webp-content", "image/webp"))],
        )
        self.assertEqual(created.status_code, 200, created.text)
        image_url = created.json()["results"][0]["record"]["image_url"]
        self.assertTrue(image_url.startswith("/uploads/sync-"))

        deleted = self.push(
            [
                {
                    "operation_id": "delete-product-image",
                    "entity": "product",
                    "entity_id": entity_id,
                    "operation": "DELETE",
                }
            ]
        )
        self.assertEqual(deleted.status_code, 200, deleted.text)

    def test_category_ids_are_client_stable_and_admin_is_guarded(self) -> None:
        category_id = 1_800_000_000_001
        created = self.client.post(
            "/api/categories",
            headers=self.headers,
            json={"id": category_id, "name": "Offline category", "description": "local"},
        )
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(created.json()["id"], category_id)

        replay = self.client.post(
            "/api/categories",
            headers=self.headers,
            json={"id": category_id, "name": "Offline category", "description": "local"},
        )
        self.assertEqual(replay.status_code, 201, replay.text)
        self.assertEqual(replay.json()["id"], category_id)

        users = self.client.get("/api/admin/users", headers=self.headers)
        self.assertEqual(users.status_code, 403, users.text)

    def test_expired_subscription_blocks_writes_but_allows_reads(self) -> None:
        with SessionLocal() as db:
            user = db.query(User).filter(User.username == "offline-sync-test").one()
            user.plan = "pro"
            user.subscription_expires_at = datetime.now(timezone.utc) - timedelta(days=1)
            db.commit()

        entitlement = self.client.get("/api/plans/current", headers=self.headers)
        self.assertEqual(entitlement.status_code, 200, entitlement.text)
        self.assertEqual(entitlement.json()["status"], "expired")
        self.assertFalse(entitlement.json()["capabilities"]["inventory.write"])

        categories = self.client.get("/api/categories", headers=self.headers)
        self.assertEqual(categories.status_code, 200, categories.text)
        blocked = self.client.post(
            "/api/categories",
            headers=self.headers,
            json={"name": "Blocked write"},
        )
        self.assertEqual(blocked.status_code, 403, blocked.text)

        with SessionLocal() as db:
            user = db.query(User).filter(User.username == "offline-sync-test").one()
            user.plan = "free"
            user.subscription_expires_at = None
            db.commit()

    def test_z_disabled_account_is_rejected_globally(self) -> None:
        with SessionLocal() as db:
            user = db.query(User).filter(User.username == "offline-sync-test").one()
            user.is_active = False
            db.commit()

        response = self.client.get("/api/auth/me", headers=self.headers)
        self.assertEqual(response.status_code, 423, response.text)
        self.assertEqual(response.json()["detail"], "ACCOUNT_DISABLED")

        with SessionLocal() as db:
            user = db.query(User).filter(User.username == "offline-sync-test").one()
            user.is_active = True
            db.commit()


if __name__ == "__main__":
    unittest.main()
