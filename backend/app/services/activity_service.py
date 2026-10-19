import json
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from ..models import StoreActivity, User
from .store_service import active_store_context


SENSITIVE_KEYS = frozenset({"password", "hashed_password", "access_token", "token"})


def _safe(value: dict[str, Any] | None) -> str | None:
    if value is None:
        return None
    return json.dumps({key: item for key, item in value.items() if key not in SENSITIVE_KEYS}, default=str)


def record_store_activity(
    db: Session,
    actor: User,
    *,
    action: str,
    target_entity: str,
    target_id: str | int | None = None,
    operation_id: str | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    outcome: str = "applied",
    client_occurred_at: datetime | None = None,
) -> StoreActivity:
    context = active_store_context(db, actor)
    item = StoreActivity(
        store_id=context.store.id,
        actor_user_id=actor.id,
        actor_membership_id=context.membership.id,
        actor_display_name=f"{actor.first_name} {actor.last_name}".strip(),
        actor_role_name="مالک" if context.is_owner else (context.membership.role.name if context.membership.role else ""),
        operation_id=operation_id or str(uuid.uuid4()),
        target_entity=target_entity,
        target_id=str(target_id) if target_id is not None else None,
        action=action,
        before_json=_safe(before),
        after_json=_safe(after),
        outcome=outcome,
        client_occurred_at=client_occurred_at,
    )
    db.add(item)
    return item

