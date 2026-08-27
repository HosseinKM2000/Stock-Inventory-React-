import json
import os
import tempfile
import unittest
from unittest.mock import patch
from datetime import datetime, timedelta, timezone
from pathlib import Path

_database_path = Path(tempfile.mktemp(suffix="-inventory-test.db"))
os.environ["DATABASE_URL"] = f"sqlite:///{_database_path.as_posix()}"
os.environ["SYSTEM_ADMIN_PASSWORD"] = "Test-only-system-admin-password-123!"

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal, engine
from app.main import app
from app.models import (
    CatalogProduct,
    Industry,
    InventoryItem,
    InventoryTransaction,
    SyncChange,
    User,
    UserSession,
)
from app.services import catalog_product_service


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
        cls.user_id = signup.json()["user"]["id"]
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
        private_catalog_id = first.json()["results"][0]["record"]["catalog_product"]["id"]
        shared_catalog = self.client.get(
            "/api/catalog-products", headers=self.admin_headers
        )
        self.assertEqual(shared_catalog.status_code, 200, shared_catalog.text)
        self.assertNotIn(private_catalog_id, [item["id"] for item in shared_catalog.json()])

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

    def test_password_change_requires_current_password(self) -> None:
        unauthorized = self.client.patch(
            "/api/auth/me/password",
            json={"current_password": "StrongPass123!", "new_password": "NewStrongPass456!"},
        )
        self.assertEqual(unauthorized.status_code, 401, unauthorized.text)

        wrong = self.client.patch(
            "/api/auth/me/password",
            headers=self.headers,
            json={"current_password": "WrongPass123!", "new_password": "NewStrongPass456!"},
        )
        self.assertEqual(wrong.status_code, 400, wrong.text)
        self.assertEqual(wrong.json()["detail"], "CURRENT_PASSWORD_INCORRECT")

        weak = self.client.patch(
            "/api/auth/me/password",
            headers=self.headers,
            json={"current_password": "StrongPass123!", "new_password": "alllowercase1"},
        )
        self.assertEqual(weak.status_code, 422, weak.text)

        unchanged = self.client.patch(
            "/api/auth/me/password",
            headers=self.headers,
            json={"current_password": "StrongPass123!", "new_password": "StrongPass123!"},
        )
        self.assertEqual(unchanged.status_code, 400, unchanged.text)
        self.assertEqual(unchanged.json()["detail"], "NEW_PASSWORD_MUST_DIFFER")

        changed = self.client.patch(
            "/api/auth/me/password",
            headers=self.headers,
            json={"current_password": "StrongPass123!", "new_password": "NewStrongPass456!"},
        )
        self.assertEqual(changed.status_code, 200, changed.text)

        restored = self.client.patch(
            "/api/auth/me/password",
            headers=self.headers,
            json={"current_password": "NewStrongPass456!", "new_password": "StrongPass123!"},
        )
        self.assertEqual(restored.status_code, 200, restored.text)

    def test_industry_deletion_is_blocked_by_catalog_dependencies(self) -> None:
        dependent = self.client.post(
            "/api/industries",
            headers=self.admin_headers,
            json={"name": "Dependent industry", "description": "test", "is_active": True},
        )
        self.assertEqual(dependent.status_code, 200, dependent.text)
        catalog = self.client.post(
            "/api/catalog-products",
            headers=self.admin_headers,
            json={
                "industry_id": dependent.json()["id"],
                "name": "Dependent catalog item",
                "description": None,
                "brand": None,
                "image_url": None,
            },
        )
        self.assertEqual(catalog.status_code, 201, catalog.text)

        blocked = self.client.delete(
            f"/api/industries/{dependent.json()['id']}", headers=self.admin_headers
        )
        self.assertEqual(blocked.status_code, 409, blocked.text)
        self.assertEqual(blocked.json()["detail"], "INDUSTRY_HAS_CATALOG_PRODUCTS")

        empty = self.client.post(
            "/api/industries",
            headers=self.admin_headers,
            json={"name": "Empty industry", "description": None, "is_active": True},
        )
        removed = self.client.delete(
            f"/api/industries/{empty.json()['id']}", headers=self.admin_headers
        )
        self.assertEqual(removed.status_code, 200, removed.text)

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

    def test_catalog_archive_without_inventory_is_non_destructive(self) -> None:
        industry = self.client.post(
            "/api/industries",
            headers=self.admin_headers,
            json={
                "name": "Archive-only industry",
                "description": None,
                "is_active": True,
            },
        )
        self.assertEqual(industry.status_code, 200, industry.text)
        catalog = self.client.post(
            "/api/catalog-products",
            headers=self.admin_headers,
            json={"industry_id": industry.json()["id"], "name": "Archive only"},
        )
        self.assertEqual(catalog.status_code, 201, catalog.text)

        archived = self.client.patch(
            f"/api/catalog-products/{catalog.json()['id']}/archive",
            headers=self.admin_headers,
        )
        self.assertEqual(archived.status_code, 200, archived.text)
        with SessionLocal() as db:
            row = db.get(CatalogProduct, catalog.json()["id"])
            self.assertIsNotNone(row)
            self.assertFalse(row.is_active)
            dependent_count = len(
                list(
                    db.scalars(
                        select(InventoryItem).where(
                            InventoryItem.catalog_product_id == row.id
                        )
                    )
                )
            )
            self.assertEqual(dependent_count, 0)

        restored = self.client.patch(
            f"/api/catalog-products/{catalog.json()['id']}/restore",
            headers=self.admin_headers,
        )
        self.assertEqual(restored.status_code, 200, restored.text)
        self.assertTrue(restored.json()["is_active"])

        deleted = self.client.delete(
            f"/api/catalog-products/{catalog.json()['id']}",
            headers=self.admin_headers,
        )
        self.assertEqual(deleted.status_code, 204, deleted.text)
        with SessionLocal() as db:
            self.assertIsNone(db.get(CatalogProduct, catalog.json()["id"]))

    def test_catalog_lifecycle_with_100_dependent_inventory_rows(self) -> None:
        with SessionLocal() as db:
            isolated_industry = Industry(
                name="Lifecycle hundred industry",
                description="No assigned users",
                is_active=True,
            )
            db.add(isolated_industry)
            db.flush()
            catalog = CatalogProduct(
                industry_id=isolated_industry.id,
                name="Lifecycle hundred",
                is_shared=True,
                is_active=True,
            )
            db.add(catalog)
            db.flush()
            db.add_all(
                InventoryItem(
                    user_id=self.user_id,
                    catalog_product_id=catalog.id,
                    is_catalog_backed=True,
                    quantity=index,
                )
                for index in range(100)
            )
            db.commit()
            catalog_id = catalog.id

        archived = self.client.patch(
            f"/api/catalog-products/{catalog_id}/archive",
            headers=self.admin_headers,
        )
        self.assertEqual(archived.status_code, 200, archived.text)
        with SessionLocal() as db:
            self.assertFalse(db.get(CatalogProduct, catalog_id).is_active)
            item_ids = list(
                db.scalars(
                    select(InventoryItem.id).where(
                        InventoryItem.catalog_product_id == catalog_id
                    )
                )
            )
            self.assertEqual(len(item_ids), 100)

        restored = self.client.patch(
            f"/api/catalog-products/{catalog_id}/restore",
            headers=self.admin_headers,
        )
        self.assertEqual(restored.status_code, 200, restored.text)
        with SessionLocal() as db:
            restored_ids = list(
                db.scalars(
                    select(InventoryItem.id).where(
                        InventoryItem.catalog_product_id == catalog_id
                    )
                )
            )
            self.assertEqual(set(restored_ids), set(item_ids))

        deleted = self.client.delete(
            f"/api/catalog-products/{catalog_id}",
            headers=self.admin_headers,
        )
        self.assertEqual(deleted.status_code, 204, deleted.text)
        with SessionLocal() as db:
            self.assertIsNone(db.get(CatalogProduct, catalog_id))
            self.assertEqual(
                len(
                    list(
                        db.scalars(
                            select(InventoryItem.id).where(
                                InventoryItem.catalog_product_id == catalog_id
                            )
                        )
                    )
                ),
                0,
            )

    def test_catalog_crud_search_validation_and_protected_delete(self) -> None:
        forbidden = self.client.post(
            "/api/catalog-products",
            headers=self.headers,
            json={"industry_id": self.industry_id, "name": "Forbidden"},
        )
        self.assertEqual(forbidden.status_code, 403, forbidden.text)

        invalid_industry = self.client.post(
            "/api/catalog-products",
            headers=self.admin_headers,
            json={"industry_id": 999_999, "name": "Invalid industry"},
        )
        self.assertEqual(invalid_industry.status_code, 400, invalid_industry.text)
        self.assertEqual(invalid_industry.json()["detail"], "CATALOG_INDUSTRY_NOT_FOUND")

        invalid_name = self.client.post(
            "/api/catalog-products",
            headers=self.admin_headers,
            json={"industry_id": self.industry_id, "name": "   "},
        )
        self.assertEqual(invalid_name.status_code, 422, invalid_name.text)

        second_signup = self.client.post(
            "/api/auth/signup",
            json={
                "first_name": "Catalog",
                "last_name": "Existing",
                "username": "catalog-existing-user",
                "password": "StrongPass123!",
                "device_fingerprint": "catalog-existing-device",
            },
        )
        self.assertEqual(second_signup.status_code, 201, second_signup.text)
        second_user_id = second_signup.json()["user"]["id"]
        second_headers = {
            "Authorization": f"Bearer {second_signup.json()['access_token']}",
            "X-Device-Fingerprint": "catalog-existing-device",
        }
        selected_second = self.client.patch(
            "/api/auth/industry",
            headers=second_headers,
            json={"industry_id": self.industry_id},
        )
        self.assertEqual(selected_second.status_code, 200, selected_second.text)

        created = self.client.post(
            "/api/catalog-products",
            headers=self.admin_headers,
            json={
                "industry_id": self.industry_id,
                "name": "  Searchable catalog item  ",
                "description": "  Catalog description  ",
                "brand": "  UniqueBrand  ",
                "image_url": None,
            },
        )
        self.assertEqual(created.status_code, 201, created.text)
        product = created.json()
        self.assertEqual(product["name"], "Searchable catalog item")
        self.assertEqual(product["industry"]["id"], self.industry_id)

        found = self.client.get(
            f"/api/catalog-products?search=UniqueBrand&industry_id={self.industry_id}",
            headers=self.headers,
        )
        self.assertEqual(found.status_code, 200, found.text)
        self.assertIn(product["id"], [item["id"] for item in found.json()])

        before_catalog_update = self.client.get(
            "/api/sync/changes?cursor=0", headers=self.headers
        )
        self.assertEqual(before_catalog_update.status_code, 200, before_catalog_update.text)
        update_cursor = before_catalog_update.json()["cursor"]

        updated = self.client.patch(
            f"/api/catalog-products/{product['id']}",
            headers=self.admin_headers,
            json={"name": "Updated catalog item", "description": None},
        )
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()["id"], product["id"])
        self.assertEqual(updated.json()["name"], "Updated catalog item")

        catalog_delta = self.client.get(
            f"/api/sync/changes?cursor={update_cursor}", headers=self.headers
        )
        self.assertEqual(catalog_delta.status_code, 200, catalog_delta.text)
        self.assertTrue(
            any(
                (change.get("record") or {}).get("catalog_product", {}).get("name")
                == "Updated catalog item"
                for change in catalog_delta.json()["changes"]
            )
        )

        protected_fields = (
            "quantity",
            "price",
            "custom_label",
            "note",
            "low_stock_threshold",
            "low_stock_alert",
            "is_hidden",
            "created_at",
            "updated_at",
            "image_url",
            "catalog_product_id",
        )
        with SessionLocal() as db:
            provisioned_items = list(
                db.scalars(
                    select(InventoryItem).where(
                        InventoryItem.catalog_product_id == product["id"]
                    )
                )
            )
            self.assertEqual(
                {item.user_id for item in provisioned_items},
                {self.user_id, second_user_id},
            )
            provisioned = next(
                item for item in provisioned_items if item.user_id == self.user_id
            )
            provisioned_id = provisioned.id
            provisioned_version = provisioned.version
            inventory_snapshots = {
                item.id: {field: getattr(item, field) for field in protected_fields}
                for item in provisioned_items
            }
            self.assertTrue(all(item.is_catalog_backed for item in provisioned_items))

        for _ in range(2):
            selected = self.client.patch(
                "/api/auth/industry",
                headers=self.headers,
                json={"industry_id": self.industry_id},
            )
            self.assertEqual(selected.status_code, 200, selected.text)

        with SessionLocal() as db:
            count = len(
                list(
                    db.scalars(
                        select(InventoryItem).where(
                            InventoryItem.user_id == self.user_id,
                            InventoryItem.catalog_product_id == product["id"],
                        )
                    )
                )
            )
            self.assertEqual(count, 1)

        protected_local_delete = self.push(
            [
                {
                    "operation_id": "delete-provisioned-catalog-product",
                    "entity": "product",
                    "entity_id": provisioned_id,
                    "operation": "DELETE",
                }
            ]
        )
        self.assertEqual(protected_local_delete.status_code, 200, protected_local_delete.text)
        self.assertEqual(
            protected_local_delete.json()["results"][0]["status"], "fatal_error"
        )
        self.assertEqual(
            protected_local_delete.json()["results"][0]["error"],
            "CATALOG_BACKED_PRODUCT_DELETE_FORBIDDEN",
        )

        unauthorized_archive = self.client.patch(
            f"/api/catalog-products/{product['id']}/archive", headers=self.headers
        )
        self.assertEqual(unauthorized_archive.status_code, 403, unauthorized_archive.text)

        unauthorized_restore = self.client.patch(
            f"/api/catalog-products/{product['id']}/restore", headers=self.headers
        )
        self.assertEqual(unauthorized_restore.status_code, 403, unauthorized_restore.text)

        unauthorized_delete = self.client.delete(
            f"/api/catalog-products/{product['id']}", headers=self.headers
        )
        self.assertEqual(unauthorized_delete.status_code, 403, unauthorized_delete.text)

        archived = self.client.patch(
            f"/api/catalog-products/{product['id']}/archive",
            headers=self.admin_headers,
        )
        self.assertEqual(archived.status_code, 200, archived.text)
        self.assertFalse(archived.json()["is_active"])

        with SessionLocal() as db:
            catalog_row = db.get(CatalogProduct, product["id"])
            self.assertIsNotNone(catalog_row)
            self.assertFalse(catalog_row.is_active)
            remaining = list(
                db.scalars(
                    select(InventoryItem).where(
                        InventoryItem.catalog_product_id == product["id"]
                    )
                )
            )
            self.assertEqual(len(remaining), 2)
            for item in remaining:
                self.assertEqual(
                    {field: getattr(item, field) for field in protected_fields},
                    inventory_snapshots[item.id],
                )

        single = self.client.get(
            f"/api/catalog-products/{product['id']}", headers=self.headers
        )
        self.assertEqual(single.status_code, 404, single.text)

        active_list = self.client.get("/api/catalog-products", headers=self.headers)
        self.assertEqual(active_list.status_code, 200, active_list.text)
        self.assertNotIn(product["id"], [item["id"] for item in active_list.json()])

        unauthorized_archived_list = self.client.get(
            "/api/catalog-products/archived", headers=self.headers
        )
        self.assertEqual(
            unauthorized_archived_list.status_code,
            403,
            unauthorized_archived_list.text,
        )
        archived_list = self.client.get(
            "/api/catalog-products/archived", headers=self.admin_headers
        )
        self.assertEqual(archived_list.status_code, 200, archived_list.text)
        self.assertIn(product["id"], [item["id"] for item in archived_list.json()])

        refreshed_snapshot = self.client.get(
            "/api/sync/changes?cursor=0", headers=self.headers
        )
        self.assertEqual(refreshed_snapshot.status_code, 200, refreshed_snapshot.text)
        self.assertTrue(
            any(
                change["entity_id"] == provisioned_id
                and change["operation"] == "UPSERT"
                for change in refreshed_snapshot.json()["changes"]
            )
        )

        repeated_archive = self.client.patch(
            f"/api/catalog-products/{product['id']}/archive",
            headers=self.admin_headers,
        )
        self.assertEqual(repeated_archive.status_code, 200, repeated_archive.text)

        missing = self.client.delete(
            "/api/catalog-products/999999", headers=self.admin_headers
        )
        self.assertEqual(missing.status_code, 404, missing.text)
        self.assertEqual(missing.json()["detail"], "CATALOG_PRODUCT_NOT_FOUND")

        # An offline-style queued inventory update remains valid after the
        # catalog source is archived.
        synced_update = self.push(
            [
                {
                    "operation_id": "update-after-catalog-archive",
                    "entity": "product",
                    "entity_id": provisioned_id,
                    "operation": "UPDATE",
                    "base_version": provisioned_version,
                    "payload": {"quantity": 7},
                }
            ]
        )
        self.assertEqual(synced_update.status_code, 200, synced_update.text)
        self.assertEqual(synced_update.json()["results"][0]["status"], "applied")
        self.assertEqual(synced_update.json()["results"][0]["record"]["quantity"], 7)

        # Re-provisioning/refresh keeps historical inventory but does not
        # create another item from the archived catalog source.
        selected_again = self.client.patch(
            "/api/auth/industry",
            headers=self.headers,
            json={"industry_id": self.industry_id},
        )
        self.assertEqual(selected_again.status_code, 200, selected_again.text)
        with SessionLocal() as db:
            existing_count = len(
                list(
                    db.scalars(
                        select(InventoryItem).where(
                            InventoryItem.user_id == self.user_id,
                            InventoryItem.catalog_product_id == product["id"],
                        )
                    )
                )
            )
            self.assertEqual(existing_count, 1)

        new_signup = self.client.post(
            "/api/auth/signup",
            json={
                "first_name": "Catalog",
                "last_name": "New",
                "username": "catalog-new-user",
                "password": "StrongPass123!",
                "device_fingerprint": "catalog-new-device",
            },
        )
        self.assertEqual(new_signup.status_code, 201, new_signup.text)
        new_user_id = new_signup.json()["user"]["id"]
        new_headers = {
            "Authorization": f"Bearer {new_signup.json()['access_token']}",
            "X-Device-Fingerprint": "catalog-new-device",
        }
        new_selected = self.client.patch(
            "/api/auth/industry",
            headers=new_headers,
            json={"industry_id": self.industry_id},
        )
        self.assertEqual(new_selected.status_code, 200, new_selected.text)
        with SessionLocal() as db:
            archived_provision = db.scalar(
                select(InventoryItem).where(
                    InventoryItem.user_id == new_user_id,
                    InventoryItem.catalog_product_id == product["id"],
                )
            )
            self.assertIsNone(archived_provision)

            pre_restore_items = list(
                db.scalars(
                    select(InventoryItem).where(
                        InventoryItem.catalog_product_id == product["id"]
                    )
                )
            )
            pre_restore_snapshots = {
                item.id: {field: getattr(item, field) for field in protected_fields}
                for item in pre_restore_items
            }

        restored = self.client.patch(
            f"/api/catalog-products/{product['id']}/restore",
            headers=self.admin_headers,
        )
        self.assertEqual(restored.status_code, 200, restored.text)
        self.assertTrue(restored.json()["is_active"])

        # Restore provisions the user who joined while archived, but preserves
        # and never duplicates the two existing assignments.
        with SessionLocal() as db:
            restored_items = list(
                db.scalars(
                    select(InventoryItem).where(
                        InventoryItem.catalog_product_id == product["id"]
                    )
                )
            )
            self.assertEqual(
                {item.user_id for item in restored_items},
                {self.user_id, second_user_id, new_user_id},
            )
            for item in restored_items:
                if item.id in pre_restore_snapshots:
                    self.assertEqual(
                        {field: getattr(item, field) for field in protected_fields},
                        pre_restore_snapshots[item.id],
                    )
            new_user_item = next(
                item for item in restored_items if item.user_id == new_user_id
            )
            new_user_item_id = new_user_item.id
            unrelated_item = db.scalar(
                select(InventoryItem).where(
                    InventoryItem.catalog_product_id != product["id"]
                )
            )
            unrelated_item_id = unrelated_item.id if unrelated_item else None

        for headers in (self.headers, second_headers, new_headers):
            selected_after_restore = self.client.patch(
                "/api/auth/industry",
                headers=headers,
                json={"industry_id": self.industry_id},
            )
            self.assertEqual(
                selected_after_restore.status_code,
                200,
                selected_after_restore.text,
            )

        with SessionLocal() as db:
            counts_by_user = {
                user_id: len(
                    list(
                        db.scalars(
                            select(InventoryItem).where(
                                InventoryItem.user_id == user_id,
                                InventoryItem.catalog_product_id == product["id"],
                            )
                        )
                    )
                )
                for user_id in (self.user_id, second_user_id, new_user_id)
            }
            self.assertEqual(set(counts_by_user.values()), {1})

        delete_cursor = self.client.get(
            "/api/sync/changes?cursor=0", headers=self.headers
        ).json()["cursor"]
        permanent_delete = self.client.delete(
            f"/api/catalog-products/{product['id']}",
            headers=self.admin_headers,
        )
        self.assertEqual(permanent_delete.status_code, 204, permanent_delete.text)

        with SessionLocal() as db:
            self.assertIsNone(db.get(CatalogProduct, product["id"]))
            self.assertEqual(
                len(
                    list(
                        db.scalars(
                            select(InventoryItem).where(
                                InventoryItem.catalog_product_id == product["id"]
                            )
                        )
                    )
                ),
                0,
            )
            if unrelated_item_id is not None:
                self.assertIsNotNone(db.get(InventoryItem, unrelated_item_id))

        deletion_delta = self.client.get(
            f"/api/sync/changes?cursor={delete_cursor}", headers=self.headers
        )
        self.assertEqual(deletion_delta.status_code, 200, deletion_delta.text)
        self.assertTrue(
            any(
                change["entity_id"] == provisioned_id
                and change["operation"] == "DELETE"
                for change in deletion_delta.json()["changes"]
            )
        )

        offline_update_after_delete = self.push(
            [
                {
                    "operation_id": "offline-update-after-permanent-delete",
                    "entity": "product",
                    "entity_id": provisioned_id,
                    "operation": "UPDATE",
                    "payload": {"quantity": 99},
                }
            ]
        )
        self.assertEqual(
            offline_update_after_delete.status_code,
            200,
            offline_update_after_delete.text,
        )
        self.assertEqual(
            offline_update_after_delete.json()["results"][0]["status"],
            "fatal_error",
        )
        self.assertEqual(
            offline_update_after_delete.json()["results"][0]["error"],
            "PRODUCT_NOT_FOUND",
        )

        new_user_snapshot = self.client.get(
            "/api/sync/changes?cursor=0", headers=new_headers
        )
        self.assertEqual(new_user_snapshot.status_code, 200, new_user_snapshot.text)
        self.assertNotIn(
            new_user_item_id,
            [change["entity_id"] for change in new_user_snapshot.json()["changes"]],
        )

        audit = self.client.get("/api/admin/audit", headers=self.admin_headers)
        self.assertEqual(audit.status_code, 200, audit.text)
        lifecycle_actions = {
            entry["action"]
            for entry in audit.json()
            if (entry.get("metadata") or {}).get("catalog_product_id")
            == product["id"]
        }
        self.assertTrue(
            {"catalog.archived", "catalog.restored", "catalog.deleted"}
            <= lifecycle_actions
        )

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

        category_denied = self.client.post(
            "/api/categories",
            headers=self.headers,
            json={"name": "Plan-blocked category"},
        )
        self.assertEqual(category_denied.status_code, 403, category_denied.text)
        self.assertEqual(
            category_denied.json()["detail"],
            "CAPABILITY_REQUIRED:categories.write",
        )

        subscribed_plan_delete = self.client.delete(
            "/api/admin/plans/test_release_plan", headers=self.admin_headers
        )
        self.assertEqual(subscribed_plan_delete.status_code, 409, subscribed_plan_delete.text)
        self.assertEqual(subscribed_plan_delete.json()["detail"], "PLAN_HAS_SUBSCRIBERS")

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

        deleted_plan = self.client.delete(
            "/api/admin/plans/test_release_plan", headers=self.admin_headers
        )
        self.assertEqual(deleted_plan.status_code, 204, deleted_plan.text)

    def test_delete_catalog_product_6_permanently_removes_dependencies(self) -> None:
        with SessionLocal() as db:
            catalog = CatalogProduct(
                id=6,
                industry_id=self.industry_id,
                name="Original failing catalog six",
                is_shared=True,
                is_active=True,
            )
            db.add(catalog)
            db.flush()
            item = InventoryItem(
                user_id=self.user_id,
                catalog_product_id=catalog.id,
                is_catalog_backed=True,
                quantity=12,
                price=345,
                custom_label="Preserved six",
                note="must survive",
                low_stock_threshold=4,
                low_stock_alert=True,
            )
            db.add(item)
            db.flush()
            transaction = InventoryTransaction(
                user_id=self.user_id,
                inventory_item_id=item.id,
                type="stock_in",
                quantity=2,
                before_quantity=10,
                after_quantity=12,
            )
            db.add(transaction)
            db.commit()
            db.refresh(item)
            item_id = item.id
            transaction_id = transaction.id

        response = self.client.delete(
            "/api/catalog-products/6", headers=self.admin_headers
        )
        self.assertEqual(response.status_code, 204, response.text)

        with SessionLocal() as db:
            catalog = db.get(CatalogProduct, 6)
            item = db.get(InventoryItem, item_id)
            self.assertIsNone(catalog)
            self.assertIsNone(item)
            self.assertIsNone(db.get(InventoryTransaction, transaction_id))
            tombstone = db.scalar(
                select(SyncChange).where(
                    SyncChange.user_id == self.user_id,
                    SyncChange.entity_id == item_id,
                    SyncChange.operation == "DELETE",
                )
            )
            self.assertIsNotNone(tombstone)

    def test_permanent_catalog_delete_rolls_back_every_dependency(self) -> None:
        with SessionLocal() as db:
            catalog = CatalogProduct(
                industry_id=self.industry_id,
                name="Atomic rollback catalog",
                is_shared=True,
                is_active=True,
            )
            db.add(catalog)
            db.flush()
            item = InventoryItem(
                user_id=self.user_id,
                catalog_product_id=catalog.id,
                is_catalog_backed=True,
                quantity=8,
            )
            db.add(item)
            db.commit()
            catalog_id = catalog.id
            item_id = item.id

        with SessionLocal() as db:
            actor = db.get(User, self.admin_user_id)
            with patch(
                "app.repositories.catalog_products.permanently_delete_catalog_product",
                side_effect=RuntimeError("injected delete failure"),
            ):
                with self.assertRaisesRegex(RuntimeError, "injected delete failure"):
                    catalog_product_service.permanently_delete_catalog_product(
                        db,
                        catalog_id,
                        actor,
                    )

        with SessionLocal() as db:
            self.assertIsNotNone(db.get(CatalogProduct, catalog_id))
            restored_item = db.get(InventoryItem, item_id)
            self.assertIsNotNone(restored_item)
            self.assertEqual(restored_item.quantity, 8)

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
