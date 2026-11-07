import json
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import Industry, User
from .authorization_service import is_admin

TOOL_IDS = ("import", "labels", "categories", "export", "catalog", "recovery", "scanner")
DEFAULT_TOOL_POLICY = {tool_id: True for tool_id in TOOL_IDS}


def normalize_tool_policy(value: dict[str, Any] | None) -> dict[str, bool]:
    if value is None:
        return dict(DEFAULT_TOOL_POLICY)
    unknown = set(value) - set(TOOL_IDS)
    if unknown:
        raise ValueError("UNKNOWN_TOOL_ID")
    return {tool_id: bool(value.get(tool_id, True)) for tool_id in TOOL_IDS}


def industry_tool_policy(industry: Industry | None) -> dict[str, bool]:
    if industry is None or not industry.tools_json:
        return dict(DEFAULT_TOOL_POLICY)
    try:
        parsed = json.loads(industry.tools_json)
    except (TypeError, json.JSONDecodeError):
        return dict(DEFAULT_TOOL_POLICY)
    return normalize_tool_policy(parsed if isinstance(parsed, dict) else None)


def tool_allowed(db: Session, user: User, tool_id: str) -> bool:
    if tool_id not in TOOL_IDS:
        return False
    if is_admin(user):
        return True
    industry = db.get(Industry, user.industry_id) if user.industry_id else None
    return industry_tool_policy(industry).get(tool_id, False)


def require_tool(db: Session, user: User, tool_id: str) -> None:
    if not tool_allowed(db, user, tool_id):
        raise HTTPException(status_code=403, detail=f"DOMAIN_TOOL_DISABLED:{tool_id}")
