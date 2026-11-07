import json
from typing import Any

from sqlalchemy.orm import Session

from ..models import AdminAuditLog, User


def record_admin_action(
    db: Session,
    actor: User,
    action: str,
    target: User | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    db.add(
        AdminAuditLog(
            actor_user_id=actor.id,
            target_user_id=target.id if target else None,
            action=action,
            metadata_json=json.dumps(metadata, ensure_ascii=False) if metadata else None,
        )
    )
