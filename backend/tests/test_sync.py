import json
import os
import tempfile
import unittest
import uuid
import hashlib
from unittest.mock import patch
from datetime import datetime, timedelta, timezone
from pathlib import Path


def _mobile(seed: str) -> str:
    digits = int(hashlib.sha256(seed.encode()).hexdigest()[:12], 16) % 1_000_000_000
    return f"09{digits:09d}"

_database_path = Path(tempfile.mktemp(suffix="-inventory-test.db"))
os.environ["DATABASE_URL"] = f"sqlite:///{_database_path.as_posix()}"
os.environ["ENVIRONMENT"] = "test"
os.environ["SYSTEM_ADMIN_PASSWORD"] = "Test-only-system-admin-password-123!"

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import (
    CatalogProduct,
    Counterparty,
    Industry,
    InventoryItem,
    InventoryMovement,
    InventoryTransaction,
    Invoice,
    InvoiceLine,
    ProductBarcode,
    SyncChange,
    SyncOperation,
    Store,
    StoreMembership,
    StorePlanGrant,
    SubscriptionPlan,
    User,
    UserSession,
)
from app.services import catalog_product_service
from app.services.bootstrap_service import ensure_system_admin
from app.services.store_service import create_owner_store
from app.services.subscription_service import seed_default_plans
from app.services.subscription_service import entitlement_for_store
from app.entitlements import SUBSCRIPTION_CAPABILITIES


class SyncApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        # SQLite remains an isolated test backend only. Production schema
        # management is exclusively Alembic/PostgreSQL.
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            seed_default_plans(db)
            ensure_system_admin(db)

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
                "phone": _mobile("offline-sync-test"),
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
            "X-Client-Data-Schema": "2",
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
        with SessionLocal() as db:
            user = db.get(User, cls.user_id)
            store = user.store_memberships[0].store
            user.plan = store.plan = "pro"
            db.commit()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client.close()
        engine.dispose()
        _database_path.unlink(missing_ok=True)

    def setUp(self) -> None:
        # Sync contract tests run under a cloud-enabled owner plan. Individual
        # downgrade/expiry tests override this state explicitly after setup.
        with SessionLocal() as db:
            user = db.get(User, self.user_id)
            store = user.store_memberships[0].store
            user.plan = store.plan = "pro"
            user.subscription_started_at = store.subscription_started_at = None
            user.subscription_expires_at = store.subscription_expires_at = None
            db.commit()

    def push(self, operations: list[dict], files=None):
        return self.client.post(
            "/api/sync/batch",
            headers=self.headers,
            data={"operations_json": json.dumps({"operations": operations})},
            files=files,
        )

    def test_non_applied_command_log_uses_safe_operation_context(self) -> None:
        operation_id = "release-log-missing-product"
        with self.assertLogs("tanzim.sync", level="WARNING") as captured:
            response = self.push([{
                "operation_id": operation_id,
                "entity": "product",
                "entity_id": 9_090_909_091,
                "operation": "UPDATE",
                "payload": {"quantity": 987_654_321, "custom_label": "must-not-be-logged"},
            }])
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["results"][0]["status"], "fatal_error")
        log = "\n".join(captured.output)
        self.assertIn(operation_id, log)
        self.assertIn("entity=product", log)
        self.assertIn("status=fatal_error", log)
        self.assertNotIn("must-not-be-logged", log)
        self.assertNotIn("987654321", log)

    def test_atomic_invoice_post_replay_cancel_and_price_snapshots(self) -> None:
        product_id = 1_700_000_095_001
        invoice_id = 1_700_000_095_002
        created = self.push([{
            "operation_id": "invoice-product-create", "entity": "product",
            "entity_id": product_id, "operation": "CREATE",
            "payload": {"quantity": 5, "sale_price": 900, "purchase_price": 600,
                        "custom_label": "Invoice product", "catalog_product": {"id": 0, "name": "Invoice product"}},
        }])
        self.assertEqual(created.json()["results"][0]["status"], "applied", created.text)
        post = {
            "operation_id": "invoice-purchase-post", "entity": "invoice",
            "entity_id": invoice_id, "operation": "CREATE",
            "payload": {"invoice_type": "purchase", "title": "Purchase one", "counterparty": "Synthetic",
                        "lines": [{"product_id": product_id, "quantity": 2, "unit": "unit", "pack_size": None, "unit_price": 500}]},
        }
        first = self.push([post])
        self.assertEqual(first.json()["results"][0]["status"], "applied", first.text)
        self.assertEqual(first.json()["results"][0]["record"]["products"][0]["quantity"], 7)
        self.assertEqual(self.push([post]).json()["results"], first.json()["results"])
        with SessionLocal() as db:
            product = db.get(InventoryItem, product_id)
            invoice = db.get(Invoice, invoice_id)
            self.assertEqual((product.quantity, product.sale_price, product.purchase_price), (7, 900, 600))
            self.assertEqual((invoice.total_amount, len(invoice.lines), invoice.lines[0].product_name), (1000, 1, "Invoice product"))
            product.custom_label = "Renamed later"
            product.is_hidden = True
            db.commit()
        history = self.client.get(f"/api/invoices/{invoice_id}", headers=self.headers)
        self.assertEqual(history.status_code, 200, history.text)
        self.assertEqual(history.json()["lines"][0]["product_name"], "Invoice product")
        isolated = self.client.post("/api/auth/signup", json={
            "username": "invoice-isolated-owner", "phone": _mobile("invoice-isolated-owner"),
            "password": "StrongPass123!", "device_fingerprint": "invoice-isolated-device",
        })
        self.assertEqual(isolated.status_code, 201, isolated.text)
        isolated_headers = {
            "Authorization": f"Bearer {isolated.json()['access_token']}",
            "X-Device-Fingerprint": "invoice-isolated-device",
        }
        self.assertEqual(self.client.get(f"/api/invoices/{invoice_id}", headers=isolated_headers).status_code, 404)
        cancel = {"operation_id": "invoice-purchase-cancel", "entity": "invoice", "entity_id": invoice_id,
                  "operation": "UPDATE", "payload": {"action": "cancel"}}
        cancelled = self.push([cancel])
        self.assertEqual(cancelled.json()["results"][0]["status"], "applied", cancelled.text)
        self.assertEqual(cancelled.json()["results"][0]["record"]["products"][0]["quantity"], 5)
        self.assertEqual(self.push([cancel]).json()["results"], cancelled.json()["results"])
        second_cancel = self.push([{**cancel, "operation_id": "invoice-second-cancel"}]).json()["results"][0]
        self.assertEqual((second_cancel["status"], second_cancel["error"]), ("conflict", "INVOICE_ALREADY_CANCELLED"))
        with SessionLocal() as db:
            self.assertEqual(db.query(Invoice).filter_by(id=invoice_id).count(), 1)
            self.assertEqual(db.query(InvoiceLine).filter_by(invoice_id=invoice_id).count(), 1)
            self.assertEqual(db.get(InventoryItem, product_id).quantity, 5)

    def test_counterparties_are_store_scoped_and_invoice_uses_server_snapshot(self) -> None:
        created = self.client.post("/api/counterparties", headers=self.headers, json={
            "kind": "organization",
            "name": "Server trusted customer",
            "phone": "09120001234",
            "address": "Tehran",
        })
        self.assertEqual(created.status_code, 201, created.text)
        counterparty_id = created.json()["id"]
        rows = self.client.get("/api/counterparties", headers=self.headers).json()
        self.assertTrue(any(row["id"] == counterparty_id and row["name"] == "Server trusted customer" for row in rows))

        updated = self.client.patch(f"/api/counterparties/{counterparty_id}", headers=self.headers, json={"phone": "02112345678"})
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()["phone"], "02112345678")

        isolated = self.client.post("/api/auth/signup", json={
            "username": "counterparty-isolated-owner",
            "phone": _mobile("counterparty-isolated-owner"),
            "password": "StrongPass123!",
            "device_fingerprint": "counterparty-isolated-device",
        })
        self.assertEqual(isolated.status_code, 201, isolated.text)
        isolated_headers = {
            "Authorization": f"Bearer {isolated.json()['access_token']}",
            "X-Device-Fingerprint": "counterparty-isolated-device",
        }
        self.assertEqual(self.client.get("/api/counterparties", headers=isolated_headers).json(), [])
        self.assertEqual(self.client.patch(
            f"/api/counterparties/{counterparty_id}",
            headers=isolated_headers,
            json={"name": "Cross-store overwrite"},
        ).status_code, 404)

        product_id = 1_700_000_095_101
        invoice_id = 1_700_000_095_102
        product = self.push([{
            "operation_id": "counterparty-invoice-product",
            "entity": "product",
            "entity_id": product_id,
            "operation": "CREATE",
            "payload": {"quantity": 2, "sale_price": 500, "custom_label": "Counterparty item", "catalog_product": {"id": 0, "name": "Counterparty item"}},
        }])
        self.assertEqual(product.json()["results"][0]["status"], "applied", product.text)
        posted = self.push([{
            "operation_id": "counterparty-invoice-post",
            "entity": "invoice",
            "entity_id": invoice_id,
            "operation": "CREATE",
            "payload": {
                "invoice_type": "sale",
                "title": "Counterparty invoice",
                "counterparty_id": counterparty_id,
                "counterparty": "Spoofed client value",
                "lines": [{"product_id": product_id, "quantity": 1, "unit": "unit", "pack_size": None, "unit_price": 500}],
            },
        }])
        result = posted.json()["results"][0]
        self.assertEqual(result["status"], "applied", posted.text)
        self.assertEqual(result["record"]["invoice"]["counterparty"], "Server trusted customer")
        self.assertEqual(result["record"]["invoice"]["counterparty_id"], counterparty_id)

        deleted = self.client.delete(f"/api/counterparties/{counterparty_id}", headers=self.headers)
        self.assertEqual(deleted.status_code, 204, deleted.text)
        history = self.client.get(f"/api/invoices/{invoice_id}", headers=self.headers)
        self.assertEqual(history.status_code, 200, history.text)
        self.assertEqual(history.json()["counterparty"], "Server trusted customer")
        self.assertIsNone(history.json()["counterparty_id"])
        with SessionLocal() as db:
            self.assertIsNone(db.get(Counterparty, counterparty_id))

    def test_invoice_failure_is_atomic_and_duplicate_rows_consolidate(self) -> None:
        product_id = 1_700_000_096_001
        empty_product_id = 1_700_000_096_010
        self.push([{"operation_id": "invoice-sale-product", "entity": "product", "entity_id": product_id,
                   "operation": "CREATE", "payload": {"quantity": 2, "sale_price": 100,
                   "custom_label": "Sale item", "catalog_product": {"id": 0, "name": "Sale item"}}}])
        self.push([{"operation_id": "invoice-empty-product", "entity": "product", "entity_id": empty_product_id,
                   "operation": "CREATE", "payload": {"quantity": 0, "sale_price": 100,
                   "custom_label": "Empty item", "catalog_product": {"id": 0, "name": "Empty item"}}}])
        failed_id = 1_700_000_096_002
        failed = self.push([{"operation_id": "invoice-insufficient", "entity": "invoice", "entity_id": failed_id,
            "operation": "CREATE", "payload": {"invoice_type": "sale", "title": "Too much",
            "lines": [{"product_id": product_id, "quantity": 1, "unit": "unit", "unit_price": 0},
                      {"product_id": empty_product_id, "quantity": 1, "unit": "unit", "unit_price": 0}]}}]).json()["results"][0]
        self.assertEqual((failed["status"], failed["error"]), ("conflict", "INSUFFICIENT_STOCK"))
        with SessionLocal() as db:
            self.assertIsNone(db.get(Invoice, failed_id))
            self.assertEqual(db.get(InventoryItem, product_id).quantity, 2)
        consolidated_id = failed_id + 1
        applied = self.push([{"operation_id": "invoice-consolidated", "entity": "invoice", "entity_id": consolidated_id,
            "operation": "CREATE", "payload": {"invoice_type": "sale", "title": "Combined",
            "lines": [{"product_id": product_id, "quantity": 1, "unit": "unit", "unit_price": 0},
                      {"product_id": product_id, "quantity": 1, "unit": "unit", "unit_price": 0}]}}]).json()["results"][0]
        self.assertEqual(applied["status"], "applied")
        self.assertEqual(len(applied["record"]["invoice"]["lines"]), 1)
        self.assertEqual(applied["record"]["invoice"]["lines"][0]["quantity"], 2)

        purchase_id = failed_id + 2
        purchase = self.push([{"operation_id": "invoice-reversal-purchase", "entity": "invoice", "entity_id": purchase_id,
            "operation": "CREATE", "payload": {"invoice_type": "purchase", "title": "Reversal source",
            "lines": [{"product_id": product_id, "quantity": 2, "unit": "unit", "unit_price": 100}]}}]).json()["results"][0]
        self.assertEqual(purchase["status"], "applied")
        consumed = self.push([{"operation_id": "invoice-reversal-sale", "entity": "invoice", "entity_id": purchase_id + 1,
            "operation": "CREATE", "payload": {"invoice_type": "sale", "title": "Consumed purchase",
            "lines": [{"product_id": product_id, "quantity": 1, "unit": "unit", "unit_price": 100}]}}]).json()["results"][0]
        self.assertEqual(consumed["status"], "applied")
        refused = self.push([{"operation_id": "invoice-reversal-refused", "entity": "invoice", "entity_id": purchase_id,
            "operation": "UPDATE", "payload": {"action": "cancel"}}]).json()["results"][0]
        self.assertEqual((refused["status"], refused["error"]), ("conflict", "INSUFFICIENT_REVERSAL_STOCK"))
        with SessionLocal() as db:
            self.assertEqual(db.get(InventoryItem, product_id).quantity, 1)
            self.assertEqual(db.get(Invoice, purchase_id).status, "posted")

    def test_invoice_downgrade_preserves_history_and_exact_replay_but_denies_new_effects(self) -> None:
        product_id = 1_700_000_097_001
        invoice_id = 1_700_000_097_002
        self.push([{"operation_id": "downgrade-product", "entity": "product", "entity_id": product_id,
                   "operation": "CREATE", "payload": {"quantity": 3, "sale_price": 100,
                   "custom_label": "Downgrade item", "catalog_product": {"id": 0, "name": "Downgrade item"}}}])
        operation = {"operation_id": "downgrade-invoice", "entity": "invoice", "entity_id": invoice_id,
                     "operation": "CREATE", "payload": {"invoice_type": "sale", "title": "Historical invoice",
                     "lines": [{"product_id": product_id, "quantity": 1, "unit": "unit", "unit_price": 100}]}}
        accepted = self.push([operation]).json()["results"][0]
        self.assertEqual(accepted["status"], "applied")
        with SessionLocal() as db:
            user = db.get(User, self.user_id)
            store = user.store_memberships[0].store
            user.plan = store.plan = "free"
            db.commit()
        try:
            history = self.client.get(f"/api/invoices/{invoice_id}", headers=self.headers)
            self.assertEqual(history.status_code, 200, history.text)
            replay = self.push([operation]).json()["results"][0]
            self.assertEqual(replay, accepted)
            denied = self.push([{**operation, "operation_id": "downgrade-new-invoice", "entity_id": invoice_id + 1}]).json()["results"][0]
            self.assertEqual(denied["status"], "fatal_error")
            self.assertEqual(denied["error"], "CAPABILITY_REQUIRED:sync")
            with SessionLocal() as db:
                self.assertIsNone(db.get(Invoice, invoice_id + 1))
                self.assertEqual(db.get(InventoryItem, product_id).quantity, 2)
        finally:
            with SessionLocal() as db:
                user = db.get(User, self.user_id)
                store = user.store_memberships[0].store
                user.plan = store.plan = "pro"
                db.commit()

    def test_barcode_and_inventory_movements_are_store_scoped_and_idempotent(self) -> None:
        product_id = 1_700_000_090_001
        barcode_id = 1_700_000_090_002
        movement_id = 1_700_000_090_003
        create_product = {
            "operation_id": "barcode-product-create",
            "entity": "product",
            "entity_id": product_id,
            "operation": "CREATE",
            "payload": {
                "quantity": 4,
                "price": 100,
                "custom_label": "Barcode product",
                "low_stock_threshold": 1,
                "low_stock_alert": True,
                "is_hidden": False,
                "catalog_product": {"id": 0, "name": "Barcode product"},
            },
        }
        self.assertEqual(self.push([create_product]).json()["results"][0]["status"], "applied")
        create_barcode = {
            "operation_id": "barcode-create",
            "entity": "barcode",
            "entity_id": barcode_id,
            "operation": "CREATE",
            "payload": {
                "product_id": product_id,
                "value": "TZ-TEST90",
                "source": "tanzim",
                "symbology": "code128",
                "meaning": "package",
                "scan_quantity": 3,
                "is_active": True,
                "is_default": True,
            },
        }
        barcode_result = self.push([create_barcode])
        self.assertEqual(barcode_result.json()["results"][0]["status"], "applied")

        receive = {
            "operation_id": "movement-receive",
            "entity": "inventory_movement",
            "entity_id": movement_id,
            "operation": "CREATE",
            "payload": {
                "product_id": product_id,
                "kind": "receive",
                "delta": 3,
                "scan_source": "hardware",
                "barcode_id": barcode_id,
                "barcode_value": "TZ-TEST90",
                "scan_quantity": 3,
                "before_quantity": 4,
            },
        }
        first = self.push([receive])
        self.assertEqual(first.json()["results"][0]["status"], "applied", first.text)
        self.assertEqual(first.json()["results"][0]["record"]["product"]["quantity"], 7)
        replay = self.push([receive])
        self.assertEqual(replay.json()["results"], first.json()["results"])

        insufficient = self.push([{
            **receive,
            "operation_id": "movement-insufficient",
            "entity_id": movement_id + 1,
            "payload": {**receive["payload"], "kind": "issue", "delta": -30},
        }])
        self.assertEqual(insufficient.json()["results"][0]["status"], "conflict")
        self.assertEqual(insufficient.json()["results"][0]["error"], "INSUFFICIENT_STOCK")

        stale_correction = self.push([{
            **receive,
            "operation_id": "movement-stale-correction",
            "entity_id": movement_id + 2,
            "payload": {**receive["payload"], "kind": "correction", "delta": 5, "before_quantity": 4, "correction_quantity": 9},
        }])
        self.assertEqual(stale_correction.json()["results"][0]["error"], "CORRECTION_STALE")
        with SessionLocal() as db:
            self.assertEqual(db.get(InventoryItem, product_id).quantity, 7)
            self.assertEqual(db.query(InventoryMovement).filter_by(operation_id="movement-receive").count(), 1)
            self.assertEqual(db.get(ProductBarcode, barcode_id).store_id, db.get(InventoryItem, product_id).store_id)

    def test_product_quantity_limit_is_enforced_during_sync_acceptance(self) -> None:
        entity_id = 1_700_000_000_090
        operation_id = "quantity-limit-product"
        result = self.push([{
            "operation_id": operation_id,
            "entity": "product",
            "entity_id": entity_id,
            "operation": "CREATE",
            "payload": {
                "quantity": 1_000_000_001,
                "price": 100,
                "custom_label": "Impossible stock",
                "catalog_product": {"id": 0, "name": "Impossible stock"},
            },
        }]).json()["results"][0]

        self.assertEqual((result["status"], result["error"]), (
            "fatal_error",
            "PRODUCT_QUANTITY_LIMIT_EXCEEDED",
        ))
        with SessionLocal() as db:
            self.assertIsNone(db.get(InventoryItem, entity_id))
            self.assertEqual(db.query(SyncOperation).filter_by(operation_id=operation_id).count(), 1)

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

        reordered_replay = self.push([{
            **create,
            "payload": dict(reversed(list(create["payload"].items()))),
        }])
        self.assertEqual(reordered_replay.status_code, 200, reordered_replay.text)
        self.assertEqual(reordered_replay.json()["results"], first.json()["results"])

        mismatched_replay = self.push([{**create, "payload": {**create["payload"], "quantity": 999}}])
        self.assertEqual(mismatched_replay.status_code, 200, mismatched_replay.text)
        self.assertEqual(mismatched_replay.json()["results"][0]["status"], "fatal_error")
        self.assertEqual(
            mismatched_replay.json()["results"][0]["error"],
            "OPERATION_PAYLOAD_MISMATCH",
        )

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

    def test_historical_operation_without_fingerprint_is_not_assumed_equivalent(self) -> None:
        operation_id = "historical-unverified-operation"
        with SessionLocal() as db:
            store_id = db.get(User, self.user_id).store_memberships[0].store_id
            db.add(SyncOperation(
                store_id=store_id,
                actor_user_id=self.user_id,
                user_id=self.user_id,
                operation_id=operation_id,
                request_fingerprint=None,
                result_payload=json.dumps({
                    "operation_id": operation_id,
                    "status": "applied",
                    "entity_id": 1_700_000_000_019,
                    "record": None,
                    "error": None,
                }),
            ))
            db.commit()

        replay = self.push([{
            "operation_id": operation_id,
            "entity": "product",
            "entity_id": 1_700_000_000_019,
            "operation": "UPDATE",
            "payload": {"quantity": 8},
        }])
        self.assertEqual(replay.status_code, 200, replay.text)
        self.assertEqual(replay.json()["results"][0]["status"], "fatal_error")
        self.assertEqual(
            replay.json()["results"][0]["error"],
            "OPERATION_PAYLOAD_UNVERIFIED",
        )

    def test_rebased_successor_conflicts_after_another_device_advances_version(self) -> None:
        username = f"rebase-device-{uuid.uuid4().hex[:8]}"
        signup = self.client.post("/api/auth/signup", json={
            "first_name": "Rebase", "last_name": "Owner", "username": username,
            "phone": _mobile(username),
            "password": "StrongPass123!", "device_fingerprint": "rebase-device-a",
        })
        self.assertEqual(signup.status_code, 201, signup.text)
        user_id = signup.json()["user"]["id"]
        with SessionLocal() as db:
            user = db.get(User, user_id)
            user.device_limit_mode = "unlimited"
            user.device_limit_override = None
            user.plan = user.store_memberships[0].store.plan = "pro"
            user.industry_id = self.industry_id
            user.store_memberships[0].store.industry_id = self.industry_id
            db.commit()

        second_login = self.client.post("/api/auth/login", json={
            "username": username, "password": "StrongPass123!",
            "device_fingerprint": "rebase-device-b",
        })
        self.assertEqual(second_login.status_code, 200, second_login.text)
        first_headers = {
            "Authorization": f"Bearer {signup.json()['access_token']}",
            "X-Device-Fingerprint": "rebase-device-a",
            "X-Client-Data-Schema": "2",
        }
        second_headers = {
            "Authorization": f"Bearer {second_login.json()['access_token']}",
            "X-Device-Fingerprint": "rebase-device-b",
            "X-Client-Data-Schema": "2",
        }

        def push(headers, operation):
            return self.client.post(
                "/api/sync/batch",
                headers=headers,
                data={"operations_json": json.dumps({"operations": [operation]})},
            )

        entity_id = 1_700_000_000_021
        create = {
            "operation_id": "rebase-create",
            "entity": "product",
            "entity_id": entity_id,
            "operation": "CREATE",
            "payload": {
                "quantity": 1, "price": 10, "custom_label": "Rebase product",
                "catalog_product": {"id": 0, "name": "Rebase product"},
            },
        }
        created = push(first_headers, create)
        self.assertEqual(created.status_code, 200, created.text)
        self.assertEqual(created.json()["results"][0]["status"], "applied", created.text)
        self.assertEqual(created.json()["results"][0]["record"]["version"], 1)

        predecessor = push(first_headers, {
            **create,
            "operation_id": "rebase-predecessor",
            "operation": "UPDATE",
            "base_version": 1,
            "payload": {"quantity": 2, "version": 1},
        })
        self.assertEqual(predecessor.status_code, 200, predecessor.text)
        self.assertEqual(predecessor.json()["results"][0]["status"], "applied", predecessor.text)
        self.assertEqual(predecessor.json()["results"][0]["record"]["version"], 2)

        other_device = push(second_headers, {
            **create,
            "operation_id": "rebase-other-device",
            "operation": "UPDATE",
            "base_version": 2,
            "payload": {"quantity": 9, "version": 2},
        })
        self.assertEqual(other_device.status_code, 200, other_device.text)
        self.assertEqual(other_device.json()["results"][0]["status"], "applied", other_device.text)
        self.assertEqual(other_device.json()["results"][0]["record"]["version"], 3)

        successor = push(first_headers, {
            **create,
            "operation_id": "rebase-successor",
            "operation": "UPDATE",
            # The client rebases B only to A's accepted version. It must not
            # adopt the other device's later version and bypass the conflict.
            "base_version": 2,
            "payload": {"quantity": 3, "version": 2},
        })
        result = successor.json()["results"][0]
        self.assertEqual(result["status"], "conflict")
        self.assertEqual(result["record"]["quantity"], 9)
        self.assertEqual(result["record"]["version"], 3)

    def test_partial_batch_failure_preserves_and_replays_committed_results(self) -> None:
        entity_id = 1_700_000_000_020
        operations = [
            {
                "operation_id": "partial-valid-create",
                "entity": "product",
                "entity_id": entity_id,
                "operation": "CREATE",
                "payload": {
                    "quantity": 4,
                    "price": 100,
                    "custom_label": "Partial batch product",
                    "low_stock_threshold": 1,
                    "low_stock_alert": True,
                    "is_hidden": False,
                    "catalog_product": {"id": 0, "name": "Partial batch product"},
                },
            },
            {
                "operation_id": "partial-invalid-update",
                "entity": "product",
                "entity_id": 1_700_000_000_021,
                "operation": "UPDATE",
                "payload": {"quantity": 99},
            },
        ]

        first = self.push(operations)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(
            [result["status"] for result in first.json()["results"]],
            ["applied", "fatal_error"],
        )
        self.assertEqual(
            first.json()["results"][1]["error"],
            "PRODUCT_NOT_FOUND",
        )

        replay = self.push(operations)
        self.assertEqual(replay.status_code, 200, replay.text)
        self.assertEqual(replay.json()["results"], first.json()["results"])

        snapshot = self.client.get("/api/sync/changes?cursor=0", headers=self.headers)
        self.assertEqual(snapshot.status_code, 200, snapshot.text)
        self.assertEqual(
            [
                change["entity_id"]
                for change in snapshot.json()["changes"]
                if change["entity_id"] == entity_id
            ],
            [entity_id],
        )

    def test_labels_are_idempotent_user_owned_and_assignable(self) -> None:
        label_id = 1_710_000_000_001
        label_operation = {
            "operation_id": "create-label-1",
            "entity": "label",
            "entity_id": label_id,
            "operation": "CREATE",
            "payload": {"name": "  ویژه  "},
        }
        first = self.push([label_operation])
        replay = self.push([label_operation])
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.json(), replay.json())
        self.assertEqual(first.json()["results"][0]["record"]["name"], "ویژه")

        entity_id = 1_710_000_000_002
        product = self.push([{
            "operation_id": "create-labeled-product-1",
            "entity": "product",
            "entity_id": entity_id,
            "operation": "CREATE",
            "payload": {
                "quantity": 1, "price": 2, "custom_label": "Labeled",
                "label_ids": [label_id],
                "catalog_product": {"id": 0, "name": "Labeled"},
            },
        }])
        self.assertEqual(product.status_code, 200, product.text)
        self.assertEqual(product.json()["results"][0]["record"]["label_ids"], [label_id])

        signup = self.client.post("/api/auth/signup", json={
            "first_name": "Label", "last_name": "Tenant", "username": "label-tenant-test",
            "phone": _mobile("label-tenant-test"),
            "password": "StrongPass123!", "device_fingerprint": "label-tenant-device",
        })
        other_headers = {
            "Authorization": f"Bearer {signup.json()['access_token']}",
            "X-Device-Fingerprint": "label-tenant-device",
            "X-Client-Data-Schema": "2",
        }
        labels = self.client.get("/api/labels", headers=other_headers)
        self.assertEqual(labels.status_code, 200, labels.text)
        self.assertEqual(labels.json(), [])

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

        mismatched_image_replay = self.push(
            [create],
            files=[("files", (operation_id, b"different-webp-content", "image/webp"))],
        )
        self.assertEqual(mismatched_image_replay.status_code, 200, mismatched_image_replay.text)
        self.assertEqual(
            mismatched_image_replay.json()["results"][0]["error"],
            "OPERATION_PAYLOAD_MISMATCH",
        )

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
            source_user = db.get(User, self.user_id)
            dependent_stores = []
            for index in range(100):
                dependent = User(
                    first_name="Lifecycle",
                    last_name=f"User {index}",
                    username=f"catalog-lifecycle-user-{index}",
                    hashed_password=source_user.hashed_password,
                    plan="free",
                    is_active=True,
                )
                db.add(dependent)
                db.flush()
                context = create_owner_store(db, dependent)
                context.store.industry_id = isolated_industry.id
                dependent.industry_id = isolated_industry.id
                dependent_stores.append(context.store)
            db.add_all(
                InventoryItem(
                    store_id=store.id,
                    user_id=store.owner_user_id,
                    catalog_product_id=catalog.id,
                    is_catalog_backed=True,
                    quantity=index,
                )
                for index, store in enumerate(dependent_stores)
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
                "phone": _mobile("catalog-existing-user"),
                "password": "StrongPass123!",
                "device_fingerprint": "catalog-existing-device",
            },
        )
        self.assertEqual(second_signup.status_code, 201, second_signup.text)
        second_user_id = second_signup.json()["user"]["id"]
        second_headers = {
            "Authorization": f"Bearer {second_signup.json()['access_token']}",
            "X-Device-Fingerprint": "catalog-existing-device",
            "X-Client-Data-Schema": "2",
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

        archive_cursor = self.client.get(
            "/api/sync/changes?cursor=0", headers=self.headers
        ).json()["cursor"]
        archived = self.client.patch(
            f"/api/catalog-products/{product['id']}/archive",
            headers=self.admin_headers,
        )
        self.assertEqual(archived.status_code, 200, archived.text)
        self.assertFalse(archived.json()["is_active"])

        archive_delta = self.client.get(
            f"/api/sync/changes?cursor={archive_cursor}", headers=self.headers
        )
        self.assertEqual(archive_delta.status_code, 200, archive_delta.text)
        archived_change = next(
            change for change in archive_delta.json()["changes"]
            if change["entity_id"] == provisioned_id
        )
        self.assertEqual(archived_change["operation"], "UPSERT")
        self.assertFalse(archived_change["record"]["catalog_product"]["is_active"])

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
                "phone": _mobile("catalog-new-user"),
                "password": "StrongPass123!",
                "device_fingerprint": "catalog-new-device",
            },
        )
        self.assertEqual(new_signup.status_code, 201, new_signup.text)
        new_user_id = new_signup.json()["user"]["id"]
        new_headers = {
            "Authorization": f"Bearer {new_signup.json()['access_token']}",
            "X-Device-Fingerprint": "catalog-new-device",
            "X-Client-Data-Schema": "2",
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
        self.assertEqual(new_user_snapshot.status_code, 403, new_user_snapshot.text)
        self.assertEqual(new_user_snapshot.json()["detail"], "CAPABILITY_REQUIRED:sync")

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
                "price_toman": None,
                "duration": None,
                "duration_unit": None,
                "is_offer_available": False,
                "is_active": True,
                "features": {key: key in {"inventory.read", "inventory.write"} for key in SUBSCRIPTION_CAPABILITIES},
                "limits": {"inventory_items": 10, "catalog_items": 10, "devices": None, "active_personnel": 0},
                "reason": "Automated policy test",
            },
        )
        self.assertEqual(created_plan.status_code, 201, created_plan.text)
        created_policy = created_plan.json()

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
            json={
                "expected_revision": created_policy["policy_revision"],
                "reason": "Disable writes in automated policy test",
                "features": {**created_policy["features"], "inventory.write": False},
            },
        )
        self.assertEqual(changed_plan.status_code, 200, changed_plan.text)
        stale_plan = self.client.patch(
            "/api/admin/plans/test_release_plan", headers=self.admin_headers,
            json={
                "expected_revision": created_policy["policy_revision"],
                "reason": "Stale concurrent administrator update",
                "name": "Must not win",
            },
        )
        self.assertEqual(stale_plan.status_code, 409, stale_plan.text)
        self.assertEqual(stale_plan.json()["detail"], "PLAN_REVISION_CONFLICT")
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

    def test_admin_managed_toman_offer_is_authoritative_and_checkout_stays_disabled(self) -> None:
        plans = self.client.get("/api/admin/plans", headers=self.admin_headers)
        pro = next(item for item in plans.json() if item["id"] == "pro")
        denied = self.client.patch(
            "/api/admin/plans/pro", headers=self.headers,
            json={"expected_revision": pro["policy_revision"], "reason": "Unauthorized price edit", "price_toman": 125_000},
        )
        self.assertEqual(denied.status_code, 403, denied.text)
        configured = self.client.patch(
            "/api/admin/plans/pro", headers=self.admin_headers,
            json={
                "expected_revision": pro["policy_revision"], "reason": "Configure synthetic paid offer",
                "price_toman": 125_000, "duration": 1, "duration_unit": "month",
                "is_offer_available": True,
            },
        )
        self.assertEqual(configured.status_code, 200, configured.text)
        self.assertEqual(configured.json()["price_toman"], 125_000)
        self.assertEqual(configured.json()["price_minor"], 1_250_000)
        offer = self.client.get("/api/plans/pro/offer", headers=self.headers)
        self.assertEqual(offer.status_code, 200, offer.text)
        self.assertEqual(offer.json()["amount_toman"], 125_000)
        self.assertEqual(offer.json()["currency"], "TOMAN")
        self.assertFalse(offer.json()["checkout_available"])
        self.assertEqual(offer.json()["checkout_status"], "PAYMENT_PROVIDER_NOT_CONFIGURED")
        stale = self.client.patch(
            "/api/admin/plans/pro", headers=self.admin_headers,
            json={"expected_revision": pro["policy_revision"], "reason": "Stale price must lose", "price_toman": 200_000},
        )
        self.assertEqual(stale.status_code, 409, stale.text)

    def test_delete_catalog_product_6_permanently_removes_dependencies(self) -> None:
        with SessionLocal() as db:
            store_id = db.get(User, self.user_id).store_memberships[0].store_id
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
                store_id=store_id,
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
                store_id=store_id,
                actor_user_id=self.user_id,
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
            store_id = db.get(User, self.user_id).store_memberships[0].store_id
            catalog = CatalogProduct(
                industry_id=self.industry_id,
                name="Atomic rollback catalog",
                is_shared=True,
                is_active=True,
            )
            db.add(catalog)
            db.flush()
            item = InventoryItem(
                store_id=store_id,
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

    def test_v1_device_policy_extension_does_not_activate_a_restriction(self) -> None:
        limited = self.client.patch(
            f"/api/admin/users/{self.user_id}/device-policy",
            headers=self.admin_headers,
            json={"mode": "limited", "limit": 2},
        )
        self.assertEqual(limited.status_code, 409, limited.text)
        self.assertEqual(limited.json()["detail"], "DEVICE_RESTRICTION_NOT_AVAILABLE_V1")
        second = self.client.post("/api/auth/login", json={
            "username": "offline-sync-test", "password": "StrongPass123!",
            "device_fingerprint": "sync-test-device-2",
        })
        self.assertEqual(second.status_code, 200, second.text)
        unrestricted = self.client.post("/api/auth/login", json={
            "username": "offline-sync-test", "password": "StrongPass123!",
            "device_fingerprint": "sync-test-device-3",
        })
        self.assertEqual(unrestricted.status_code, 200, unrestricted.text)
        still_valid = self.client.get("/api/auth/me", headers=self.headers)
        self.assertEqual(still_valid.status_code, 200, still_valid.text)

        unlimited = self.client.patch(
            f"/api/admin/users/{self.user_id}/device-policy",
            headers=self.admin_headers,
            json={"mode": "unlimited", "limit": None},
        )
        self.assertEqual(unlimited.status_code, 200, unlimited.text)
        admitted = self.client.post("/api/auth/login", json={
            "username": "offline-sync-test", "password": "StrongPass123!",
            "device_fingerprint": "sync-test-device-4",
        })
        self.assertEqual(admitted.status_code, 200, admitted.text)

    def test_resource_ownership_blocks_cross_user_access(self) -> None:
        signup = self.client.post(
            "/api/auth/signup",
            json={
                "first_name": "Second",
                "last_name": "Tenant",
                "username": "second-tenant-test",
                "phone": _mobile("second-tenant-test"),
                "password": "StrongPass123!",
                "device_fingerprint": "second-tenant-device",
            },
        )
        self.assertEqual(signup.status_code, 201, signup.text)
        other_headers = {
            "Authorization": f"Bearer {signup.json()['access_token']}",
            "X-Device-Fingerprint": "second-tenant-device",
            "X-Client-Data-Schema": "2",
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
        self.assertEqual(blocked.json()["detail"], "ENTITLEMENT_EXPIRED")

        with SessionLocal() as db:
            user = db.query(User).filter(User.username == "offline-sync-test").one()
            user.plan = "free"
            user.subscription_expires_at = None
            db.commit()

    def test_subscription_expiry_replay_and_renewal_preserve_identity_and_data(self) -> None:
        product_id = 1_700_000_098_001
        rejected_product_id = product_id + 1
        operation = {
            "operation_id": "lifecycle-accepted-before-expiry",
            "entity": "product",
            "entity_id": product_id,
            "operation": "CREATE",
            "payload": {
                "quantity": 4,
                "sale_price": 250,
                "custom_label": "Lifecycle retained product",
                "low_stock_threshold": 0,
                "low_stock_alert": False,
                "is_hidden": False,
                "catalog_product": {"id": 0, "name": "Lifecycle retained product"},
            },
        }
        rejected = {
            **operation,
            "operation_id": "lifecycle-rejected-at-expiry",
            "entity_id": rejected_product_id,
        }
        expiration = datetime.now(timezone.utc) + timedelta(minutes=5)
        with SessionLocal() as db:
            user = db.get(User, self.user_id)
            store = db.scalar(select(Store).where(Store.owner_user_id == self.user_id))
            user.plan = store.plan = "pro"
            user.subscription_expires_at = store.subscription_expires_at = expiration
            self.assertEqual(entitlement_for_store(db, store, as_of=expiration)["status"], "expired")
            db.commit()

        try:
            accepted = self.push([operation]).json()["results"][0]
            self.assertEqual(accepted["status"], "applied")

            with SessionLocal() as db:
                user = db.get(User, self.user_id)
                store = db.scalar(select(Store).where(Store.owner_user_id == self.user_id))
                expired_at = datetime.now(timezone.utc) - timedelta(seconds=1)
                user.subscription_expires_at = store.subscription_expires_at = expired_at
                db.commit()

            # A lost response resolves from the committed operation before the
            # current entitlement is evaluated, with no duplicate effect.
            self.assertEqual(self.push([operation]).json()["results"][0], accepted)
            denied = self.push([rejected]).json()["results"][0]
            self.assertEqual((denied["status"], denied["error"]), ("fatal_error", "ENTITLEMENT_EXPIRED"))

            with SessionLocal() as db:
                user = db.get(User, self.user_id)
                store = db.scalar(select(Store).where(Store.owner_user_id == self.user_id))
                renewed_until = datetime.now(timezone.utc) + timedelta(days=1)
                user.subscription_expires_at = store.subscription_expires_at = renewed_until
                db.commit()

            # Renewal does not reinterpret the terminal operation. A newly
            # approved action needs a new identity and remains distinguishable.
            self.assertEqual(self.push([rejected]).json()["results"][0], denied)
            approved_new_action = self.push([{
                **rejected,
                "operation_id": "lifecycle-approved-after-renewal",
            }]).json()["results"][0]
            self.assertEqual(approved_new_action["status"], "applied")

            with SessionLocal() as db:
                self.assertEqual(db.get(InventoryItem, product_id).quantity, 4)
                self.assertEqual(db.get(InventoryItem, rejected_product_id).quantity, 4)
                self.assertEqual(db.query(SyncOperation).filter(
                    SyncOperation.operation_id.in_([
                        operation["operation_id"],
                        rejected["operation_id"],
                        "lifecycle-approved-after-renewal",
                    ])
                ).count(), 3)
        finally:
            with SessionLocal() as db:
                user = db.get(User, self.user_id)
                store = db.scalar(select(Store).where(Store.owner_user_id == self.user_id))
                user.plan = store.plan = "free"
                user.subscription_started_at = store.subscription_started_at = None
                user.subscription_expires_at = store.subscription_expires_at = None
                db.commit()

    def test_recorded_operation_resolution_requires_restored_membership_and_never_reapplies(self) -> None:
        product_id = 1_700_000_098_101
        operation_id = "lifecycle-resolution-after-restored-access"
        operation = {
            "operation_id": operation_id,
            "entity": "product",
            "entity_id": product_id,
            "operation": "CREATE",
            "payload": {
                "quantity": 6,
                "sale_price": 300,
                "custom_label": "Resolution retained product",
                "low_stock_threshold": 0,
                "low_stock_alert": False,
                "is_hidden": False,
                "catalog_product": {"id": 0, "name": "Resolution retained product"},
            },
        }
        accepted = self.push([operation]).json()["results"][0]
        self.assertEqual(accepted["status"], "applied")

        with SessionLocal() as db:
            membership = db.scalar(select(StoreMembership).where(
                StoreMembership.user_id == self.user_id,
                StoreMembership.is_owner.is_(True),
            ))
            membership.status = "inactive"
            db.commit()

        try:
            blocked = self.client.get(f"/api/sync/operations/{operation_id}", headers=self.headers)
            self.assertEqual(blocked.status_code, 403, blocked.text)
            self.assertEqual(blocked.json()["detail"], "STORE_MEMBERSHIP_INACTIVE")

            with SessionLocal() as db:
                membership = db.scalar(select(StoreMembership).where(
                    StoreMembership.user_id == self.user_id,
                    StoreMembership.is_owner.is_(True),
                ))
                membership.status = "active"
                db.commit()

            resolved = self.client.get(f"/api/sync/operations/{operation_id}", headers=self.headers)
            self.assertEqual(resolved.status_code, 200, resolved.text)
            self.assertEqual(resolved.json(), accepted)
            missing = self.client.get("/api/sync/operations/not-recorded", headers=self.headers)
            self.assertEqual(missing.status_code, 404, missing.text)
            self.assertEqual(missing.json()["detail"], "SYNC_OPERATION_NOT_RECORDED")

            with SessionLocal() as db:
                self.assertEqual(db.get(InventoryItem, product_id).quantity, 6)
                self.assertEqual(db.query(SyncOperation).filter_by(operation_id=operation_id).count(), 1)
        finally:
            with SessionLocal() as db:
                membership = db.scalar(select(StoreMembership).where(
                    StoreMembership.user_id == self.user_id,
                    StoreMembership.is_owner.is_(True),
                ))
                membership.status = "active"
                db.commit()

    def test_team_mode_requires_current_policy_and_preserves_historical_replay(self) -> None:
        suffix = uuid.uuid4().hex[:8]
        signup = self.client.post("/api/auth/signup", json={
            "first_name": "Mode", "last_name": "Owner", "username": f"mode-{suffix}",
            "phone": _mobile(f"mode-{suffix}"),
            "password": "StrongPass123!", "device_fingerprint": f"mode-device-{suffix}",
        })
        self.assertEqual(signup.status_code, 201, signup.text)
        owner_id = signup.json()["user"]["id"]
        headers = {
            "Authorization": f"Bearer {signup.json()['access_token']}",
            "X-Device-Fingerprint": f"mode-device-{suffix}",
            "X-Client-Data-Schema": "2",
        }
        with SessionLocal() as db:
            owner = db.get(User, owner_id)
            owner.plan = "vip"
            db.commit()
        selected = self.client.patch("/api/auth/industry", headers=headers, json={"industry_id": self.industry_id})
        self.assertEqual(selected.status_code, 200, selected.text)

        product_id = 1_800_000_000_000 + owner_id
        historical = {
            "operation_id": f"historical-{suffix}", "entity": "product",
            "entity_id": product_id, "operation": "CREATE",
            "payload": {
                "quantity": 1, "price": 100, "custom_label": "Historical",
                "low_stock_threshold": 0, "low_stock_alert": False,
                "is_hidden": False,
                "catalog_product": {"id": 0, "name": "Historical"},
            },
        }
        first = self.client.post("/api/sync/batch", headers=headers, data={
            "operations_json": json.dumps({"operations": [historical]}),
        })
        self.assertEqual(first.json()["results"][0]["status"], "applied", first.text)

        mode = self.client.get("/api/store/operating-mode", headers=headers).json()
        transition_id = str(uuid.uuid4())
        activated = self.client.post("/api/store/operating-mode/activate-team", headers=headers, json={
            "expected_policy_version": mode["policy_version"], "transition_id": transition_id,
        })
        self.assertEqual(activated.status_code, 200, activated.text)
        policy_version = activated.json()["policy_version"]

        replay = self.client.post("/api/sync/batch", headers=headers, data={
            "operations_json": json.dumps({"operations": [historical]}),
        })
        self.assertEqual(replay.json()["results"], first.json()["results"])

        missing_context = {**historical, "operation_id": f"missing-{suffix}", "operation": "UPDATE", "payload": {"version": 1, "quantity": 2}}
        rejected = self.client.post("/api/sync/batch", headers=headers, data={
            "operations_json": json.dumps({"operations": [missing_context]}),
        })
        self.assertEqual(rejected.json()["results"][0]["status"], "fatal_error")
        self.assertEqual(rejected.json()["results"][0]["error"], "STORE_POLICY_CONTEXT_REQUIRED")
        rejected_replay = self.client.post("/api/sync/batch", headers=headers, data={
            "operations_json": json.dumps({"operations": [missing_context]}),
        })
        self.assertEqual(rejected_replay.json()["results"], rejected.json()["results"])

        stale = {**missing_context, "operation_id": f"stale-{suffix}", "execution_mode": "team", "policy_version": policy_version - 1}
        stale_result = self.client.post("/api/sync/batch", headers=headers, data={
            "operations_json": json.dumps({"operations": [stale]}),
        })
        self.assertEqual(stale_result.json()["results"][0]["error"], "STORE_POLICY_STALE")

        accepted = {**missing_context, "operation_id": f"accepted-{suffix}", "execution_mode": "team", "policy_version": policy_version}
        result = self.client.post("/api/sync/batch", headers=headers, data={
            "operations_json": json.dumps({"operations": [accepted]}),
        })
        self.assertEqual(result.json()["results"][0]["status"], "applied", result.text)
        # Treat the first response as lost and recreate the HTTP client. The
        # exact immutable request must resolve from sync history without a
        # second domain effect.
        with TestClient(app) as restarted_client:
            replay_after_restart = restarted_client.post("/api/sync/batch", headers=headers, data={
                "operations_json": json.dumps({"operations": [accepted]}),
            })
        self.assertEqual(replay_after_restart.json()["results"], result.json()["results"])
        with SessionLocal() as db:
            self.assertEqual(db.get(InventoryItem, product_id).quantity, 2)
            self.assertEqual(db.query(SyncOperation).filter_by(
                actor_user_id=owner_id,
                operation_id=accepted["operation_id"],
            ).count(), 1)
        direct = self.client.patch(f"/api/products/{product_id}", headers=headers, data={"quantity": 3})
        self.assertEqual(direct.status_code, 409, direct.text)

        with SessionLocal() as db:
            store = db.scalar(select(Store).where(Store.owner_user_id == owner_id))
            owner = db.get(User, owner_id)
            owner.subscription_expires_at = datetime.now(timezone.utc) - timedelta(days=1)
            db.commit()
            self.assertEqual(store.operating_mode, "team")

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

    def test_entitlement_registry_plan_revision_and_time_bounded_grant(self) -> None:
        registry = self.client.get("/api/admin/entitlements/registry", headers=self.admin_headers)
        self.assertEqual(registry.status_code, 200, registry.text)
        capability_keys = {item["key"] for item in registry.json()["capabilities"]}
        self.assertIn("invoices.sale", capability_keys)
        self.assertEqual(
            next(item for item in registry.json()["capabilities"] if item["key"] == "invoices.sale")["status"],
            "implemented",
        )

        signup = self.client.post("/api/auth/signup", json={
            "first_name": "Grant", "last_name": "Owner", "username": "grant-owner-test",
            "phone": _mobile("grant-owner-test"),
            "password": "StrongPass123!", "device_fingerprint": "grant-owner-device",
        })
        self.assertEqual(signup.status_code, 201, signup.text)
        grant_headers = {
            "Authorization": f"Bearer {signup.json()['access_token']}",
            "X-Device-Fingerprint": "grant-owner-device",
        }
        store_id = signup.json()["user"]["store_id"]
        before = self.client.get("/api/plans/current", headers=grant_headers)
        self.assertEqual(before.status_code, 200, before.text)
        self.assertEqual(before.json()["base_plan"], "free")
        self.assertEqual(before.json()["entitlement_source"], "subscription")

        request = {
            "request_id": "grant-retry-test-001", "store_id": store_id, "plan_id": "pro",
            "source": "early_user_gift", "reason": "Explicit automated early-user gift",
            "starts_at": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
            "ends_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        }
        created = self.client.post("/api/admin/grants", headers=self.admin_headers, json=request)
        self.assertEqual(created.status_code, 201, created.text)
        replay = self.client.post("/api/admin/grants", headers=self.admin_headers, json=request)
        self.assertEqual(replay.status_code, 201, replay.text)
        self.assertEqual(replay.json()["id"], created.json()["id"])
        mismatch = self.client.post("/api/admin/grants", headers=self.admin_headers, json={
            **request, "reason": "Changed retry payload",
        })
        self.assertEqual(mismatch.status_code, 409, mismatch.text)
        self.assertEqual(mismatch.json()["detail"], "GRANT_REQUEST_REUSE_MISMATCH")
        overlap = self.client.post("/api/admin/grants", headers=self.admin_headers, json={
            **request, "request_id": "grant-overlap-test-002", "plan_id": "vip",
        })
        self.assertEqual(overlap.status_code, 409, overlap.text)
        self.assertEqual(overlap.json()["detail"], "GRANT_OVERLAP_UNSUPPORTED")
        forbidden = self.client.post("/api/admin/grants", headers=grant_headers, json={
            **request, "request_id": "grant-non-admin-003",
        })
        self.assertEqual(forbidden.status_code, 403, forbidden.text)

        effective = self.client.get("/api/plans/current", headers=grant_headers)
        self.assertEqual(effective.status_code, 200, effective.text)
        self.assertEqual(effective.json()["plan"], "pro")
        self.assertEqual(effective.json()["base_plan"], "free")
        self.assertEqual(effective.json()["entitlement_source"], "grant")
        starts_at = datetime.fromisoformat(request["starts_at"])
        ends_at = datetime.fromisoformat(request["ends_at"])
        with SessionLocal() as db:
            store = db.get(Store, store_id)
            self.assertEqual(entitlement_for_store(db, store, as_of=starts_at)["plan"], "pro")
            self.assertEqual(
                entitlement_for_store(db, store, as_of=ends_at - timedelta(microseconds=1))["plan"],
                "pro",
            )
            boundary = entitlement_for_store(db, store, as_of=ends_at)
            self.assertEqual(boundary["plan"], "free")
            self.assertEqual(boundary["entitlement_source"], "subscription")
        mode = self.client.get("/api/store/operating-mode", headers=grant_headers)
        self.assertEqual(mode.status_code, 200, mode.text)
        self.assertEqual(mode.json()["operating_mode"], "solo")

        revoked = self.client.post(
            f"/api/admin/grants/{created.json()['id']}/revoke",
            headers=self.admin_headers, json={"reason": "Automated revocation boundary"},
        )
        self.assertEqual(revoked.status_code, 200, revoked.text)
        after = self.client.get("/api/plans/current", headers=grant_headers)
        self.assertEqual(after.status_code, 200, after.text)
        self.assertEqual(after.json()["plan"], "free")
        self.assertEqual(after.json()["base_plan"], "free")
        self.assertEqual(after.json()["entitlement_source"], "subscription")

        expired = self.client.post("/api/admin/grants", headers=self.admin_headers, json={
            **request,
            "request_id": "grant-expired-test-004",
            "starts_at": (datetime.now(timezone.utc) - timedelta(days=3)).isoformat(),
            "ends_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
        })
        self.assertEqual(expired.status_code, 201, expired.text)
        after_expiry = self.client.get("/api/plans/current", headers=grant_headers)
        self.assertEqual(after_expiry.status_code, 200, after_expiry.text)
        self.assertEqual(after_expiry.json()["plan"], "free")
        self.assertEqual(after_expiry.json()["entitlement_source"], "subscription")
        with SessionLocal() as db:
            self.assertEqual(db.query(StorePlanGrant).filter_by(store_id=store_id).count(), 2)

    def test_grant_expiry_during_sync_uses_one_acceptance_instant(self) -> None:
        signup = self.client.post("/api/auth/signup", json={
            "first_name": "Boundary", "last_name": "Owner", "username": "grant-boundary-owner",
            "phone": _mobile("grant-boundary-owner"),
            "password": "StrongPass123!", "device_fingerprint": "grant-boundary-device",
        })
        self.assertEqual(signup.status_code, 201, signup.text)
        headers = {
            "Authorization": f"Bearer {signup.json()['access_token']}",
            "X-Device-Fingerprint": "grant-boundary-device",
            "X-Client-Data-Schema": "2",
        }
        store_id = signup.json()["user"]["store_id"]
        accepted_at = datetime(2026, 6, 1, 12, 0, tzinfo=timezone.utc)
        with SessionLocal() as db:
            free = db.get(SubscriptionPlan, "free")
            original_limits = free.limits_json
            limits = json.loads(original_limits)
            limits["inventory_items"] = 0
            free.limits_json = json.dumps(limits)
            owner = db.get(User, signup.json()["user"]["id"])
            store = db.get(Store, store_id)
            owner.industry_id = self.industry_id
            store.industry_id = self.industry_id
            db.add(StorePlanGrant(
                request_id="grant-boundary-sync",
                store_id=store_id,
                plan_id="pro",
                source="support",
                reason="Controlled acceptance-time boundary",
                starts_at=accepted_at,
                ends_at=accepted_at + timedelta(microseconds=1),
                granted_by_user_id=self.admin_user_id,
            ))
            db.commit()

        class AcceptanceClock(datetime):
            @classmethod
            def now(cls, tz=None):
                return accepted_at if tz is not None else accepted_at.replace(tzinfo=None)

        operation = {
            "operation_id": "grant-boundary-product",
            "entity": "product",
            "entity_id": 1_700_003_000_001,
            "operation": "CREATE",
            "payload": {
                "quantity": 1, "price": 100, "custom_label": "Boundary product",
                "low_stock_threshold": 0, "low_stock_alert": False, "is_hidden": False,
                "catalog_product": {"id": 0, "name": "Boundary product"},
            },
        }
        try:
            with patch("app.routers.sync.datetime", AcceptanceClock):
                response = self.client.post("/api/sync/batch", headers=headers, data={
                    "operations_json": json.dumps({"operations": [operation]}),
                })
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["results"][0]["status"], "applied", response.text)
            update = self.client.post("/api/sync/batch", headers=headers, data={
                "operations_json": json.dumps({"operations": [{
                    **operation,
                    "operation_id": "grant-boundary-existing-update",
                    "operation": "UPDATE",
                    "payload": {"quantity": 2},
                }]}),
            })
            self.assertEqual(update.json()["results"][0]["status"], "fatal_error", update.text)
            self.assertEqual(update.json()["results"][0]["error"], "CAPABILITY_REQUIRED:sync")
            blocked_new = self.client.post("/api/sync/batch", headers=headers, data={
                "operations_json": json.dumps({"operations": [{
                    **operation,
                    "operation_id": "grant-boundary-new-after-expiry",
                    "entity_id": operation["entity_id"] + 1,
                }]}),
            })
            self.assertEqual(blocked_new.json()["results"][0]["status"], "fatal_error", blocked_new.text)
            self.assertEqual(blocked_new.json()["results"][0]["error"], "CAPABILITY_REQUIRED:sync")
            with SessionLocal() as db:
                self.assertEqual(
                    db.query(InventoryItem).filter_by(
                        store_id=store_id, id=operation["entity_id"]
                    ).count(),
                    1,
                )
                self.assertEqual(db.get(InventoryItem, operation["entity_id"]).quantity, 1)
        finally:
            with SessionLocal() as db:
                db.get(SubscriptionPlan, "free").limits_json = original_limits
                db.commit()

    def test_starter_is_readable_for_existing_assignment_but_not_newly_assignable(self) -> None:
        existing = self.client.post("/api/auth/signup", json={
            "first_name": "Legacy", "last_name": "Starter", "username": "legacy-starter-owner",
            "phone": _mobile("legacy-starter-owner"),
            "password": "StrongPass123!", "device_fingerprint": "legacy-starter-device",
        })
        new_user = self.client.post("/api/auth/signup", json={
            "first_name": "New", "last_name": "Subscriber", "username": "new-starter-candidate",
            "phone": _mobile("new-starter-candidate"),
            "password": "StrongPass123!", "device_fingerprint": "new-starter-device",
        })
        with SessionLocal() as db:
            owner = db.get(User, existing.json()["user"]["id"])
            store = db.get(Store, existing.json()["user"]["store_id"])
            owner.plan = store.plan = "starter"
            db.commit()
        existing_headers = {
            "Authorization": f"Bearer {existing.json()['access_token']}",
            "X-Device-Fingerprint": "legacy-starter-device",
        }
        current = self.client.get("/api/plans/current", headers=existing_headers)
        self.assertEqual(current.status_code, 200, current.text)
        self.assertEqual(current.json()["plan"], "starter")
        offers = self.client.get("/api/plans", headers=existing_headers)
        self.assertNotIn("starter", {plan["id"] for plan in offers.json()})
        forbidden = self.client.patch(
            f"/api/admin/users/{new_user.json()['user']['id']}/subscription",
            headers=self.admin_headers,
            json={"plan": "starter"},
        )
        self.assertEqual(forbidden.status_code, 409, forbidden.text)
        self.assertEqual(forbidden.json()["detail"], "PLAN_LEGACY_ASSIGNMENT_FORBIDDEN")


if __name__ == "__main__":
    unittest.main()
