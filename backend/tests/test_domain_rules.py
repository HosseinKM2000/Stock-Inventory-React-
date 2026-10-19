import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.plans import subscription_expired
from app.schemas import CatalogProductCreate, InventoryCreate, PasswordUpdate, SyncBatchRequest
from app.security import hash_password, verify_password
from app.services.authorization_service import Permission, RoleId, has_permission, set_role


def test_bcrypt_hashes_and_verifies_without_storing_plaintext() -> None:
    password = "StrongPass123!"
    hashed = hash_password(password)
    assert hashed != password
    assert hashed.startswith("$2")
    assert verify_password(password, hashed)
    assert not verify_password("WrongPass123!", hashed)


@pytest.mark.parametrize("password", ["alllowercase1", "ALLUPPERCASE1", "NoNumberHere"])
def test_password_update_rejects_weak_passwords(password: str) -> None:
    with pytest.raises(ValidationError):
        PasswordUpdate(current_password="CurrentPass123!", new_password=password)


def test_password_schema_enforces_bcrypt_utf8_limit() -> None:
    with pytest.raises(ValidationError, match="PASSWORD_TOO_LONG"):
        PasswordUpdate(current_password="CurrentPass123!", new_password="A1a" + "é" * 35)


def test_catalog_packaging_contract_normalizes_or_rejects_invalid_metadata() -> None:
    unpackaged = CatalogProductCreate(industry_id=1, name="  Item  ", is_packaged=False, pack_size=12)
    assert unpackaged.name == "Item"
    assert unpackaged.pack_size is None
    with pytest.raises(ValidationError, match="PACK_SIZE_REQUIRED"):
        CatalogProductCreate(industry_id=1, name="Item", is_packaged=True, pack_size=None)
    with pytest.raises(ValidationError):
        CatalogProductCreate(industry_id=1, name="Item", is_packaged=True, pack_size=0)


@pytest.mark.parametrize("field", ["quantity", "price", "low_stock_threshold"])
def test_inventory_payload_rejects_negative_values(field: str) -> None:
    with pytest.raises(ValidationError):
        InventoryCreate(**{field: -1})


def test_sync_batch_has_a_hard_operation_limit() -> None:
    operation = {"operation_id": "op", "entity": "product", "entity_id": 1, "operation": "DELETE"}
    with pytest.raises(ValidationError):
        SyncBatchRequest(operations=[{**operation, "operation_id": f"op-{index}"} for index in range(201)])


def test_subscription_expiry_uses_absolute_time_and_free_plan_does_not_expire() -> None:
    now = datetime.now(timezone.utc)
    assert subscription_expired("pro", now - timedelta(seconds=1))
    assert not subscription_expired("pro", now + timedelta(minutes=1))
    assert not subscription_expired("free", now - timedelta(days=1))
    assert subscription_expired("pro", (now - timedelta(seconds=1)).replace(tzinfo=None))


def test_role_changes_keep_legacy_admin_flag_synchronized() -> None:
    user = SimpleNamespace(role="USER", is_admin=False, is_system_admin=False)
    assert not has_permission(user, Permission.USERS_MANAGE)
    set_role(user, RoleId.ADMIN)
    assert user.role == "ADMIN"
    assert user.is_admin is True
    assert has_permission(user, Permission.CATALOG_MANAGE)
    set_role(user, RoleId.USER)
    assert user.is_admin is False
