"""Protected, deterministic TZ-010 demonstration fixture.

Run only after choosing a concrete local account:
  python -m backend.app.demo_fixture --user-id 1 --confirm tanzim-development

Authentication, roles, plans and audit configuration are never deleted. A
recoverable JSON snapshot of every affected business row is written first.
"""
from __future__ import annotations

import argparse
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import delete, select

from .config import settings
from .database import SessionLocal, engine
from .models import (
    CatalogProduct, Category, Industry, InventoryItem, InventoryItemLabel,
    InventoryTransaction, Label, SyncChange, SyncOperation, User,
)
from .schemas import InventoryOut
from .services.tool_policy import DEFAULT_TOOL_POLICY

CONFIRMATION = "tanzim-development"
SNAPSHOT_TABLES = (
    InventoryTransaction.__table__, InventoryItemLabel.__table__, InventoryItem.__table__,
    CatalogProduct.__table__, Category.__table__, Label.__table__, SyncOperation.__table__, SyncChange.__table__,
)


def _json_value(value: Any) -> Any:
    return value.isoformat() if isinstance(value, (datetime, date)) else value


def _assert_safe(user_id: int, confirmation: str) -> None:
    if settings.ENVIRONMENT not in {"development", "test"}:
        raise RuntimeError("DEMO_RESET_REQUIRES_DEVELOPMENT_OR_TEST")
    if confirmation != CONFIRMATION:
        raise RuntimeError("DEMO_RESET_CONFIRMATION_REQUIRED")
    url = engine.url
    if (url.host or "") not in {"localhost", "127.0.0.1", ""}:
        raise RuntimeError("DEMO_RESET_REQUIRES_LOCAL_DATABASE")
    if user_id <= 0:
        raise RuntimeError("DEMO_RESET_REQUIRES_EXPLICIT_USER")


def _snapshot(db, user: User, output_dir: Path) -> Path:
    inventory_ids = list(db.scalars(select(InventoryItem.id).where(InventoryItem.user_id == user.id)))
    catalog_ids = list(db.scalars(select(InventoryItem.catalog_product_id).where(InventoryItem.user_id == user.id)))
    rows: dict[str, list[dict[str, Any]]] = {}
    filters = {
        "inventory_transactions": InventoryTransaction.user_id == user.id,
        "inventory_item_labels": InventoryItemLabel.inventory_item_id.in_(inventory_ids or [-1]),
        "inventory_items": InventoryItem.user_id == user.id,
        "catalog_products": CatalogProduct.id.in_(catalog_ids or [-1]),
        "categories": Category.user_id == user.id,
        "labels": Label.user_id == user.id,
        "sync_operations": SyncOperation.user_id == user.id,
        "sync_changes": SyncChange.user_id == user.id,
    }
    for table in SNAPSHOT_TABLES:
        result = db.execute(select(table).where(filters[table.name])).mappings()
        rows[table.name] = [{key: _json_value(value) for key, value in row.items()} for row in result]
    payload = {
        "schema": 1, "created_at": datetime.now(timezone.utc).isoformat(),
        "environment": settings.ENVIRONMENT, "database": engine.url.database,
        "user_id": user.id, "previous_industry_id": user.industry_id, "rows": rows,
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"tz010-before-user-{user.id}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def _clear_business_state(db, user: User) -> None:
    items = list(db.scalars(select(InventoryItem).where(InventoryItem.user_id == user.id)))
    private_catalogs = [item.catalog_product for item in items if not item.catalog_product.is_shared]
    for item in items:
        db.delete(item)
    db.flush()
    for catalog in private_catalogs:
        db.delete(catalog)
    db.execute(delete(Category).where(Category.user_id == user.id))
    db.execute(delete(Label).where(Label.user_id == user.id))
    db.execute(delete(SyncOperation).where(SyncOperation.user_id == user.id))
    db.execute(delete(SyncChange).where(SyncChange.user_id == user.id))
    db.flush()


def _seed(db, user: User) -> dict[str, Any]:
    industry = db.scalar(select(Industry).where(Industry.name == "فروشگاه نمایشی تنظیم"))
    if industry is None:
        industry = Industry(name="فروشگاه نمایشی تنظیم", description="داده تکرارپذیر TZ-010", is_active=True, tools_json=json.dumps(DEFAULT_TOOL_POLICY))
        db.add(industry); db.flush()
    user.industry_id = industry.id
    categories = [Category(user_id=user.id, name=name, description="داده نمایشی") for name in ("مواد غذایی", "لوازم خانه", "کالاهای ارزشمند")]
    labels = [Label(user_id=user.id, name=name, normalized_name=name, version=1) for name in ("پرفروش", "خرید فوری", "ویژه")]
    db.add_all(categories + labels); db.flush()
    now = datetime.now(timezone.utc)
    specs = [
        ("برنج ایرانی ممتاز", 18, 850000, 5, True, True, 0, [0, 2]),
        ("روغن مایع", 0, 120000, 4, True, False, 0, [1]),
        ("چای Earl Grey ویژه", 3, 0, 3, True, False, None, []),
        ("ظرف نگهدارنده شیشه‌ای با درپوش بسیار بلند", 4, 390000, 6, True, True, 1, [2]),
        ("لامپ LED 12W", 6, 95000, 6, True, False, 1, [0]),
        ("کابل USB-C", 25, 210000, 5, False, False, None, [0, 2]),
        ("قهوه فوری", 1, 475000, 2, True, False, 0, [1]),
        ("دستمال کاغذی بسته‌ای", 48, 98000, 10, True, True, 0, []),
        ("Notebook A5 / دفتر یادداشت", 9, 165000, 2, True, False, None, [2]),
        ("مایع ظرفشویی", 2, 87000, 4, True, False, 0, [1]),
        ("زعفران یک مثقال", 12, 4200000, 2, True, True, 2, [0, 2]),
        ("شکر", 7, 0, 3, True, False, 0, []),
        ("باتری قلمی", 20, 145000, 5, True, True, 1, [0]),
        ("محصول بدون دسته", 11, 310000, 2, True, False, None, []),
        ("کالای پنهان", 5, 550000, 2, True, False, 1, [2]),
    ]
    coverage: dict[str, str] = {}
    for index, (name, quantity, price, threshold, active, packaged, category_index, label_indexes) in enumerate(specs):
        is_shared = index < 3
        catalog = db.scalar(select(CatalogProduct).where(
            CatalogProduct.industry_id == industry.id,
            CatalogProduct.name == name,
            CatalogProduct.brand == "Tanzim Demo",
            CatalogProduct.is_shared.is_(True),
        )) if is_shared else None
        created_at = now if index < 5 else now - timedelta(days=index)
        if catalog is None:
            catalog = CatalogProduct(industry_id=industry.id, name=name, is_shared=is_shared)
            db.add(catalog)
        catalog.description = "محصول نمایشی برای بررسی رابط کاربری"
        catalog.brand = "Tanzim Demo"
        catalog.image_url = "/pwa-icon-192.png" if index % 3 else None
        catalog.is_packaged = packaged
        catalog.pack_size = 6 if packaged else None
        catalog.is_active = active
        catalog.created_at = created_at
        db.flush()
        item = InventoryItem(user_id=user.id, catalog_product_id=catalog.id, category_id=categories[category_index].id if category_index is not None else None, quantity=quantity, price=price, sale_price=price, image_url=catalog.image_url, is_catalog_backed=catalog.is_shared, version=1, custom_label=None if catalog.is_shared else name, note="TZ-010", low_stock_threshold=threshold, low_stock_alert=True, is_hidden=index == 14, created_at=catalog.created_at, updated_at=now)
        item.labels = [labels[i] for i in label_indexes]
        db.add(item); db.flush()
        db.add(SyncChange(
            user_id=user.id,
            entity="product",
            entity_id=item.id,
            operation="UPSERT",
            payload=json.dumps(InventoryOut.model_validate(item).model_dump(mode="json")),
        ))
        coverage[name] = ", ".join(filter(None, ["ناموجود" if quantity == 0 else "کم‌موجود" if quantity <= threshold else "موجود", "بدون قیمت" if price == 0 else "قیمت‌دار", "بدون تصویر" if catalog.image_url is None else "تصویردار", "امروز" if index < 5 else "قدیمی", "کاتالوگی" if catalog.is_shared else "شخصی", "پنهان" if item.is_hidden else ""]))
    return {
        "industry_id": industry.id,
        "products": len(specs),
        "categories": len(categories),
        "labels": len(labels),
        "coverage": coverage,
        "pending_operations": 0,
        "sync_baseline_changes": len(specs),
    }


def reset_demo(user_id: int, confirmation: str, snapshot_dir: Path) -> tuple[Path, dict[str, Any]]:
    _assert_safe(user_id, confirmation)
    with SessionLocal() as db:
        user = db.get(User, user_id)
        if user is None:
            raise RuntimeError("DEMO_TARGET_USER_NOT_FOUND")
        snapshot = _snapshot(db, user, snapshot_dir)
        try:
            _clear_business_state(db, user)
            manifest = _seed(db, user)
            db.commit()
        except Exception:
            db.rollback()
            raise
    manifest_path = snapshot.with_name(snapshot.stem + "-coverage.json")
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return snapshot, manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--user-id", type=int, required=True)
    parser.add_argument("--confirm", required=True)
    parser.add_argument("--snapshot-dir", type=Path, default=Path("backend/demo-snapshots"))
    args = parser.parse_args()
    snapshot, manifest = reset_demo(args.user_id, args.confirm, args.snapshot_dir)
    # ASCII-escaped JSON remains machine-readable on Windows consoles whose
    # legacy code page cannot encode every Persian character.
    print(json.dumps({"snapshot": str(snapshot), **manifest}, ensure_ascii=True))


if __name__ == "__main__":
    main()
