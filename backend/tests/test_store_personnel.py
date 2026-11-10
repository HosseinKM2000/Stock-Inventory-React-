import json
import uuid
import hashlib

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import CatalogProduct, Category, Industry, InventoryItem, Store, StoreMembership, StoreRole, User
from app.services.catalog_product_service import _reconcile_catalog_assignments
from app.services.bootstrap_service import ensure_system_admin
from app.services.store_authorization import normalize_permissions
from app.services.subscription_service import seed_default_plans
from app.services.store_service import active_store_context


@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_default_plans(db)
        ensure_system_admin(db)
    with TestClient(app) as value:
        yield value
    engine.dispose()


def signup(client: TestClient, username: str):
    digits = int(hashlib.sha256(username.encode()).hexdigest()[:12], 16) % 1_000_000_000
    response = client.post("/api/auth/signup", json={
        "first_name": "Store", "last_name": "Owner", "username": username,
        "phone": f"09{digits:09d}",
        "password": "StrongPass123!", "device_fingerprint": f"device-{username}",
    })
    assert response.status_code == 201, response.text
    return response.json()


def headers(auth: dict, fingerprint: str):
    return {"Authorization": f"Bearer {auth['access_token']}", "X-Device-Fingerprint": fingerprint}


def activate_team(client: TestClient, owner_headers: dict):
    mode = client.get("/api/store/operating-mode", headers=owner_headers)
    assert mode.status_code == 200, mode.text
    transition_id = str(uuid.uuid4())
    payload = {
        "expected_policy_version": mode.json()["policy_version"],
        "transition_id": transition_id,
    }
    activated = client.post("/api/store/operating-mode/activate-team", headers=owner_headers, json=payload)
    assert activated.status_code == 200, activated.text
    assert activated.json()["operating_mode"] == "team"
    replay = client.post("/api/store/operating-mode/activate-team", headers=owner_headers, json=payload)
    assert replay.status_code == 200, replay.text
    converged = client.post("/api/store/operating-mode/activate-team", headers=owner_headers, json={
        "expected_policy_version": mode.json()["policy_version"],
        "transition_id": str(uuid.uuid4()),
    })
    assert converged.status_code == 200, converged.text
    assert converged.json()["policy_version"] == activated.json()["policy_version"]
    return activated.json()


def test_permission_dependencies_are_expanded_and_unknown_values_denied():
    assert normalize_permissions(["tools.import"]) == ["products.create", "products.view", "tools.import"]
    assert normalize_permissions(["counterparties.manage"]) == [
        "counterparties.manage", "counterparties.view", "products.view",
    ]
    with pytest.raises(Exception, match="UNKNOWN_PERMISSION"):
        normalize_permissions(["products.typo"])


def test_role_changes_require_personnel_capability(client: TestClient):
    username = f"free-owner-{uuid.uuid4().hex[:8]}"
    auth = signup(client, username)
    owner_headers = headers(auth, f"device-{username}")
    roles = client.get("/api/store/roles", headers=owner_headers)
    assert roles.status_code == 200

    created = client.post("/api/store/roles", headers=owner_headers, json={
        "name": "فروشنده", "permissions": ["products.view"],
    })
    assert created.status_code == 403
    assert created.json()["detail"] == "PERSONNEL_ENTITLEMENT_REQUIRED"


def test_personnel_capacity_temporary_password_gate_and_attribution(client: TestClient):
    username = f"owner-{uuid.uuid4().hex[:8]}"
    auth = signup(client, username)
    owner_headers = headers(auth, f"device-{username}")
    with SessionLocal() as db:
        owner = db.get(User, auth["user"]["id"])
        owner.plan = "vip"
        store = db.scalar(select(Store).where(Store.owner_user_id == owner.id))
        industry = Industry(name=f"Personnel mode {uuid.uuid4().hex[:8]}", is_active=True)
        db.add(industry)
        db.flush()
        owner.industry_id = industry.id
        store.industry_id = industry.id
        store.personnel_limit_override = 1
        db.commit()

    roles = client.get("/api/store/roles", headers=owner_headers)
    assert roles.status_code == 200
    viewer = next(item for item in roles.json() if item["name"] == "مشاهده‌گر")
    role_created = client.post("/api/store/roles", headers=owner_headers, json={
        "name": "انباردار", "permissions": ["products.create", "products.quantity.change"],
    })
    assert role_created.status_code == 201, role_created.text
    assert role_created.json()["permissions"] == ["products.create", "products.quantity.change", "products.view"]
    blocked_in_solo = client.post("/api/store/personnel", headers=owner_headers, json={
        "first_name": "Blocked", "last_name": "Solo", "role_id": viewer["id"],
    })
    assert blocked_in_solo.status_code == 409
    assert blocked_in_solo.json()["detail"] == "TEAM_MODE_REQUIRED_FOR_PERSONNEL"
    activate_team(client, owner_headers)
    created = client.post("/api/store/personnel", headers=owner_headers, json={
        "first_name": "Person", "last_name": "One", "role_id": role_created.json()["id"],
    })
    assert created.status_code == 201, created.text
    credential = created.json()
    assert credential["temporary_password"]

    full = client.post("/api/store/personnel", headers=owner_headers, json={
        "first_name": "Person", "last_name": "Two", "role_id": viewer["id"],
    })
    assert full.status_code == 409
    assert full.json()["detail"] == "PERSONNEL_CAPACITY_REACHED"

    login = client.post("/api/auth/login", json={
        "username": credential["username"], "password": credential["temporary_password"],
        "device_fingerprint": "person-device",
    })
    assert login.status_code == 200
    person_headers = headers(login.json(), "person-device")
    blocked = client.get("/api/products", headers=person_headers)
    assert blocked.status_code == 428

    dismissed = client.post("/api/store/credentials-notice/viewed", headers=person_headers)
    assert dismissed.status_code == 204
    still_blocked = client.get("/api/products", headers=person_headers)
    assert still_blocked.status_code == 428

    changed = client.patch("/api/auth/me/password", headers=person_headers, json={
        "current_password": credential["temporary_password"], "new_password": "ChangedPass456!",
    })
    assert changed.status_code == 200
    allowed = client.get("/api/products", headers=person_headers)
    assert allowed.status_code == 200

    mode = client.get("/api/store/operating-mode", headers=owner_headers).json()
    team_headers = {**person_headers, "X-Client-Data-Schema": "2"}
    personnel_create = {
        "operation_id": f"personnel-create-{uuid.uuid4()}",
        "entity": "product", "entity_id": 1_860_000_000_001, "operation": "CREATE",
        "execution_mode": "team", "policy_version": mode["policy_version"],
        "payload": {
            "quantity": 2, "price": 120, "custom_label": "Personnel accepted",
            "low_stock_threshold": 0, "low_stock_alert": False, "is_hidden": False,
            "catalog_product": {"id": 0, "name": "Personnel accepted"},
        },
    }
    accepted = client.post("/api/sync/batch", headers=team_headers, data={
        "operations_json": json.dumps({"operations": [personnel_create]}),
    })
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["results"][0]["status"] == "applied"

    with SessionLocal() as db:
        membership = db.get(StoreMembership, credential["membership_id"])
        membership.status = "inactive"
        db.commit()
    revoked = client.post("/api/sync/batch", headers=team_headers, data={
        "operations_json": json.dumps({"operations": [{
            **personnel_create,
            "operation_id": f"revoked-{uuid.uuid4()}",
            "entity_id": 1_860_000_000_002,
        }]}),
    })
    assert revoked.status_code == 403

    activity = client.get("/api/store/activity", headers=owner_headers)
    assert activity.status_code == 200
    assert any(item["action"] == "personnel.created" for item in activity.json()["items"])


def test_platform_administrator_has_unrestricted_store_access(client: TestClient):
    login = client.post("/api/auth/login", json={
        "username": "HosseinKM2000", "password": "Test-only-system-admin-password-123!",
        "device_fingerprint": "platform-admin-personnel-test",
    })
    assert login.status_code == 200
    auth = login.json()
    assert auth["user"]["is_store_owner"] is True
    assert auth["user"]["store_id"] is not None

    admin_headers = headers(auth, "platform-admin-personnel-test")
    assert client.get("/api/products", headers=admin_headers).status_code == 200
    assert client.get("/api/store/personnel", headers=admin_headers).status_code == 200

    capacity = client.get("/api/store/personnel/capacity", headers=admin_headers)
    assert capacity.status_code == 200
    assert capacity.json()["enabled"] is True
    assert capacity.json()["limit"] is None
    assert capacity.json()["available"] is None

    entitlement = client.get("/api/plans/current", headers=admin_headers)
    assert entitlement.status_code == 200
    assert entitlement.json()["store_id"] == auth["user"]["store_id"]
    assert entitlement.json()["capabilities"]["inventory.write"] is True
    assert entitlement.json()["capabilities"]["media.recovery"] is False
    assert entitlement.json()["capabilities"]["invoices.sale"] is True
    assert all(value is None for value in entitlement.json()["limits"].values())

    customer_username = f"admin-isolation-{uuid.uuid4().hex[:8]}"
    customer = signup(client, customer_username)
    with SessionLocal() as db:
        customer_store = db.scalar(select(Store).where(
            Store.owner_user_id == customer["user"]["id"]
        ))
        industry = Industry(name=f"Admin isolation {customer_username}", is_active=True)
        db.add(industry)
        db.flush()
        catalog = CatalogProduct(
            industry_id=industry.id,
            name=f"Customer-only {customer_username}",
            is_shared=False,
            is_active=True,
        )
        db.add(catalog)
        db.flush()
        customer_item = InventoryItem(
            store_id=customer_store.id,
            user_id=customer_store.owner_user_id,
            catalog_product_id=catalog.id,
        )
        db.add(customer_item)
        db.commit()
        customer_item_id = customer_item.id

    isolated = client.get("/api/products", headers=admin_headers)
    assert isolated.status_code == 200
    assert customer_item_id not in {item["id"] for item in isolated.json()["items"]}


def test_store_inventory_is_shared_with_personnel_and_isolated_from_other_store(client: TestClient):
    suffix = uuid.uuid4().hex[:8]
    with SessionLocal() as db:
        industry = Industry(name=f"Store ownership {suffix}", is_active=True)
        db.add(industry)
        db.flush()
        catalog = CatalogProduct(
            industry_id=industry.id,
            name=f"Shared product {suffix}",
            is_shared=True,
            is_active=True,
        )
        db.add(catalog)
        db.commit()
        industry_id, catalog_id = industry.id, catalog.id

    owner_username = f"ownership-owner-{suffix}"
    owner_auth = signup(client, owner_username)
    owner_headers = headers(owner_auth, f"device-{owner_username}")
    with SessionLocal() as db:
        owner = db.get(User, owner_auth["user"]["id"])
        owner.plan = "vip"
        db.commit()
    selected = client.patch(
        "/api/auth/industry", headers=owner_headers, json={"industry_id": industry_id}
    )
    assert selected.status_code == 200, selected.text

    with SessionLocal() as db:
        owner = db.get(User, owner_auth["user"]["id"])
        store_id = owner.store_memberships[0].store_id
        item = db.scalar(select(InventoryItem).where(
            InventoryItem.store_id == store_id,
            InventoryItem.catalog_product_id == catalog_id,
        ))
        assert item is not None
        item.quantity = 17
        item.price = 2300
        item.sale_price = 2300
        item.custom_label = "customer override"
        item.note = "must survive reconciliation"
        item.is_hidden = True
        db.commit()
        item_id = item.id

    unrelated_username = f"ownership-other-{suffix}"
    unrelated_auth = signup(client, unrelated_username)
    unrelated_headers = headers(unrelated_auth, f"device-{unrelated_username}")
    assert client.get(f"/api/products/{item_id}", headers=unrelated_headers).status_code == 404
    unrelated_category = client.post(
        "/api/categories", headers=unrelated_headers, json={"name": f"Other {suffix}"}
    )
    assert unrelated_category.status_code == 201, unrelated_category.text
    rejected_relation = client.patch(
        f"/api/products/{item_id}",
        headers=owner_headers,
        data={"category_id": unrelated_category.json()["id"]},
    )
    assert rejected_relation.status_code == 400

    activate_team(client, owner_headers)

    viewer_response = client.post("/api/store/roles", headers=owner_headers, json={
        "name": f"Read only {suffix}", "permissions": ["products.view"],
    })
    assert viewer_response.status_code == 201, viewer_response.text
    viewer = viewer_response.json()
    created = client.post("/api/store/personnel", headers=owner_headers, json={
        "first_name": "Shared", "last_name": "Member", "role_id": viewer["id"],
    })
    assert created.status_code == 201, created.text
    credential = created.json()
    login = client.post("/api/auth/login", json={
        "username": credential["username"],
        "password": credential["temporary_password"],
        "device_fingerprint": f"person-{suffix}",
    })
    person_headers = headers(login.json(), f"person-{suffix}")
    changed = client.patch("/api/auth/me/password", headers=person_headers, json={
        "current_password": credential["temporary_password"],
        "new_password": "ChangedPass456!",
    })
    assert changed.status_code == 200, changed.text

    owner_items = client.get("/api/products", headers=owner_headers)
    person_items = client.get("/api/products", headers=person_headers)
    assert owner_items.status_code == person_items.status_code == 200
    assert [item["id"] for item in owner_items.json()["items"]] == [
        item["id"] for item in person_items.json()["items"]
    ]
    person_item = next(item for item in person_items.json()["items"] if item["id"] == item_id)
    # The store's VIP entitlement permits inventory writes, but the viewer's
    # member role does not. Plan capability must never bypass member policy.
    mode = client.get("/api/store/operating-mode", headers=owner_headers).json()
    denied_write = client.post("/api/sync/batch", headers={
        **person_headers, "X-Client-Data-Schema": "2",
    }, data={"operations_json": json.dumps({"operations": [{
        "operation_id": f"viewer-denied-{uuid.uuid4()}",
        "entity": "product", "entity_id": item_id, "operation": "UPDATE",
        "execution_mode": "team", "policy_version": mode["policy_version"],
        "payload": {"version": person_item["version"], "quantity": 18},
    }]})})
    assert denied_write.status_code == 200, denied_write.text
    denied_result = denied_write.json()["results"][0]
    assert denied_result["status"] == "fatal_error"
    assert denied_result["error"].startswith("PERMISSION_REQUIRED:")

    with SessionLocal() as db:
        product = db.get(CatalogProduct, catalog_id)
        _reconcile_catalog_assignments(db, product)
        _reconcile_catalog_assignments(db, product)
        db.commit()
        assignments = list(db.scalars(select(InventoryItem).where(
            InventoryItem.store_id == store_id,
            InventoryItem.catalog_product_id == catalog_id,
        )))
        assert len(assignments) == 1
        assignment = assignments[0]
        assert (assignment.quantity, assignment.price, assignment.custom_label, assignment.note, assignment.is_hidden) == (
            17, 2300, "customer override", "must survive reconciliation", True,
        )
        personnel = db.scalar(select(StoreMembership).where(
            StoreMembership.user_id == credential["user_id"]
        ))
        personnel.status = "inactive"
        db.commit()

    revoked = client.get("/api/products", headers=person_headers)
    assert revoked.status_code == 403
    assert revoked.json()["detail"] == "STORE_MEMBERSHIP_INACTIVE"


def test_multiple_active_memberships_fail_closed_instead_of_choosing_arbitrarily(client: TestClient):
    suffix = uuid.uuid4().hex[:8]
    first = signup(client, f"ambiguous-first-{suffix}")
    second = signup(client, f"ambiguous-second-{suffix}")
    with SessionLocal() as db:
        first_user = db.get(User, first["user"]["id"])
        second_store = db.scalar(select(Store).where(Store.owner_user_id == second["user"]["id"]))
        role = db.scalar(select(StoreRole).where(StoreRole.store_id == second_store.id))
        extra = StoreMembership(
            store_id=second_store.id,
            user_id=first_user.id,
            role_id=role.id,
            status="active",
            is_owner=False,
        )
        db.add(extra)
        db.commit()
        with pytest.raises(HTTPException) as error:
            active_store_context(db, first_user)
        assert error.value.status_code == 409
        assert error.value.detail == "STORE_CONTEXT_AMBIGUOUS"

    ambiguous_headers = headers(first, f"device-ambiguous-first-{suffix}")
    for method, path, kwargs in (
        ("get", "/api/auth/me", {}),
        ("get", "/api/products", {}),
        ("get", "/api/sync/changes", {"headers": {"X-Client-Data-Schema": "2"}}),
    ):
        request_headers = {**ambiguous_headers, **kwargs.get("headers", {})}
        response = client.request(method, path, headers=request_headers)
        assert response.status_code == 409
        assert response.json()["detail"] == "STORE_CONTEXT_AMBIGUOUS"


def test_platform_user_deletion_cannot_delete_store_identity_or_business_boundary(client: TestClient):
    suffix = uuid.uuid4().hex[:8]
    customer = signup(client, f"delete-boundary-{suffix}")
    admin_login = client.post("/api/auth/login", json={
        "username": "HosseinKM2000",
        "password": "Test-only-system-admin-password-123!",
        "device_fingerprint": f"delete-admin-{suffix}",
    })
    admin_headers = headers(admin_login.json(), f"delete-admin-{suffix}")
    denied = client.delete(
        f"/api/admin/users/{customer['user']['id']}", headers=admin_headers
    )
    assert denied.status_code == 409
    assert denied.json()["detail"] == "STORE_IDENTITY_DELETE_FORBIDDEN"
    with SessionLocal() as db:
        assert db.get(User, customer["user"]["id"]) is not None
        assert db.scalar(select(Store).where(
            Store.owner_user_id == customer["user"]["id"]
        )) is not None
