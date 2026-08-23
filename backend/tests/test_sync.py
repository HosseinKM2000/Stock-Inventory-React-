import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

_database_path = Path(tempfile.mktemp(suffix="-inventory-test.db"))
os.environ["DATABASE_URL"] = f"sqlite:///{_database_path.as_posix()}"
os.environ["SYSTEM_ADMIN_PASSWORD"] = "Test-only-system-admin-password-123!"

from fastapi.testclient import TestClient

from app.database import SessionLocal, engine
from app.main import app
from app.models import Industry, User, UserSession


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
        assert signup.json()["user"]["is_active"] is True
        assert signup.json()["user"]["is_admin"] is False
        cls.headers = {
            "Authorization": f"Bearer {signup.json()['access_token']}",
            "X-Device-Fingerprint": "sync-test-device",
        }
        admin_login = cls.client.post(
            "/api/auth/login",
            json={
                "username": "HosseinKM2000",
                "password": "Test-only-system-admin-password-123!",
                "device_fingerprint": "system-admin-test-device",
            },
        )
        assert admin_login.status_code == 200, admin_login.text
        assert admin_login.json()["user"]["is_system_admin"] is True
        assert admin_login.json()["user"]["role"] == "ADMIN"
        cls.admin_user_id = admin_login.json()["user"]["id"]
        cls.admin_headers = {
            "Authorization": f"Bearer {admin_login.json()['access_token']}",
            "X-Device-Fingerprint": "system-admin-test-device",
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

    def test_permanent_admin_rbac_subscription_and_audit(self) -> None:
        # SQLite reloads persisted timestamps without timezone information,
        # while the current request updates last_seen with UTC awareness.
        # User listing must handle both representations across devices.
        with SessionLocal() as db:
            db.add(UserSession(
                user_id=self.admin_user_id,
                device_fingerprint="legacy-admin-device",
                access_token=None,
                is_active=False,
                last_seen=datetime.now(),
            ))
            db.commit()

        users = self.client.get("/api/admin/users", headers=self.admin_headers)
        self.assertEqual(users.status_code, 200, users.text)
        target = next(user for user in users.json() if user["username"] == "offline-sync-test")

        promoted = self.client.patch(
            f"/api/admin/users/{target['id']}/role",
            headers=self.admin_headers,
            json={"role": "ADMIN"},
        )
        self.assertEqual(promoted.status_code, 200, promoted.text)
        self.assertEqual(promoted.json()["role"], "ADMIN")
        promoted_access = self.client.get("/api/admin/plans", headers=self.headers)
        self.assertEqual(promoted_access.status_code, 200, promoted_access.text)

        demoted = self.client.patch(
            f"/api/admin/users/{target['id']}/role",
            headers=self.admin_headers,
            json={"role": "USER"},
        )
        self.assertEqual(demoted.status_code, 200, demoted.text)

        for method, path, payload in (
            ("patch", f"/api/admin/users/{self.admin_user_id}/role", {"role": "USER"}),
            ("patch", f"/api/admin/users/{self.admin_user_id}/state", {"is_active": False}),
            ("delete", f"/api/admin/users/{self.admin_user_id}", None),
        ):
            response = self.client.request(method, path, headers=self.admin_headers, json=payload)
            self.assertEqual(response.status_code, 409, response.text)
            self.assertEqual(response.json()["detail"], "SYSTEM_ADMIN_IMMUTABLE")

        plans = self.client.get("/api/admin/plans", headers=self.admin_headers)
        self.assertEqual(plans.status_code, 200, plans.text)
        self.assertTrue(any(plan["id"] == "free" for plan in plans.json()))

        created_plan = self.client.post(
            "/api/admin/plans",
            headers=self.admin_headers,
            json={
                "id": "test_release_plan",
                "name": "Test release plan",
                "description": "Automated test",
                "price_minor": None,
                "currency": "IRR",
                "duration": None,
                "duration_unit": None,
                "is_active": True,
                "features": {"inventory.read": True, "inventory.write": True},
                "limits": {"inventory_items": 10, "devices": 2},
            },
        )
        self.assertEqual(created_plan.status_code, 201, created_plan.text)

        assigned = self.client.patch(
            f"/api/admin/users/{target['id']}/subscription",
            headers=self.admin_headers,
            json={"plan": "test_release_plan"},
        )
        self.assertEqual(assigned.status_code, 200, assigned.text)
        self.assertEqual(assigned.json()["plan"], "test_release_plan")

        changed_plan = self.client.patch(
            "/api/admin/plans/test_release_plan",
            headers=self.admin_headers,
            json={"features": {"inventory.read": True, "inventory.write": False}},
        )
        self.assertEqual(changed_plan.status_code, 200, changed_plan.text)
        refreshed = self.client.get("/api/plans/current", headers=self.headers)
        self.assertEqual(refreshed.status_code, 200, refreshed.text)
        self.assertFalse(refreshed.json()["capabilities"]["inventory.write"])

        audit = self.client.get("/api/admin/audit", headers=self.admin_headers)
        self.assertEqual(audit.status_code, 200, audit.text)
        actions = {entry["action"] for entry in audit.json()}
        self.assertIn("role.admin_granted", actions)
        self.assertIn("subscription.changed", actions)

        with SessionLocal() as db:
            user = db.query(User).filter(User.username == "offline-sync-test").one()
            user.plan = "free"
            user.subscription_started_at = None
            user.subscription_expires_at = None
            db.commit()

    def test_resource_ownership_blocks_cross_user_access(self) -> None:
        signup = self.client.post(
            "/api/auth/signup",
            json={
                "first_name": "Second",
                "last_name": "Tenant",
                "username": "second-tenant-test",
                "password": "StrongPass123!",
                "device_fingerprint": "second-tenant-device",
            },
        )
        self.assertEqual(signup.status_code, 201, signup.text)
        other_headers = {
            "Authorization": f"Bearer {signup.json()['access_token']}",
            "X-Device-Fingerprint": "second-tenant-device",
        }
        response = self.client.patch(
            "/api/categories/1800000000001",
            headers=other_headers,
            json={"name": "Stolen category"},
        )
        self.assertEqual(response.status_code, 404, response.text)

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
