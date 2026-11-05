import json

from app.services.activity_service import _safe
from app.routers.sync import _activity_evidence
from app.schemas import SyncOperationIn, SyncOperationResult


def test_activity_evidence_recursively_removes_credentials_and_tokens():
    encoded = _safe({
        "name": "نمونه",
        "nested": {
            "token": "secret",
            "password_hash": "hash",
            "customerPasswordHash": "hash2",
            "api_key": "key",
            "quantity": 2,
        },
        "items": [{"temporary_password": "never", "set-cookie": "session=never", "status": "active"}],
    })
    assert encoded is not None
    value = json.loads(encoded)
    assert value == {"name": "نمونه", "nested": {"quantity": 2}, "items": [{"status": "active"}]}


def test_activity_evidence_keeps_only_reliable_business_fields():
    operation = SyncOperationIn(
        operation_id="movement-1", entity="inventory_movement", entity_id=10,
        operation="CREATE", payload={"token": "never", "kind": "receive"},
    )
    result = SyncOperationResult(operation_id="movement-1", status="applied", entity_id=10, record={
        "movement": {"before_quantity": 7, "after_quantity": 12, "barcode_value": "private"},
        "product": {"custom_label": "لنت جلو", "purchase_price": 500},
    })
    assert _activity_evidence(operation, result) == {
        "name": "لنت جلو", "before_quantity": 7, "quantity": 12,
    }
